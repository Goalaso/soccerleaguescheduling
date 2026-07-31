const pool = require('../db/pool');

function toApiShape(row) {
  return { id: row.id, name: row.name };
}

async function list(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM leagues ORDER BY id ASC');
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
