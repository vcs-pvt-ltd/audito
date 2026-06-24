/**
 * PaymentModel
 *
 * Persists billing transactions for registration, plan upgrades and renewals.
 * Each row is the legal/professional record of a payment: payer, plan, period,
 * amount, currency, status and (once paid) an invoice number.
 */

const { db } = require('../config/db');
const crypto = require('crypto');

function genPaymentCode() {
  return `PAY-${crypto.randomBytes(16).toString('hex')}`;
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
    await db.query(
      `INSERT INTO payment_transactions
        (payment_code, root_entity_code, purpose, plan_name, billing_cycle, amount, currency, status, payer_name, payer_email, org_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [code, rootEntityCode, purpose, planName, billingCycle, amount, currency, payerName, payerEmail, orgName]
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
       ORDER BY id DESC LIMIT 1`,
      [rootEntityCode, purpose]
    );
    return rows[0] || null;
  },

  async markPaid(id, { periodStart, periodEnd, gateway = 'manual', gatewayReference = null }) {
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(id).padStart(6, '0')}`;
    await db.query(
      `UPDATE payment_transactions
       SET status = 'paid', invoice_number = ?, gateway = ?, gateway_reference = ?,
           period_start = ?, period_end = ?, paid_at = NOW()
       WHERE id = ?`,
      [invoiceNumber, gateway, gatewayReference, periodStart, periodEnd, id]
    );
    return invoiceNumber;
  },

  async listByOrg(rootEntityCode) {
    const [rows] = await db.query(
      `SELECT payment_code, purpose, plan_name, billing_cycle, amount, currency, status,
              payer_name, payer_email, org_name, invoice_number, period_start, period_end, paid_at, created_at
       FROM payment_transactions
       WHERE root_entity_code = ?
       ORDER BY id DESC`,
      [rootEntityCode]
    );
    return rows;
  },
};

module.exports = PaymentModel;
