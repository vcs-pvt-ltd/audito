/**
 * Admin Model
 *
 * Uses generic entity_code + entity_type + account_type + org_level
 * so admins can belong to ANY entity type.
 */

const { db } = require('../config/db');

const AdminModel = {

  async create({ user_id, first_name, last_name, nic, email, country, phone_number, password, account_type, entity_type, entity_code, org_level }) {
    const [result] = await db.query(
      `INSERT INTO admins (user_id, first_name, last_name, nic, email, country, phone_number, password, account_type, entity_type, entity_code, org_level, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [user_id, first_name, last_name, nic || null, email, country || null, phone_number || null, password, account_type, entity_type, entity_code, org_level]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async emailExists(email) {
    const [rows] = await db.query('SELECT id FROM admins WHERE email = ?', [email]);
    return rows.length > 0;
  },

  async findByEntityCode(entity_code) {
    const [rows] = await db.query('SELECT * FROM admins WHERE entity_code = ? AND is_active = TRUE', [entity_code]);
    return rows[0] || null;
  },

  async updateLastLogin(id) {
    await db.query('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  },

  async updatePassword(id, hashedPassword) {
    await db.query('UPDATE admins SET password = ? WHERE id = ?', [hashedPassword, id]);
  },

  async deactivate(id) {
    await db.query('UPDATE admins SET is_active = FALSE WHERE id = ?', [id]);
  },

  async setVerificationToken(id, token) {
    await db.query('UPDATE admins SET verification_token = ? WHERE id = ?', [token, id]);
  },

  async findByVerificationToken(token) {
    const [rows] = await db.query('SELECT * FROM admins WHERE verification_token = ?', [token]);
    return rows[0] || null;
  },

  async markAsVerified(id) {
    await db.query('UPDATE admins SET is_verified = TRUE, verification_token = NULL WHERE id = ?', [id]);
  },

  async getOnboardingStatus(id) {
    const [rows] = await db.query(
      `SELECT onboarding_completed, onboarding_skipped, onboarding_completed_at
       FROM admins
       WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async updateOnboardingStatus(id, { completed, skipped }) {
    await db.query(
      `UPDATE admins
       SET onboarding_completed = ?, onboarding_skipped = ?,
           onboarding_completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE onboarding_completed_at END
       WHERE id = ?`,
      [completed ? 1 : 0, skipped ? 1 : 0, completed ? 1 : 0, id]
    );
  }
};

module.exports = AdminModel;
