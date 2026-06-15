const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const ctrl = require('../controllers/learningController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

router.use(authenticate);

router.get('/trainings', ctrl.listTrainings);
router.post('/trainings', ctrl.createTraining);
router.put('/trainings/:id', ctrl.updateTraining);
router.delete('/trainings/:id', ctrl.deleteTraining);
router.post('/trainings/:id/assign', ctrl.assignTraining);

router.get('/field-visits', ctrl.listFieldVisits);
router.post('/field-visits', ctrl.createFieldVisit);
router.put('/field-visits/:id', ctrl.updateFieldVisit);
router.delete('/field-visits/:id', ctrl.deleteFieldVisit);
router.post('/field-visits/:id/assign', ctrl.assignFieldVisit);

router.get('/evaluation-papers', ctrl.listEvaluationPapers);
router.post('/evaluation-papers', ctrl.createEvaluationPaper);
router.put('/evaluation-papers/:id', ctrl.updateEvaluationPaper);
router.delete('/evaluation-papers/:id', ctrl.deleteEvaluationPaper);
router.post('/evaluation-papers/:id/questions', ctrl.setEvaluationQuestions);
router.get('/evaluation-papers/excel-template', ctrl.downloadEvaluationExcelTemplate);
router.post('/evaluation-papers/questions/preview-upload', upload.single('questions_file'), ctrl.previewEvaluationQuestionsExcel);
router.post('/evaluation-papers/:id/questions/upload', upload.single('questions_file'), ctrl.uploadEvaluationQuestionsExcel);
router.post('/evaluation-papers/:id/assign', ctrl.assignEvaluationPaper);

module.exports = router;
