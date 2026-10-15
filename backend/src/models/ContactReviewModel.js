const { db } = require('../config/db');
const crypto = require('crypto');

// Customer and Audit Firm account requests, reviewed and quoted by the Audito team.
// Status: pending (new) → quoted (price sent with a registration link) → closed.
// A quoted request is registered once the requester creates the workspace; it is
// then paid through the normal payment page. Closed requests can be reopened.
const REGISTRATION_DAYS = 30;

// Secret links never leave the server in admin responses.
function publicRow(row) {
  if (!row) return row;
  const { verification_token: _verification, registration_token: _registration, ...rest } = row;
  return { ...rest, registration_link_active: Boolean(row.registration_token && row.registration_expires_at && new Date(row.registration_expires_at) > new Date()) };
}

const ContactReviewModel = {
  REGISTRATION_DAYS,
  async create(data) {
    const id = crypto.randomUUID();
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await db.query(`INSERT INTO contact_review_requests
      (request_id, account_type, entity_type, organization_name, contact_name, email, phone, country, departments, lines_per_audit, notes, verification_token, verification_expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 48 HOUR))`,
      [id, data.account_type, data.entity_type, data.organization_name,
        data.contact_name, data.email, data.phone, data.country, data.departments, data.lines_per_audit, data.notes || null, verificationToken]);
    return { id, verificationToken };
  },
  /** For the admin list: secret links are left out; payment status shows how far registration got. */
  async list() {
    const [rows] = await db.query(`SELECT r.*, p.status AS payment_status, p.amount AS payment_amount, p.paid_at
      FROM contact_review_requests r
      LEFT JOIN payment_transactions p ON p.payment_code = r.payment_code
      ORDER BY r.created_at DESC`);
    return rows.map(publicRow);
  },
  async find(id) {
    const [rows] = await db.query(`SELECT r.*, p.status AS payment_status, p.amount AS payment_amount, p.paid_at
      FROM contact_review_requests r
      LEFT JOIN payment_transactions p ON p.payment_code = r.payment_code
      WHERE r.request_id = ?`, [id]);
    return rows[0] ? publicRow(rows[0]) : null;
  },
  /** The quoted request a registration link points to, or null. */
  async findByRegistrationToken(token, executor = db, { lock = false } = {}) {
    if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
    const [rows] = await executor.query(`SELECT * FROM contact_review_requests WHERE registration_token = ?${lock ? ' FOR UPDATE' : ''}`, [token]);
    return rows[0] || null;
  },
  /** A new 30-day registration link for a quoted request that is not registered yet. */
  async renewRegistration(id) {
    const token = crypto.randomBytes(32).toString('hex');
    const [result] = await db.query(`UPDATE contact_review_requests
      SET registration_token = ?, registration_expires_at = DATE_ADD(NOW(), INTERVAL ${REGISTRATION_DAYS} DAY)
      WHERE request_id = ? AND status = 'quoted' AND registered_at IS NULL`, [token, id]);
    return result.affectedRows ? token : null;
  },
  /** Links the request to the workspace created from it; the link cannot be used again. */
  async markRegistered(id, { rootEntityCode, paymentCode }, executor = db) {
    await executor.query(`UPDATE contact_review_requests
      SET registered_root_entity_code = ?, registered_at = NOW(), payment_code = ?, registration_token = NULL, registration_expires_at = NULL
      WHERE request_id = ?`, [rootEntityCode, paymentCode, id]);
  },
  async verify(token) {
    const [result] = await db.query(`UPDATE contact_review_requests
      SET email_verified = 1, verification_token = NULL, verification_expires_at = NULL
      WHERE verification_token = ? AND verification_expires_at > NOW()`, [token]);
    return result.affectedRows > 0;
  },
  /** A fresh 48-hour link for a request whose email is not verified yet. */
  async renewVerification(id) {
    const token = crypto.randomBytes(32).toString('hex');
    const [result] = await db.query(`UPDATE contact_review_requests
      SET verification_token = ?, verification_expires_at = DATE_ADD(NOW(), INTERVAL 48 HOUR)
      WHERE request_id = ? AND email_verified = 0 AND status <> 'closed'`, [token, id]);
    return result.affectedRows ? token : null;
  },
  /** Saves the quote and a 30-day registration link. Returns the link token, or null if the request was not pending. */
  async quote(id, { price, notes, tokens, unitPrice }) {
    const token = crypto.randomBytes(32).toString('hex');
    const [result] = await db.query(`UPDATE contact_review_requests
      SET assigned_price = ?, quoted_tokens = ?, token_unit_price = ?, admin_notes = ?, status = 'quoted', quoted_at = NOW(),
          registration_token = ?, registration_expires_at = DATE_ADD(NOW(), INTERVAL ${REGISTRATION_DAYS} DAY)
      WHERE request_id = ? AND status = 'pending'`, [price, tokens, unitPrice, notes || null, token, id]);
    return result.affectedRows ? token : null;
  },
  async close(id) {
    await db.query(`UPDATE contact_review_requests SET status = 'closed', closed_at = NOW()
      WHERE request_id = ? AND status <> 'closed'`, [id]);
    return this.find(id);
  },
  /** Reopens a closed request: back to quoted when a price was sent, otherwise pending. */
  async reopen(id) {
    await db.query(`UPDATE contact_review_requests
      SET status = CASE WHEN assigned_price IS NULL THEN 'pending' ELSE 'quoted' END, closed_at = NULL
      WHERE request_id = ? AND status = 'closed'`, [id]);
    return this.find(id);
  },
  async setInternalNotes(id, notes) {
    await db.query('UPDATE contact_review_requests SET internal_notes = ? WHERE request_id = ?', [notes || null, id]);
    return this.find(id);
  },
};

module.exports = ContactReviewModel;
