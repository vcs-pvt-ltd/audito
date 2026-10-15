/**
 * PaymentModel
 *
 * Persists permanent plan activation, upgrade, and token-reload transactions.
 * Historical recurring-purpose rows remain readable after migration.
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

async function generateInvoiceNumber(executor = db) {
  const [dateRows] = await executor.query("SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') AS date_code");
  const dateCode = dateRows[0]?.date_code;
  if (!dateCode) throw new Error('Unable to determine the invoice date.');

  const prefix = `INV-${dateCode}-`;
  const [rows] = await executor.query(
    `SELECT invoice_number
       FROM payment_transactions
      WHERE invoice_number >= ?
        AND invoice_number < ?
      ORDER BY invoice_number DESC
      LIMIT 1
      FOR UPDATE`,
    [prefix, `${prefix}\uffff`]
  );
  const previousSequence = Number(rows[0]?.invoice_number?.slice(prefix.length) || 0);
  return `${prefix}${String(previousSequence + 1).padStart(4, '0')}`;
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
    promotionCampaignId = null,
    listAmount = null,
    promotionDiscountAmount = 0,
    tokenQuantity = 0,
    bonusTokenQuantity = 0,
    tokenUnitPrice = null,
    pricingSnapshot = null,
  }, executor = db) {
    const code = genPaymentCode();
    const payment_transaction_id = await genPaymentTransactionId();
    await executor.query(
      `INSERT INTO payment_transactions
        (payment_transaction_id, payment_code, root_entity_code, purpose, plan_name, billing_cycle,
         amount, token_quantity, bonus_token_quantity, token_unit_price, pricing_snapshot,
         currency, status, payer_name, payer_email, org_name, promotion_campaign_id,
         list_amount, promotion_discount_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      [payment_transaction_id, code, rootEntityCode, purpose, planName, billingCycle,
        amount, tokenQuantity, bonusTokenQuantity, tokenUnitPrice,
        pricingSnapshot ? JSON.stringify(pricingSnapshot) : null, currency,
        payerName, payerEmail, orgName, promotionCampaignId,
        listAmount ?? amount, promotionDiscountAmount]
    );
    if (executor !== db) {
      const [rows] = await executor.query('SELECT * FROM payment_transactions WHERE payment_code = ? LIMIT 1', [code]);
      return rows[0] || null;
    }
    return this.findByCode(code);
  },

  async findByCode(code) {
    const [rows] = await db.query(
      `SELECT * FROM payment_transactions WHERE payment_code = ? LIMIT 1`,
      [code]
    );
    return rows[0] || null;
  },

  async findByTransactionId(paymentTransactionId) {
    const [rows] = await db.query(
      `SELECT * FROM payment_transactions WHERE payment_transaction_id = ? LIMIT 1`,
      [paymentTransactionId]
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

  async markPaid(payment_transaction_id, {
    periodStart,
    periodEnd,
    gateway = 'manual',
    gatewayReference = null,
    manualApprovalReviewedBy = null,
  }, executor = db) {
    const invoiceNumber = await generateInvoiceNumber(executor);
    await executor.query(
      `UPDATE payment_transactions
       SET status = 'paid', invoice_number = ?, gateway = ?, gateway_reference = ?, gateway_status = 'paid',
           period_start = ?, period_end = ?, paid_at = NOW(),
           manual_approval_status = CASE WHEN ?::text IS NOT NULL THEN 'approved' ELSE manual_approval_status END,
           manual_approval_reviewed_at = CASE WHEN ?::text IS NOT NULL THEN NOW() ELSE manual_approval_reviewed_at END,
           manual_approval_reviewed_by = COALESCE(?, manual_approval_reviewed_by)
       WHERE payment_transaction_id = ? AND status = 'processing'`,
      [
        invoiceNumber, gateway, gatewayReference, periodStart, periodEnd,
        manualApprovalReviewedBy, manualApprovalReviewedBy, manualApprovalReviewedBy,
        payment_transaction_id,
      ]
    );
    return invoiceNumber;
  },

  /** Moves a pending/failed payment into the Audito Admin manual-review queue. */
  async requestManualApproval(paymentTransactionId) {
    const [result] = await db.query(
      `UPDATE payment_transactions
       SET status = 'pending', gateway = 'manual_admin', gateway_status = 'awaiting_admin_approval',
           manual_approval_status = 'requested', manual_approval_requested_at = NOW(),
           manual_approval_reviewed_at = NULL, manual_approval_reviewed_by = NULL,
           failure_reason = NULL, failed_at = NULL
       WHERE payment_transaction_id = ?
         AND status IN ('pending', 'failed')
         AND manual_approval_status = 'not_requested'`,
      [paymentTransactionId]
    );
    return result.affectedRows === 1;
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

  /**
   * Sets (or, with promoCodeId null, removes) the promo code and the amount due.
   * Only an unpaid payment that is not waiting for approval can change.
   */
  async setPromoCode(paymentTransactionId, { promoCodeId = null, code = null, amount, discount = 0 }) {
    const [result] = await db.query(
      `UPDATE payment_transactions
       SET promo_code_id = ?, promo_code = ?, promo_discount_amount = ?, amount = ?
       WHERE payment_transaction_id = ? AND status IN ('pending', 'failed')
         AND manual_approval_status = 'not_requested'`,
      [promoCodeId, code, discount, amount, paymentTransactionId]
    );
    return result.affectedRows === 1;
  },

  async listByOrg(rootEntityCode) {
    const [rows] = await db.query(
      `SELECT payment_code, purpose, plan_name, billing_cycle, amount, token_quantity,
              bonus_token_quantity, token_unit_price, currency, status,
              payer_name, payer_email, org_name, promotion_campaign_id, list_amount, promotion_discount_amount,
              promo_code, promo_discount_amount,
              invoice_number, period_start, period_end, paid_at, created_at,
              manual_approval_status, manual_approval_requested_at, manual_approval_reviewed_at
       FROM payment_transactions
       WHERE root_entity_code = ?
       ORDER BY payment_transaction_id DESC`,
      [rootEntityCode]
    );
    return rows;
  },
};

module.exports = PaymentModel;
