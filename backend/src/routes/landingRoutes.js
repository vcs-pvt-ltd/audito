const express = require('express');
const router = express.Router();
const { submitContactForm, getPublicPlanSettings } = require('../controllers/landingController');

router.get('/plans', getPublicPlanSettings);
// POST /api/landing/contact
router.post('/contact', submitContactForm);

module.exports = router;
