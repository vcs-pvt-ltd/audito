const { db } = require('../config/db');
const { generatePromoCodeId } = require('../utils/codeGenerator');

const PromoCodeModel = {
  async create({ promo_code_id, code, discount_percentage, expires_at }) {
    const id = promo_code_id || await generatePromoCodeId();
    await db.query(
      `INSERT INTO promo_codes (promo_code_id, code, discount_percentage, expires_at, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [id, code.toUpperCase().trim(), discount_percentage, expires_at || null]
    );
    return id;
  },

  async findByCode(code) {
    if (!code) return null;
    const [rows] = await db.query(
      `SELECT * FROM promo_codes WHERE code = ? AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())`,
      [code.toUpperCase().trim()]
    );
    return rows[0] || null;
  },

  async list() {
    const [rows] = await db.query(
      `SELECT * FROM promo_codes ORDER BY created_at DESC`
    );
    return rows;
  },

  async deactivate(promo_code_id) {
    await db.query(
      `UPDATE promo_codes SET is_active = FALSE WHERE promo_code_id = ?`,
      [promo_code_id]
    );
  },

  async delete(promo_code_id) {
    await db.query(
      `DELETE FROM promo_codes WHERE promo_code_id = ?`,
      [promo_code_id]
    );
  }
};

module.exports = PromoCodeModel;
