const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// Protected by authenticate & authorize('audito_admin')
router.use(authenticate, authorize('audito_admin'));

// Messages routing
router.get('/messages', adminController.listMessages);
router.post('/messages/:id/reply', adminController.replyMessage);

// Promo codes routing
router.get('/promo-codes', adminController.listPromoCodes);
router.post('/promo-codes', adminController.createPromoCode);
router.post('/promo-codes/:id/deactivate', adminController.deactivatePromoCode);
router.delete('/promo-codes/:id', adminController.deletePromoCode);

// Admin users (audito_admin management)
router.get('/admins', adminController.listAdmins);
router.post('/admins', adminController.createAdmin);
router.post('/admins/:id/toggle-status', adminController.toggleAdminStatus);
router.delete('/admins/:id', adminController.deleteAdmin);

module.exports = router;
