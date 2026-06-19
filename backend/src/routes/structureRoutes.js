/**
 * Hierarchy Routes
 *
 * After registering, an admin uses these endpoints to build the
 * internal structure of their organization.
 *
 * ─── CUSTOMER ─────────────────────────────────────
 *   POST  body.entity_type = 'Buying Office'   → customer_buying_offices
 *   POST  body.entity_type = 'Supplier'         → suppliers
 *
 * ─── COMPANY ──────────────────────────────────────
 *   POST  body.entity_type = 'Cluster'          → company_clusters
 *   POST  body.entity_type = 'Factory'          → company_factories
 *   POST  body.entity_type = 'Unit'             → company_units
 *   POST  body.entity_type = 'Department'       → company_departments
 *
 * ─── AUDIT FIRM ───────────────────────────────────
 *   (no sub-entities — Audit Firm Company is a flat entity)
 *
 * All routes require Bearer token.
 *
 * POST   /api/structure                                     Create a sub-entity
 * GET    /api/structure/tree                                Full nested tree of your org
 * GET    /api/structure/children/:entityType/:code          Direct children of a specific node
 * PUT    /api/structure/:entityType/:code                   Update a sub-entity
 * DELETE /api/structure/:entityType/:code                   Deactivate a sub-entity
 */

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createSubEntity,
  updateSubEntity,
  deleteSubEntity,
  listByType
} = require('../controllers/structureController');

router.use(authenticate);

router.post('/', createSubEntity);
router.get('/list/:entityType', listByType);
router.put('/:entityType/:code', updateSubEntity);
router.delete('/:entityType/:code', deleteSubEntity);

module.exports = router;
