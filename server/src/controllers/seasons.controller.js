const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { sendEmail, getAccessToken, EMAIL_NOTIFIED_TYPES } = require('../services/email');

function toApiShape(row) {
  return {
    id: row.id,
    leagueId: row.league_id,
    leagueName: row.league_name,
    status: row.status,
    name: row.name,
    startsOn: row.starts_on,
    numTeams: row.num_teams,
    playersPerTeam: row.players_per_team,
    teamNames: row.team_names || [],
    balanceBySkill: row.balance_by_skill,
    balanceByAge: row.balance_by_age,
    balanceByPosition: row.balance_by_position,
    createdAt: row.created_at,
  };
}

async function list(req, res, next) {
  try {
    const { leagueId } = req.query;
    const params = [];
    let where = '';
    if (leagueId) {
      params.push(leagueId);
      where = 'WHERE s.league_id = $1';
    }
    const { rows } = await pool.query(
      `SELECT s.*, l.name AS league_name
       FROM seasons s
       JOIN leagues l ON l.id = s.league_id
       ${where}
       ORDER BY s.id DESC`,
      params
    );
    res.json(rows.map(toApiShape));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, l.name AS league_name FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Season not found' });
    res.json(toApiShape(rows[0]));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  const {
    leagueId,
    numTeams: requestedNumTeams,
    playersPerTeam,
    balanceBySkill,
    balanceByAge,
    balanceByPosition,
    name,
    startsOn,
    teamNames: rawTeamNames,
  } = req.body;

  // Trimmed/filtered server-side too, not just trusting the frontend — and
  // numTeams is derived from however many names actually survive that,
  // rather than trusting a separately-sent count that could disagree with it.
  const teamNames = Array.isArray(rawTeamNames)
    ? rawTeamNames.map((n) => (typeof n === 'string' ? n.trim() : '')).filter(Boolean)
    : [];
  const numTeams = teamNames.length || requestedNumTeams;

  if (!leagueId || !numTeams || !playersPerTeam) {
    return res.status(400).json({ error: 'leagueId, team names (or numTeams), and playersPerTeam are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: leagueRows } = await client.query('SELECT id, name FROM leagues WHERE id = $1', [
      leagueId,
    ]);
    if (!leagueRows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid leagueId' });
    }
    const leagueName = leagueRows[0].name;

    const { rows: seasonRows } = await client.query(
      `INSERT INTO seasons
         (league_id, num_teams, players_per_team, balance_by_skill, balance_by_age, balance_by_position, name, starts_on, created_by, team_names)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        leagueId,
        numTeams,
        playersPerTeam,
        !!balanceBySkill,
        !!balanceByAge,
        !!balanceByPosition,
        name || null,
        startsOn || null,
        req.user.sub,
        teamNames.length ? teamNames : null,
      ]
    );
    const seasonId = seasonRows[0].id;

    // Seed one availability row per player currently in this league — this
    // is the "ask" from the user's flow.
    await client.query(
      `INSERT INTO season_availability (season_id, player_id)
       SELECT $1, pl.player_id FROM player_leagues pl WHERE pl.league_id = $2`,
      [seasonId, leagueId]
    );

    // Notify each of those players (only ones with a real login account —
    // notifications.user_id has no meaning for an admin-added player with
    // no account yet).
    const seasonLabel = name || `a new ${leagueName} season`;
    await client.query(
      `INSERT INTO notifications (user_id, type, message, related_season_id)
       SELECT p.user_id, 'season_availability_request', $2, $1
       FROM season_availability sa
       JOIN players p ON p.id = sa.player_id
       WHERE sa.season_id = $1 AND p.user_id IS NOT NULL`,
      [seasonId, `Are you available to play in ${seasonLabel} (${leagueName})?`]
    );

    await client.query('COMMIT');

    // Best-effort, after commit — a slow or failed Outlook call must never
    // fail season creation, which has already succeeded by this point.
    if (EMAIL_NOTIFIED_TYPES.includes('season_availability_request')) {
      try {
        // Two groups get this, not just players with logins: (1) players
        // with an account who haven't opted out, and (2) players with NO
        // login at all (admin-added, or someone who just prefers to run
        // everything through email) — for those, players.email is the only
        // contact info that exists, and there's no settings screen for them
        // to opt out from, so they always get it. The [ref: ...] token lets
        // the waitlist poller match a reply back to this exact
        // season+player without needing to track sent-message IDs.
        const { rows: recipients } = await pool.query(
          `SELECT p.id AS player_id, COALESCE(u.email, p.email) AS email
           FROM season_availability sa
           JOIN players p ON p.id = sa.player_id
           LEFT JOIN users u ON u.id = p.user_id
           WHERE sa.season_id = $1
             AND (u.id IS NULL OR u.email_notifications_enabled = true)
             AND COALESCE(u.email, p.email) IS NOT NULL`,
          [seasonId]
        );
        // Warmed once, sequentially, before the parallel batch below —
        // getAccessToken() caches its result, but with no warm-up every one
        // of these concurrent sendEmail calls could see an expired/missing
        // cached token at the same instant and race to refresh it
        // simultaneously, all using the same refresh token. Microsoft only
        // honors one such concurrent exchange; the rest would fail. Calling
        // it once here first means every send below just reuses the
        // already-valid cached token instead of racing for it.
        await getAccessToken();

        // allSettled never rejects, even if every single send fails — it
        // has to be inspected explicitly, or a real per-recipient failure
        // (bad token, Graph error, etc.) disappears with zero logging and
        // looks indistinguishable from a successful, silent send.
        const results = await Promise.allSettled(
          recipients.map((r) =>
            sendEmail({
              to: r.email,
              subject: `Are you available for ${seasonLabel}?`,
              body: `Are you available to play in ${seasonLabel} (${leagueName})?\n\nReply to this email with just the word YES or NO to let us know — or log in to the app to respond there instead.\n\n[ref: SA-${seasonId}-${r.player_id}]`,
            })
          )
        );
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`Failed to send season availability email to ${recipients[i].email}`, r.reason);
          }
        });
      } catch (err) {
        console.error('Failed to send season availability emails', err);
      }
    }

    const { rows } = await pool.query(
      `SELECT s.*, l.name AS league_name FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE s.id = $1`,
      [seasonId]
    );
    res.status(201).json(toApiShape(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This league already has a season collecting availability' });
    }
    next(err);
  } finally {
    client.release();
  }
}

async function getAvailability(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT sa.player_id, sa.is_available, sa.waitlisted, sa.responded_at,
              p.name, p.position, p.skill, p.age, p.phone, p.has_app
       FROM season_availability sa
       JOIN players p ON p.id = sa.player_id
       WHERE sa.season_id = $1
       ORDER BY p.name ASC`,
      [req.params.id]
    );
    res.json(
      rows.map((r) => ({
        playerId: r.player_id,
        name: r.name,
        position: r.position,
        skill: r.skill,
        age: r.age,
        hasPhone: !!r.phone,
        hasApp: r.has_app,
        isAvailable: r.is_available,
        waitlisted: r.waitlisted,
        respondedAt: r.responded_at,
      }))
    );
  } catch (err) {
    next(err);
  }
}

// Shared by the admin override, the player's own in-app toggle, an email
// reply (server/src/services/waitlistPoll.js), and a brand-new registrant
// opting into an already-open season (auth.controller.js's register()) —
// four entry points that all need to resolve the same way.
//
// respectCapacity distinguishes admin (false — can always force a spot,
// same as before this existed) from every self-service path (true — capped
// at num_teams * players_per_team, overflow goes to a waitlist ordered by
// responded_at). allowCreate is only true for register(): a brand-new
// signup has no pre-existing row the way everyone seeded at season
// creation does, so this needs to upsert rather than require one.
//
// Locks the season row for the duration (same pattern teams.controller.js's
// publish() already uses) so two near-simultaneous "yes" responses for the
// last open spot can't both succeed, and a decline's promotion can't race a
// fresh claim for the same freed spot. That lock only actually holds across
// the whole check-then-write sequence inside a real transaction — a bare
// pool.query() per statement auto-commits (and releases the lock) after
// each individual call, which defeats it entirely. So this function always
// runs as one transaction: on the shared pool, it opens/commits its own; if
// it's handed a client already inside a transaction (register()'s, which
// this needs to be part of — see below), it just participates in that one.
async function resolveAvailability(db, seasonId, playerId, isAvailable, markedBy, opts = {}) {
  if (db !== pool) {
    // Already inside the caller's own transaction — don't open/close a
    // second one, just run the same logic against that client.
    return resolveAvailabilityTx(db, seasonId, playerId, isAvailable, markedBy, opts);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await resolveAvailabilityTx(client, seasonId, playerId, isAvailable, markedBy, opts);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function resolveAvailabilityTx(
  db,
  seasonId,
  playerId,
  isAvailable,
  markedBy,
  { respectCapacity = false, allowCreate = false } = {}
) {
  const { rows: seasonRows } = await db.query(
    `SELECT s.*, l.name AS league_name FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE s.id = $1 FOR UPDATE`,
    [seasonId]
  );
  const season = seasonRows[0];
  if (!season) return null;
  const seasonLabel = season.name || `this ${season.league_name} season`;

  const { rows: existingRows } = await db.query(
    'SELECT is_available FROM season_availability WHERE season_id = $1 AND player_id = $2',
    [seasonId, playerId]
  );
  const existing = existingRows[0];
  if (!existing && !allowCreate) return null;
  const wasConfirmed = existing?.is_available === true;

  let newIsAvailable;
  let newWaitlisted = false;
  let outcome;

  if (isAvailable === false) {
    newIsAvailable = false;
    outcome = 'declined';
  } else if (!respectCapacity) {
    newIsAvailable = true;
    outcome = 'confirmed';
  } else {
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*)::int AS c FROM season_availability WHERE season_id = $1 AND is_available = true`,
      [seasonId]
    );
    const capacity = season.num_teams * season.players_per_team;
    if (countRows[0].c < capacity) {
      newIsAvailable = true;
      outcome = 'confirmed';
    } else {
      newIsAvailable = false;
      newWaitlisted = true;
      outcome = 'waitlisted';
    }
  }

  const { rows } = await db.query(
    `INSERT INTO season_availability (season_id, player_id, is_available, waitlisted, responded_at, marked_by)
     VALUES ($1, $2, $3, $4, now(), $5)
     ON CONFLICT (season_id, player_id) DO UPDATE
       SET is_available = $3, waitlisted = $4, responded_at = now(), marked_by = $5
     RETURNING player_id, is_available, waitlisted, responded_at`,
    [seasonId, playerId, newIsAvailable, newWaitlisted, markedBy]
  );
  const row = rows[0];

  let waitlistPosition = null;
  if (outcome === 'waitlisted') {
    const { rows: posRows } = await db.query(
      `SELECT COUNT(*)::int + 1 AS position FROM season_availability
       WHERE season_id = $1 AND waitlisted = true AND responded_at < $2`,
      [seasonId, row.responded_at]
    );
    waitlistPosition = posRows[0].position;
  }

  // A confirmed spot just freed up (declined, or an admin removed someone
  // who had one) — promote whoever's been waiting longest into it. Covered
  // by the same season-row lock, so this can't double-promote into a spot
  // a concurrent new "yes" is also trying to claim.
  let promotedPlayerId = null;
  if (wasConfirmed && newIsAvailable !== true) {
    const { rows: promotedRows } = await db.query(
      `UPDATE season_availability SET is_available = true, waitlisted = false
       WHERE season_id = $1 AND player_id = (
         SELECT player_id FROM season_availability
         WHERE season_id = $1 AND waitlisted = true
         ORDER BY responded_at ASC LIMIT 1
       )
       RETURNING player_id`,
      [seasonId]
    );
    promotedPlayerId = promotedRows[0]?.player_id || null;
  }

  // Resolve the pending ask, same as before — actionable notifications only
  // ever resolve by deletion, never by marking read, so they stay unread
  // (and visible on the homepage) for as long as they're actually pending.
  await db.query(
    `DELETE FROM notifications n
     USING players p
     WHERE p.id = $1 AND n.user_id = p.user_id
       AND n.type = 'season_availability_request' AND n.related_season_id = $2`,
    [playerId, seasonId]
  );

  // Informational follow-up notifications — not actionable, so no dedup
  // concern beyond "don't leave a stale message behind" if someone responds
  // more than once for the same season.
  if (outcome === 'confirmed' || outcome === 'waitlisted') {
    const message =
      outcome === 'confirmed'
        ? `You're confirmed for ${seasonLabel}!`
        : `Season is full — you're #${waitlistPosition} on the waitlist for ${seasonLabel}. We'll email you if a spot opens.`;
    await db.query(
      `INSERT INTO notifications (user_id, type, message, related_season_id)
       SELECT p.user_id, $1, $2, $3 FROM players p WHERE p.id = $4 AND p.user_id IS NOT NULL
       ON CONFLICT (user_id, type, related_season_id) WHERE related_season_id IS NOT NULL DO UPDATE
         SET message = EXCLUDED.message, is_read = false, created_at = now()`,
      [outcome === 'confirmed' ? 'season_confirmed' : 'season_waitlisted', message, seasonId, playerId]
    );
  }
  if (promotedPlayerId) {
    await db.query(
      `INSERT INTO notifications (user_id, type, message, related_season_id)
       SELECT p.user_id, 'season_confirmed', $1, $2 FROM players p WHERE p.id = $3 AND p.user_id IS NOT NULL
       ON CONFLICT (user_id, type, related_season_id) WHERE related_season_id IS NOT NULL DO UPDATE
         SET message = EXCLUDED.message, is_read = false, created_at = now()`,
      [`A spot opened up — you're confirmed for ${seasonLabel}!`, seasonId, promotedPlayerId]
    );
  }

  // Resolved emails for whoever needs one below — never just a bare user_id,
  // since a player with no login account still has players.email.
  const { rows: emailRows } = await db.query(
    `SELECT p.id AS player_id, COALESCE(u.email, p.email) AS email
     FROM players p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = ANY($1::int[]) AND (u.id IS NULL OR u.email_notifications_enabled = true)`,
    [[playerId, promotedPlayerId].filter(Boolean)]
  );
  const emailByPlayer = Object.fromEntries(emailRows.map((r) => [r.player_id, r.email]));

  return {
    playerId: row.player_id,
    isAvailable: row.is_available,
    waitlisted: row.waitlisted,
    respondedAt: row.responded_at,
    outcome,
    waitlistPosition,
    seasonLabel,
    email: emailByPlayer[playerId] || null,
    promotedPlayerId,
    promotedEmail: promotedPlayerId ? emailByPlayer[promotedPlayerId] || null : null,
  };
}

// Split so a caller (waitlistPoll.js) that's already sending its own
// outcome-aware reply to the person who just responded can skip the
// duplicate "you're confirmed" email for themselves while still notifying
// anyone who got auto-promoted as a side effect.
async function sendAvailabilityOutcomeEmail(result) {
  if (!result || !result.email) return;
  if (result.outcome === 'confirmed' && EMAIL_NOTIFIED_TYPES.includes('season_confirmed')) {
    await sendEmail({
      to: result.email,
      subject: `You're confirmed for ${result.seasonLabel}!`,
      body: `You're confirmed for ${result.seasonLabel}. See you on the field!`,
    });
  } else if (result.outcome === 'waitlisted' && EMAIL_NOTIFIED_TYPES.includes('season_waitlisted')) {
    await sendEmail({
      to: result.email,
      subject: `You're on the waitlist for ${result.seasonLabel}`,
      body: `Season is full — you're #${result.waitlistPosition} on the waitlist for ${result.seasonLabel}. We'll email you if a spot opens.`,
    });
  }
}

async function sendPromotionEmail(result) {
  if (!result || !result.promotedPlayerId || !result.promotedEmail) return;
  if (!EMAIL_NOTIFIED_TYPES.includes('season_confirmed')) return;
  await sendEmail({
    to: result.promotedEmail,
    subject: `You're confirmed for ${result.seasonLabel}!`,
    body: `A spot opened up — you're confirmed for ${result.seasonLabel}. See you on the field!`,
  });
}

async function setAvailability(req, res, next) {
  const { isAvailable } = req.body;
  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({ error: 'isAvailable must be a boolean' });
  }
  try {
    const result = await resolveAvailability(pool, req.params.id, req.params.playerId, isAvailable, req.user.sub);
    if (!result) {
      return res.status(404).json({ error: "Player is not part of this season's availability list" });
    }
    // Best-effort — a slow/failed Outlook call must never fail the admin
    // action itself, which has already succeeded by this point.
    try {
      await sendAvailabilityOutcomeEmail(result);
      await sendPromotionEmail(result);
    } catch (err) {
      console.error('Failed to send season availability outcome emails', err);
    }
    res.json({ playerId: result.playerId, isAvailable: result.isAvailable, respondedAt: result.respondedAt });
  } catch (err) {
    next(err);
  }
}

async function setMyAvailability(req, res, next) {
  const { isAvailable } = req.body;
  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({ error: 'isAvailable must be a boolean' });
  }
  try {
    const { rows: playerRows } = await pool.query('SELECT id FROM players WHERE user_id = $1', [req.user.sub]);
    if (!playerRows[0]) {
      return res.status(404).json({ error: 'No player profile linked to this account' });
    }
    const result = await resolveAvailability(pool, req.params.id, playerRows[0].id, isAvailable, req.user.sub, {
      respectCapacity: true,
    });
    if (!result) {
      return res.status(404).json({ error: "You are not part of this season's availability list" });
    }
    try {
      await sendAvailabilityOutcomeEmail(result);
      await sendPromotionEmail(result);
    } catch (err) {
      console.error('Failed to send season availability outcome emails', err);
    }
    res.json({
      playerId: result.playerId,
      isAvailable: result.isAvailable,
      waitlisted: result.waitlisted,
      waitlistPosition: result.waitlistPosition,
      respondedAt: result.respondedAt,
    });
  } catch (err) {
    next(err);
  }
}

// Adds one player to an already-started season's availability pool —
// distinct from the bulk seeding in create() above, which only ever runs
// once, at season creation, from whoever was in the league at that moment.
// A player who joins the league (or gets approved off the waitlist) after
// that point has no row and is invisible to the roster editor's sub-pool
// dropdown until this runs. No team assignment happens here — that's still
// a separate, explicit step (team generation, or addSeasonPlayer/roster
// editor, depending on whether teams already exist for this season).
// Deliberately bypasses capacity — this is always an explicit admin action
// (addAvailability below), same reasoning as setAvailability's admin
// override: the admin can always force a spot. Self-service paths that
// need the FCFS/waitlist behavior go through resolveAvailability instead
// (see register()'s season opt-in in auth.controller.js).
async function seedAvailability(db, seasonId, playerId, markedBy) {
  const { rows } = await db.query(
    `INSERT INTO season_availability (season_id, player_id, is_available, responded_at, marked_by)
     VALUES ($1, $2, true, now(), $3)
     ON CONFLICT (season_id, player_id) DO UPDATE
       SET is_available = true, responded_at = now(), marked_by = $3
     RETURNING player_id, is_available`,
    [seasonId, playerId, markedBy]
  );
  return rows[0];
}

async function addAvailability(req, res, next) {
  const { playerId } = req.body;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  try {
    const row = await seedAvailability(pool, req.params.id, playerId, req.user.sub);
    res.status(201).json({ playerId: row.player_id, isAvailable: row.is_available });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid season or player' });
    }
    next(err);
  }
}

// Deletes cascade through teams/matches/match_goals/team_players/
// season_availability/notifications (all declared ON DELETE CASCADE on
// seasons(id)) — a single DELETE is all that's needed.
async function remove(req, res, next) {
  const { currentPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ error: 'currentPassword is required' });
  }
  try {
    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    const user = userRows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const { rowCount } = await pool.query('DELETE FROM seasons WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Season not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getOne,
  create,
  getAvailability,
  setAvailability,
  setMyAvailability,
  resolveAvailability,
  sendAvailabilityOutcomeEmail,
  sendPromotionEmail,
  addAvailability,
  seedAvailability,
  remove,
};
