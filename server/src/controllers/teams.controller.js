const pool = require('../db/pool');
const { toApiShape: playerToApiShape } = require('./players.controller');
const { sendEmail, sendEmailBatch, getAccessToken, EMAIL_NOTIFIED_TYPES } = require('../services/email');

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

    // Best-effort, after commit — a slow/failed Outlook call must never
    // fail publishing itself, which has already succeeded by this point.
    try {
      await notifyTeamsPublished(seasonId, result.teams);
    } catch (err) {
      console.error('Failed to notify players of team assignments', err);
    }

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
  const message = messages[action];
  await db.query(
    `INSERT INTO notifications (user_id, type, message, action_url, data)
     SELECT p.user_id, 'team_roster_changed', $2, $3, $4
     FROM players p WHERE p.id = $1 AND p.user_id IS NOT NULL`,
    [playerId, message, `/league/team/${team.id}`, JSON.stringify({ teamId: team.id, teamName: team.name, action })]
  );

  if (!EMAIL_NOTIFIED_TYPES.includes('team_roster_changed')) return;
  const { rows: emailRows } = await db.query(
    `SELECT COALESCE(u.email, p.email) AS email FROM players p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND (u.id IS NULL OR u.email_notifications_enabled = true)`,
    [playerId]
  );
  const email = emailRows[0]?.email;
  if (!email) return;
  // Best-effort — a slow/failed Outlook call must never fail the roster
  // change itself, which has already succeeded by this point.
  try {
    await sendEmail({ to: email, subject: message, body: message });
  } catch (err) {
    console.error('Failed to send team roster change email', err);
  }
}

// Fires once, right after a season's teams are first published — every
// player gets an in-app notification plus an email with their team
// assignment. Distinct from notifyRosterChange above (used for individual
// add/remove/move actions on an already-published team): a publish can
// touch dozens of players in one shot, so emails go out via sendEmailBatch
// (small batches, spaced out) instead of one Graph call per player, which
// is what caused throttling at this kind of volume before (see
// server/src/services/email.js and this session's batch-send testing).
// Same notification `type` as notifyRosterChange ('team_roster_changed') —
// this is just another flavor of "here's your team," not a distinct
// category the frontend needs to treat differently.
async function notifyTeamsPublished(seasonId, teams) {
  const assignments = teams.flatMap((team) => team.players.map((p) => ({ playerId: p.id, team })));
  if (!assignments.length) return;

  for (const { playerId, team } of assignments) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, message, action_url, data)
       SELECT p.user_id, 'team_roster_changed', $2, $3, $4
       FROM players p WHERE p.id = $1 AND p.user_id IS NOT NULL`,
      [
        playerId,
        `You've been placed on ${team.name} for this season!`,
        `/league/team/${team.id}`,
        JSON.stringify({ teamId: team.id, teamName: team.name, action: 'published' }),
      ]
    );
  }

  if (!EMAIL_NOTIFIED_TYPES.includes('team_roster_changed')) return;

  const { rows: emailRows } = await pool.query(
    `SELECT p.id AS player_id, COALESCE(u.email, p.email) AS email
     FROM players p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = ANY($1::int[]) AND (u.id IS NULL OR u.email_notifications_enabled = true)`,
    [assignments.map((a) => a.playerId)]
  );
  const emailByPlayer = Object.fromEntries(emailRows.map((r) => [r.player_id, r.email]));

  const messages = assignments
    .map(({ playerId, team }) => {
      const email = emailByPlayer[playerId];
      if (!email) return null;
      const text = `You've been placed on ${team.name} for this season!`;
      return { to: email, subject: text, body: text };
    })
    .filter(Boolean);

  if (!messages.length) return;

  await getAccessToken();
  await sendEmailBatch(messages);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Core "add one player to a team's season-long roster" logic, taking an
// already-open client so this can run inside a bigger transaction (see
// batchEditRoster) as well as its own single-operation one (addSeasonPlayer
// below). Returns a notification descriptor instead of sending it inline —
// lets a batch collect several of these and fire them all after one COMMIT.
async function addSeasonPlayerTx(client, seasonId, { teamId, playerId }) {
  const { rows: teamRows } = await client.query('SELECT * FROM teams WHERE id = $1', [teamId]);
  const team = teamRows[0];
  if (!team) throw httpError(404, 'Team not found');
  if (team.season_id !== seasonId) throw httpError(400, 'Team is not part of this season');

  // A season-long spot, unlike a match_rosters loan — a player can only
  // be on one team's permanent roster per season.
  const { rows: conflictRows } = await client.query(
    `SELECT 1 FROM team_players tp JOIN teams t ON t.id = tp.team_id
     WHERE t.season_id = $1 AND tp.player_id = $2`,
    [seasonId, playerId]
  );
  if (conflictRows.length) throw httpError(409, 'That player is already on a team this season');

  await client.query('INSERT INTO team_players (team_id, player_id) VALUES ($1, $2)', [teamId, playerId]);
  return { playerId, team, action: 'added' };
}

async function removeSeasonPlayerTx(client, seasonId, { teamId, playerId }) {
  const { rows: teamRows } = await client.query('SELECT * FROM teams WHERE id = $1', [teamId]);
  const team = teamRows[0];
  if (!team) throw httpError(404, 'Team not found');
  if (team.season_id !== seasonId) throw httpError(400, 'Team is not part of this season');

  const { rowCount } = await client.query('DELETE FROM team_players WHERE team_id = $1 AND player_id = $2', [
    teamId,
    playerId,
  ]);
  if (!rowCount) throw httpError(404, 'Player not on this team');

  // Removing their season-long spot also clears them as captain, if they
  // were one — teams.captain_player_id has no meaning once they're not
  // even on the roster anymore.
  await client.query('UPDATE teams SET captain_player_id = NULL WHERE id = $1 AND captain_player_id = $2', [
    teamId,
    playerId,
  ]);
  return { playerId, team, action: 'removed' };
}

async function moveSeasonPlayerTx(client, seasonId, { teamId, playerId, toTeamId }) {
  const { rows: teamRows } = await client.query('SELECT * FROM teams WHERE id = ANY($1::int[]) FOR UPDATE', [
    [teamId, toTeamId],
  ]);
  const fromTeam = teamRows.find((t) => t.id === teamId);
  const toTeam = teamRows.find((t) => t.id === toTeamId);
  if (!fromTeam || !toTeam) throw httpError(404, 'Team not found');
  if (fromTeam.season_id !== seasonId || toTeam.season_id !== seasonId) {
    throw httpError(400, 'Both teams must be in this season');
  }

  const { rows: existingRows } = await client.query(
    'SELECT score FROM team_players WHERE team_id = $1 AND player_id = $2',
    [teamId, playerId]
  );
  if (!existingRows.length) throw httpError(404, 'Player not on this team');

  await client.query('DELETE FROM team_players WHERE team_id = $1 AND player_id = $2', [teamId, playerId]);
  await client.query('INSERT INTO team_players (team_id, player_id, score) VALUES ($1, $2, $3)', [
    toTeamId,
    playerId,
    existingRows[0].score,
  ]);
  // Same reasoning as removeSeasonPlayerTx — captaincy doesn't carry over
  // to whichever team they've moved to.
  await client.query('UPDATE teams SET captain_player_id = NULL WHERE id = $1 AND captain_player_id = $2', [
    teamId,
    playerId,
  ]);
  return { playerId, team: toTeam, action: 'moved' };
}

// Best-effort, after commit — a slow/failed Outlook call (or a notifications
// insert failure for one player) must never fail the roster change itself,
// which has already succeeded by this point.
async function sendRosterChangeNotifications(notifications) {
  for (const n of notifications) {
    try {
      await notifyRosterChange(pool, n.playerId, n.team, n.action);
    } catch (err) {
      console.error('Failed to send team roster change notification', err);
    }
  }
}

async function addSeasonPlayer(req, res, next) {
  const { playerId } = req.body;
  if (!playerId) {
    return res.status(400).json({ error: 'playerId is required' });
  }
  const client = await pool.connect();
  try {
    const { rows: teamRows } = await client.query('SELECT season_id FROM teams WHERE id = $1', [
      req.params.teamId,
    ]);
    const seasonId = teamRows[0]?.season_id;
    if (!seasonId) return res.status(404).json({ error: 'Team not found' });

    await client.query('BEGIN');
    let result;
    try {
      result = await addSeasonPlayerTx(client, seasonId, { teamId: Number(req.params.teamId), playerId });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    await client.query('COMMIT');

    await sendRosterChangeNotifications([result]);
    const seasonResult = await fetchSeasonTeams(pool, seasonId);
    res.json(seasonResult);
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

async function removeSeasonPlayer(req, res, next) {
  const client = await pool.connect();
  try {
    const { rows: teamRows } = await client.query('SELECT season_id FROM teams WHERE id = $1', [
      req.params.teamId,
    ]);
    const seasonId = teamRows[0]?.season_id;
    if (!seasonId) return res.status(404).json({ error: 'Team not found' });

    await client.query('BEGIN');
    let result;
    try {
      result = await removeSeasonPlayerTx(client, seasonId, {
        teamId: Number(req.params.teamId),
        playerId: Number(req.params.playerId),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    await client.query('COMMIT');

    await sendRosterChangeNotifications([result]);
    const seasonResult = await fetchSeasonTeams(pool, seasonId);
    res.json(seasonResult);
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

async function moveSeasonPlayer(req, res, next) {
  const { toTeamId } = req.body;
  if (!toTeamId) {
    return res.status(400).json({ error: 'toTeamId is required' });
  }

  const client = await pool.connect();
  try {
    const { rows: teamRows } = await client.query('SELECT season_id FROM teams WHERE id = $1', [
      req.params.teamId,
    ]);
    const seasonId = teamRows[0]?.season_id;
    if (!seasonId) return res.status(404).json({ error: 'Team not found' });

    await client.query('BEGIN');
    let result;
    try {
      result = await moveSeasonPlayerTx(client, seasonId, {
        teamId: Number(req.params.teamId),
        playerId: Number(req.params.playerId),
        toTeamId: Number(toTeamId),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    await client.query('COMMIT');

    await sendRosterChangeNotifications([result]);
    const seasonResult = await fetchSeasonTeams(pool, seasonId);
    res.json(seasonResult);
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}

// One "confirm roster changes" click from TeamRosterEditPage can stage
// several move/remove/add operations plus a captain change at once — this
// applies all of them in one transaction and one final fetchSeasonTeams
// call, instead of the N full team/roster re-reads that N individual
// clicks used to cost (every single-entity mutation above rebuilds the
// entire season's team list on its own). All teams referenced anywhere in
// the batch are locked and season-checked up front; any invalid operation
// rolls back the whole batch rather than silently applying only some of
// the admin's clicks.
async function batchEditRoster(req, res, next) {
  const { seasonId, captainTeamId } = req.body;
  const operations = Array.isArray(req.body.operations) ? req.body.operations : [];
  const captainPlayerId = req.body.captainPlayerId;

  if (!seasonId) {
    return res.status(400).json({ error: 'seasonId is required' });
  }
  if (!operations.length && captainPlayerId === undefined) {
    return res.status(400).json({ error: 'operations or a captain change is required' });
  }
  for (const op of operations) {
    if (!op.playerId || !op.teamId || !['add', 'remove', 'move'].includes(op.action)) {
      return res.status(400).json({ error: 'Each operation needs playerId, teamId, and action of add/remove/move' });
    }
    if (op.action === 'move' && !op.toTeamId) {
      return res.status(400).json({ error: 'move operations need toTeamId' });
    }
  }
  if (captainPlayerId !== undefined && !captainTeamId) {
    return res.status(400).json({ error: 'captainTeamId is required when setting a captain' });
  }

  const client = await pool.connect();
  try {
    const teamIds = new Set(operations.flatMap((op) => [op.teamId, op.toTeamId].filter(Boolean)));
    if (captainTeamId) teamIds.add(captainTeamId);

    await client.query('BEGIN');
    let notifications = [];
    try {
      if (teamIds.size) {
        const { rows: teamRows } = await client.query(
          'SELECT id, season_id FROM teams WHERE id = ANY($1::int[]) FOR UPDATE',
          [Array.from(teamIds)]
        );
        if (teamRows.length !== teamIds.size || teamRows.some((t) => t.season_id !== seasonId)) {
          throw httpError(400, 'All teams must belong to this season');
        }
      }

      for (const op of operations) {
        let result;
        if (op.action === 'add') {
          result = await addSeasonPlayerTx(client, seasonId, { teamId: op.teamId, playerId: op.playerId });
        } else if (op.action === 'remove') {
          result = await removeSeasonPlayerTx(client, seasonId, { teamId: op.teamId, playerId: op.playerId });
        } else {
          result = await moveSeasonPlayerTx(client, seasonId, {
            teamId: op.teamId,
            playerId: op.playerId,
            toTeamId: op.toTeamId,
          });
        }
        notifications.push(result);
      }

      if (captainPlayerId !== undefined) {
        const { rows: teamRows } = await client.query('SELECT * FROM teams WHERE id = $1', [captainTeamId]);
        const team = teamRows[0];
        if (!team) throw httpError(404, 'Team not found');
        if (captainPlayerId !== null) {
          const { rows: onRoster } = await client.query(
            'SELECT 1 FROM team_players WHERE team_id = $1 AND player_id = $2',
            [captainTeamId, captainPlayerId]
          );
          if (!onRoster.length) throw httpError(400, "Captain must be on the team's roster");
        }
        await client.query('UPDATE teams SET captain_player_id = $1 WHERE id = $2', [
          captainPlayerId ?? null,
          captainTeamId,
        ]);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.status) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    await client.query('COMMIT');

    await sendRosterChangeNotifications(notifications);
    const result = await fetchSeasonTeams(pool, seasonId);
    res.json(result);
  } catch (err) {
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
  batchEditRoster,
};
