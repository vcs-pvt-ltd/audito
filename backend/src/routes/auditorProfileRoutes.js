const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/auditorProfileController');

router.use(authenticate);

// Profile
router.get('/', ctrl.getProfile);
router.put('/', ctrl.profileUpload.fields([
  { name: 'profile_picture', maxCount: 1 },
  { name: 'signature_path', maxCount: 1 },
  { name: 'cv_path', maxCount: 1 }
]), ctrl.updateProfile);

// Experiences
router.post('/experiences', ctrl.addExperience);
router.put('/experiences/:id', ctrl.updateExperience);
router.delete('/experiences/:id', ctrl.deleteExperience);

// Qualifications
router.post('/qualifications', ctrl.profileUpload.single('certificate_file'), ctrl.addQualification);
router.put('/qualifications/:id', ctrl.profileUpload.single('certificate_file'), ctrl.updateQualification);
router.delete('/qualifications/:id', ctrl.deleteQualification);

// Trainings
router.post('/trainings', ctrl.profileUpload.single('certificate_file'), ctrl.addTraining);
router.put('/trainings/:id', ctrl.profileUpload.single('certificate_file'), ctrl.updateTraining);
router.delete('/trainings/:id', ctrl.deleteTraining);

module.exports = router;
