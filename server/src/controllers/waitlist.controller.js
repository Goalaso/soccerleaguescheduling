const pool = require('../db/pool');

function toApiShape(row) {
  return {
    id: row.id,
    email: row.email,
    rawSubject: row.raw_subject,
    rawSnippet: row.raw_snippet,
    seasonOpen: row.season_open,
    receivedAt: row.received_at,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
  };
}

// Defaults to pending only, same convention as GET /notifications — pass
// ?all=true to see the full history including already-reviewed entries.
async function list(req, res, next) {
  try {
    const { rows } = await pool.query(
      req.query.all === 'true'
        ? 'SELECT * FROM waitlist_entries ORDER BY received_at DESC'
        : `SELECT * FROM waitlist_entries WHERE status = 'pending' ORDER BY received_at DESC`
    );
    res.json(rows.map(toApiShape));
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  const { status } = req.body;
  if (!['approved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'dismissed'" });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE waitlist_entries SET status = $1, reviewed_by = $2, reviewed_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, req.user.sub, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Waitlist entry not found' });
    res.json(toApiShape(rows[0]));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, updateStatus };
