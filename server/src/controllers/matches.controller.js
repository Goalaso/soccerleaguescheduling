const pool = require('../db/pool');
const { toApiShape: playerToApiShape } = require('./players.controller');
const { buildRoundRobinFixtures } = require('../utils/schedule');
const { sendEmail, EMAIL_NOTIFIED_TYPES } = require('../services/email');

// match_date comes back as a raw 'YYYY-MM-DD' string (see server/src/db/pool.js's
// DATE type-parser override) — building the Date from Y/M/D components
// directly avoids the UTC-parse day-shift a bare `new Date(str)` risks.
function formatMatchDateLabel(matchDateStr) {
  const [year, month, day] = matchDateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Same Y/M/D-component construction as formatMatchDateLabel above, just
// returning a Date instead of a formatted label — a bare `new Date(str)`
// parses the date-only string as UTC midnight, which then reads back as
// the *previous* calendar day everywhere the server's local timezone is
// behind UTC. buildRoundRobinFixtures does date math (.setDate()) against
// whatever Date it's given, so that shift would silently move every
// generated match a day earlier than the season's actual starts_on.
function parseDateOnly(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

async function resolvePlayerEmail(db, playerId) {
  const { rows } = await db.query(
    `SELECT COALESCE(u.email, p.email) AS email FROM players p LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND (u.id IS NULL OR u.email_notifications_enabled = true)`,
    [playerId]
  );
  return rows[0]?.email || null;
}

// Fires when a player is added as a sub or borrowed player — never for
// 'regular', which is just the normal attendance toggle, not a new
// assignment. related_match_id is deliberately left unset: same reasoning
// as team_roster_changed in teams.controller.js — a player can legitimately
// be (re)assigned to the same match more than once, and the dedup index on
// (user_id, type, related_match_id) would collapse those into one row.
async function notifyMatchAssignment(db, { playerId, teamId, match }) {
  const { rows: teamRows } = await db.query('SELECT name FROM teams WHERE id = $1', [teamId]);
  const teamName = teamRows[0]?.name;
  const isHome = teamId === match.home_team_id;
  const message = `You're now playing for ${teamName} (${isHome ? 'Home' : 'Away'}) — Week ${match.week}, ${formatMatchDateLabel(match.match_date)}.`;

  await db.query(
    `INSERT INTO notifications (user_id, type, message, action_url, data)
     SELECT p.user_id, 'match_roster_assigned', $2, $3, $4
     FROM players p WHERE p.id = $1 AND p.user_id IS NOT NULL`,
    [playerId, message, `/schedule/match/${match.id}`, JSON.stringify({ matchId: match.id, teamId, teamName, isHome, week: match.week })]
  );

  const email = await resolvePlayerEmail(db, playerId);
  if (email && EMAIL_NOTIFIED_TYPES.includes('match_roster_assigned')) {
    try {
      await sendEmail({ to: email, subject: `You're playing for ${teamName} this week!`, body: message });
    } catch (err) {
      console.error('Failed to send match assignment email', err);
    }
  }
}

// Fires when a sub/borrowed player is removed. `stillNeededTeamId` +
// `stillNeededMatchId` cover the "loaned, but still needed for their own
// team's match" case (same match, or a different one this round) —
// left undefined for a plain sub (nothing to fall back to) or a borrowed
// player whose own team has a bye this round (nothing to restore them to).
async function notifyMatchRemoval(db, { playerId, removedFromTeamId, match, stillNeededTeamId, stillNeededMatchId }) {
  const teamIds = [removedFromTeamId, stillNeededTeamId].filter(Boolean);
  const { rows: teamRows } = await db.query('SELECT id, name FROM teams WHERE id = ANY($1::int[])', [teamIds]);
  const teamNameById = Object.fromEntries(teamRows.map((r) => [r.id, r.name]));
  const removedFromTeamName = teamNameById[removedFromTeamId];

  let stillNeededMatch = null;
  if (stillNeededTeamId) {
    const targetMatch = stillNeededMatchId
      ? (await db.query('SELECT id, week, match_date, home_team_id FROM matches WHERE id = $1', [stillNeededMatchId])).rows[0]
      : match;
    stillNeededMatch = {
      id: targetMatch.id,
      week: targetMatch.week,
      dateLabel: formatMatchDateLabel(targetMatch.match_date),
      isHome: stillNeededTeamId === targetMatch.home_team_id,
    };
  }

  const message = stillNeededMatch
    ? `You're no longer playing for ${removedFromTeamName} — you're still needed for ${teamNameById[stillNeededTeamId]} (${stillNeededMatch.isHome ? 'Home' : 'Away'}) — Week ${stillNeededMatch.week}, ${stillNeededMatch.dateLabel}.`
    : `You're no longer needed for ${removedFromTeamName}'s Week ${match.week} match on ${formatMatchDateLabel(match.match_date)}.`;
  const actionUrl = `/schedule/match/${stillNeededMatch ? stillNeededMatch.id : match.id}`;

  await db.query(
    `INSERT INTO notifications (user_id, type, message, action_url, data)
     SELECT p.user_id, 'match_roster_removed', $2, $3, $4
     FROM players p WHERE p.id = $1 AND p.user_id IS NOT NULL`,
    [
      playerId,
      message,
      actionUrl,
      JSON.stringify({ matchId: match.id, removedFromTeamId, removedFromTeamName, stillNeededTeamId: stillNeededTeamId || null }),
    ]
  );

  const email = await resolvePlayerEmail(db, playerId);
  if (email && EMAIL_NOTIFIED_TYPES.includes('match_roster_removed')) {
    try {
      await sendEmail({
        to: email,
        subject: stillNeededMatch ? `Still on for ${teamNameById[stillNeededTeamId]} this week` : 'Update to your match assignment',
        body: message,
      });
    } catch (err) {
      console.error('Failed to send match removal email', err);
    }
  }
}

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
          `SELECT mr.match_id, mr.player_id, mr.team_id, mr.goals, p.name AS player_name,
                  t.name AS team_name, t.color AS team_color
           FROM match_rosters mr
           JOIN players p ON p.id = mr.player_id
           JOIN teams t ON t.id = mr.team_id
           WHERE mr.match_id = ANY($1::int[]) AND mr.goals > 0`,
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

  // "Confirmed today" per team per match — real match_rosters rows only.
  // No fallback to the team's season roster size: nobody's confirmed until
  // someone actually checks in, same reasoning as fetchEffectiveRoster's
  // confirmed flag — an untouched match correctly shows 0 here, not the
  // team's full roster size.
  const rosterCountRows = matchIds.length
    ? (
        await db.query(
          `SELECT match_id, team_id, COUNT(*)::int AS cnt FROM match_rosters
           WHERE match_id = ANY($1::int[]) GROUP BY match_id, team_id`,
          [matchIds]
        )
      ).rows
    : [];
  const rosterCountByMatchTeam = Object.fromEntries(
    rosterCountRows.map((r) => [`${r.match_id}:${r.team_id}`, r.cnt])
  );

  const confirmedCountFor = (matchId, teamId) => rosterCountByMatchTeam[`${matchId}:${teamId}`] ?? 0;

  return matchRows.map((m) => ({
    id: m.id,
    week: m.week,
    matchDate: m.match_date,
    status: m.status,
    homeGoals: m.home_goals,
    awayGoals: m.away_goals,
    home: {
      id: m.home_id,
      name: m.home_name,
      color: m.home_color,
      confirmedCount: confirmedCountFor(m.id, m.home_id),
    },
    away: {
      id: m.away_id,
      name: m.away_name,
      color: m.away_color,
      confirmedCount: confirmedCountFor(m.id, m.away_id),
    },
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
    `SELECT mr.player_id, mr.team_id, mr.goals, p.name AS player_name, t.name AS team_name, t.color AS team_color
     FROM match_rosters mr
     JOIN players p ON p.id = mr.player_id
     JOIN teams t ON t.id = mr.team_id
     WHERE mr.match_id = $1 AND mr.goals > 0`,
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

  try {
    // Fast path — true for every season after its schedule has ever been
    // generated once, i.e. almost always: just fetch it, no lock or
    // transaction at all. The BEGIN/FOR UPDATE/COMMIT dance below exists
    // only to safely auto-generate a schedule the *first* time it's
    // needed; paying for that lock on every subsequent read (unconditional
    // before this) is why this endpoint was consistently slower than
    // sibling endpoints doing one simple query.
    const existingMatches = await fetchMatchesForSeason(pool, seasonId);
    if (existingMatches.length > 0) {
      return res.json({ matches: existingMatches });
    }
  } catch (err) {
    return next(err);
  }

  // Slow path — no matches yet, so either this season doesn't exist, or it
  // does but genuinely needs its schedule generated for the first time.
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
        // roundRobinRounds (inside buildRoundRobinFixtures) always produces
        // exactly teamIds.length - 1 rounds for one full cycle — multiplying
        // by num_round_robins is how many times each team plays every other.
        const numWeeks = (season.num_round_robins || 1) * (teamIds.length - 1);
        const fixtures = season.starts_on
          ? buildRoundRobinFixtures(teamIds, numWeeks, parseDateOnly(season.starts_on))
          : buildRoundRobinFixtures(teamIds, numWeeks);
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

// A match's real roster for a given team: whatever's been recorded in
// match_rosters (a roll call, a sub/borrow assignment, an in-game swap —
// they're all just rows in this table). If nobody's touched it yet, this
// falls back to the season-long team_players roster, so the feature is
// opt-in — a match nobody did a roll call for still works exactly like it
// did before match_rosters existed.
// `confirmed` distinguishes a real roll-call/roster row from the fallback
// list below — the fallback exists so the team still shows up (e.g. for
// logging a goal) before anyone's touched this match's roster at all, but
// nobody has actually said they're attending yet, so it must never read as
// "everyone confirmed." Only the fallback rows get confirmed: false; real
// match_rosters rows (regular, sub, or borrowed) are always confirmed: true
// by definition — they only exist because someone was actively checked in.
async function fetchEffectiveRoster(db, matchId, teamId) {
  const { rows } = await db.query(
    `SELECT mr.player_id, mr.source, mr.goals, p.*
     FROM match_rosters mr
     JOIN players p ON p.id = mr.player_id
     WHERE mr.match_id = $1 AND mr.team_id = $2
     ORDER BY p.id ASC`,
    [matchId, teamId]
  );
  if (rows.length) return rows.map((r) => ({ ...r, confirmed: true }));

  const { rows: fallbackRows } = await db.query(
    `SELECT tp.player_id, 'regular' AS source, 0 AS goals, p.*
     FROM team_players tp
     JOIN players p ON p.id = tp.player_id
     WHERE tp.team_id = $1
     ORDER BY p.id ASC`,
    [teamId]
  );
  return fallbackRows.map((r) => ({ ...r, confirmed: false }));
}

// Turns the read-side fallback above into real rows, the first time anyone
// actually edits a team's match-day roster (a roll call, a sub/borrow
// assignment, or recording a score with nobody having done either first).
// Needed before any add/remove: e.g. unchecking someone from a roll call
// that hasn't started yet is a DELETE against a row that doesn't exist
// until the rest of the team's regular roster is materialized alongside it.
async function materializeRosterIfEmpty(db, matchId, teamId) {
  const { rows: existing } = await db.query(
    'SELECT 1 FROM match_rosters WHERE match_id = $1 AND team_id = $2 LIMIT 1',
    [matchId, teamId]
  );
  if (existing.length) return;
  // ON CONFLICT DO NOTHING: a player being restored here from a borrow
  // elsewhere may already have a live row for this match (just on a
  // different team_id) — the PK is (match_id, player_id), so re-inserting
  // them as part of this team's batch would otherwise violate it.
  await db.query(
    `INSERT INTO match_rosters (match_id, team_id, player_id, source)
     SELECT $1, team_id, player_id, 'regular' FROM team_players WHERE team_id = $2
     ON CONFLICT (match_id, player_id) DO NOTHING`,
    [matchId, teamId]
  );
}

// A team plays at most one match per round (season_id + week) in a
// round-robin schedule — used to find/clear a borrowed player's own match
// this round, since two simultaneous matches on different fields mean they
// can't be rostered on both at once.
async function findTeamMatchInRound(db, seasonId, week, teamId, excludeMatchId) {
  const { rows } = await db.query(
    `SELECT id FROM matches WHERE season_id = $1 AND week = $2 AND id != $3
       AND (home_team_id = $4 OR away_team_id = $4)`,
    [seasonId, week, excludeMatchId, teamId]
  );
  return rows[0]?.id || null;
}

// Match + scorers (fetchMatchById) plus both teams' effective match-day
// roster — the full shape the frontend expects from a single match. Shared
// by getOne and recordResults so their responses are always shape-compatible:
// the client merges a recordResults response into its cached getOne result
// (`{ ...prev, ...updated }`), and a response missing `.players` would wipe
// out the roster the UI still needs on the same render.
async function fetchMatchWithRosters(db, matchId) {
  const match = await fetchMatchById(db, matchId);
  if (!match) return null;

  const { rows: seasonRows } = await db.query('SELECT season_id, week FROM matches WHERE id = $1', [matchId]);
  const { season_id: seasonId, week } = seasonRows[0];

  const [homeRoster, awayRoster, submissionRows, loanedOutRows] = await Promise.all([
    fetchEffectiveRoster(db, matchId, match.home.id),
    fetchEffectiveRoster(db, matchId, match.away.id),
    db.query(
      'SELECT team_id, home_goals, away_goals, scorers, submitted_at FROM match_score_submissions WHERE match_id = $1',
      [matchId]
    ),
    // Any of this match's two teams' season-roster players currently
    // rostered under a DIFFERENT team this same round — whether that's the
    // opponent right here (visible via home/away.players too, but flagged
    // here as well for a uniform lookup) or a totally different match
    // elsewhere this round (not otherwise visible from this match's data
    // at all, since that's a separate match_rosters row entirely).
    db.query(
      `SELECT tp.team_id AS home_team_id, mr.player_id, t2.name AS actual_team_name
       FROM team_players tp
       JOIN match_rosters mr ON mr.player_id = tp.player_id
       JOIN matches m2 ON m2.id = mr.match_id
       JOIN teams t2 ON t2.id = mr.team_id
       WHERE tp.team_id = ANY($1::int[]) AND m2.season_id = $2 AND m2.week = $3 AND mr.team_id != tp.team_id`,
      [[match.home.id, match.away.id], seasonId, week]
    ),
  ]);

  const loanedOutByTeam = { [match.home.id]: {}, [match.away.id]: {} };
  loanedOutRows.rows.forEach((r) => {
    loanedOutByTeam[r.home_team_id][r.player_id] = r.actual_team_name;
  });

  return {
    ...match,
    home: {
      ...match.home,
      players: homeRoster.map((row) => ({ ...playerToApiShape(row), source: row.source, confirmed: row.confirmed })),
      loanedOut: loanedOutByTeam[match.home.id],
    },
    away: {
      ...match.away,
      players: awayRoster.map((row) => ({ ...playerToApiShape(row), source: row.source, confirmed: row.confirmed })),
      loanedOut: loanedOutByTeam[match.away.id],
    },
    scoreSubmissions: submissionRows.rows.map((r) => ({
      teamId: r.team_id,
      homeGoals: r.home_goals,
      awayGoals: r.away_goals,
      scorers: r.scorers,
      submittedAt: r.submitted_at,
    })),
  };
}

async function getOne(req, res, next) {
  try {
    const match = await fetchMatchWithRosters(pool, req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
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

    // Lock in "who played" permanently at the moment a score is submitted,
    // for whichever team hasn't had a roll call/sub assignment yet — a
    // later season-long roster move can then never retroactively rewrite
    // this match's history. No-op if match_rosters already has rows here.
    await materializeRosterIfEmpty(client, match.id, homeTeamId);
    await materializeRosterIfEmpty(client, match.id, awayTeamId);

    if (cleanScorers.length) {
      const { rows: rosterRows } = await client.query(
        'SELECT team_id, player_id FROM match_rosters WHERE match_id = $1 AND team_id = ANY($2::int[])',
        [match.id, [homeTeamId, awayTeamId]]
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

    // Every scorer's match_rosters row is guaranteed to already exist (they
    // just passed roster validation above), so this is reset-then-update,
    // never delete-then-insert — it's not possible to end up with a goal
    // credited to someone who isn't on the roster.
    await client.query('UPDATE match_rosters SET goals = 0 WHERE match_id = $1', [match.id]);
    for (const s of cleanScorers) {
      await client.query('UPDATE match_rosters SET goals = $1 WHERE match_id = $2 AND player_id = $3', [
        s.goals,
        match.id,
        s.playerId,
      ]);
    }

    // A submitted score fully resolves the "needs a score" reminder —
    // delete rather than mark read, since the match is now permanently
    // 'played' and the lazy check can never re-add it for this match.
    await client.query(`DELETE FROM notifications WHERE type = 'match_needs_score' AND related_match_id = $1`, [
      match.id,
    ]);

    // Any pending captain-reported proposals for this match are resolved
    // now that the official result is in, whether or not they were used.
    await client.query('DELETE FROM match_score_submissions WHERE match_id = $1', [match.id]);

    await client.query('COMMIT');

    const updated = await fetchMatchWithRosters(pool, match.id);
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// Admins can edit either team's match-day roster with any source. A team
// captain can only confirm/unconfirm their own team's *regular* roster
// players — assigning subs/borrowed players, or touching the other team,
// is admin-only (matches the real workflow: captains report attendance,
// the admin is the one who fills gaps).
async function canEditMatchRoster(db, user, teamId) {
  if (user.role === 'admin') return { allowed: true, captainOnly: false };
  const { rows } = await db.query(
    `SELECT 1 FROM teams t JOIN players p ON p.id = t.captain_player_id
     WHERE t.id = $1 AND p.user_id = $2`,
    [teamId, user.sub]
  );
  return { allowed: !!rows[0], captainOnly: true };
}

const ROSTER_SOURCES = ['regular', 'sub', 'borrowed'];

async function addRosterEntry(req, res, next) {
  const { playerId, teamId } = req.body;
  const source = req.body.source || 'regular';

  if (!playerId || !teamId) {
    return res.status(400).json({ error: 'playerId and teamId are required' });
  }
  if (!ROSTER_SOURCES.includes(source)) {
    return res.status(400).json({ error: 'Invalid source' });
  }

  try {
    const { rows: matchRows } = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    const match = matchRows[0];
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
      return res.status(400).json({ error: 'teamId must be one of the two match teams' });
    }

    const perm = await canEditMatchRoster(pool, req.user, teamId);
    if (!perm.allowed) return res.status(403).json({ error: 'Forbidden' });

    if (perm.captainOnly) {
      if (source !== 'regular') {
        return res
          .status(403)
          .json({ error: "Captains can only confirm attendance for their own team's regular roster" });
      }
      const { rows: onRoster } = await pool.query(
        'SELECT 1 FROM team_players WHERE team_id = $1 AND player_id = $2',
        [teamId, playerId]
      );
      if (!onRoster.length) {
        return res.status(403).json({ error: "That player is not on your team's roster" });
      }
    }

    // Re-adding a previously-unchecked regular player (or adding a sub/
    // borrowed player) onto a roster nobody's touched yet needs the rest of
    // the team's regular roster materialized first, same reasoning as below.
    await materializeRosterIfEmpty(pool, req.params.id, teamId);

    // A player can only be on one side of a match — the PK enforces this.
    // Only block the cross-team case for the plain 'regular' source (a
    // clear error beats a raw constraint violation for accidental
    // data-entry mistakes); 'sub'/'borrowed' are expected to move a
    // player's row to a new team, that's the whole point of borrowing.
    const { rows: existingRows } = await pool.query(
      'SELECT team_id FROM match_rosters WHERE match_id = $1 AND player_id = $2',
      [req.params.id, playerId]
    );
    if (source === 'regular' && existingRows.length && existingRows[0].team_id !== teamId) {
      return res.status(409).json({ error: "That player is already on the other team's roster for this match" });
    }

    await pool.query(
      `INSERT INTO match_rosters (match_id, team_id, player_id, source, added_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (match_id, player_id) DO UPDATE SET team_id = EXCLUDED.team_id, source = EXCLUDED.source, added_by = EXCLUDED.added_by`,
      [req.params.id, teamId, playerId, source, req.user.sub]
    );

    if (source === 'borrowed') {
      const { rows: homeTeamRows } = await pool.query('SELECT team_id FROM team_players WHERE player_id = $1', [
        playerId,
      ]);
      const homeTeamId = homeTeamRows[0]?.team_id;
      if (homeTeamId && homeTeamId !== teamId) {
        if (homeTeamId === match.home_team_id || homeTeamId === match.away_team_id) {
          // Home team is playing in this same match — materialize it (safe
          // now that materializeRosterIfEmpty is conflict-tolerant) so its
          // read-side fallback stops listing this player once they're moved.
          await materializeRosterIfEmpty(pool, match.id, homeTeamId);
        } else {
          // Every match in a round plays simultaneously on a different
          // field — a borrowed player can't also be rostered on their own
          // team's match this same round, so clear them from it if one exists.
          const conflictMatchId = await findTeamMatchInRound(pool, match.season_id, match.week, homeTeamId, match.id);
          if (conflictMatchId) {
            await materializeRosterIfEmpty(pool, conflictMatchId, homeTeamId);
            await pool.query('DELETE FROM match_rosters WHERE match_id = $1 AND player_id = $2', [
              conflictMatchId,
              playerId,
            ]);
          }
        }
      }
    }

    if (source === 'sub' || source === 'borrowed') {
      // Best-effort — a slow/failed Outlook call must never fail the roster
      // change itself, which has already succeeded by this point.
      try {
        await notifyMatchAssignment(pool, { playerId, teamId, match });
      } catch (err) {
        console.error('Failed to send match assignment notification', err);
      }
    }

    const updated = await fetchMatchWithRosters(pool, req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function removeRosterEntry(req, res, next) {
  // teamId can't be inferred from an existing match_rosters row alone —
  // there might not be one yet (nobody's touched this match's roster, so
  // it's still showing the team_players fallback) — the caller already
  // knows which team's column they're unchecking from, so it comes in as
  // a query param, same as addRosterEntry takes it in the body.
  const teamId = Number(req.query.teamId);
  if (!teamId) {
    return res.status(400).json({ error: 'teamId is required' });
  }

  try {
    const { rows: matchRows } = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    const match = matchRows[0];
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
      return res.status(400).json({ error: 'teamId must be one of the two match teams' });
    }

    const perm = await canEditMatchRoster(pool, req.user, teamId);
    if (!perm.allowed) return res.status(403).json({ error: 'Forbidden' });

    await materializeRosterIfEmpty(pool, req.params.id, teamId);

    const { rows: existingRows } = await pool.query(
      'SELECT source FROM match_rosters WHERE match_id = $1 AND team_id = $2 AND player_id = $3',
      [req.params.id, teamId, req.params.playerId]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'Roster entry not found' });
    if (perm.captainOnly && existing.source !== 'regular') {
      return res.status(403).json({ error: 'Only admins can remove subs or borrowed players' });
    }

    if (existing.source === 'borrowed') {
      // Undo both sides of the loan rather than just deleting: put the
      // player back where they actually belong, instead of leaving them
      // rostered nowhere (or, worse, silently reappearing via fallback).
      const { rows: homeTeamRows } = await pool.query('SELECT team_id FROM team_players WHERE player_id = $1', [
        req.params.playerId,
      ]);
      const homeTeamId = homeTeamRows[0]?.team_id;

      if (homeTeamId && (homeTeamId === match.home_team_id || homeTeamId === match.away_team_id)) {
        // On loan from one of this match's own two teams — move the row back in place.
        await materializeRosterIfEmpty(pool, req.params.id, homeTeamId);
        await pool.query(
          `UPDATE match_rosters SET team_id = $1, source = 'regular', added_by = $2 WHERE match_id = $3 AND player_id = $4`,
          [homeTeamId, req.user.sub, req.params.id, req.params.playerId]
        );
        try {
          await notifyMatchRemoval(pool, {
            playerId: Number(req.params.playerId),
            removedFromTeamId: teamId,
            match,
            stillNeededTeamId: homeTeamId,
          });
        } catch (err) {
          console.error('Failed to send match removal notification', err);
        }
        const updated = await fetchMatchWithRosters(pool, req.params.id);
        return res.json(updated);
      }

      await pool.query('DELETE FROM match_rosters WHERE match_id = $1 AND player_id = $2', [
        req.params.id,
        req.params.playerId,
      ]);

      let ownMatchId = null;
      if (homeTeamId) {
        // On loan from a third team — restore them to that team's own match this round, if it has one.
        ownMatchId = await findTeamMatchInRound(pool, match.season_id, match.week, homeTeamId, req.params.id);
        if (ownMatchId) {
          await materializeRosterIfEmpty(pool, ownMatchId, homeTeamId);
          await pool.query(
            `INSERT INTO match_rosters (match_id, team_id, player_id, source, added_by)
             VALUES ($1, $2, $3, 'regular', $4)
             ON CONFLICT (match_id, player_id) DO UPDATE SET team_id = EXCLUDED.team_id, source = 'regular', added_by = EXCLUDED.added_by`,
            [ownMatchId, homeTeamId, req.params.playerId, req.user.sub]
          );
        }
      }

      try {
        await notifyMatchRemoval(pool, {
          playerId: Number(req.params.playerId),
          removedFromTeamId: teamId,
          match,
          stillNeededTeamId: ownMatchId ? homeTeamId : undefined,
          stillNeededMatchId: ownMatchId || undefined,
        });
      } catch (err) {
        console.error('Failed to send match removal notification', err);
      }

      const updated = await fetchMatchWithRosters(pool, req.params.id);
      return res.json(updated);
    }

    if (existing.source === 'sub') {
      try {
        await notifyMatchRemoval(pool, {
          playerId: Number(req.params.playerId),
          removedFromTeamId: teamId,
          match,
        });
      } catch (err) {
        console.error('Failed to send match removal notification', err);
      }
    }

    await pool.query('DELETE FROM match_rosters WHERE match_id = $1 AND player_id = $2', [
      req.params.id,
      req.params.playerId,
    ]);

    const updated = await fetchMatchWithRosters(pool, req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// Captain-reported score proposal — never writes to matches/match_rosters
// directly, only to match_score_submissions. Admin-only recordResults()
// above is completely unaffected and remains the sole path to an official
// result; this just gives the admin something to review/prefill from.
async function submitCaptainScore(req, res, next) {
  const { homeGoals, awayGoals } = req.body;
  const scorers = Array.isArray(req.body.scorers) ? req.body.scorers : [];

  if (!Number.isInteger(homeGoals) || homeGoals < 0 || !Number.isInteger(awayGoals) || awayGoals < 0) {
    return res.status(400).json({ error: 'homeGoals and awayGoals must be non-negative integers' });
  }

  try {
    const { rows: matchRows } = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    const match = matchRows[0];
    if (!match) return res.status(404).json({ error: 'Match not found' });
    if (match.status !== 'scheduled') {
      return res.status(409).json({ error: 'This match already has a recorded result' });
    }

    const { home_team_id: homeTeamId, away_team_id: awayTeamId } = match;

    // Admins already have recordResults directly — this endpoint is for
    // whichever team the requester actually captains, not a shortcut for admin.
    const homePerm = await canEditMatchRoster(pool, req.user, homeTeamId);
    const awayPerm = await canEditMatchRoster(pool, req.user, awayTeamId);
    const myTeamId =
      homePerm.allowed && homePerm.captainOnly
        ? homeTeamId
        : awayPerm.allowed && awayPerm.captainOnly
        ? awayTeamId
        : null;

    if (!myTeamId) {
      return res.status(403).json({ error: 'Only a team captain can submit a score for their own team' });
    }

    const myGoals = myTeamId === homeTeamId ? homeGoals : awayGoals;
    const cleanScorers = scorers.filter((s) => s && Number.isInteger(s.playerId) && Number.isInteger(s.goals) && s.goals > 0);

    if (cleanScorers.length) {
      const roster = await fetchEffectiveRoster(pool, req.params.id, myTeamId);
      const rosterIds = new Set(roster.map((r) => r.player_id));
      const invalidPlayer = cleanScorers.find((s) => !rosterIds.has(s.playerId));
      if (invalidPlayer) {
        return res.status(400).json({ error: "Scorer must be on your team's roster" });
      }
    }

    const scorerSum = cleanScorers.reduce((sum, s) => sum + s.goals, 0);
    if (scorerSum !== myGoals) {
      return res.status(400).json({ error: 'Scorer goal totals must match the score you entered for your team' });
    }

    await pool.query(
      `INSERT INTO match_score_submissions (match_id, team_id, submitted_by, home_goals, away_goals, scorers)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (match_id, team_id) DO UPDATE SET
         submitted_by = EXCLUDED.submitted_by,
         home_goals = EXCLUDED.home_goals,
         away_goals = EXCLUDED.away_goals,
         scorers = EXCLUDED.scorers,
         submitted_at = now()`,
      [req.params.id, myTeamId, req.user.sub, homeGoals, awayGoals, JSON.stringify(cleanScorers)]
    );

    // If the other team has also submitted, this pair is ready for the
    // admin to review — notify every admin, whether the two reports agree
    // or conflict (same dedup pattern ensureAdminSystemNotifications uses
    // for match_needs_score in notifications.controller.js, so this either
    // creates or refreshes the existing "needs a score" reminder for each admin).
    const otherTeamId = myTeamId === homeTeamId ? awayTeamId : homeTeamId;
    const { rows: otherRows } = await pool.query(
      'SELECT home_goals, away_goals FROM match_score_submissions WHERE match_id = $1 AND team_id = $2',
      [req.params.id, otherTeamId]
    );

    if (otherRows.length) {
      const other = otherRows[0];
      const agrees = other.home_goals === homeGoals && other.away_goals === awayGoals;

      const { rows: teamRows } = await pool.query('SELECT id, name FROM teams WHERE id = ANY($1::int[])', [
        [homeTeamId, awayTeamId],
      ]);
      const teamName = (id) => teamRows.find((t) => t.id === id)?.name || 'Team';

      const message = agrees
        ? `${teamName(homeTeamId)} and ${teamName(awayTeamId)} both reported ${homeGoals}-${awayGoals} (week ${match.week}) — ready to finalize`
        : `${teamName(myTeamId)} reported ${homeGoals}-${awayGoals}, ${teamName(otherTeamId)} reported ${other.home_goals}-${other.away_goals} (week ${match.week}) — scores don't match, please review`;

      const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, message, action_url, related_match_id)
           VALUES ($1, 'match_needs_score', $2, $3, $4)
           ON CONFLICT (user_id, type, related_match_id) WHERE related_match_id IS NOT NULL
           DO UPDATE SET is_read = false, message = EXCLUDED.message, action_url = EXCLUDED.action_url`,
          [admin.id, message, `/schedule/match/${match.id}`, match.id]
        );
      }
    }

    const updated = await fetchMatchWithRosters(pool, req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getOne,
  recordResults,
  fetchEffectiveRoster,
  addRosterEntry,
  removeRosterEntry,
  submitCaptainScore,
};
