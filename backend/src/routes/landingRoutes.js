const express = require('express');
const router = express.Router();
const { submitContactForm, getPublicPlanSettings, getPublishedPrivacyPolicy } = require('../controllers/landingController');
const { sendLandingAssistantMessage } = require('../controllers/landingAssistantController');

router.get('/plans', getPublicPlanSettings);
router.get('/privacy-policy', getPublishedPrivacyPolicy);
router.post('/assistant/message', sendLandingAssistantMessage);
// POST /api/landing/contact
router.post('/contact', submitContactForm);

module.exports = router;
