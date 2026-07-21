const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// Protected by authenticate & authorize('audito_admin')
router.use(authenticate, authorize('audito_admin'));

router.get('/plan-settings', adminController.listPlanSettings);
router.post('/plan-settings', adminController.createPlanSettings);
router.put('/plan-settings/yearly-discount', adminController.updateYearlyDiscount);
router.put('/plan-settings/:planName', adminController.updatePlanSettings);
router.put('/entry-prices/:entityType', adminController.updateEntryPrice);

// Automatic time-bound plan promotions (separate from promo codes)
router.get('/promotion-campaigns', adminController.listPromotionCampaigns);
router.post('/promotion-campaigns', adminController.createPromotionCampaign);
router.put('/promotion-campaigns/:campaignId', adminController.updatePromotionCampaign);
router.put('/promotion-campaigns/:campaignId/status', adminController.setPromotionCampaignStatus);

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

// Custom solution requests
router.get('/custom-solutions', adminController.listCustomSolutions);
router.get('/custom-solutions/:requestId', adminController.getCustomSolution);
router.post('/custom-solutions/:requestId/assign-price', adminController.assignCustomSolutionPrice);

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);

// Registered organizations
router.get('/organizations', adminController.listOrganizations);

// Payment transactions
router.get('/payments', adminController.listPayments);

module.exports = router;
