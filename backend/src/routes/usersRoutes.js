/**
 * Users Routes
 *
 * Public routes (no auth):
 *   POST /api/users/verify-email     Verify email token
 *   POST /api/users/set-password     Set password after verification
 *
 * Protected routes (admin auth):
 *   POST   /api/users                Create user
 *   GET    /api/users                List users
 *   GET    /api/users/:userCode      Get user
 *   PUT    /api/users/:userCode      Update user
 *   DELETE /api/users/:userCode      Delete user
 *   POST   /api/users/:userCode/resend  Resend verification
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  resendVerification,
  verifyEmail,
  setPassword,
  checkAdminEmail,
  createUserFromAdmin,
} = require('../controllers/usersController');

// Public routes (before authenticate middleware)
router.post('/verify-email', verifyEmail);
router.post('/set-password', setPassword);

// Protected routes
router.post('/check-admin-email', authenticate, checkAdminEmail);
router.post('/create-from-admin', authenticate, createUserFromAdmin);
router.post('/', authenticate, createUser);
router.get('/', authenticate, listUsers);
router.get('/:userCode', authenticate, getUser);
router.put('/:userCode', authenticate, updateUser);
router.delete('/:userCode', authenticate, deleteUser);
router.post('/:userCode/resend', authenticate, resendVerification);

module.exports = router;
