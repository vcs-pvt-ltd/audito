const express = require('express');
const router = express.Router();
const { submitContactForm } = require('../controllers/landingController');

// POST /api/landing/contact
router.post('/contact', submitContactForm);

module.exports = router;
