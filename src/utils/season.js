// Pure aggregation over real matches fetched from the API (see
// src/hooks/useMatches.js). Scheduling and results used to be simulated
// client-side with a seeded PRNG — now both are real, persisted server-side
// (server/src/controllers/matches.controller.js), so this file only reduces
// over that data. No randomness here.

// matchDate from the API is a plain calendar date ('YYYY-MM-DD', no time or
// timezone — see server/src/db/pool.js's DATE type-parser override).
// `new Date(str)` on a date-only string parses it as UTC, so any getter
// used downstream (.getDate(), .getDay(), toLocaleDateString(), ...) would
// still shift by a day for anyone browsing from west of UTC. Pulling the
// Y/M/D apart and using the local-time Date constructor sidesteps that
// entirely — the result represents exactly the calendar date that was
// stored, regardless of the browser's (or, previously, the server's) timezone.
export function parseMatchDate(matchDate) {
  const [year, month, day] = matchDate.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function buildSeasonFromMatches(matches, teams) {
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));
  const standingsById = Object.fromEntries(
    teams.map((t) => [t.id, { team: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }])
  );

  const playerGoals = {};
  const teamPlayerGoals = {};
  const scorersFlat = [];

  const mapped = matches.map((m) => {
    const played = m.status === 'played';

    if (played) {
      const homeStanding = standingsById[m.home.id];
      const awayStanding = standingsById[m.away.id];
      if (homeStanding && awayStanding) {
        homeStanding.mp += 1;
        awayStanding.mp += 1;
        homeStanding.gf += m.homeGoals;
        homeStanding.ga += m.awayGoals;
        awayStanding.gf += m.awayGoals;
        awayStanding.ga += m.homeGoals;

        if (m.homeGoals > m.awayGoals) {
          homeStanding.w += 1;
          awayStanding.l += 1;
        } else if (m.homeGoals < m.awayGoals) {
          awayStanding.w += 1;
          homeStanding.l += 1;
        } else {
          homeStanding.d += 1;
          awayStanding.d += 1;
        }
      }

      (m.scorers || []).forEach((s) => {
        playerGoals[s.playerId] = (playerGoals[s.playerId] || 0) + s.goals;
        // Team-scoped total — goals scored *while playing for that team in
        // that match*, per s.teamId. A player borrowed by another team for
        // one match still only counts toward that team here, unlike the
        // flat playerGoals total above (which is intentionally
        // team-agnostic, for the league-wide top scorers list).
        (teamPlayerGoals[s.teamId] ||= {});
        teamPlayerGoals[s.teamId][s.playerId] = (teamPlayerGoals[s.teamId][s.playerId] || 0) + s.goals;
        scorersFlat.push(s);
      });
    }

    return {
      id: m.id,
      week: m.week,
      homeId: m.home.id,
      awayId: m.away.id,
      date: parseMatchDate(m.matchDate),
      home: m.home,
      away: m.away,
      played,
      result: played ? { homeGoals: m.homeGoals, awayGoals: m.awayGoals } : null,
    };
  });

  const standings = Object.values(standingsById)
    .map((s) => ({
      ...s,
      team: teamsById[s.team.id] || s.team,
      gd: s.gf - s.ga,
      pts: s.w * 3 + s.d,
    }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

  const topScorers = Object.entries(playerGoals)
    .map(([playerId, goals]) => {
      const info = scorersFlat.find((s) => String(s.playerId) === playerId);
      return {
        id: playerId,
        name: info?.playerName,
        teamName: info?.teamName,
        teamColor: info?.teamColor,
        goals,
      };
    })
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);

  const totalWeeks = matches.length ? Math.max(...matches.map((m) => m.week)) : 0;
  const scheduledWeeks = matches.filter((m) => m.status === 'scheduled').map((m) => m.week);
  const currentWeek = scheduledWeeks.length ? Math.min(...scheduledWeeks) : totalWeeks + 1;

  const nextMatch =
    mapped.find((m) => m.week === currentWeek && !m.played) || mapped.find((m) => !m.played) || null;

  return {
    currentWeek,
    totalWeeks,
    matches: mapped,
    standings,
    topScorers,
    playerGoals,
    teamPlayerGoals,
    nextMatch,
  };
}

export function getTeamMatches(season, teamId) {
  return season.matches
    .filter((m) => m.played && (m.homeId === teamId || m.awayId === teamId))
    .sort((a, b) => b.week - a.week);
}

export function matchResultLetter(match, teamId) {
  const isHome = match.homeId === teamId;
  const forGoals = isHome ? match.result.homeGoals : match.result.awayGoals;
  const againstGoals = isHome ? match.result.awayGoals : match.result.homeGoals;
  if (forGoals > againstGoals) return 'W';
  if (forGoals < againstGoals) return 'L';
  return 'D';
}

export function formatMatchDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// A scheduled match only genuinely "needs a score" once its date has
// passed — a future scheduled match isn't overdue, just not played yet.
export function isMatchOverdue(match) {
  if (match.status !== 'scheduled') return false;
  const matchDate = parseMatchDate(match.matchDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return matchDate <= today;
}
