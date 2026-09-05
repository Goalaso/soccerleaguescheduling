const express = require('express');
const {
  getPublished,
  publish,
  getStats,
  addSeasonPlayer,
  removeSeasonPlayer,
  moveSeasonPlayer,
  setCaptain,
  batchEditRoster,
} = require('../controllers/teams.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/published', requireAuth, getPublished);
router.get('/stats', requireAuth, getStats);
router.post('/publish', requireAuth, requireRole('admin'), publish);
// Top-level (not nested under :teamId) since a batch can span moves
// between two different teams — the season is carried in the body instead.
router.post('/roster/batch', requireAuth, requireRole('admin'), batchEditRoster);
router.post('/:teamId/players', requireAuth, requireRole('admin'), addSeasonPlayer);
router.delete('/:teamId/players/:playerId', requireAuth, requireRole('admin'), removeSeasonPlayer);
router.post('/:teamId/players/:playerId/move', requireAuth, requireRole('admin'), moveSeasonPlayer);
router.patch('/:id/captain', requireAuth, requireRole('admin'), setCaptain);

module.exports = router;
