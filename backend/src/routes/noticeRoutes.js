const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const noticeController = require('../controllers/noticeController');

router.use(authenticate);
router.get('/', authorize('admin', 'auditor', 'entity_head', 'audito_admin'), noticeController.getMyNotices);
router.patch('/read-all', authorize('admin', 'auditor', 'entity_head', 'audito_admin'), noticeController.markAllMyNotificationsRead);
router.patch('/:id/read', authorize('admin', 'auditor', 'entity_head', 'audito_admin'), noticeController.markMyNotificationRead);
router.patch('/:id/unread', authorize('admin', 'auditor', 'entity_head', 'audito_admin'), noticeController.markMyNotificationUnread);
router.delete('/:id', authorize('admin', 'auditor', 'entity_head', 'audito_admin'), noticeController.deleteMyNotification);

module.exports = router;
