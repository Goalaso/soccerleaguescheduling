// Round-robin fixture generator — same circle-method algorithm as the
// (now removed) client-side simulator in src/utils/season.js, ported here
// because schedule generation is now real, persisted data.

function roundRobinRounds(teamIds) {
  const ids = [...teamIds];
  const n = ids.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r += 1) {
    const round = [];
    for (let i = 0; i < n / 2; i += 1) {
      round.push([ids[i], ids[n - 1 - i]]);
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

function nextMonday(from = new Date()) {
  const date = new Date(from);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysUntilMonday = (8 - day) % 7 || 7;
  date.setDate(date.getDate() + (day === 1 ? 0 : daysUntilMonday));
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildRoundRobinFixtures(teamIds, numWeeks = 12, startDate = nextMonday()) {
  const rounds = roundRobinRounds(teamIds);
  const fixtures = [];

  for (let week = 1; week <= numWeeks; week += 1) {
    const cycleIndex = week - 1;
    const round = rounds[cycleIndex % rounds.length];
    const flip = Math.floor(cycleIndex / rounds.length) % 2 === 1;

    const matchDate = new Date(startDate);
    matchDate.setDate(matchDate.getDate() + (week - 1) * 7);

    round.forEach(([aId, bId]) => {
      fixtures.push({
        week,
        homeId: flip ? bId : aId,
        awayId: flip ? aId : bId,
        matchDate,
      });
    });
  }

  return fixtures;
}

module.exports = { buildRoundRobinFixtures, nextMonday };
