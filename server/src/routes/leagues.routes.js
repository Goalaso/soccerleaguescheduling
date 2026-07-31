const express = require('express');
const { list, rename } = require('../controllers/leagues.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: the registration form needs the league list before the visitor
// has an account, and league names carry no sensitive info.
router.get('/', list);
router.patch('/:id', requireAuth, requireRole('admin'), rename);

module.exports = router;
