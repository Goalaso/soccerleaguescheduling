const express = require('express');
const {
  list,
  getOne,
  create,
  getAvailability,
  setAvailability,
  setMyAvailability,
} = require('../controllers/seasons.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, list);
router.get('/:id', requireAuth, getOne);
router.post('/', requireAuth, requireRole('admin'), create);
router.get('/:id/availability', requireAuth, requireRole('admin'), getAvailability);
// Order matters: the literal "me" route must be registered before the
// generic :playerId route below, or "me" would be captured as a playerId.
router.patch('/:id/availability/me', requireAuth, setMyAvailability);
router.patch('/:id/availability/:playerId', requireAuth, requireRole('admin'), setAvailability);

module.exports = router;
