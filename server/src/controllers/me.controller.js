const pool = require('../db/pool');

// Generic "things this user needs to act on" seam. Only one producer exists
// today (pending season-availability responses), but the shape is
// deliberately generic ({ type, message, actionUrl }) so a real notification
// system can feed the same list/endpoint/UI later without a homepage rework.
async function getPendingActions(req, res, next) {
  try {
    const { rows: playerRows } = await pool.query('SELECT id FROM players WHERE user_id = $1', [
      req.user.sub,
    ]);
    const player = playerRows[0];
    if (!player) return res.json({ actions: [] });

    const { rows } = await pool.query(
      `SELECT sa.season_id, s.name AS season_name, l.name AS league_name
       FROM season_availability sa
       JOIN seasons s ON s.id = sa.season_id
       JOIN leagues l ON l.id = s.league_id
       WHERE sa.player_id = $1 AND sa.is_available IS NULL AND s.status = 'collecting_availability'
       ORDER BY s.id DESC`,
      [player.id]
    );

    const actions = rows.map((r) => ({
      type: 'season_availability',
      seasonId: r.season_id,
      message: `Are you available to play in ${r.season_name} (${r.league_name})?`,
    }));

    res.json({ actions });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPendingActions };
