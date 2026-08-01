const PaymentModel = require('../models/PaymentModel');
const SubscriptionModel = require('../models/SubscriptionModel');
const CustomSolutionModel = require('../models/CustomSolutionModel');
const AdminModel = require('../models/AdminModel');
const LinkBillingCreditModel = require('../models/LinkBillingCreditModel');

/**
 * Activates a subscription exactly once after a trusted payment source has
 * verified the payment. The source may be a signed gateway callback or an
 * authenticated Audito Admin manual approval.
 */
async function settleVerifiedPayment(payment, {
  gateway,
  gatewayReference = null,
  manualApprovalReviewedBy = null,
}) {
  const claimed = await PaymentModel.claimForSettlement(payment.payment_transaction_id);
  if (!claimed) {
    const current = await PaymentModel.findByCode(payment.payment_code);
    if (current?.status === 'paid') return { payment: current, alreadyCompleted: true };
    return { payment: current || payment, processing: true };
  }

  try {
    let customLimits = null;
    if (payment.plan_name === 'Custom') {
      const request = await CustomSolutionModel.findByOrgCode(payment.root_entity_code);
      if (request) {
        customLimits = await SubscriptionModel.normalizeCustomLimits({
          company_level: request.max_company_levels,
          department: request.max_departments,
          audits: request.max_audits,
          checklists: request.max_checklists,
          auditors: request.max_auditors,
          auditor_eval: request.allow_auditor_eval,
          company_to_company: request.allow_company_to_company,
        });
      }
    }

    const { start, end } = await SubscriptionModel.activatePaidSubscription(
      payment.root_entity_code,
      payment.plan_name,
      payment.billing_cycle,
      customLimits
    );

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
    } catch (creditError) {
      console.error('Failed to apply link credits:', creditError.message);
    }

    await PaymentModel.markPaid(payment.payment_transaction_id, {
      periodStart: start,
      periodEnd: end,
      gateway,
      gatewayReference,
      manualApprovalReviewedBy,
    });

    if (payment.plan_name === 'Custom') {
      const request = await CustomSolutionModel.findByPaymentCode(payment.payment_code);
      if (request) {
        await CustomSolutionModel.updateStatus(request.request_id, 'accepted');
        if (request.admin_id) await AdminModel.activate(request.admin_id);
      }
    }

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

module.exports = { settleVerifiedPayment };
