const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/auditExecutionController');

router.use(authenticate);

// Auditor's assigned audits
router.get('/my-audits', authorize('auditor', 'entity_head'), ctrl.listMyAudits);

// Corrective actions (CAP-required questions)
router.get('/:id/corrective-actions', authorize('auditor'), ctrl.getCorrectiveActions);
router.put('/:id/corrective-actions', authorize('auditor'), ctrl.saveCorrectiveActions);

// Audit detail (auditor or admin)
router.get('/:id', ctrl.getAuditDetail);

// Start audit
router.post('/:id/start', authorize('auditor'), ctrl.startAudit);

// Submit question response
router.post('/:id/respond', authorize('auditor'), ctrl.submitResponse);

// Get all responses
router.get('/:id/responses', ctrl.getResponses);

// Get responses for specific entity
router.get('/:id/responses/:entityCode', ctrl.getEntityResponses);

// Upload evidence
router.post('/:id/evidence', authorize('auditor'), ctrl.upload.single('evidence_file'), ctrl.uploadEvidence);

// Delete evidence
router.delete('/evidence/:evidenceId', authorize('auditor'), ctrl.deleteEvidence);

// Progress
router.get('/:id/progress', ctrl.getProgress);

// Complete audit
router.post('/:id/complete', authorize('auditor'), ctrl.completeAudit);

// Entity tree for audit
router.get('/:id/entity-tree', ctrl.getEntityTree);

// Report
router.get('/:id/report', ctrl.getReport);

module.exports = router;
