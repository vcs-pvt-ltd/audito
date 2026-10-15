const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { receiveScanImage, getContext, analyzeImage } = require('../controllers/visualScanController');

const router = express.Router();

router.use(authenticate, authorize('auditor'));
router.get('/context', getContext);
router.post('/analyze', receiveScanImage, analyzeImage);

module.exports = router;
