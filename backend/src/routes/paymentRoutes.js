const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, authorize } = require('../middleware/auth');

// Authenticated (admin) — create checkout & view billing history
router.post('/checkout', authenticate, authorize('admin'), paymentController.createCheckout);
router.get('/', authenticate, authorize('admin'), paymentController.listPayments);
router.get('/methods', authenticate, authorize('admin'), paymentController.listPaymentMethods);
router.post('/methods/:id/default', authenticate, authorize('admin'), paymentController.setDefaultPaymentMethod);
router.delete('/methods/:id', authenticate, authorize('admin'), paymentController.deletePaymentMethod);

// Public — payment page lookup & confirmation (temporary; gateway webhook later)
router.post('/sampath/webhook', paymentController.handleSampathWebhook);
router.all('/sampath/return', paymentController.handleSampathReturn);
router.post('/:code/temporary-accept', paymentController.temporarilyAcceptPayment);
router.post('/:code/initiate', paymentController.initiatePayment);
router.get('/:code', paymentController.getPayment);
// Kept temporarily for older clients; it no longer has a route that can mark payment paid.
router.post('/:code/confirm', (_req, res) => res.status(410).json({ success: false, message: 'Direct payment confirmation is disabled.' }));

module.exports = router;
