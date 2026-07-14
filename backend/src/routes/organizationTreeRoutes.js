/**
 * Organization Tree Routes
 *
 * Admin manages the organization hierarchy tree by linking
 * independently created entities.
 *
 * GET    /api/org-tree                      Full nested tree
 * POST   /api/org-tree                      Add child under parent
 * DELETE /api/org-tree/:id          Remove a tree edge
 * GET    /api/org-tree/entities/:entityType  List all entities of a type
 */

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getTree,
  addNode,
  removeNode,
  listEntitiesOfType,
  syncTree
} = require('../controllers/organizationTreeController');

router.use(authenticate);

router.get('/',                        getTree);
router.post('/',                       addNode);
router.post('/sync',                   syncTree);
router.delete('/:id',                  removeNode);
router.get('/entities/:entityType',    listEntitiesOfType);

module.exports = router;
