const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createLink,
  previewLinkTarget,
  respondToLink,
  getMyLinks,
  getPendingLinks,
  removeLink,
  getLinkedEntityData
} = require('../controllers/linkController');

// All routes require authentication
router.use(authenticate, authorize('admin'));

router.post('/',                  createLink);
router.post('/preview',           previewLinkTarget);
router.get('/',                   getMyLinks);
router.get('/pending',            getPendingLinks);
router.get('/:linkCode/data',     getLinkedEntityData);
router.put('/:linkCode/respond',  respondToLink);
router.delete('/:linkCode',       removeLink);

module.exports = router;
