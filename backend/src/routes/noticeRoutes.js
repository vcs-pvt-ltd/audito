const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const noticeController = require('../controllers/noticeController');

router.use(authenticate);
router.get('/', authorize('auditor'), noticeController.getMyNotices);
router.patch('/:id/read', authorize('auditor'), noticeController.markMyNotificationRead);
router.patch('/:id/unread', authorize('auditor'), noticeController.markMyNotificationUnread);
router.delete('/:id', authorize('auditor'), noticeController.deleteMyNotification);

module.exports = router;
