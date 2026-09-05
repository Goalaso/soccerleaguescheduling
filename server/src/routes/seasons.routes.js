const express = require('express');
const {
  list,
  getOne,
  create,
  getAvailability,
  setAvailability,
  setAvailabilityBatch,
  setMyAvailability,
  addAvailability,
  remove,
} = require('../controllers/seasons.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, list);
router.get('/:id', requireAuth, getOne);
router.post('/', requireAuth, requireRole('admin'), create);
router.delete('/:id', requireAuth, requireRole('admin'), remove);
router.get('/:id/availability', requireAuth, requireRole('admin'), getAvailability);
router.post('/:id/availability', requireAuth, requireRole('admin'), addAvailability);
// Applies several players' availability changes in one request (see
// setAvailabilityBatch) — distinct path shape from the two PATCH routes
// below (no extra segment), so there's no route-ordering ambiguity.
router.patch('/:id/availability', requireAuth, requireRole('admin'), setAvailabilityBatch);
// Order matters: the literal "me" route must be registered before the
// generic :playerId route below, or "me" would be captured as a playerId.
router.patch('/:id/availability/me', requireAuth, setMyAvailability);
router.patch('/:id/availability/:playerId', requireAuth, requireRole('admin'), setAvailability);

module.exports = router;
