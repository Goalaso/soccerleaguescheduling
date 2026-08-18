export const TEAM_NAMES = [
  'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
];

export const TEAM_COLORS = [
  '#3d5afe', '#22c55e', '#ef4444', '#f2994a', '#a855f7', '#14b8a6', '#ec4899', '#94a3b8',
];

const MIN_AGE = 18;
const MAX_AGE = 45;

function scorePlayer(player, balanceBySkill, balanceByAge) {
  const skillScore = player.skill;
  const ageScore = ((player.age - MIN_AGE) / (MAX_AGE - MIN_AGE)) * 10;

  if (balanceBySkill && balanceByAge) return (skillScore + ageScore) / 2;
  if (balanceBySkill) return skillScore;
  if (balanceByAge) return ageScore;
  return Math.random() * 10;
}

function snakeDistribute(players, teams, playersPerTeam) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  let teamIndex = 0;
  let direction = 1;

  const advance = () => {
    teamIndex += direction;
    if (teamIndex >= teams.length) {
      teamIndex = teams.length - 1;
      direction = -1;
    } else if (teamIndex < 0) {
      teamIndex = 0;
      direction = 1;
    }
  };

  sorted.forEach((player) => {
    let attempts = 0;
    while (teams[teamIndex].players.length >= playersPerTeam && attempts < teams.length) {
      advance();
      attempts += 1;
    }
    if (teams[teamIndex].players.length < playersPerTeam) {
      teams[teamIndex].players.push(player);
    }
    advance();
  });
}

function groupByPosition(players) {
  return players.reduce((groups, player) => {
    if (!groups[player.position]) groups[player.position] = [];
    groups[player.position].push(player);
    return groups;
  }, {});
}

export function generateTeams(allPlayers, options) {
  const {
    numTeams,
    playersPerTeam,
    balanceBySkill,
    balanceByAge,
    balanceByPosition,
    teamNames,
  } = options;

  const needed = numTeams * playersPerTeam;
  const pool = allPlayers
    .slice(0, Math.min(needed, allPlayers.length))
    .map((player) => ({ ...player, score: scorePlayer(player, balanceBySkill, balanceByAge) }));

  // A season set its own names at creation time (see CreateSeasonView) —
  // used verbatim, no "Team " prefix injected, since that's exactly what
  // was typed. Falls back to the default Alpha/Bravo/... scheme when none
  // were set (older seasons, or the non-season-scoped generator flow).
  const teams = Array.from({ length: numTeams }, (_, index) => ({
    id: index,
    name: teamNames?.[index] || `Team ${TEAM_NAMES[index] || index + 1}`,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    players: [],
  }));

  if (balanceByPosition) {
    const groups = groupByPosition(pool);
    Object.values(groups).forEach((group) => snakeDistribute(group, teams, playersPerTeam));
  } else {
    snakeDistribute(pool, teams, playersPerTeam);
  }

  return teams.map((team) => summarizeTeam(team));
}

// Exported so pre-publish roster edits (moving/adding/removing a player in
// SeasonTeamGenerator's local state) can recompute avgSkill/counts after
// each change, the same way this runs once at initial generation.
export function summarizeTeam(team) {
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

export function summarizeBalance(teams) {
  if (!teams.length) return { avgSkill: 0, label: 'N/A' };

  const avgSkills = teams.map((t) => t.avgSkill);
  const overallAvg = avgSkills.reduce((sum, v) => sum + v, 0) / avgSkills.length;
  const spread = Math.max(...avgSkills) - Math.min(...avgSkills);

  let label = 'Low';
  if (spread < 0.5) label = 'High';
  else if (spread < 1.5) label = 'Medium';

  return {
    avgSkill: Math.round(overallAvg * 10) / 10,
    label,
  };
}
