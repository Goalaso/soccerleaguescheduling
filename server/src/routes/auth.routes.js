const express = require('express');
const {
  register,
  login,
  logout,
  me,
  updateMe,
  updatePreferences,
  deleteMe,
  devLoginAsAdmin,
} = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/dev-login-admin', devLoginAsAdmin);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);
router.patch('/me/preferences', requireAuth, updatePreferences);
router.delete('/me', requireAuth, deleteMe);

module.exports = router;
