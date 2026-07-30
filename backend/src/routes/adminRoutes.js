const express = require('express');
const multer = require('multer');
const router = express.Router();
const adminController = require('../controllers/adminController');
const aiKnowledgeController = require('../controllers/aiKnowledgeController');
const { authenticate, authorize } = require('../middleware/auth');
const { errorResponse } = require('../utils/helpers');

const aiKnowledgeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const accepted = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/markdown',
    ];
    if (accepted.includes(file.mimetype) || /\.(pdf|doc|docx|txt|md)$/i.test(file.originalname || '')) return cb(null, true);
    return cb(new Error('Only PDF, Word, TXT, and Markdown documents are allowed.'));
  },
});

const handleAiKnowledgeUpload = (req, res, next) => {
  aiKnowledgeUpload.single('document')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'Document must be 10 MB or smaller.', 400);
    }
    return errorResponse(res, error.message || 'Unable to upload the document.', 400);
  });
};

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

// Versioned privacy policies
router.get('/privacy-policies', adminController.listPrivacyPolicies);
router.post('/privacy-policies', adminController.createPrivacyPolicy);
router.put('/privacy-policies/:policyId', adminController.updatePrivacyPolicy);
router.post('/privacy-policies/:policyId/publish', adminController.publishPrivacyPolicy);
router.delete('/privacy-policies/:policyId', adminController.deletePrivacyPolicy);

// Public knowledge used by Audito AI Assistant
router.get('/ai-knowledge', aiKnowledgeController.listKnowledgeSources);
router.post('/ai-knowledge/articles', aiKnowledgeController.createArticle);
router.post('/ai-knowledge/documents', handleAiKnowledgeUpload, aiKnowledgeController.createDocument);
router.put('/ai-knowledge/:sourceId', aiKnowledgeController.updateSource);
router.post('/ai-knowledge/:sourceId/publish', aiKnowledgeController.publishSource);
router.post('/ai-knowledge/:sourceId/unpublish', aiKnowledgeController.unpublishSource);
router.delete('/ai-knowledge/:sourceId', aiKnowledgeController.deleteSource);

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
