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
} = require('../controllers/auditController');

// All routes require auth
router.use(authenticate);

// Helper route: entities that have questions in a checklist
router.get('/checklist/:id/entities', getChecklistEntities);

router.post('/',     createAudit);
router.get('/',      listAudits);
router.get('/:id',   getAudit);
router.put('/:id',   updateAudit);
router.delete('/:id', deleteAudit);
router.post('/:id/cancel', cancelAudit);

module.exports = router;
