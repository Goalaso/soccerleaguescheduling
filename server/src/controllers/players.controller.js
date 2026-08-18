const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { validatePlayerProfile, normalizeLeagueIds } = require('../utils/validation');

const LEAGUES_JOIN = `
  LEFT JOIN player_leagues pl ON pl.player_id = p.id
  LEFT JOIN leagues l ON l.id = pl.league_id
`;
const LEAGUES_AGG = `
  json_agg(json_build_object('id', l.id, 'name', l.name)) FILTER (WHERE l.id IS NOT NULL) AS leagues
`;

function toApiShape(row) {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    skill: row.skill,
    age: row.age,
    email: row.email,
    phone: row.phone,
    gender: row.gender,
    yearsExperience: row.years_experience,
    hasPhone: !!row.phone,
    hasApp: row.has_app,
    leagues: row.leagues || [],
  };
}

async function fetchPlayerById(id) {
  const { rows } = await pool.query(
    `SELECT p.*, ${LEAGUES_AGG} FROM players p ${LEAGUES_JOIN} WHERE p.id = $1 GROUP BY p.id`,
    [id]
  );
  return rows[0] || null;
}

// Shared update logic used by both the admin PATCH /:id route and the
// self-service PATCH /me route — only the caller differs in how it looks
// up which player row to target.
async function applyPlayerUpdate(client, playerId, body) {
  const { name, position, skill, age, email, phone, gender, yearsExperience, leagueIds } = body;

  let normalizedLeagueIds = null;
  if (leagueIds !== undefined) {
    const result = await normalizeLeagueIds(client, leagueIds);
    if (result.error) return { error: result.error };
    normalizedLeagueIds = result.leagueIds;
  }

  const { rows } = await client.query(
    `UPDATE players SET
       name = COALESCE($1, name),
       position = COALESCE($2, position),
       skill = COALESCE($3, skill),
       age = COALESCE($4, age),
       email = COALESCE($5, email),
       phone = COALESCE($6, phone),
       gender = COALESCE($7, gender),
       years_experience = COALESCE($8, years_experience),
       updated_at = now()
     WHERE id = $9
     RETURNING *`,
    [name, position, skill, age, email ? email.toLowerCase() : null, phone, gender, yearsExperience, playerId]
  );
  const player = rows[0];
  if (!player) return { error: 'not_found' };

  if (normalizedLeagueIds) {
    await client.query('DELETE FROM player_leagues WHERE player_id = $1', [player.id]);
    for (const leagueId of normalizedLeagueIds) {
      await client.query(
        'INSERT INTO player_leagues (player_id, league_id) VALUES ($1, $2)',
        [player.id, leagueId]
      );
    }
  }

  return { player };
}

async function list(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, ${LEAGUES_AGG} FROM players p ${LEAGUES_JOIN} GROUP BY p.id ORDER BY p.id ASC`
    );
    res.json(rows.map(toApiShape));
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const player = await fetchPlayerById(req.params.id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(toApiShape(player));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  const {
    name,
    position,
    skill,
    age,
    email,
    phone = null,
    gender = null,
    yearsExperience = null,
    leagueIds,
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  const profileError = validatePlayerProfile({ position, skill, age });
  if (profileError) {
    return res.status(400).json({ error: profileError });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Unlike self-registration (which links to an existing admin-added
    // player instead of duplicating), this form has no such check today —
    // an admin adding someone who (unknown to them) already has a player
    // row would otherwise silently create a second record with the same
    // email. Surface it instead of guessing what the admin meant.
    const { rows: existingRows } = await client.query('SELECT id, name FROM players WHERE lower(email) = $1', [
      email.toLowerCase(),
    ]);
    if (existingRows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `A player named "${existingRows[0].name}" already exists with this email.`,
        existingPlayerId: existingRows[0].id,
      });
    }

    const { leagueIds: normalizedLeagueIds, error: leaguesError } = await normalizeLeagueIds(
      client,
      leagueIds
    );
    if (leaguesError) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: leaguesError });
    }

    const { rows } = await client.query(
      `INSERT INTO players
         (name, position, skill, age, email, phone, gender, years_experience, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, position, skill, age, email.toLowerCase(), phone, gender, yearsExperience, req.user.sub]
    );
    const player = rows[0];

    for (const leagueId of normalizedLeagueIds) {
      await client.query(
        'INSERT INTO player_leagues (player_id, league_id) VALUES ($1, $2)',
        [player.id, leagueId]
      );
    }

    await client.query('COMMIT');

    const { rows: leagueRows } = await pool.query('SELECT id, name FROM leagues WHERE id = ANY($1::int[])', [
      normalizedLeagueIds,
    ]);
    res.status(201).json(toApiShape({ ...player, leagues: leagueRows }));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function update(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await applyPlayerUpdate(client, req.params.id, req.body);

    if (result.error === 'not_found') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }
    if (result.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: result.error });
    }

    await client.query('COMMIT');
    const fresh = await fetchPlayerById(result.player.id);
    res.json(toApiShape(fresh));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// Requires the acting admin's own password, same re-auth shape as
// auth.controller.js's updateMe — this is an admin action, so it's the
// admin's password being checked, not the player being deleted.
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

    const { rowCount } = await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Player not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Self-service: the player linked to the logged-in account, regardless of role.
async function getMe(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, ${LEAGUES_AGG} FROM players p ${LEAGUES_JOIN} WHERE p.user_id = $1 GROUP BY p.id`,
      [req.user.sub]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'No player profile linked to this account' });
    }
    res.json(toApiShape(rows[0]));
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existingRows } = await client.query('SELECT id FROM players WHERE user_id = $1', [
      req.user.sub,
    ]);
    if (!existingRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No player profile linked to this account' });
    }

    const result = await applyPlayerUpdate(client, existingRows[0].id, req.body);
    if (result.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: result.error });
    }

    await client.query('COMMIT');
    const fresh = await fetchPlayerById(result.player.id);
    res.json(toApiShape(fresh));
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { list, getOne, create, update, remove, getMe, updateMe, toApiShape };
