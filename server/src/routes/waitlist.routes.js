const express = require('express');
const { list, updateStatus } = require('../controllers/waitlist.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin'), list);
router.patch('/:id', requireAuth, requireRole('admin'), updateStatus);

module.exports = router;
