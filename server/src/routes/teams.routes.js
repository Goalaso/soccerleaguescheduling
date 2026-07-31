const express = require('express');
const { getPublished, publish } = require('../controllers/teams.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/published', requireAuth, getPublished);
router.post('/publish', requireAuth, requireRole('admin'), publish);

module.exports = router;
