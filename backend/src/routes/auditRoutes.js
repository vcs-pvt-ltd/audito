const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getChecklistEntities,
  createAudit,
  listAudits,
  getAudit,
  updateAudit,
  deleteAudit,
  cancelAudit,
  getAuditCount,
} = require('../controllers/auditController');

// All routes require auth
router.use(authenticate);

// Helper route: entities that have questions in a checklist
router.get('/checklist/:checklist_id/entities', getChecklistEntities);

// Count route — must be before /:id to avoid being swallowed by the param route
router.get('/count', getAuditCount);

router.post('/',     createAudit);
router.get('/',      listAudits);
router.get('/:id',   getAudit);
router.put('/:id',   updateAudit);
router.delete('/:id', deleteAudit);
router.post('/:id/cancel', cancelAudit);

module.exports = router;
