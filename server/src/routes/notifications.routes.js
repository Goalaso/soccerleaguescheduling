const express = require('express');
const { list, markRead, remove } = require('../controllers/notifications.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, list);
router.patch('/:id', requireAuth, markRead);
router.delete('/:id', requireAuth, remove);

module.exports = router;
