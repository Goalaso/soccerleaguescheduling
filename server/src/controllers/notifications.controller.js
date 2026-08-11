const pool = require('../db/pool');

function toApiShape(row) {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    actionUrl: row.action_url,
    relatedSeasonId: row.related_season_id,
    relatedMatchId: row.related_match_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

// System-detected condition, not tied to any single admin action: a
// scheduled match's date has passed with no recorded score yet. Lazily
// checked on read (same pattern as the lazy schedule generation in
// matches.controller.js) rather than needing a scheduler.
//
// This is an upsert, not an insert-if-missing: it unconditionally ensures
// an *unread* notification exists for every still-overdue match, self-
// healing anything that's stuck read (match_needs_score is actionable —
// see notificationTypes.js on the client — so nothing should ever leave it
// read without also deleting it, but this guards against stale rows from
// before that rule existed, or any future code path that breaks it). The
// partial unique index on (user_id, type, related_match_id) is what makes
// ON CONFLICT ... DO UPDATE target the right row instead of duplicating.
async function ensureAdminSystemNotifications(client, adminUserId) {
  const { rows: overdueMatches } = await client.query(
    `SELECT m.id, m.week, ht.name AS home_name, at.name AS away_name
     FROM matches m
     JOIN teams ht ON ht.id = m.home_team_id
     JOIN teams at ON at.id = m.away_team_id
     WHERE m.status = 'scheduled' AND m.match_date < now()`
  );

  for (const m of overdueMatches) {
    await client.query(
      `INSERT INTO notifications (user_id, type, message, action_url, related_match_id)
       VALUES ($1, 'match_needs_score', $2, $3, $4)
       ON CONFLICT (user_id, type, related_match_id) WHERE related_match_id IS NOT NULL
       DO UPDATE SET is_read = false, message = EXCLUDED.message, action_url = EXCLUDED.action_url`,
      [
        adminUserId,
        `${m.home_name} vs ${m.away_name} (week ${m.week}) needs a score`,
        `/schedule/match/${m.id}`,
        m.id,
      ]
    );
  }
}

async function list(req, res, next) {
  try {
    if (req.user.role === 'admin') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await ensureAdminSystemNotifications(client, req.user.sub);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // The homepage panel wants unread-only; the full history page passes
    // ?all=true to also see read ones (still newest-first within each).
    const includeRead = req.query.all === 'true';
    const { rows } = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1 ${includeRead ? '' : 'AND is_read = false'}
       ORDER BY is_read ASC, created_at DESC`,
      [req.user.sub]
    );
    res.json(rows.map(toApiShape));
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  const { isRead } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE notifications SET is_read = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [isRead !== false, req.params.id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json(toApiShape(rows[0]));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { rowCount } = await pool.query(`DELETE FROM notifications WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user.sub,
    ]);
    if (!rowCount) return res.status(404).json({ error: 'Notification not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, markRead, remove };
