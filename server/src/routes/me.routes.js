const express = require('express');
const { getPendingActions } = require('../controllers/me.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/pending-actions', requireAuth, getPendingActions);

module.exports = router;
