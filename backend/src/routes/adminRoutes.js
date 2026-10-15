const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// Protected by authenticate & authorize('audito_admin')
router.use(authenticate, authorize('audito_admin'));
router.get('/package-pricing', adminController.getPackagePricing);
router.put('/package-pricing', adminController.updatePackagePricing);
router.get('/contact-reviews', adminController.listContactReviews);
router.post('/contact-reviews/:requestId/quote', adminController.quoteContactReview);
router.post('/contact-reviews/:requestId/resend-quote', adminController.resendContactReviewQuote);
router.post('/contact-reviews/:requestId/close', adminController.closeContactReview);
router.post('/contact-reviews/:requestId/reopen', adminController.reopenContactReview);
router.put('/contact-reviews/:requestId/notes', adminController.updateContactReviewNotes);
router.post('/contact-reviews/:requestId/resend-verification', adminController.resendContactReviewVerification);

router.get('/plan-settings', (_req, res) => res.status(410).json({ success: false, message: 'Pricing plans are retired. Use package pricing.' }));
router.post('/plan-settings', (_req, res) => res.status(410).json({ success: false, message: 'Pricing plans are retired.' }));
router.put('/plan-settings/yearly-discount', (_req, res) => res.status(410).json({ success: false, message: 'Plan discounts are retired.' }));
router.put('/plan-settings/:planName', (_req, res) => res.status(410).json({ success: false, message: 'Use Pricing Settings.' }));
router.get('/token-packages', adminController.listTokenReloadPackages);
router.post('/token-packages', adminController.createTokenReloadPackage);
router.put('/token-packages/:packageId', adminController.updateTokenReloadPackage);
router.delete('/token-packages/:packageId', adminController.deleteTokenReloadPackage);
router.put('/entry-prices/:entityType', (_req, res) => res.status(410).json({ success: false, message: 'Tailored accounts require review.' }));

// Automatic time-bound plan promotions (separate from promo codes)
router.get('/promotion-campaigns', adminController.listPromotionCampaigns);
router.post('/promotion-campaigns', adminController.createPromotionCampaign);
router.put('/promotion-campaigns/:campaignId', adminController.updatePromotionCampaign);
router.put('/promotion-campaigns/:campaignId/status', adminController.setPromotionCampaignStatus);

// Versioned privacy policies
router.get('/privacy-policies', adminController.listPrivacyPolicies);
router.post('/privacy-policies', adminController.createPrivacyPolicy);
router.put('/privacy-policies/:policyId', adminController.updatePrivacyPolicy);
router.post('/privacy-policies/:policyId/publish', adminController.publishPrivacyPolicy);
router.delete('/privacy-policies/:policyId', adminController.deletePrivacyPolicy);

// Messages routing
router.get('/messages', adminController.listMessages);
router.post('/messages/:id/reply', adminController.replyMessage);

// Promo codes routing
router.get('/promo-codes', adminController.listPromoCodes);
router.post('/promo-codes', adminController.createPromoCode);
router.post('/promo-codes/:id/deactivate', adminController.deactivatePromoCode);
router.post('/promo-codes/:id/activate', adminController.activatePromoCode);
router.delete('/promo-codes/:id', adminController.deletePromoCode);

// Admin users (audito_admin management)
router.get('/admins', adminController.listAdmins);
router.post('/admins', adminController.createAdmin);
router.post('/admins/:id/toggle-status', adminController.toggleAdminStatus);
router.delete('/admins/:id', adminController.deleteAdmin);

// Dashboard stats
router.get('/stats', adminController.getDashboardStats);

// Registered organizations
router.get('/organizations', adminController.listOrganizations);

// Payment transactions
router.get('/payments', adminController.listPayments);
router.post('/payments/:transactionId/approve', adminController.approveManualPayment);

module.exports = router;
