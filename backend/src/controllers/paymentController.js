/**
 * Payment Controller
 *
 * Handles payment lookup, confirmation and billing history.
 *
 * Subscription activation is performed only after a verified gateway callback
 * or an authenticated Audito Admin manual approval.
 */

const PaymentModel = require('../models/PaymentModel');
const PromoCodeModel = require('../models/PromoCodeModel');
const { quoteCode, priceWithoutCode, changeBlockedReason } = require('../services/promoCheckoutService');
const AdminModel = require('../models/AdminModel');
const PaymentMethodModel = require('../models/PaymentMethodModel');
const NotificationModel = require('../models/NotificationModel');
const { db } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');
const { settleVerifiedPayment } = require('../services/paymentSettlementService');
const {
  GatewayConfigurationError,
  createHostedCheckout,
  verifyCallback,
  getCallbackPaymentCode,
  getFrontendPaymentUrl,
  getSavedMethodCallbackData,
  isSavedPaymentMethodConfigured,
} = require('../services/sampathGatewayService');
const crypto = require('crypto');

const PAYMENT_CONTACT_EMAIL = process.env.PAYMENT_CONTACT_EMAIL || 'hi@audito.cloud';

function getPaymentMode() {
  return process.env.PAYMENT_MODE === 'gateway' ? 'gateway' : 'manual_approval';
}

function paymentConfiguration() {
  return {
    payment_mode: getPaymentMode(),
    payment_contact_email: PAYMENT_CONTACT_EMAIL,
  };
}

// Client-safe projection — never exposes internal ids.
function publicPayment(p) {
  if (!p) return null;
  return {
    payment_code: p.payment_code,
    purpose: p.purpose,
    plan_name: p.plan_name,
    billing_cycle: p.billing_cycle,
    amount: Number(p.amount),
    token_quantity: Number(p.token_quantity || 0),
    bonus_token_quantity: Number(p.bonus_token_quantity || 0),
    token_unit_price: p.token_unit_price == null ? null : Number(p.token_unit_price),
    pricing_snapshot: typeof p.pricing_snapshot === 'string' ? JSON.parse(p.pricing_snapshot) : p.pricing_snapshot,
    currency: p.currency,
    status: p.status,
    org_name: p.org_name,
    invoice_number: p.invoice_number,
    period_start: p.period_start,
    period_end: p.period_end,
    paid_at: p.paid_at,
    created_at: p.created_at,
    list_amount: p.list_amount == null ? Number(p.amount) : Number(p.list_amount),
    promotion_discount_amount: Number(p.promotion_discount_amount || 0),
    promotion_campaign_id: p.promotion_campaign_id || null,
    promo_code: p.promo_code || null,
    promo_discount_amount: Number(p.promo_discount_amount || 0),
    manual_approval_status: p.manual_approval_status || 'not_requested',
    manual_approval_requested_at: p.manual_approval_requested_at || null,
    manual_approval_reviewed_at: p.manual_approval_reviewed_at || null,
  };
}

/**
 * GET /api/payments/:code   (public)
 * Returns the payment summary so the payment page can render the invoice.
 */
const getPayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    return successResponse(res, { payment: publicPayment(payment), ...paymentConfiguration() });
  } catch (error) {
    console.error('getPayment error:', error);
    return errorResponse(res, 'Failed to fetch payment.', 500);
  }
};

const initiatePayment = async (req, res) => {
  try {
    if (getPaymentMode() !== 'gateway') {
      return errorResponse(res, 'Online payments are temporarily unavailable. Request manual payment approval instead.', 409);
    }
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    if (payment.status === 'paid') return successResponse(res, { payment: publicPayment(payment), ...paymentConfiguration() }, 'Payment already completed.');
    if (!['pending', 'failed'].includes(payment.status)) return errorResponse(res, 'This payment is already being processed.', 409);
    if (payment.plan_name === 'Package') {
      const owner = await AdminModel.findPaymentOwnerByEntityCode(payment.root_entity_code);
      if (!owner?.is_verified) return errorResponse(res, 'Verify the workspace administrator email before payment.', 409);
    }
    const promoProblem = await promoCheckoutProblem(payment);
    if (promoProblem) return errorResponse(res, promoProblem, 409);

    const savePaymentMethodRequested = req.body?.save_payment_method === true;
    if (savePaymentMethodRequested && (!isSavedPaymentMethodConfigured() || !PaymentMethodModel.isEncryptionConfigured())) {
      return errorResponse(res, 'Saving payment methods is not configured yet. Please continue without selecting this option.', 503);
    }
    const checkout = createHostedCheckout(payment, { savePaymentMethod: savePaymentMethodRequested });
    const attemptId = crypto.randomUUID();
    await PaymentModel.markGatewayInitiated(payment.payment_transaction_id, {
      gateway: 'sampath', attemptId, savePaymentMethodRequested,
    });
    await PaymentModel.recordGatewayEvent({
      paymentTransactionId: payment.payment_transaction_id, provider: 'sampath', eventType: 'checkout_initiated',
      providerReference: attemptId, providerStatus: 'initiated', signatureValid: true,
      payload: { payment_code: payment.payment_code, amount: payment.amount, currency: payment.currency, save_payment_method_requested: savePaymentMethodRequested },
    });
    return successResponse(res, { checkout, payment: publicPayment(payment) }, 'Redirecting to Sampath secure payment page.');
  } catch (error) {
    if (error instanceof GatewayConfigurationError) return errorResponse(res, error.message, 503);
    console.error('initiatePayment error:', error);
    return errorResponse(res, 'Unable to start secure payment.', 500);
  }
};

// ─── Promo codes on the payment page ────────────────────────────────────────
// The payment link is the secret that allows these public actions, the same as
// starting a checkout. Wrong codes are limited per payment so codes cannot be
// guessed by trying many of them.
const PROMO_ATTEMPTS = new Map();
const PROMO_ATTEMPT_LIMIT = 10;
const PROMO_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
function promoAttemptsLeft(paymentCode, failed = false) {
  const now = Date.now();
  for (const [key, entry] of PROMO_ATTEMPTS) if (entry.resetAt <= now) PROMO_ATTEMPTS.delete(key);
  const entry = PROMO_ATTEMPTS.get(paymentCode) || { count: 0, resetAt: now + PROMO_ATTEMPT_WINDOW_MS };
  if (failed) { entry.count++; PROMO_ATTEMPTS.set(paymentCode, entry); }
  return PROMO_ATTEMPT_LIMIT - entry.count;
}
const money = (amount, currency) => `${currency || 'USD'} ${Number(amount).toFixed(2)}`;

// Checks before a payment goes to the bank or the approval queue.
async function promoCheckoutProblem(payment) {
  if (payment.promo_code_id && Number(payment.amount) === 0) return 'Your promo code covers the full amount. Complete the purchase without payment.';
  if (payment.promo_code_id && !await PromoCodeModel.findByCode(payment.promo_code)) return 'This promo code is no longer available. Remove it to continue.';
  return '';
}

/** POST /api/payments/:code/promo-code  Body: { code } */
const applyPromoCode = async (req, res) => {
  try {
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    const blocked = changeBlockedReason(payment);
    if (blocked) return errorResponse(res, blocked, 409);
    // Promo codes apply to new packages and token reloads, not to adding departments.
    if (payment.purpose === 'plan_upgrade') return errorResponse(res, 'Promo codes cannot be used when adding departments.', 400);
    if (!PromoCodeModel.normalizeCode(req.body?.code)) return errorResponse(res, 'Enter a promo code.', 400);
    if (promoAttemptsLeft(payment.payment_code) <= 0) return errorResponse(res, 'Too many promo code attempts. Try again in 15 minutes.', 429);

    const promo = await PromoCodeModel.findByCode(req.body.code);
    if (!promo) {
      promoAttemptsLeft(payment.payment_code, true);
      return errorResponse(res, 'This promo code is not valid, has expired, or has been fully used.', 400);
    }
    if (payment.promo_code_id === promo.promo_code_id) {
      return successResponse(res, { payment: publicPayment(payment), ...paymentConfiguration() }, 'This promo code is already applied.');
    }
    const quote = quoteCode(payment, promo.discount_percentage);
    if (!quote.better) {
      return errorResponse(res, `Your current price of ${money(quote.withoutCode, payment.currency)} is already lower than this code gives. Promo codes do not combine with other offers.`, 409);
    }
    const changed = await PaymentModel.setPromoCode(payment.payment_transaction_id, {
      promoCodeId: promo.promo_code_id, code: promo.code, amount: quote.amount, discount: quote.discount,
    });
    if (!changed) return errorResponse(res, 'This payment can no longer be changed.', 409);
    const updated = await PaymentModel.findByCode(payment.payment_code);
    return successResponse(res, { payment: publicPayment(updated), ...paymentConfiguration() },
      `Promo code ${promo.code} applied. You save ${money(quote.discount, payment.currency)}.`);
  } catch (error) {
    console.error('applyPromoCode error:', error);
    return errorResponse(res, 'Could not apply the promo code.', 500);
  }
};

/** DELETE /api/payments/:code/promo-code */
const removePromoCode = async (req, res) => {
  try {
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    if (!payment.promo_code_id) return successResponse(res, { payment: publicPayment(payment), ...paymentConfiguration() }, 'No promo code is applied.');
    const blocked = changeBlockedReason(payment);
    if (blocked) return errorResponse(res, blocked, 409);
    const changed = await PaymentModel.setPromoCode(payment.payment_transaction_id, { amount: priceWithoutCode(payment) });
    if (!changed) return errorResponse(res, 'This payment can no longer be changed.', 409);
    const updated = await PaymentModel.findByCode(payment.payment_code);
    return successResponse(res, { payment: publicPayment(updated), ...paymentConfiguration() }, 'Promo code removed.');
  } catch (error) {
    console.error('removePromoCode error:', error);
    return errorResponse(res, 'Could not remove the promo code.', 500);
  }
};

/**
 * POST /api/payments/:code/complete-free
 * A promo code that covers the whole amount completes the purchase without
 * the bank. The same account checks as a paid checkout apply.
 */
const completeFreePayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    if (payment.status === 'paid') return successResponse(res, { payment: publicPayment(payment), ...paymentConfiguration() }, 'Payment already completed.');
    if (!['pending', 'failed'].includes(payment.status)) return errorResponse(res, 'This payment is already being processed.', 409);
    if (!payment.promo_code_id || Number(payment.amount) !== 0) return errorResponse(res, 'This payment has an amount due.', 409);
    const owner = await AdminModel.findPaymentOwnerByEntityCode(payment.root_entity_code);
    if (!owner?.is_verified) return errorResponse(res, 'Verify the workspace administrator email before completing this purchase.', 409);
    // The code must still be usable at the moment the purchase completes.
    if (!await PromoCodeModel.findByCode(payment.promo_code)) {
      return errorResponse(res, 'This promo code is no longer available. Remove it to continue.', 409);
    }
    const result = await settleVerifiedPayment(payment, { gateway: 'promo_code', gatewayReference: `PROMO-${payment.promo_code}` });
    if (result.processing) return errorResponse(res, 'This payment is already being processed.', 409);
    return successResponse(res, { payment: publicPayment(result.payment), ...paymentConfiguration() }, 'Purchase completed with your promo code.');
  } catch (error) {
    console.error('completeFreePayment error:', error);
    return errorResponse(res, 'Could not complete the purchase.', 500);
  }
};

/**
 * Public payment-link action. It can only request review; payment settlement
 * remains restricted to an authenticated Audito Admin.
 */
const requestManualApproval = async (req, res) => {
  try {
    if (getPaymentMode() !== 'manual_approval') {
      return errorResponse(res, 'Manual payment approval is not currently available.', 409);
    }

    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    if (payment.status === 'paid') return successResponse(res, { payment: publicPayment(payment), ...paymentConfiguration() }, 'Payment already completed.');
    if (!['pending', 'failed'].includes(payment.status)) return errorResponse(res, 'This payment is already being processed.', 409);

    const owner = await AdminModel.findPaymentOwnerByEntityCode(payment.root_entity_code);
    if (!owner?.is_verified) {
      return errorResponse(res, 'Verify the workspace administrator email before requesting payment approval.', 409);
    }
    const promoProblem = await promoCheckoutProblem(payment);
    if (promoProblem) return errorResponse(res, promoProblem, 409);

    const newlyRequested = await PaymentModel.requestManualApproval(payment.payment_transaction_id);
    const updated = await PaymentModel.findByCode(payment.payment_code);

    // A previous request may have been saved while its notification failed.
    // Repeated requests safely fill that gap using the stable notification key.
    if (updated?.manual_approval_status === 'requested') {
      try {
        const [auditoAdmins] = await db.query(
          `SELECT admin_id FROM admins
           WHERE role = 'audito_admin' AND is_active = TRUE AND is_verified = TRUE`
        );
        await Promise.all(auditoAdmins.map((admin) => NotificationModel.createIfNotExists({
          recipient_user_code: admin.admin_id,
          recipient_role: 'audito_admin',
          created_by_entity_code: payment.root_entity_code,
          type: 'manual_payment_approval_requested',
          title: 'Payment approval requested',
          message: `${payment.org_name || 'An organization'} requested approval for ${payment.plan_name} (${payment.billing_cycle}).`,
          notification_key: `manual-payment:${payment.payment_transaction_id}:${admin.admin_id}`,
        })));
      } catch (notificationError) {
        console.error('Failed to notify Audito admins of payment approval request:', notificationError.message);
      }
    }

    return successResponse(
      res,
      { payment: publicPayment(updated), ...paymentConfiguration() },
      newlyRequested ? 'Payment approval request sent to Audito Admin.' : 'Payment approval is already awaiting review.'
    );
  } catch (error) {
    console.error('requestManualApproval error:', error);
    return errorResponse(res, 'Unable to request payment approval.', 500);
  }
};

const handleSampathWebhook = async (req, res) => {
  try {
    const result = verifyCallback(req.body || {});
    const payment = result.paymentCode ? await PaymentModel.findByCode(result.paymentCode) : null;
    await PaymentModel.recordGatewayEvent({
      paymentTransactionId: payment?.payment_transaction_id || null, provider: 'sampath', eventType: 'callback',
      providerReference: result.gatewayReference, providerStatus: result.status, signatureValid: result.valid, payload: req.body || {},
    });
    if (!result.valid) return res.status(403).send('INVALID_SIGNATURE');
    if (!payment) return res.status(404).send('PAYMENT_NOT_FOUND');
    if (!result.successful) {
      await PaymentModel.markGatewayFailed(payment.payment_transaction_id, {
        gateway: 'sampath', gatewayReference: result.gatewayReference, status: result.status, reason: 'Gateway declined or cancelled the payment.',
      });
      return res.status(200).send('ACK');
    }
    // The amount due can change before checkout (for example a promo code), so
    // a payment settles only when the bank confirms exactly the amount due.
    if (result.amount !== null && Math.abs(Number(result.amount) - Number(payment.amount)) > 0.005) {
      console.error('Sampath callback amount does not match the amount due:', { payment: payment.payment_transaction_id, paid: result.amount, due: Number(payment.amount) });
      await PaymentModel.markGatewayFailed(payment.payment_transaction_id, {
        gateway: 'sampath', gatewayReference: result.gatewayReference, status: 'amount_mismatch',
        reason: `The bank confirmed ${result.amount}, but ${Number(payment.amount).toFixed(2)} is due. Review this payment manually.`,
      });
      return res.status(200).send('ACK');
    }
    await settleVerifiedPayment(payment, { gateway: 'sampath', gatewayReference: result.gatewayReference });

    // Only a signed, successful callback may result in saving a gateway token.
    // A token storage error must not undo an already-valid customer payment.
    if (payment.save_payment_method_requested) {
      const savedMethod = getSavedMethodCallbackData(req.body || {});
      if (savedMethod) {
        try {
          await PaymentMethodModel.saveGatewayToken({
            rootEntityCode: payment.root_entity_code,
            gateway: 'sampath',
            ...savedMethod,
          });
          await PaymentModel.recordGatewayEvent({
            paymentTransactionId: payment.payment_transaction_id, provider: 'sampath', eventType: 'payment_method_saved',
            providerReference: result.gatewayReference, providerStatus: 'saved', signatureValid: true,
            payload: { payment_code: payment.payment_code, saved: true },
          });
        } catch (saveError) {
          console.error('Sampath payment method token was not saved:', saveError.message);
        }
      }
    }
    return res.status(200).send('ACK');
  } catch (error) {
    if (error instanceof GatewayConfigurationError) return res.status(503).send('GATEWAY_NOT_CONFIGURED');
    console.error('Sampath webhook error:', error);
    return res.status(500).send('RETRY');
  }
};

const listPaymentMethods = async (req, res) => {
  try {
    const methods = await PaymentMethodModel.listActive(req.user.entityCode);
    return successResponse(res, { methods });
  } catch (error) {
    console.error('listPaymentMethods error:', error);
    return errorResponse(res, 'Failed to load saved payment methods.', 500);
  }
};

const setDefaultPaymentMethod = async (req, res) => {
  try {
    const method = await PaymentMethodModel.setDefault(req.params.id, req.user.entityCode);
    if (!method) return errorResponse(res, 'Saved payment method not found.', 404);
    return successResponse(res, { method }, 'Default payment method updated.');
  } catch (error) {
    console.error('setDefaultPaymentMethod error:', error);
    return errorResponse(res, 'Failed to update saved payment method.', 500);
  }
};

const deletePaymentMethod = async (req, res) => {
  try {
    const revoked = await PaymentMethodModel.revoke(req.params.id, req.user.entityCode);
    if (!revoked) return errorResponse(res, 'Saved payment method not found.', 404);
    // Local access is revoked immediately. Enable Sampath's remote token-revoke
    // call here once its exact API contract is supplied.
    return successResponse(res, null, 'Saved payment method removed.');
  } catch (error) {
    console.error('deletePaymentMethod error:', error);
    return errorResponse(res, 'Failed to remove saved payment method.', 500);
  }
};

const handleSampathReturn = (req, res) => {
  try {
    const paymentCode = getCallbackPaymentCode({ ...(req.query || {}), ...(req.body || {}) });
    if (!paymentCode) return res.status(400).send('Unable to return to payment page.');
    return res.redirect(getFrontendPaymentUrl(paymentCode));
  } catch {
    return res.status(400).send('Unable to return to payment page.');
  }
};

/**
 * GET /api/payments   (admin)
 * Billing history for the admin's organization.
 */
const listPayments = async (req, res) => {
  try {
    const rootCode = req.user.entityCode;
    if (!rootCode) return successResponse(res, { payments: [] });
    const payments = await PaymentModel.listByOrg(rootCode);
    return successResponse(res, { payments: payments.map(publicPayment) });
  } catch (error) {
    console.error('listPayments error:', error);
    return errorResponse(res, 'Failed to fetch billing history.', 500);
  }
};

module.exports = {
  getPayment,
  initiatePayment,
  requestManualApproval,
  applyPromoCode,
  removePromoCode,
  completeFreePayment,
  handleSampathWebhook,
  handleSampathReturn,
  listPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  listPayments,
};
