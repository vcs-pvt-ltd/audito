const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const noticeController = require('../controllers/noticeController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/timezone', authenticate, settingsController.getTimezone);
router.put('/timezone', authenticate, settingsController.setTimezone);

router.get('/notices/auditors', authenticate, authorize('admin'), noticeController.listAuditorsForNotices);
router.get('/notices', authenticate, authorize('admin'), noticeController.listNotices);
router.post('/notices', authenticate, authorize('admin'), noticeController.createNotice);
router.put('/notices/:id', authenticate, authorize('admin'), noticeController.updateNotice);
router.delete('/notices/:id', authenticate, authorize('admin'), noticeController.deleteNotice);

module.exports = router;
