/**
 * Payment Controller
 *
 * Handles checkout creation, payment lookup, confirmation and billing history.
 *
 * Subscription activation is performed only after a verified gateway callback.
 */

const PaymentModel = require('../models/PaymentModel');
const SubscriptionModel = require('../models/SubscriptionModel');
const CustomSolutionModel = require('../models/CustomSolutionModel');
const AdminModel = require('../models/AdminModel');
const LinkBillingCreditModel = require('../models/LinkBillingCreditModel');
const PaymentMethodModel = require('../models/PaymentMethodModel');
const { getOrgName } = require('../utils/orgLookup');
const { successResponse, errorResponse } = require('../utils/helpers');
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

const VALID_PLANS = ['Pro', 'Elite', 'Custom'];
const VALID_CYCLES = ['Monthly', 'Yearly'];

// Client-safe projection — never exposes internal ids.
function publicPayment(p) {
  if (!p) return null;
  return {
    payment_code: p.payment_code,
    purpose: p.purpose,
    plan_name: p.plan_name,
    billing_cycle: p.billing_cycle,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    org_name: p.org_name,
    invoice_number: p.invoice_number,
    period_start: p.period_start,
    period_end: p.period_end,
    paid_at: p.paid_at,
    created_at: p.created_at,
  };
}

/**
 * POST /api/payments/checkout   (admin)
 * Body: { plan_name, billing_cycle, purpose: 'upgrade' | 'renewal' }
 * Creates a pending payment for the admin's organization and returns it.
 */
const createCheckout = async (req, res) => {
  try {
    const { plan_name, billing_cycle, purpose } = req.body;

    if (!VALID_PLANS.includes(plan_name)) {
      return errorResponse(res, `Invalid plan. Allowed: ${VALID_PLANS.join(', ')}.`, 400);
    }
    if (!VALID_CYCLES.includes(billing_cycle)) {
      return errorResponse(res, `Invalid billing cycle. Allowed: ${VALID_CYCLES.join(', ')}.`, 400);
    }
    const effectivePurpose = purpose === 'renewal' ? 'renewal' : 'upgrade';

    const rootCode = req.user.entityCode;
    if (!rootCode) return errorResponse(res, 'No organization found for this account.', 400);

    const amount = SubscriptionModel.computeAmount(plan_name, billing_cycle);
    if (amount <= 0) {
      return errorResponse(res, 'The selected plan does not require a payment.', 400);
    }

    const admin = await AdminModel.findById(req.user.userCode);
    const payerName = admin ? `${admin.first_name} ${admin.last_name}` : null;
    const orgName = await getOrgName(req.user.entityType, rootCode);

    const payment = await PaymentModel.create({
      rootEntityCode: rootCode,
      purpose: effectivePurpose,
      planName: plan_name,
      billingCycle: billing_cycle,
      amount,
      payerName,
      payerEmail: req.user.email,
      orgName,
    });

    return successResponse(res, { payment: publicPayment(payment) }, 'Checkout created.');
  } catch (error) {
    console.error('createCheckout error:', error);
    return errorResponse(res, 'Failed to create checkout.', 500);
  }
};

async function activateVerifiedPayment(payment, gatewayReference) {
  const claimed = await PaymentModel.claimForSettlement(payment.payment_transaction_id);
  if (!claimed) {
    const current = await PaymentModel.findByCode(payment.payment_code);
    if (current?.status === 'paid') return { payment: current, alreadyCompleted: true };
    return { payment: current || payment, processing: true };
  }

  try {
    let customLimits = null;
    if (payment.plan_name === 'Custom') {
      const csr = await CustomSolutionModel.findByOrgCode(payment.root_entity_code);
      if (csr) {
        customLimits = {
          company_level: 6,
          department: csr.max_departments,
          audits: csr.max_audits,
          checklists: csr.max_checklists,
          auditors: csr.max_auditors,
          auditor_eval: !!csr.allow_auditor_eval,
          company_to_company: !!csr.allow_company_to_company,
        };
      }
    }

    const { start, end } = await SubscriptionModel.activatePaidSubscription(
      payment.root_entity_code,
      payment.plan_name,
      payment.billing_cycle,
      customLimits
    );

    // Credits are applied only by the one callback that claimed this payment.
    let creditApplied = 0;
    try {
      const available = await LinkBillingCreditModel.getAvailableCreditAmount(payment.root_entity_code);
      if (available > 0 && payment.amount > 0) {
        const result = await LinkBillingCreditModel.applyCredits(
          payment.root_entity_code,
          payment.payment_transaction_id,
          Math.min(available, payment.amount)
        );
        creditApplied = result.total_applied;
      }
    } catch (creditErr) {
      console.error('Failed to apply link credits:', creditErr.message);
    }

    await PaymentModel.markPaid(payment.payment_transaction_id, {
      periodStart: start,
      periodEnd: end,
      gateway: 'sampath',
      gatewayReference,
    });
    return {
      payment: await PaymentModel.findByCode(payment.payment_code),
      creditApplied,
      netAmount: Math.round((payment.amount - creditApplied) * 100) / 100,
    };
  } catch (error) {
    await PaymentModel.releaseSettlementClaim(payment.payment_transaction_id, error.message);
    throw error;
  }
}

/**
 * GET /api/payments/:code   (public)
 * Returns the payment summary so the payment page can render the invoice.
 */
const getPayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    return successResponse(res, { payment: publicPayment(payment) });
  } catch (error) {
    console.error('getPayment error:', error);
    return errorResponse(res, 'Failed to fetch payment.', 500);
  }
};

/**
 * POST /api/payments/:code/confirm   (public — temporary)
 * Marks the payment paid and activates the organization's subscription.
 * Replace the call site with a gateway webhook once integrated.
 */
const confirmPayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);

    if (payment.status === 'paid') {
      return successResponse(res, { payment: publicPayment(payment) }, 'Payment already completed.');
    }
    if (payment.status !== 'pending') {
      return errorResponse(res, 'This payment can no longer be processed.', 400);
    }

    // registration / upgrade / renewal all resolve to: activate the paid plan.
    // For Custom plans, fetch the limits from the custom solution request.
    let customLimits = null;
    if (payment.plan_name === 'Custom') {
      const csr = await CustomSolutionModel.findByOrgCode(payment.root_entity_code);
      if (csr) {
        customLimits = {
          // Custom plans always include the complete Company hierarchy.
          company_level: 6,
          department: csr.max_departments,
          audits: csr.max_audits,
          checklists: csr.max_checklists,
          auditors: csr.max_auditors,
          auditor_eval: !!csr.allow_auditor_eval,
          company_to_company: !!csr.allow_company_to_company,
        };
      }
    }

    const { start, end } = await SubscriptionModel.activatePaidSubscription(
      payment.root_entity_code,
      payment.plan_name,
      payment.billing_cycle,
      customLimits
    );

    // Apply any available link billing credits
    let creditApplied = 0;
    let creditApplications = [];
    try {
      const available = await LinkBillingCreditModel.getAvailableCreditAmount(payment.root_entity_code);
      if (available > 0 && payment.amount > 0) {
        const applyAmount = Math.min(available, payment.amount);
        const result = await LinkBillingCreditModel.applyCredits(
          payment.root_entity_code,
          payment.payment_transaction_id,
          applyAmount
        );
        creditApplied = result.total_applied;
        creditApplications = result.applications;
      }
    } catch (creditErr) {
      console.error('Failed to apply link billing credits:', creditErr.message);
    }

    await PaymentModel.markPaid(payment.payment_transaction_id, {
      periodStart: start,
      periodEnd: end,
      gateway: (req.body && req.body.gateway) || 'manual',
      gatewayReference: (req.body && req.body.gateway_reference) || null,
    });

    const updated = await PaymentModel.findByCode(req.params.code);
    return successResponse(res, {
      payment: publicPayment(updated),
      credit_applied: creditApplied,
      credit_applications: creditApplications,
      net_amount: Math.round((payment.amount - creditApplied) * 100) / 100,
    }, 'Payment successful. Subscription activated.');
  } catch (error) {
    console.error('confirmPayment error:', error);
    return errorResponse(res, 'Failed to confirm payment.', 500);
  }
};

const initiatePayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    if (payment.status === 'paid') return successResponse(res, { payment: publicPayment(payment) }, 'Payment already completed.');
    if (!['pending', 'failed'].includes(payment.status)) return errorResponse(res, 'This payment is already being processed.', 409);

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

/** Development-only simulator; it is always disabled in production. */
const temporarilyAcceptPayment = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TEMPORARY_PAYMENT_ACCEPTANCE !== 'true') {
      return errorResponse(res, 'Temporary payment acceptance is disabled.', 404);
    }

    let payment = await PaymentModel.findByCode(req.params.code);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);
    if (payment.status === 'paid') return successResponse(res, { payment: publicPayment(payment) }, 'Payment already completed.');
    if (!['pending', 'failed'].includes(payment.status)) return errorResponse(res, 'This payment is already being processed.', 409);

    if (payment.status === 'failed') {
      await PaymentModel.markGatewayInitiated(payment.payment_transaction_id, {
        gateway: 'temporary_test', attemptId: `TEMP-${crypto.randomUUID()}`,
      });
      payment = await PaymentModel.findByCode(req.params.code);
    }

    const result = await activateVerifiedPayment(payment, `TEMP-${crypto.randomUUID()}`);
    return successResponse(res, { payment: publicPayment(result.payment) }, 'Temporary test payment accepted.');
  } catch (error) {
    console.error('temporarilyAcceptPayment error:', error);
    return errorResponse(res, 'Unable to accept the temporary test payment.', 500);
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
    await activateVerifiedPayment(payment, result.gatewayReference);

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
  createCheckout,
  getPayment,
  confirmPayment,
  initiatePayment,
  temporarilyAcceptPayment,
  handleSampathWebhook,
  handleSampathReturn,
  listPaymentMethods,
  setDefaultPaymentMethod,
  deletePaymentMethod,
  listPayments,
};
