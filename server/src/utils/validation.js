const VALID_POSITIONS = ['Goalkeeper', 'Forward', 'Midfielder', 'Defender'];

function validatePlayerProfile({ position, skill, age }) {
  if (!VALID_POSITIONS.includes(position)) {
    return `position must be one of: ${VALID_POSITIONS.join(', ')}`;
  }
  if (!Number.isInteger(skill) || skill < 1 || skill > 10) {
    return 'skill must be an integer between 1 and 10';
  }
  if (!Number.isInteger(age) || age <= 0) {
    return 'age must be a positive integer';
  }
  return null;
}

// Validates leagueIds against the real `leagues` table (leagues are
// admin-renameable data, not a hardcoded enum) inside the caller's
// transaction/client so the check is consistent with whatever else
// that transaction is doing.
async function normalizeLeagueIds(client, leagueIds) {
  if (!Array.isArray(leagueIds) || leagueIds.length === 0) {
    return { error: 'leagueIds must be a non-empty array' };
  }
  const deduped = [...new Set(leagueIds)];
  if (!deduped.every((id) => Number.isInteger(id))) {
    return { error: 'leagueIds must be integers' };
  }

  const { rows } = await client.query('SELECT id FROM leagues WHERE id = ANY($1::int[])', [deduped]);
  const foundIds = new Set(rows.map((r) => r.id));
  const invalid = deduped.filter((id) => !foundIds.has(id));
  if (invalid.length) {
    return { error: `Invalid league id(s): ${invalid.join(', ')}` };
  }

  return { leagueIds: deduped };
}

module.exports = { VALID_POSITIONS, validatePlayerProfile, normalizeLeagueIds };
