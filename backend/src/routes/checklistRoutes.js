/**
 * Checklist Routes
 *
 * All routes require Bearer token authentication.
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { authenticate } = require('../middleware/auth');
const {
  createChecklistType,
  listChecklistTypes,
  updateChecklistType,
  deactivateChecklistType,
  uploadMedia,
  createChecklist,
  listChecklists,
  getChecklist,
  updateChecklist,
  deactivateChecklist,
  addQuestions,
  updateQuestion,
  deleteQuestion,
  downloadExcelTemplate,
  uploadQuestionsExcel,
  previewQuestionsExcel,
} = require('../controllers/checklistController');

// Multer: store uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx / .xls files are allowed.'));
    }
  },
});

// Multer for media files (images, PDFs, etc.)
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'video/mp4', 'video/webm',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: images, PDFs, videos.'));
    }
  },
});

router.use(authenticate);

// ── Checklist Types ──────────────────────────────────────────────
router.post  ('/types',      createChecklistType);
router.get   ('/types',      listChecklistTypes);
router.put   ('/types/:id',  updateChecklistType);
router.delete('/types/:id',  deactivateChecklistType);

// ── Media upload ─────────────────────────────────────────────────
router.post('/upload-media', mediaUpload.single('media_file'), uploadMedia);

// ── Excel template (no checklist scope needed) ───────────────────
router.get('/excel-template', downloadExcelTemplate);

// ── Excel preview (no DB writes) ──────────────────────────────────
router.post('/questions/preview-upload', upload.single('questions_file'), previewQuestionsExcel);

// ── Questions (standalone routes — must come before /:id) ────────
router.put   ('/questions/:qid', updateQuestion);
router.delete('/questions/:qid', deleteQuestion);

// ── Checklists ───────────────────────────────────────────────────
router.post  ('/',      createChecklist);
router.get   ('/',      listChecklists);
router.get   ('/:id',   getChecklist);
router.put   ('/:id',   updateChecklist);
router.delete('/:id',   deactivateChecklist);

// ── Questions under a checklist ──────────────────────────────────
router.post('/:id/questions',        addQuestions);
router.post('/:id/questions/upload', upload.single('questions_file'), uploadQuestionsExcel);

module.exports = router;
