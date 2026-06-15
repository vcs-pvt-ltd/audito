const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/capController');

router.use(authenticate);

// ── CAP CRUD ──────────────────────────────────────────────────────

// Create CAP from corrective actions
router.post('/', ctrl.createCap);

// List CAPs for current user
router.get('/', ctrl.listCaps);

// Entity heads for assignment dropdown
router.get('/entity-heads/:entityCode', ctrl.getEntityHeads);

// Create follow-up (CAP verification) audit
router.post('/create-follow-up', ctrl.createFollowUpAudit);

// List CAPs for specific audit
router.get('/audit/:auditId', ctrl.listCapsByAudit);

// CAP detail
router.get('/:id', ctrl.getCapDetail);

// Corrective actions / findings of a CAP (recursive)
router.get('/:id/corrective-actions', ctrl.getCorrectiveActions);
router.put('/:id/corrective-actions', ctrl.saveCorrectiveActions);

// CAP items for execution view
router.get('/:id/items', ctrl.getCapItems);

// Submit response to a CAP question
router.post('/:id/respond', ctrl.submitCapResponse);

// Get all responses for a CAP
router.get('/:id/responses', ctrl.getCapResponses);

// Get entity progress for a CAP
router.get('/:id/progress', ctrl.getCapProgress);

// Complete / submit a CAP
router.post('/:id/complete', ctrl.completeCap);

// Update CAP status
router.put('/:id/status', ctrl.updateCapStatus);

// Assign CAP
router.put('/:id/assign', ctrl.assignCap);

// Resolve CAP
router.put('/:id/resolve', ctrl.resolveCap);

// Evidence
router.post('/:id/evidence', ctrl.capUpload.single('evidence_file'), ctrl.uploadCapEvidence);
router.delete('/evidence/:evidenceId', ctrl.deleteCapEvidence);

module.exports = router;
