const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

// Authenticated (admin) — create checkout & view billing history
router.post('/checkout', authenticate, authorize('admin'), paymentController.createCheckout);
router.get('/', authenticate, authorize('admin'), paymentController.listPayments);

// Public — payment page lookup & confirmation (temporary; gateway webhook later)
router.get('/:code', paymentController.getPayment);
router.post('/:code/confirm', paymentController.confirmPayment);

module.exports = router;
