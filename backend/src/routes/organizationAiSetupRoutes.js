const express = require('express');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/organizationAiSetupController');
const { errorResponse } = require('../utils/helpers');
const { isSupportedOnboardingDocument } = require('../utils/documentReader');
const LimitsEnforcer = require('../utils/limitsEnforcer');
// Serialize draft mutations and publishing across backend processes. This also
// makes a repeated publish return the original checklist instead of duplicating it.
const serialized = handler => async (req, res, next) => {
  try { await LimitsEnforcer.withQuotaLock(req.user.entityCode, 'organization-ai-setup', () => handler(req, res)); }
  catch (error) { next(error); }
};

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, callback) => {
    const supported = isSupportedOnboardingDocument(file);
    callback(supported ? null : new Error(`${file.originalname} is not supported. Upload Excel, CSV, Word, PowerPoint, PDF, text, or a photo (PNG, JPG, WEBP).`), supported);
  }
});

const handleUpload = (req, res, next) => upload.array('documents', 4)(req, res, (error) => {
  if (!error) return next();
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return errorResponse(res, 'Each document must be 10 MB or smaller.', 400);
  return errorResponse(res, error.message || 'Unable to read the uploaded document.', 400);
});

router.use(authenticate, authorize('admin'));
router.get('/current', controller.getCurrentSession);
router.get('/completion', controller.getCompletion);
router.post('/', serialized(controller.createSession));
router.get('/:id', controller.getSession);
router.post('/:id/analyze', handleUpload, serialized(controller.analyze));
router.post('/:id/questions', serialized(controller.generateQuestions));
router.post('/:id/chat', serialized(controller.chat));
router.put('/:id', serialized(controller.updateDraft));
router.post('/:id/discard', serialized(controller.discard));
router.post('/:id/publish', serialized(controller.publish));

module.exports = router;
