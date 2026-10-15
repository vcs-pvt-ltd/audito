const { db } = require('../config/db');
const { generatePromoCodeId } = require('../utils/codeGenerator');

// Paid checkouts that used a code. Pending payments do not use up a code.
const REDEMPTIONS = `(SELECT COUNT(*) FROM payment_transactions t WHERE t.promo_code_id = p.promo_code_id AND t.status = 'paid')`;
const normalizeCode = code => String(code || '').toUpperCase().trim();

const PromoCodeModel = {
  normalizeCode,

  async create({ promo_code_id, code, discount_percentage, expires_at, max_redemptions = null }) {
    const id = promo_code_id || await generatePromoCodeId();
    await db.query(
      `INSERT INTO promo_codes (promo_code_id, code, discount_percentage, expires_at, max_redemptions, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [id, normalizeCode(code), discount_percentage, expires_at || null, max_redemptions]
    );
    return id;
  },

  /** A code that can be used right now: active, not expired and not used up. */
  async findByCode(code) {
    if (!normalizeCode(code)) return null;
    const [rows] = await db.query(
      `SELECT p.*, ${REDEMPTIONS} AS redemptions FROM promo_codes p
       WHERE p.code = ? AND p.is_active = TRUE AND (p.expires_at IS NULL OR p.expires_at > NOW())
         AND (p.max_redemptions IS NULL OR ${REDEMPTIONS} < p.max_redemptions)
       ORDER BY p.created_at DESC LIMIT 1`,
      [normalizeCode(code)]
    );
    return rows[0] || null;
  },

  /** Any code with this text, usable or not; codes stay unique for clear reports. */
  async exists(code) {
    const [rows] = await db.query('SELECT 1 FROM promo_codes WHERE code = ? LIMIT 1', [normalizeCode(code)]);
    return rows.length > 0;
  },

  async list() {
    const [rows] = await db.query(
      `SELECT p.*, ${REDEMPTIONS} AS redemptions,
              (SELECT COALESCE(SUM(t.promo_discount_amount), 0) FROM payment_transactions t WHERE t.promo_code_id = p.promo_code_id AND t.status = 'paid') AS total_discount
       FROM promo_codes p ORDER BY p.created_at DESC`
    );
    return rows;
  },

  async deactivate(promo_code_id) {
    await db.query(
      `UPDATE promo_codes SET is_active = FALSE WHERE promo_code_id = ?`,
      [promo_code_id]
    );
  },

  async activate(promo_code_id) {
    await db.query(
      `UPDATE promo_codes SET is_active = TRUE WHERE promo_code_id = ?`,
      [promo_code_id]
    );
  },

  /** Codes that were used on a payment are kept for invoices; only unused ones can be deleted. */
  async delete(promo_code_id) {
    const [[used]] = await db.query('SELECT COUNT(*) AS cnt FROM payment_transactions WHERE promo_code_id = ?', [promo_code_id]);
    if (used.cnt > 0) return false;
    await db.query(
      `DELETE FROM promo_codes WHERE promo_code_id = ?`,
      [promo_code_id]
    );
    return true;
  }
};

module.exports = PromoCodeModel;
