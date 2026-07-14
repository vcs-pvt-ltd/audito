/**
 * Auth Routes
 * 
 * POST /api/auth/register          - Register ANY org/entity type (public)
 *   Top-level:  send account_type_id (no parent_org_id)
 *   Sub-entity: send entity_type_id + parent_org_id
 * POST /api/auth/login             - Login
 * POST /api/auth/refresh-token     - Refresh access token
 * POST /api/auth/logout            - Logout
 * GET  /api/auth/me                - Get current user profile (protected)
 * GET  /api/users/:userId          - Get user by user_id e.g. USR-00000001 (protected)
 * PUT  /api/auth/change-password   - Change password (protected)
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/set-admin-password', authController.setAdminPassword);
router.post('/validate-promo-code', authController.validatePromoCode);

// Protected routes
router.get('/me', authenticate, authController.getMe);
router.get('/onboarding', authenticate, authController.getOnboardingStatus);
router.put('/onboarding', authenticate, authController.updateOnboardingStatus);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/organization', authenticate, authController.updateOrganization);
router.put('/change-password', authenticate, authController.changePassword);
router.post('/switch-account', authenticate, authController.switchAccount);


module.exports = router;


