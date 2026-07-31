const pool = require('../db/pool');
const { toApiShape: playerToApiShape } = require('./players.controller');
const { buildRoundRobinFixtures } = require('../utils/schedule');

async function fetchMatchesForSeason(db, seasonId) {
  const { rows: matchRows } = await db.query(
    `SELECT m.*,
            ht.id AS home_id, ht.name AS home_name, ht.color AS home_color,
            at.id AS away_id, at.name AS away_name, at.color AS away_color
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.season_id = $1
     ORDER BY m.week ASC, m.id ASC`,
    [seasonId]
  );

  const matchIds = matchRows.map((m) => m.id);
  const goalRows = matchIds.length
    ? (
        await db.query(
          `SELECT mg.match_id, mg.player_id, mg.team_id, mg.goals, p.name AS player_name,
                  t.name AS team_name, t.color AS team_color
           FROM match_goals mg
           JOIN players p ON p.id = mg.player_id
           JOIN teams t ON t.id = mg.team_id
           WHERE mg.match_id = ANY($1::int[])`,
          [matchIds]
        )
      ).rows
    : [];

  const scorersByMatch = goalRows.reduce((acc, row) => {
    (acc[row.match_id] ||= []).push({
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      teamName: row.team_name,
      teamColor: row.team_color,
      goals: row.goals,
    });
    return acc;
  }, {});

  return matchRows.map((m) => ({
    id: m.id,
    week: m.week,
    matchDate: m.match_date,
    status: m.status,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
    home: { id: m.home_id, name: m.home_name, color: m.home_color },
    away: { id: m.away_id, name: m.away_name, color: m.away_color },
    scorers: scorersByMatch[m.id] || [],
  }));
}

async function fetchMatchById(db, matchId) {
  const { rows: matchRows } = await db.query(
    `SELECT m.*,
            ht.id AS home_id, ht.name AS home_name, ht.color AS home_color,
            at.id AS away_id, at.name AS away_name, at.color AS away_color
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.id = $1`,
    [matchId]
  );
  const m = matchRows[0];
  if (!m) return null;

  const { rows: goalRows } = await db.query(
    `SELECT mg.player_id, mg.team_id, mg.goals, p.name AS player_name, t.name AS team_name, t.color AS team_color
     FROM match_goals mg
     JOIN players p ON p.id = mg.player_id
     JOIN teams t ON t.id = mg.team_id
     WHERE mg.match_id = $1`,
    [matchId]
  );

  return {
    id: m.id,
    week: m.week,
    matchDate: m.match_date,
    status: m.status,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
    home: { id: m.home_id, name: m.home_name, color: m.home_color },
    away: { id: m.away_id, name: m.away_name, color: m.away_color },
    scorers: goalRows.map((r) => ({
      playerId: r.player_id,
      playerName: r.player_name,
      teamId: r.team_id,
      teamName: r.team_name,
      teamColor: r.team_color,
      goals: r.goals,
    })),
  };
}

async function list(req, res, next) {
  const { seasonId } = req.query;
  if (!seasonId) {
    return res.status(400).json({ error: 'seasonId is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: seasonRows } = await client.query('SELECT * FROM seasons WHERE id = $1 FOR UPDATE', [
      seasonId,
    ]);
    const season = seasonRows[0];

    if (!season) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Season not found' });
    }

    const { rows: countRows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM matches WHERE season_id = $1',
      [season.id]
    );

    if (countRows[0].count === 0) {
      const { rows: teamRows } = await client.query(
        'SELECT id FROM teams WHERE season_id = $1 ORDER BY id ASC',
        [season.id]
      );
      const teamIds = teamRows.map((t) => t.id);

      if (teamIds.length >= 2) {
        const fixtures = season.starts_on
          ? buildRoundRobinFixtures(teamIds, 12, new Date(season.starts_on))
          : buildRoundRobinFixtures(teamIds);
        for (const f of fixtures) {
          await client.query(
            `INSERT INTO matches (season_id, week, match_date, home_team_id, away_team_id, status)
             VALUES ($1, $2, $3, $4, $5, 'scheduled')`,
            [season.id, f.week, f.matchDate, f.homeId, f.awayId]
          );
        }
      }
    }

    await client.query('COMMIT');

    const matches = await fetchMatchesForSeason(pool, season.id);
    res.json({ matches });
  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      // Another concurrent request generated the schedule first — that's
      // fine, just return whatever ended up persisted.
      try {
        const matches = await fetchMatchesForSeason(pool, seasonId);
        return res.json({ matches });
      } catch (err2) {
        return next(err2);
      }
    }

    next(err);
  } finally {
    client.release();
  }
}

async function getOne(req, res, next) {
  try {
    const match = await fetchMatchById(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const { rows: memberRows } = await pool.query(
      `SELECT tp.team_id, p.*
       FROM team_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.team_id = ANY($1::int[])
       ORDER BY p.id ASC`,
      [[match.home.id, match.away.id]]
    );

    const rosterByTeam = memberRows.reduce((acc, row) => {
      (acc[row.team_id] ||= []).push(playerToApiShape(row));
      return acc;
    }, {});

    res.json({
      ...match,
      home: { ...match.home, players: rosterByTeam[match.home.id] || [] },
      away: { ...match.away, players: rosterByTeam[match.away.id] || [] },
    });
  } catch (err) {
    next(err);
  }
}

async function recordResults(req, res, next) {
  const { homeGoals, awayGoals, scorers } = req.body;

  if (!Number.isInteger(homeGoals) || homeGoals < 0 || !Number.isInteger(awayGoals) || awayGoals < 0) {
    return res.status(400).json({ error: 'homeGoals and awayGoals must be non-negative integers' });
  }

  const cleanScorers = (Array.isArray(scorers) ? scorers : []).filter(
    (s) => s && Number.isInteger(s.goals) && s.goals > 0
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: matchRows } = await client.query('SELECT * FROM matches WHERE id = $1 FOR UPDATE', [
      req.params.id,
    ]);
    const match = matchRows[0];
    if (!match) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }

    const { home_team_id: homeTeamId, away_team_id: awayTeamId } = match;

    const invalidTeam = cleanScorers.find((s) => s.teamId !== homeTeamId && s.teamId !== awayTeamId);
    if (invalidTeam) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Scorer team must be one of the two match teams' });
    }

    if (cleanScorers.length) {
      const { rows: rosterRows } = await client.query(
        'SELECT team_id, player_id FROM team_players WHERE team_id = ANY($1::int[])',
        [[homeTeamId, awayTeamId]]
      );
      const rosterSet = new Set(rosterRows.map((r) => `${r.team_id}:${r.player_id}`));
      const invalidPlayer = cleanScorers.find((s) => !rosterSet.has(`${s.teamId}:${s.playerId}`));
      if (invalidPlayer) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Scorer must be on the roster of the team credited' });
      }
    }

    const homeSum = cleanScorers
      .filter((s) => s.teamId === homeTeamId)
      .reduce((sum, s) => sum + s.goals, 0);
    const awaySum = cleanScorers
      .filter((s) => s.teamId === awayTeamId)
      .reduce((sum, s) => sum + s.goals, 0);

    if (homeSum !== homeGoals || awaySum !== awayGoals) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Scorer goal totals must match the entered team score' });
    }

    await client.query(
      `UPDATE matches SET home_goals = $1, away_goals = $2, status = 'played', recorded_by = $3, recorded_at = now()
       WHERE id = $4`,
      [homeGoals, awayGoals, req.user.sub, match.id]
    );

    await client.query('DELETE FROM match_goals WHERE match_id = $1', [match.id]);
    for (const s of cleanScorers) {
      await client.query(
        'INSERT INTO match_goals (match_id, player_id, team_id, goals) VALUES ($1, $2, $3, $4)',
        [match.id, s.playerId, s.teamId, s.goals]
      );
    }

    await client.query('COMMIT');

    const updated = await fetchMatchById(pool, match.id);
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { list, getOne, recordResults };
