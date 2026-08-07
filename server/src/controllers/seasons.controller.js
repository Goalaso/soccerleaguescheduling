const pool = require('../db/pool');

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
    numTeams,
    playersPerTeam,
    balanceBySkill,
    balanceByAge,
    balanceByPosition,
    name,
    startsOn,
  } = req.body;

  if (!leagueId || !numTeams || !playersPerTeam) {
    return res.status(400).json({ error: 'leagueId, numTeams, and playersPerTeam are required' });
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
         (league_id, num_teams, players_per_team, balance_by_skill, balance_by_age, balance_by_position, name, starts_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      `SELECT sa.player_id, sa.is_available, sa.responded_at,
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
        respondedAt: r.responded_at,
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function setAvailability(req, res, next) {
  const { isAvailable } = req.body;
  if (typeof isAvailable !== 'boolean') {
    return res.status(400).json({ error: 'isAvailable must be a boolean' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE season_availability SET is_available = $1, responded_at = now(), marked_by = $2
       WHERE season_id = $3 AND player_id = $4
       RETURNING player_id, is_available, responded_at`,
      [isAvailable, req.user.sub, req.params.id, req.params.playerId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Player is not part of this season's availability list" });
    }

    // An admin override also resolves the player's own pending ask, if
    // they have an account to have received one.
    await pool.query(
      `UPDATE notifications n SET is_read = true
       FROM players p
       WHERE p.id = $1 AND n.user_id = p.user_id
         AND n.type = 'season_availability_request' AND n.related_season_id = $2`,
      [req.params.playerId, req.params.id]
    );

    res.json({ playerId: rows[0].player_id, isAvailable: rows[0].is_available, respondedAt: rows[0].responded_at });
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
    const { rows } = await pool.query(
      `UPDATE season_availability SET is_available = $1, responded_at = now(), marked_by = $2
       WHERE season_id = $3 AND player_id = $4
       RETURNING player_id, is_available, responded_at`,
      [isAvailable, req.user.sub, req.params.id, playerRows[0].id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "You are not part of this season's availability list" });
    }

    await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE user_id = $1 AND type = 'season_availability_request' AND related_season_id = $2`,
      [req.user.sub, req.params.id]
    );

    res.json({ playerId: rows[0].player_id, isAvailable: rows[0].is_available, respondedAt: rows[0].responded_at });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, getAvailability, setAvailability, setMyAvailability };
