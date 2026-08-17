const express = require('express');
const {
  list,
  getOne,
  recordResults,
  addRosterEntry,
  removeRosterEntry,
  submitCaptainScore,
} = require('../controllers/matches.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, list);
router.get('/:id', requireAuth, getOne);
router.post('/:id/results', requireAuth, requireRole('admin'), recordResults);
// Not requireRole('admin') — team captains (regular players) need access
// too; the permission split between admin/captain is handled inside the
// controller since it depends on which team is being touched.
router.post('/:id/roster', requireAuth, addRosterEntry);
router.delete('/:id/roster/:playerId', requireAuth, removeRosterEntry);
// Captain-only in practice (checked inside the controller) — a proposal
// that only ever prefills the admin's recordResults form, never writes
// the official result itself.
router.post('/:id/submit-score', requireAuth, submitCaptainScore);

module.exports = router;
