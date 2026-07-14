/**
 * Admin Model
 *
 * Uses generic entity_code + entity_type + account_type + org_level
 * so admins can belong to ANY entity type.
 */

const { db } = require('../config/db');

const AdminModel = {

  async create({ admin_id, first_name, last_name, email, country, phone_number, password, account_type, entity_type, entity_code, org_level }) {
    await db.query(
      `INSERT INTO admins (admin_id, first_name, last_name, email, country, phone_number, password, account_type, entity_type, entity_code, org_level, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [admin_id, first_name, last_name, email, country || null, phone_number || null, password || null, account_type || null, entity_type || null, entity_code || null, org_level || 0]
    );
    return admin_id;
  },

  async findById(admin_id) {
    const [rows] = await db.query('SELECT * FROM admins WHERE admin_id = ?', [admin_id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async emailExists(email) {
    const [rows] = await db.query('SELECT admin_id FROM admins WHERE email = ?', [email]);
    return rows.length > 0;
  },

  async findByEntityCode(entity_code) {
    const [rows] = await db.query('SELECT * FROM admins WHERE entity_code = ? AND is_active = TRUE', [entity_code]);
    return rows[0] || null;
  },

  async updateLastLogin(admin_id) {
    await db.query('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE admin_id = ?', [admin_id]);
  },

  async updatePassword(admin_id, hashedPassword) {
    await db.query('UPDATE admins SET password = ? WHERE admin_id = ?', [hashedPassword, admin_id]);
  },

  async deactivate(admin_id) {
    await db.query('UPDATE admins SET is_active = FALSE WHERE admin_id = ?', [admin_id]);
  },

  async setVerificationToken(admin_id, token) {
    await db.query('UPDATE admins SET verification_token = ? WHERE admin_id = ?', [token, admin_id]);
  },

  async findByVerificationToken(token) {
    const [rows] = await db.query('SELECT * FROM admins WHERE verification_token = ?', [token]);
    return rows[0] || null;
  },

  async markAsVerified(admin_id) {
    await db.query('UPDATE admins SET is_verified = TRUE, verification_token = NULL WHERE admin_id = ?', [admin_id]);
  },

  async getOnboardingStatus(admin_id) {
    const [rows] = await db.query(
      `SELECT onboarding_completed, onboarding_skipped, onboarding_completed_at
       FROM admins
       WHERE admin_id = ?`,
      [admin_id]
    );
    return rows[0] || null;
  },

  async updateOnboardingStatus(admin_id, { completed, skipped }) {
    await db.query(
      `UPDATE admins
       SET onboarding_completed = ?, onboarding_skipped = ?,
           onboarding_completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE onboarding_completed_at END
       WHERE admin_id = ?`,
      [completed ? 1 : 0, skipped ? 1 : 0, completed ? 1 : 0, admin_id]
    );
  },

  async resetOnboardingStatus(admin_id) {
    await db.query(
      `UPDATE admins
       SET onboarding_completed = 0, onboarding_skipped = 0, onboarding_completed_at = NULL
       WHERE admin_id = ?`,
      [admin_id]
    );
  },

  async setAdminPassword(admin_id, hashedPassword) {
    await db.query(
      'UPDATE admins SET password = ?, is_verified = TRUE, verification_token = NULL WHERE admin_id = ?',
      [hashedPassword, admin_id]
    );
  },

  // --- Admin management (for audito_admin panel) ---

  async listAll({ role, is_active, search } = {}) {
    let sql = 'SELECT admin_id, first_name, last_name, email, phone_number, role, is_active, is_verified, created_at FROM admins WHERE 1=1';
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (typeof is_active === 'boolean') {
      sql += ' AND is_active = ?';
      params.push(is_active ? 1 : 0);
    }
    if (search) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    return rows;
  },

  async toggleActive(admin_id) {
    await db.query('UPDATE admins SET is_active = NOT is_active WHERE admin_id = ?', [admin_id]);
    const [rows] = await db.query('SELECT admin_id, is_active FROM admins WHERE admin_id = ?', [admin_id]);
    return rows[0] || null;
  },

  async hardDelete(admin_id) {
    await db.query('DELETE FROM admins WHERE admin_id = ?', [admin_id]);
  },

  async count({ role } = {}) {
    let sql = 'SELECT COUNT(*) AS cnt FROM admins';
    const params = [];
    if (role) {
      sql += ' WHERE role = ?';
      params.push(role);
    }
    const [rows] = await db.query(sql, params);
    return rows[0].cnt;
  }
};

module.exports = AdminModel;
