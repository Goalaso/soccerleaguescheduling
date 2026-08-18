const pool = require('../db/pool');

function toApiShape(row) {
  return {
    id: row.id,
    name: row.name,
    openSeasonId: row.open_season_id,
    openSeasonName: row.open_season_name,
  };
}

// Public (see leagues.routes.js) — the open-season fields let the sign-up
// form offer "also include me in {season}, forming now" without exposing
// anything more sensitive than the league/season names already returned here.
async function list(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, s.id AS open_season_id, s.name AS open_season_name
       FROM leagues l
       LEFT JOIN seasons s ON s.league_id = l.id AND s.status = 'collecting_availability'
       ORDER BY l.id ASC`
    );
    res.json(rows.map(toApiShape));
  } catch (err) {
    next(err);
  }
}

async function rename(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { rows } = await pool.query(
      'UPDATE leagues SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'League not found' });
    res.json(toApiShape(rows[0]));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, rename };
