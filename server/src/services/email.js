const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const ssmClient = new SSMClient({});

// Cached for the lifetime of a warm Lambda container — same pattern as
// server/src/lambda.js's handlerPromise, avoids a token refresh (and the
// resulting secret rewrite) on every single Graph call.
let cachedAccessToken = null; // { token, expiresAt }

async function readSecret() {
  const result = await ssmClient.send(
    new GetParameterCommand({ Name: process.env.OUTLOOK_SECRET_PARAM, WithDecryption: true })
  );
  return JSON.parse(result.Parameter.Value);
}

// Microsoft rotates the refresh token on every use — the old one stops
// working once a new one is issued, so it has to be written back here or
// the *next* refresh fails. This is why the Lambda role needs
// ssm:PutParameter on this one parameter, unlike the read-only
// database/JWT parameters (see infra/lib/infra-stack.ts).
async function writeSecret(secret) {
  await ssmClient.send(
    new PutParameterCommand({
      Name: process.env.OUTLOOK_SECRET_PARAM,
      Value: JSON.stringify(secret),
      Type: 'SecureString',
      Overwrite: true,
    })
  );
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now) {
    return cachedAccessToken.token;
  }

  const secret = await readSecret();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: secret.refresh_token,
    client_id: secret.client_id,
    client_secret: secret.client_secret,
    // Mail.ReadWrite, not just Mail.Read — marking a processed message as
    // read (see waitlistPoll.js) is a write operation Mail.Read alone
    // doesn't cover, which is a real 403 we hit during testing.
    scope: 'offline_access Mail.ReadWrite Mail.Send',
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Outlook token refresh failed: ${data.error_description || data.error || res.status}`);
  }

  await writeSecret({ ...secret, refresh_token: data.refresh_token });

  // Refresh a minute early so a call right at the boundary doesn't race a
  // token that's about to expire mid-request.
  cachedAccessToken = { token: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
  return cachedAccessToken.token;
}

async function graphFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  // sendMail returns 202 with an empty body on success (not 204), and
  // PATCH-ing a message read also returns no body — text-first avoids
  // res.json() throwing on an empty response for either of those.
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Graph API ${options.method || 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function sendEmail({ to, subject, body }) {
  await graphFetch('/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A bulk send (e.g. "are you available" to a whole season roster) firing
// every recipient at once is what triggered Graph's ApplicationThrottled /
// MailboxConcurrency 429s at ~40 recipients in testing. Sending in small
// batches with a pause between them keeps concurrency low. Callers must stay
// mindful this runs on the request's critical path (awaited before the HTTP
// response) and HttpApi has a hard, non-configurable 30s integration
// timeout — these constants are tuned to stay well under that for
// realistic recipient counts; a truly unbounded recipient list would need
// sending moved off the request path entirely (e.g. a queue), not just
// batched.
async function sendEmailBatch(messages) {
  const results = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map((m) => sendEmail(m)));
    results.push(...batchResults);
    if (i + BATCH_SIZE < messages.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  return results;
}

// Notification types that also go out by email, for recipients who've opted
// in. Starts with just the one case where missing it in-app — because you
// didn't happen to open the app — has a real cost: a missed availability
// deadline. Adding a future type is a one-line addition here, same pattern
// as ACTIONABLE_NOTIFICATION_TYPES on the frontend.
const EMAIL_NOTIFIED_TYPES = [
  'season_availability_request',
  'season_confirmed',
  'season_waitlisted',
  'match_roster_assigned',
  'match_roster_removed',
  'team_roster_changed',
];

module.exports = { getAccessToken, sendEmail, sendEmailBatch, graphFetch, EMAIL_NOTIFIED_TYPES };
