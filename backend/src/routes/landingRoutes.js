const express = require('express');
const router = express.Router();
const { submitContactForm, getPublishedPrivacyPolicy } = require('../controllers/landingController');
const { sendLandingAssistantMessage, createLandingAssistantVoiceSession } = require('../controllers/landingAssistantController');

router.get('/plans', (_req, res) => res.status(410).json({ success: false, message: 'Use package pricing.' }));
router.get('/package-pricing', require('../controllers/landingController').getPackagePricing);
router.post('/contact-review', require('../controllers/landingController').submitContactReview);
router.get('/contact-details', require('../controllers/landingController').getContactDetails);
router.get('/privacy-policy', getPublishedPrivacyPolicy);
router.post('/assistant/message', sendLandingAssistantMessage);
router.post('/assistant/voice/session', createLandingAssistantVoiceSession);
// POST /api/landing/contact
router.post('/contact', submitContactForm);

module.exports = router;
