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
      captainPlayerId: t.captain_player_id,
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

// Games played per player for a season, straight from match_rosters — every
// played match is guaranteed a roster row (backfilled for old matches,
// materialized on submit for new ones), so no fallback logic is needed here
// the way fetchEffectiveRoster needs it for a single in-progress match.
// Excludes rows for matches that haven't been played yet (a confirmed
// roll call for an upcoming match isn't a "game played").
async function getStats(req, res, next) {
  try {
    const { seasonId } = req.query;
    if (!seasonId) {
      return res.status(400).json({ error: 'seasonId is required' });
    }
    const { rows } = await pool.query(
      `SELECT mr.player_id, COUNT(*)::int AS games_played
       FROM match_rosters mr
       JOIN matches m ON m.id = mr.match_id
       WHERE m.season_id = $1 AND m.status = 'played'
       GROUP BY mr.player_id`,
      [seasonId]
    );
    res.json(rows.map((r) => ({ playerId: r.player_id, gamesPlayed: r.games_played })));
  } catch (err) {
    next(err);
  }
}

// Season-long roster changes (distinct from a single-match loan in
// match_rosters) notify the affected player if they have a login — same
// directly-triggered pattern as season_availability_request, except
// related_season_id is deliberately left NULL: a player could legitimately
// be moved more than once in a season, and the dedup index on
// (user_id, type, related_season_id) would block a second real
// notification. Team/action context goes in `data` JSONB instead.
async function notifyRosterChange(db, playerId, team, action) {
  const messages = {
    added: `You've been added to ${team.name}`,
    removed: `You've been removed from ${team.name}`,
    moved: `You've been moved to ${team.name}`,
  };
  await db.query(
    `INSERT INTO notifications (user_id, type, message, action_url, data)
     SELECT p.user_id, 'team_roster_changed', $2, $3, $4
     FROM players p WHERE p.id = $1 AND p.user_id IS NOT NULL`,
    [
      playerId,
      messages[action],
      `/league/team/${team.id}`,
      JSON.stringify({ teamId: team.id, teamName: team.name, action }),
    ]
  );
}

async function addSeasonPlayer(req, res, next) {
  const { playerId } = req.body;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  try {
    const { rows: teamRows } = await pool.query('SELECT * FROM teams WHERE id = $1', [req.params.teamId]);
    const team = teamRows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // A season-long spot, unlike a match_rosters loan — a player can only
    // be on one team's permanent roster per season.
    const { rows: conflictRows } = await pool.query(
      `SELECT 1 FROM team_players tp JOIN teams t ON t.id = tp.team_id
       WHERE t.season_id = $1 AND tp.player_id = $2`,
      [team.season_id, playerId]
    );
    if (conflictRows.length) {
      return res.status(409).json({ error: 'That player is already on a team this season' });
    }

    await pool.query('INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)', [team.id, playerId]);
    await notifyRosterChange(pool, playerId, team, 'added');

    const result = await fetchSeasonTeams(pool, team.season_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function removeSeasonPlayer(req, res, next) {
  try {
    const { rows: teamRows } = await pool.query('SELECT * FROM teams WHERE id = $1', [req.params.teamId]);
    const team = teamRows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { rowCount } = await pool.query('DELETE FROM team_players WHERE team_id = $1 AND player_id = $2', [
      team.id,
      req.params.playerId,
    ]);
    if (!rowCount) return res.status(404).json({ error: 'Player not on this team' });

    // Removing their season-long spot also clears them as captain, if they
    // were one — teams.captain_player_id has no meaning once they're not
    // even on the roster anymore.
    await pool.query('UPDATE teams SET captain_player_id = NULL WHERE id = $1 AND captain_player_id = $2', [
      team.id,
      req.params.playerId,
    ]);
    await notifyRosterChange(pool, req.params.playerId, team, 'removed');

    const result = await fetchSeasonTeams(pool, team.season_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function moveSeasonPlayer(req, res, next) {
  const { toTeamId } = req.body;
  if (!toTeamId) {
    return res.status(400).json({ error: 'toTeamId is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: teamRows } = await client.query('SELECT * FROM teams WHERE id = ANY($1::int[]) FOR UPDATE', [
      [Number(req.params.teamId), Number(toTeamId)],
    ]);
    const fromTeam = teamRows.find((t) => t.id === Number(req.params.teamId));
    const toTeam = teamRows.find((t) => t.id === Number(toTeamId));
    if (!fromTeam || !toTeam) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Team not found' });
    }
    if (fromTeam.season_id !== toTeam.season_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Both teams must be in the same season' });
    }

    const { rows: existingRows } = await client.query(
      'SELECT score FROM team_players WHERE team_id = $1 AND player_id = $2',
      [fromTeam.id, req.params.playerId]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not on this team' });
    }

    await client.query('DELETE FROM team_players WHERE team_id = $1 AND player_id = $2', [
      fromTeam.id,
      req.params.playerId,
    ]);
    await client.query('INSERT INTO team_players (team_id, player_id, score) VALUES ($1, $2, $3)', [
      toTeam.id,
      req.params.playerId,
      existingRows[0].score,
    ]);
    // Same reasoning as removeSeasonPlayer — captaincy doesn't carry over
    // to whichever team they've moved to.
    await client.query('UPDATE teams SET captain_player_id = NULL WHERE id = $1 AND captain_player_id = $2', [
      fromTeam.id,
      req.params.playerId,
    ]);

    await client.query('COMMIT');

    await notifyRosterChange(pool, req.params.playerId, toTeam, 'moved');
    const result = await fetchSeasonTeams(pool, fromTeam.season_id);
    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function setCaptain(req, res, next) {
  const { playerId } = req.body;
  try {
    const { rows: teamRows } = await pool.query('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    const team = teamRows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (playerId !== null && playerId !== undefined) {
      const { rows: onRoster } = await pool.query(
        'SELECT 1 FROM team_players WHERE team_id = $1 AND player_id = $2',
        [team.id, playerId]
      );
      if (!onRoster.length) {
        return res.status(400).json({ error: "Captain must be on the team's roster" });
      }
    }

    await pool.query('UPDATE teams SET captain_player_id = $1 WHERE id = $2', [playerId ?? null, team.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublished,
  publish,
  getStats,
  addSeasonPlayer,
  removeSeasonPlayer,
  moveSeasonPlayer,
  setCaptain,
};
