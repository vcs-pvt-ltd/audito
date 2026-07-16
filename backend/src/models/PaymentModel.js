/**
 * PaymentModel
 *
 * Persists billing transactions for registration, plan upgrades and renewals.
 * Each row is the legal/professional record of a payment: payer, plan, period,
 * amount, currency, status and (once paid) an invoice number.
 */

const { db } = require('../config/db');
const crypto = require('crypto');
const { generatePaymentGatewayEventId } = require('../utils/codeGenerator');

function hashPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload || {}), 'utf8').digest('hex');
}

function genPaymentCode() {
  return `PAY-${crypto.randomBytes(16).toString('hex')}`;
}

let paymentIdCounter = null;

async function genPaymentTransactionId() {
  if (paymentIdCounter === null) {
    const [rows] = await db.query(
      "SELECT MAX(CAST(SUBSTRING(payment_transaction_id, 4) AS UNSIGNED)) AS max_num FROM payment_transactions WHERE payment_transaction_id LIKE 'PT-%'"
    );
    paymentIdCounter = (rows[0].max_num || 0) + 1;
  }
  const id = `PT-${String(paymentIdCounter).padStart(6, '0')}`;
  paymentIdCounter++;
  return id;
}

const PaymentModel = {
  async create({
    rootEntityCode,
    purpose,
    planName,
    billingCycle,
    amount,
    currency = 'USD',
    payerName = null,
    payerEmail = null,
    orgName = null,
  }) {
    const code = genPaymentCode();
    const payment_transaction_id = await genPaymentTransactionId();
    await db.query(
      `INSERT INTO payment_transactions
        (payment_transaction_id, payment_code, root_entity_code, purpose, plan_name, billing_cycle, amount, currency, status, payer_name, payer_email, org_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [payment_transaction_id, code, rootEntityCode, purpose, planName, billingCycle, amount, currency, payerName, payerEmail, orgName]
    );
    return this.findByCode(code);
  },

  async findByCode(code) {
    const [rows] = await db.query(
      `SELECT * FROM payment_transactions WHERE payment_code = ? LIMIT 1`,
      [code]
    );
    return rows[0] || null;
  },

  // Latest still-pending transaction of a given purpose for an org — used so a
  // renewal attempt reuses one pending record instead of spawning duplicates.
  async findPendingByOrgPurpose(rootEntityCode, purpose) {
    const [rows] = await db.query(
      `SELECT * FROM payment_transactions
       WHERE root_entity_code = ? AND purpose = ? AND status = 'pending'
       ORDER BY payment_transaction_id DESC LIMIT 1`,
      [rootEntityCode, purpose]
    );
    return rows[0] || null;
  },

  async markPaid(payment_transaction_id, { periodStart, periodEnd, gateway = 'manual', gatewayReference = null }) {
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(payment_transaction_id).padStart(6, '0')}`;
    await db.query(
      `UPDATE payment_transactions
       SET status = 'paid', invoice_number = ?, gateway = ?, gateway_reference = ?, gateway_status = 'paid',
           period_start = ?, period_end = ?, paid_at = NOW()
       WHERE payment_transaction_id = ? AND status = 'processing'`,
      [invoiceNumber, gateway, gatewayReference, periodStart, periodEnd, payment_transaction_id]
    );
    return invoiceNumber;
  },

  async markGatewayInitiated(payment_transaction_id, { gateway, attemptId, savePaymentMethodRequested = false }) {
    await db.query(
      `UPDATE payment_transactions
       SET status = 'pending', gateway = ?, gateway_status = 'initiated', gateway_attempt_id = ?, initiated_at = NOW(),
           failure_reason = NULL, failed_at = NULL, save_payment_method_requested = ?
       WHERE payment_transaction_id = ? AND status IN ('pending', 'failed')`,
      [gateway, attemptId, savePaymentMethodRequested ? 1 : 0, payment_transaction_id]
    );
  },

  /** Atomically grants one callback the right to activate the subscription. */
  async claimForSettlement(payment_transaction_id) {
    const [result] = await db.query(
      `UPDATE payment_transactions
       SET status = 'processing', gateway_status = 'processing'
       WHERE payment_transaction_id = ? AND status = 'pending'`,
      [payment_transaction_id]
    );
    return result.affectedRows === 1;
  },

  async releaseSettlementClaim(payment_transaction_id, reason) {
    await db.query(
      `UPDATE payment_transactions
       SET status = 'pending', gateway_status = 'callback_error', failure_reason = ?
       WHERE payment_transaction_id = ? AND status = 'processing'`,
      [String(reason || 'Unable to process payment confirmation.').slice(0, 255), payment_transaction_id]
    );
  },

  async markGatewayFailed(payment_transaction_id, { gateway = 'sampath', gatewayReference = null, status = 'failed', reason = null }) {
    await db.query(
      `UPDATE payment_transactions
       SET status = 'failed', gateway = ?, gateway_reference = ?, gateway_status = ?,
           failure_reason = ?, failed_at = NOW()
       WHERE payment_transaction_id = ? AND status IN ('pending', 'processing')`,
      [gateway, gatewayReference, status, reason ? String(reason).slice(0, 255) : null, payment_transaction_id]
    );
  },

  async recordGatewayEvent({ paymentTransactionId = null, provider, eventType, providerReference = null, providerStatus = null, signatureValid, payload }) {
    const paymentGatewayEventId = await generatePaymentGatewayEventId();
    const payloadHash = hashPayload(payload);
    await db.query(
      `INSERT IGNORE INTO payment_gateway_events
       (payment_gateway_event_id, payment_transaction_id, provider, event_type, provider_reference, provider_status, signature_valid, payload_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentGatewayEventId, paymentTransactionId, provider, eventType, providerReference || null, providerStatus || null, signatureValid ? 1 : 0, payloadHash]
    );
  },

  async listByOrg(rootEntityCode) {
    const [rows] = await db.query(
      `SELECT payment_code, purpose, plan_name, billing_cycle, amount, currency, status,
              payer_name, payer_email, org_name, invoice_number, period_start, period_end, paid_at, created_at
       FROM payment_transactions
       WHERE root_entity_code = ?
       ORDER BY payment_transaction_id DESC`,
      [rootEntityCode]
    );
    return rows;
  },
};

module.exports = PaymentModel;
