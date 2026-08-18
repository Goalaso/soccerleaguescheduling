const pool = require('../db/pool');
const { graphFetch, sendEmail } = require('./email');
const { resolveAvailability } = require('../controllers/seasons.controller');

const AUTO_SENDER_PATTERN = /noreply|no-reply|mailer-daemon/i;

// Matches the "[ref: SA-{seasonId}-{playerId}]" footer on every
// season-availability email (see seasons.controller.js's create()) —
// Microsoft Graph's sendMail doesn't hand back a message ID to track, so
// this embedded token is what lets a reply get matched back to the right
// season+player instead of tracking sent-message IDs separately.
const AVAILABILITY_TOKEN_PATTERN = /\[ref:\s*SA-(\d+)-(\d+)\]/i;
// Common casual variants, not just the literal words — anchored to the
// start of the line and \b-bounded so e.g. "y" doesn't accidentally match
// inside "yo", and matched against a curated list rather than attempting to
// parse arbitrary free text, which is far less reliable.
const YES_LINE = /^(yes|yeah|yep|yup|y|available)\b/i;
const NO_LINE = /^(no|nope|nah|n|unavailable|not available)\b/i;

function extractPlainText(message) {
  const raw = message.body?.content || message.bodyPreview || '';
  if (message.body?.contentType !== 'html') return raw;
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

// Only the sender's own new text should decide this, not whatever the
// original outbound email said when quoted back — so this stops reading at
// the first sign of a quoted block (a '>' line, or a "so-and-so wrote:"/
// "Original Message" marker), same as any normal reply-parsing convention.
function parseAvailabilityReply(text) {
  const tokenMatch = text.match(AVAILABILITY_TOKEN_PATTERN);
  if (!tokenMatch) return null;
  const seasonId = Number(tokenMatch[1]);
  const playerId = Number(tokenMatch[2]);

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('>') || /^on .* wrote:$/i.test(line) || /^-+\s*original message\s*-+$/i.test(line)) {
      break;
    }
    if (YES_LINE.test(line)) return { seasonId, playerId, isAvailable: true };
    if (NO_LINE.test(line)) return { seasonId, playerId, isAvailable: false };
  }
  return { seasonId, playerId, isAvailable: null };
}

async function handleAvailabilityReply(message, parsed) {
  const from = message.from?.emailAddress?.address;

  if (parsed.isAvailable === null) {
    if (from) {
      try {
        await sendEmail({
          to: from,
          subject: `Re: ${message.subject || 'Availability'}`,
          body: "Sorry, we couldn't tell from that reply — could you reply again with just the word YES or NO?",
        });
      } catch (err) {
        console.error('Failed to send availability clarification reply', err);
      }
    }
    return;
  }

  const { rows: playerRows } = await pool.query('SELECT user_id FROM players WHERE id = $1', [parsed.playerId]);
  const player = playerRows[0];
  if (!player) return;

  const row = await resolveAvailability(pool, parsed.seasonId, parsed.playerId, parsed.isAvailable, player.user_id);
  if (row && from) {
    try {
      await sendEmail({
        to: from,
        subject: `Re: ${message.subject || 'Availability'}`,
        body: `Got it — you're marked as ${parsed.isAvailable ? 'available' : 'not available'}. Thanks for letting us know!`,
      });
    } catch (err) {
      console.error('Failed to send availability confirmation reply', err);
    }
  }
}

// The whole point of this channel is that someone can just email in
// without ever touching the website (see project plan) — so none of these
// signals depend on the sender following any format. Outlook's own spam
// filter already keeps real spam out of Inbox entirely (this only ever
// polls Inbox, never Junk); this just catches machine-generated mail that
// isn't spam per se — calendar invites, bounces, autoreplies.
function looksAutomated(message) {
  const from = message.from?.emailAddress?.address || '';
  if (AUTO_SENDER_PATTERN.test(from)) return true;
  if (message.inferenceClassification === 'other') return true;

  const headers = message.internetMessageHeaders || [];
  const autoSubmitted = headers.find((h) => h.name.toLowerCase() === 'auto-submitted');
  if (autoSubmitted && autoSubmitted.value.toLowerCase() !== 'no') return true;

  return false;
}

async function hasOpenSeason() {
  const { rows } = await pool.query(`SELECT 1 FROM seasons WHERE status = 'collecting_availability' LIMIT 1`);
  return rows.length > 0;
}

// Runs on a schedule — see the EventBridge branch in lambda.js.
async function checkWaitlistInbox() {
  const data = await graphFetch(
    '/me/mailFolders/inbox/messages?$filter=isRead eq false&$select=id,subject,from,body,bodyPreview,inferenceClassification,internetMessageHeaders'
  );
  const messages = data.value || [];
  if (!messages.length) return { processed: 0 };

  // Which league a *new* signup meant isn't knowable from a plain email
  // anyway — that mapping stays a manual step during admin review, same as
  // approving any other waitlist entry. This only answers "is signup open
  // *anywhere* right now," which is what the auto-reply/flagging decision
  // needs.
  const seasonOpen = await hasOpenSeason();

  for (const message of messages) {
    // Checked first, before the junk filter or waitlist-signup path below —
    // this mailbox is also where every season-availability email is *sent
    // from* (see seasons.controller.js), so a reply to one of those lands
    // right back here and must never be mistaken for a new signup.
    const availabilityReply = parseAvailabilityReply(extractPlainText(message));
    if (availabilityReply) {
      await handleAvailabilityReply(message, availabilityReply);
    } else if (!looksAutomated(message)) {
      const from = message.from?.emailAddress?.address;
      if (from) {
        await pool.query(
          `INSERT INTO waitlist_entries (email, raw_subject, raw_snippet, season_open)
           VALUES ($1, $2, $3, $4)`,
          [from, message.subject || null, message.bodyPreview || null, seasonOpen]
        );

        // Never silently drop a real message — it's still logged above even
        // when nothing's open — but there's a live sender to tell, so also
        // let them know rather than leaving them wondering.
        if (!seasonOpen) {
          try {
            await sendEmail({
              to: from,
              subject: `Re: ${message.subject || 'Joining the waitlist'}`,
              body: "Thanks for reaching out — signups aren't open right now, but we've got your note and will follow up when the next season opens.",
            });
          } catch (err) {
            console.error('Failed to send waitlist auto-reply', err);
          }
        }
      }
    }

    // Marked read regardless of which branch handled it, so nothing here
    // gets re-evaluated on every future poll forever.
    await graphFetch(`/me/messages/${message.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    });
  }

  return { processed: messages.length };
}

module.exports = { checkWaitlistInbox };
