const express = require('express');
const { list, getOne, create, update, remove, getMe, updateMe } = require('../controllers/players.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Self-service routes must be registered before /:id, or Express would
// treat "me" as the :id param.
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);

router.get('/', requireAuth, requireRole('admin'), list);
router.get('/:id', requireAuth, requireRole('admin'), getOne);
router.post('/', requireAuth, requireRole('admin'), create);
router.patch('/:id', requireAuth, requireRole('admin'), update);
router.delete('/:id', requireAuth, requireRole('admin'), remove);

module.exports = router;
