const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/myLearningController');

router.use(authenticate);

// Trainings
router.get('/trainings', ctrl.listMyTrainings);
router.post('/trainings/:assignmentId/progress', ctrl.saveTrainingProgress);
router.post('/trainings/:assignmentId/complete', ctrl.completeTraining);

// Field visits
router.get('/field-visits', ctrl.listMyFieldVisits);
router.post('/field-visits/:assignmentId/complete', ctrl.completeFieldVisit);

// Evaluation papers
router.get('/evaluation-papers', ctrl.listMyEvaluationPapers);
router.get('/evaluation-papers/:paperId', ctrl.getMyEvaluationPaper);
router.post('/evaluation-papers/:paperId/start', ctrl.startMyEvaluationPaper);
router.post('/evaluation-papers/:paperId/submit', ctrl.submitMyEvaluationPaper);

module.exports = router;
