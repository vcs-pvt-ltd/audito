const { db } = require('../config/db');
const PaymentModel = require('../models/PaymentModel');
const TokenWalletModel = require('../models/TokenWalletModel');
const { generatePaymentFulfillmentId } = require('../utils/codeGenerator');

function fulfillmentType(payment) {
  if (payment.purpose === 'token_reload') return 'token_reload';
  if (payment.purpose === 'plan_upgrade') return 'plan_upgrade';
  return 'plan_activation';
}
const snapshotOf = payment => (typeof payment.pricing_snapshot === 'string' ? JSON.parse(payment.pricing_snapshot || 'null') : payment.pricing_snapshot);

/** The price snapshot of a workspace registered from an Audito quote, or null. */
function quotedAccountSnapshot(payment) {
  if (payment?.plan_name !== 'Custom') return null;
  const snapshot = typeof payment.pricing_snapshot === 'string' ? JSON.parse(payment.pricing_snapshot || 'null') : payment.pricing_snapshot;
  return snapshot?.purchase_type === 'quoted_account' ? snapshot : null;
}

/**
 * Commit payment, token grant, and ledger atomically. A paid registration is
 * the workspace's package: its pricing snapshot holds the purchased limits.
 */
async function settleVerifiedPayment(payment, {
  gateway,
  gatewayReference = null,
  manualApprovalReviewedBy = null,
}) {
  const type = fulfillmentType(payment);
  let hasPackageDetails = false;
  if (type === 'plan_activation' && payment.purpose !== 'registration') {
    throw new Error('Only registration payments can activate a workspace package.');
  }
  if (type === 'plan_upgrade') {
    // More departments for an active package; the paid snapshot raises the limit.
    const snapshot = snapshotOf(payment);
    if (snapshot?.purchase_type !== 'department_upgrade' ||
        !Number.isSafeInteger(Number(snapshot.departments)) || Number(snapshot.departments) <= Number(snapshot.from_departments) ||
        Number(snapshot.total_tokens) !== Number(payment.token_quantity) ||
        Number(snapshot.total_price) !== Number(payment.list_amount ?? payment.amount)) {
      throw new Error('Department upgrade payment is missing its pricing snapshot.');
    }
    hasPackageDetails = true;
  }
  if (payment.plan_name === 'Package' && type === 'plan_activation') {
    const snapshot = typeof payment.pricing_snapshot === 'string'
      ? JSON.parse(payment.pricing_snapshot) : payment.pricing_snapshot;
    if (snapshot?.purchase_type !== 'company_package' ||
        !Number.isSafeInteger(Number(snapshot.company_levels)) ||
        !Number.isSafeInteger(Number(snapshot.departments)) ||
        Number(snapshot.total_tokens) !== Number(payment.token_quantity) ||
        // The package price is the list price; a promo code lowers only the amount due.
        Number(snapshot.total_price) !== Number(payment.list_amount ?? payment.amount)) {
      throw new Error('Company package payment is missing its pricing snapshot.');
    }
    hasPackageDetails = true;
  }
  if (payment.promo_code_id) {
    const expected = Math.round((Number(payment.list_amount ?? payment.amount) - Number(payment.promo_discount_amount || 0)) * 100) / 100;
    if (Math.abs(expected - Number(payment.amount)) > 0.005) throw new Error('The promo code discount does not match the amount due.');
  }
  const quoted = quotedAccountSnapshot(payment);
  if (quoted && type === 'plan_activation') {
    // A Customer or Audit Firm workspace registered from a quote. Like the
    // Company package, audits and users are governed by tokens.
    if (!Number.isSafeInteger(Number(quoted.departments)) || Number(quoted.departments) < 1 ||
        Number(quoted.total_tokens) !== Number(payment.token_quantity) ||
        Number(quoted.total_price) !== Number(payment.list_amount ?? payment.amount)) {
      throw new Error('Quoted account payment is missing its pricing snapshot.');
    }
    hasPackageDetails = true;
  }
  if (type !== 'token_reload' && !hasPackageDetails) {
    throw new Error('Workspace activation payment is missing its package details.');
  }

  const claimed = await PaymentModel.claimForSettlement(payment.payment_transaction_id);
  if (!claimed) {
    const current = await PaymentModel.findByCode(payment.payment_code);
    if (current?.status === 'paid') return { payment: current, alreadyCompleted: true };
    return { payment: current || payment, processing: true };
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.query(
      'SELECT * FROM payment_fulfillments WHERE payment_transaction_id = ? FOR UPDATE',
      [payment.payment_transaction_id]
    );

    // Packages are permanent.
    const start = new Date();
    const end = new Date(start);
    end.setFullYear(9999, 11, 31);
    let grantedTokens = Number(existing[0]?.token_quantity || 0);
    let tokenLotId = existing[0]?.token_lot_id || null;

    if (!existing.length) {
      const purchasedTokens = Number(payment.token_quantity || 0);
      const unitPrice = Number(payment.token_unit_price || 0);

      tokenLotId = await TokenWalletModel.grantTokens(connection, {
        rootEntityCode: payment.root_entity_code,
        sourceType: type === 'token_reload' ? 'reload' : 'initial_purchase',
        sourceReference: payment.payment_transaction_id,
        quantity: purchasedTokens,
        unitPrice,
        paymentTransactionId: payment.payment_transaction_id,
        description: type === 'token_reload'
          ? `Token reload payment ${payment.payment_transaction_id}`
          : type === 'plan_upgrade' ? `Department upgrade token grant (${payment.payment_transaction_id})`
            : `${payment.plan_name} activation token grant`,
      });

      const bonusTokens = Number(payment.bonus_token_quantity || 0);
      if (bonusTokens > 0) {
        await TokenWalletModel.grantTokens(connection, {
          rootEntityCode: payment.root_entity_code,
          sourceType: 'bonus',
          sourceReference: `${payment.payment_transaction_id}:bonus`,
          quantity: bonusTokens,
          unitPrice: 0,
          paymentTransactionId: payment.payment_transaction_id,
          description: `Bonus tokens for payment ${payment.payment_transaction_id}`,
        });
      }
      grantedTokens = purchasedTokens + bonusTokens;

      await connection.query(
        `INSERT INTO payment_fulfillments
          (payment_fulfillment_id, payment_transaction_id, root_entity_code,
           fulfillment_type, token_quantity, token_lot_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [await generatePaymentFulfillmentId(connection), payment.payment_transaction_id, payment.root_entity_code,
          type, grantedTokens, tokenLotId]
      );
    }

    await PaymentModel.markPaid(payment.payment_transaction_id, {
      periodStart: start,
      periodEnd: end,
      gateway,
      gatewayReference,
      manualApprovalReviewedBy,
    }, connection);
    await connection.commit();

    return {
      payment: await PaymentModel.findByCode(payment.payment_code),
      grantedTokens,
      creditApplied: 0,
      netAmount: Number(payment.amount),
    };
  } catch (error) {
    if (connection) await connection.rollback();
    await PaymentModel.releaseSettlementClaim(payment.payment_transaction_id, error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { settleVerifiedPayment, quotedAccountSnapshot };
