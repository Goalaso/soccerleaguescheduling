const pool = require('../db/pool');
const { toApiShape: playerToApiShape } = require('./players.controller');

function summarizeTeam(team) {
  const totalSkill = team.players.reduce((sum, p) => sum + p.skill, 0);
  const avgSkill = team.players.length ? totalSkill / team.players.length : 0;

  const counts = { Forward: 0, Midfielder: 0, defGk: 0 };
  team.players.forEach((p) => {
    if (p.position === 'Forward') counts.Forward += 1;
    else if (p.position === 'Midfielder') counts.Midfielder += 1;
    else counts.defGk += 1;
  });

  return {
    ...team,
    avgSkill: Math.round(avgSkill * 10) / 10,
    counts,
  };
}

async function fetchSeasonTeams(client, seasonId) {
  const { rows: seasonRows } = await client.query(
    `SELECT s.*, l.name AS league_name FROM seasons s JOIN leagues l ON l.id = s.league_id WHERE s.id = $1`,
    [seasonId]
  );
  const season = seasonRows[0];
  if (!season) return { teams: null, options: null };

  const { rows: teamRows } = await client.query(
    'SELECT * FROM teams WHERE season_id = $1 ORDER BY id ASC',
    [season.id]
  );

  const { rows: memberRows } = await client.query(
    `SELECT tp.team_id, tp.score, p.*
     FROM team_players tp
     JOIN players p ON p.id = tp.player_id
     WHERE tp.team_id = ANY($1::int[])
     ORDER BY p.id ASC`,
    [teamRows.map((t) => t.id)]
  );

  const membersByTeam = memberRows.reduce((acc, row) => {
    const player = { ...playerToApiShape(row), score: row.score !== null ? Number(row.score) : null };
    (acc[row.team_id] ||= []).push(player);
    return acc;
  }, {});

  const teams = teamRows.map((t) =>
    summarizeTeam({
      id: t.id,
      name: t.name,
      color: t.color,
      players: membersByTeam[t.id] || [],
    })
  );

  const options = {
    leagueId: season.league_id,
    leagueName: season.league_name,
    numTeams: season.num_teams,
    playersPerTeam: season.players_per_team,
    balanceBySkill: season.balance_by_skill,
    balanceByAge: season.balance_by_age,
    balanceByPosition: season.balance_by_position,
  };

  return { teams, options, seasonStatus: season.status };
}

async function getPublished(req, res, next) {
  try {
    const { seasonId } = req.query;
    if (!seasonId) {
      return res.status(400).json({ error: 'seasonId is required' });
    }
    const result = await fetchSeasonTeams(pool, seasonId);
    if (!result.options) {
      return res.status(404).json({ error: 'Season not found' });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function publish(req, res, next) {
  const client = await pool.connect();
  try {
    const { seasonId, teams } = req.body;
    if (!seasonId || !Array.isArray(teams) || !teams.length) {
      return res.status(400).json({ error: 'seasonId and teams are required' });
    }

    await client.query('BEGIN');

    const { rows: seasonRows } = await client.query('SELECT * FROM seasons WHERE id = $1 FOR UPDATE', [
      seasonId,
    ]);
    const season = seasonRows[0];
    if (!season) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Season not found' });
    }
    if (season.status !== 'collecting_availability') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Teams have already been generated for this season' });
    }

    // Only players confirmed available for this season may be placed on a team.
    const { rows: availableRows } = await client.query(
      'SELECT player_id FROM season_availability WHERE season_id = $1 AND is_available = true',
      [seasonId]
    );
    const availableSet = new Set(availableRows.map((r) => r.player_id));
    const invalidPlayer = teams.flatMap((t) => t.players).find((p) => !availableSet.has(p.id));
    if (invalidPlayer) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'All players must be confirmed available for this season' });
    }

    // Defensive delete+reinsert, in case this is retried after a partial failure.
    await client.query('DELETE FROM teams WHERE season_id = $1', [seasonId]);

    for (const team of teams) {
      const { rows: teamRows } = await client.query(
        `INSERT INTO teams (season_id, name, color) VALUES ($1, $2, $3) RETURNING id`,
        [seasonId, team.name, team.color]
      );
      const teamId = teamRows[0].id;

      for (const player of team.players) {
        await client.query(
          `INSERT INTO team_players (team_id, player_id, score) VALUES ($1, $2, $3)`,
          [teamId, player.id, player.score ?? null]
        );
      }
    }

    await client.query(`UPDATE seasons SET status = 'teams_generated' WHERE id = $1`, [seasonId]);

    await client.query('COMMIT');

    const result = await fetchSeasonTeams(client, seasonId);
    res.status(201).json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { getPublished, publish };
