const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { signToken } = require('../utils/jwt');
const { validatePlayerProfile, normalizeLeagueIds } = require('../utils/validation');
const { resolveAvailability, sendAvailabilityOutcomeEmail, sendPromotionEmail } = require('./seasons.controller');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 2 * 60 * 60 * 1000,
};

// A team's captain isn't a separate role — it's a per-team designation
// (teams.captain_player_id) on top of role='player', so it's resolved
// fresh here rather than baked into the JWT at login time.
async function getCaptainOfTeamIds(userId) {
  const { rows } = await pool.query(
    `SELECT t.id FROM teams t JOIN players p ON p.id = t.captain_player_id WHERE p.user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.id);
}

async function publicUser(user) {
  // Fetched fresh rather than threading these through every SELECT at every
  // call site (register/login/me/updateMe all pass a partial user row here)
  // — one extra query, same shape as the captainOfTeamIds lookup right
  // below it. defaultTeamNames survives a localStorage wipe or a switch to
  // a different browser/device, unlike a client-only preference — it's
  // useful for any admin creating a season, but harmless to fetch/ignore
  // for a player account too, so it's not worth branching on role here.
  const [{ rows: prefRows }, captainOfTeamIds] = await Promise.all([
    pool.query('SELECT email_notifications_enabled, default_team_names FROM users WHERE id = $1', [user.id]),
    getCaptainOfTeamIds(user.id),
  ]);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailNotificationsEnabled: prefRows[0]?.email_notifications_enabled ?? true,
    defaultTeamNames: prefRows[0]?.default_team_names || [],
    captainOfTeamIds,
  };
}

async function register(req, res, next) {
  const { email, password, name, position, skill, age, leagueIds, joinSeasonLeagueIds } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }
  const profileError = validatePlayerProfile({ position, skill, age });
  if (profileError) {
    return res.status(400).json({ error: profileError });
  }

  const client = await pool.connect();
  const availabilityResults = [];
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const lowerEmail = email.toLowerCase();

    await client.query('BEGIN');

    const { leagueIds: normalizedLeagueIds, error: leaguesError } = await normalizeLeagueIds(
      client,
      leagueIds
    );
    if (leaguesError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: leaguesError });
    }

    const { rows: existingPlayerRows } = await client.query(
      'SELECT id, user_id FROM players WHERE lower(email) = $1 FOR UPDATE',
      [lowerEmail]
    );
    const existingPlayer = existingPlayerRows[0];

    if (existingPlayer && existingPlayer.user_id) {
      // Already claimed by a real account (not just an admin-added
      // placeholder) — this is a genuine "already registered" case, not a
      // duplicate-roster-entry case. Fail clearly here instead of letting
      // the users.email unique constraint reject it with a generic error.
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account already exists for this email. Try logging in instead.' });
    }

    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, 'player')
       RETURNING id, email, name, role`,
      [lowerEmail, passwordHash, name]
    );
    const user = userRows[0];

    if (existingPlayer) {
      // A player row already exists for this email (an admin added them
      // without an account) — link this new login to it instead of
      // creating a duplicate roster entry. The admin's existing
      // position/skill/age/leagues are left untouched.
      await client.query('UPDATE players SET user_id = $1 WHERE id = $2', [
        user.id,
        existingPlayer.id,
      ]);
    } else {
      const { rows: playerRows } = await client.query(
        `INSERT INTO players (user_id, name, position, skill, age, email, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $1)
         RETURNING id`,
        [user.id, name, position, skill, age, lowerEmail]
      );
      const playerId = playerRows[0].id;
      const joinSet = new Set((joinSeasonLeagueIds || []).map(Number));

      for (const leagueId of normalizedLeagueIds) {
        await client.query(
          'INSERT INTO player_leagues (player_id, league_id) VALUES ($1, $2)',
          [playerId, leagueId]
        );

        // Visible opt-in, not silent auto-add: player_leagues membership is
        // immediate regardless, but season_availability only gets seeded
        // once, at season-creation time — without this, signing up mid-season
        // would otherwise mean waiting for the *next* season to be eligible
        // for anything, even for someone who did everything right. Goes
        // through resolveAvailability (respectCapacity+allowCreate) rather
        // than a plain seed, so a fresh signup can't bypass the same FCFS
        // queue an existing player responding to an ask has to go through.
        if (joinSet.has(leagueId)) {
          const { rows: openSeasonRows } = await client.query(
            `SELECT id FROM seasons WHERE league_id = $1 AND status = 'collecting_availability'`,
            [leagueId]
          );
          if (openSeasonRows[0]) {
            const result = await resolveAvailability(client, openSeasonRows[0].id, playerId, true, user.id, {
              respectCapacity: true,
              allowCreate: true,
            });
            if (result) availabilityResults.push(result);
          }
        }
      }
    }

    await client.query('COMMIT');

    // Best-effort, after commit — a slow/failed Outlook call must never
    // fail registration, which has already succeeded by this point.
    try {
      for (const result of availabilityResults) {
        await sendAvailabilityOutcomeEmail(result);
        await sendPromotionEmail(result);
      }
    } catch (err) {
      console.error('Failed to send season availability outcome emails', err);
    }

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user: await publicUser(user) });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: await publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// Passwordless admin login for giving people a quick look at the app
// without handing out real credentials. No auth check by design — do not
// keep this around once the app has real, non-dummy data in it.
async function devLoginAsAdmin(req, res, next) {
  try {
    const { rows } = await pool.query(
      "SELECT id, email, name, role FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'No admin account exists' });
    }

    const token = signToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: await publicUser(user) });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  res.status(204).end();
}

async function me(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT id, email, name, role FROM users WHERE id = $1', [req.user.sub]);
    if (!rows[0]) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user: await publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
}

// Account credential changes (email/password), separate from player
// profile fields — requires the current password so a hijacked session
// can't silently lock the real owner out by changing credentials.
async function updateMe(req, res, next) {
  try {
    const { email, password, currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'currentPassword is required' });
    }
    if (!email && !password) {
      return res.status(400).json({ error: 'Provide a new email and/or password' });
    }
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const lowerEmail = email ? email.toLowerCase() : null;
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const { rows: updatedRows } = await pool.query(
      `UPDATE users SET
         email = COALESCE($1, email),
         password_hash = COALESCE($2, password_hash),
         updated_at = now()
       WHERE id = $3
       RETURNING id, email, name, role`,
      [lowerEmail, passwordHash, req.user.sub]
    );
    const updatedUser = updatedRows[0];

    if (lowerEmail) {
      // Keep the linked player record's email in sync, if one exists.
      await pool.query('UPDATE players SET email = $1 WHERE user_id = $2', [lowerEmail, req.user.sub]);
    }

    const token = signToken(updatedUser);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: await publicUser(updatedUser) });
  } catch (err) {
    next(err);
  }
}

// Not a credential change (unlike updateMe above), so no currentPassword
// friction — just preference toggles. Each field is independently
// optional (COALESCE-style) rather than requiring the full set on every
// call, since AccountSettingsPanel and CreateSeasonView's "Save as
// Default" button each only ever send the one field they own.
async function updatePreferences(req, res, next) {
  const { emailNotificationsEnabled, defaultTeamNames } = req.body;
  if (emailNotificationsEnabled === undefined && defaultTeamNames === undefined) {
    return res.status(400).json({ error: 'Provide emailNotificationsEnabled and/or defaultTeamNames' });
  }
  if (emailNotificationsEnabled !== undefined && typeof emailNotificationsEnabled !== 'boolean') {
    return res.status(400).json({ error: 'emailNotificationsEnabled must be a boolean' });
  }
  if (defaultTeamNames !== undefined && !Array.isArray(defaultTeamNames)) {
    return res.status(400).json({ error: 'defaultTeamNames must be an array of strings' });
  }

  const cleanedTeamNames = defaultTeamNames
    ? defaultTeamNames.map((n) => (typeof n === 'string' ? n.trim() : '')).filter(Boolean)
    : undefined;

  try {
    await pool.query(
      `UPDATE users SET
         email_notifications_enabled = COALESCE($1, email_notifications_enabled),
         default_team_names = COALESCE($2, default_team_names)
       WHERE id = $3`,
      [emailNotificationsEnabled ?? null, cleanedTeamNames ?? null, req.user.sub]
    );
    res.json({
      emailNotificationsEnabled,
      defaultTeamNames: cleanedTeamNames,
    });
  } catch (err) {
    next(err);
  }
}

// Self-service account deletion, players only — an admin deleting their own
// account would leave devLoginAsAdmin (which grabs "the first admin row")
// with nothing to find and no recovery path short of reseeding the DB.
// players.user_id/created_by, matches.recorded_by, season_availability.marked_by,
// and seasons.created_by are all ON DELETE SET NULL, so this only removes
// login access — the player's roster entry, stats, and match history stay.
async function deleteMe(req, res, next) {
  const { currentPassword } = req.body;
  if (!currentPassword) {
    return res.status(400).json({ error: 'currentPassword is required' });
  }
  if (req.user.role !== 'player') {
    return res.status(403).json({ error: 'Admin accounts cannot be self-deleted' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [req.user.sub]);
    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, me, updateMe, updatePreferences, deleteMe, devLoginAsAdmin };
