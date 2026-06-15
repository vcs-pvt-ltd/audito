const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getDashboardOverview } = require('../controllers/dashboardController');

router.use(authenticate);

router.get('/overview', getDashboardOverview);

module.exports = router;
