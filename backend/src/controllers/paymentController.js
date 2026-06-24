/**
 * Payment Controller
 *
 * Handles checkout creation, payment lookup, confirmation and billing history.
 *
 * NOTE: A real payment gateway is not yet integrated. `confirmPayment` is the
 * temporary success hook the UI calls; once a gateway is added, the same logic
 * should be driven by the gateway's webhook instead of a direct client call.
 */

const PaymentModel = require('../models/PaymentModel');
const SubscriptionModel = require('../models/SubscriptionModel');
const AdminModel = require('../models/AdminModel');
const { getOrgName } = require('../utils/orgLookup');
const { successResponse, errorResponse } = require('../utils/helpers');

const VALID_PLANS = ['Pro', 'Elite'];
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
    payer_name: p.payer_name,
    payer_email: p.payer_email,
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

    const admin = await AdminModel.findById(req.user.id);
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
    const { start, end } = await SubscriptionModel.activatePaidSubscription(
      payment.root_entity_code,
      payment.plan_name,
      payment.billing_cycle
    );

    await PaymentModel.markPaid(payment.id, {
      periodStart: start,
      periodEnd: end,
      gateway: (req.body && req.body.gateway) || 'manual',
      gatewayReference: (req.body && req.body.gateway_reference) || null,
    });

    const updated = await PaymentModel.findByCode(req.params.code);
    return successResponse(res, { payment: publicPayment(updated) }, 'Payment successful. Subscription activated.');
  } catch (error) {
    console.error('confirmPayment error:', error);
    return errorResponse(res, 'Failed to confirm payment.', 500);
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
  listPayments,
};
