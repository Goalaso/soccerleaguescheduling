const express = require('express');
const { list, getOne, recordResults } = require('../controllers/matches.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, list);
router.get('/:id', requireAuth, getOne);
router.post('/:id/results', requireAuth, requireRole('admin'), recordResults);

module.exports = router;
