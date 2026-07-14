/**
 * Auditor Model
 *
 * CRUD operations for the auditors table.
 * Auditors are common across the organization (no entity assignment).
 */

const { db } = require('../config/db');

const AuditorModel = {

  async create({ auditor_id, first_name, last_name, email, phone_number, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires }) {
    await db.query(
      `INSERT INTO auditors (auditor_id, first_name, last_name, email, phone_number, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [auditor_id, first_name, last_name, email, phone_number || null, country || null, role, user_type, auditor_type || null, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, email_token, email_token_expires]
    );
    return auditor_id;
  },

  async createVerified({ auditor_id, first_name, last_name, email, phone_number, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password }) {
    await db.query(
      `INSERT INTO auditors (auditor_id, first_name, last_name, email, phone_number, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [auditor_id, first_name, last_name, email, phone_number || null, country || null, role, user_type, auditor_type || null, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, password]
    );
    return auditor_id;
  },

  async findById(auditor_id) {
    const [rows] = await db.query('SELECT * FROM auditors WHERE auditor_id = ? AND is_active = TRUE', [auditor_id]);
    return rows[0] || null;
  },

  async findByCode(auditor_id) {
    const [rows] = await db.query('SELECT * FROM auditors WHERE auditor_id = ? AND is_active = TRUE', [auditor_id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM auditors WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async getOnboardingStatus(auditor_id) {
    const [rows] = await db.query(
      `SELECT onboarding_completed, onboarding_skipped, onboarding_completed_at
       FROM auditors
       WHERE auditor_id = ?`,
      [auditor_id]
    );
    return rows[0] || null;
  },

  async updateOnboardingStatus(auditor_id, { completed, skipped }) {
    await db.query(
      `UPDATE auditors
       SET onboarding_completed = ?, onboarding_skipped = ?,
           onboarding_completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE onboarding_completed_at END
       WHERE auditor_id = ?`,
      [completed ? 1 : 0, skipped ? 1 : 0, completed ? 1 : 0, auditor_id]
    );
  },

  async resetOnboardingStatus(auditor_id) {
    await db.query(
      `UPDATE auditors
       SET onboarding_completed = 0, onboarding_skipped = 0, onboarding_completed_at = NULL
       WHERE auditor_id = ?`,
      [auditor_id]
    );
  },

  async findByEmailToken(token) {
    const [rows] = await db.query(
      'SELECT * FROM auditors WHERE email_token = ? AND email_token_expires > NOW() AND is_active = TRUE',
      [token]
    );
    return rows[0] || null;
  },

  async verifyEmail(auditor_id) {
    await db.query(
      'UPDATE auditors SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL WHERE auditor_id = ?',
      [auditor_id]
    );
  },

  async setPassword(auditor_id, hashedPassword) {
    await db.query('UPDATE auditors SET password = ? WHERE auditor_id = ?', [hashedPassword, auditor_id]);
  },

  async listByCreator(entityCode) {
    const [rows] = await db.query(
      'SELECT auditor_id AS user_code, auditor_id, first_name, last_name, email, phone_number, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM auditors WHERE created_by_entity_code = ? AND is_active = TRUE ORDER BY created_at DESC',
      [entityCode]
    );
    return rows;
  },

  async listByCreators(entityCodes) {
    if (!entityCodes.length) return [];
    const placeholders = entityCodes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT auditor_id AS user_code, auditor_id, first_name, last_name, email, phone_number, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM auditors WHERE created_by_entity_code IN (${placeholders}) AND is_active = TRUE ORDER BY created_at DESC`,
      entityCodes
    );
    return rows;
  },

  async update(auditor_id, fields) {
    const allowed = ['first_name', 'last_name', 'phone_number', 'country', 'assigned_entity_type', 'assigned_entity_code', 'assigned_org_tree_id'];
    const sets = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`\`${key}\` = ?`);
        values.push(fields[key]);
      }
    }
    if (sets.length === 0) return;
    values.push(auditor_id);
    await db.query(`UPDATE auditors SET ${sets.join(', ')} WHERE auditor_id = ?`, values);
  },

  async deleteById(auditor_id) {
    await db.query('DELETE FROM auditors WHERE auditor_id = ?', [auditor_id]);
  },

  async regenerateToken(auditor_id, token, expires) {
    await db.query(
      'UPDATE auditors SET email_token = ?, email_token_expires = ? WHERE auditor_id = ?',
      [token, expires, auditor_id]
    );
  }
};

module.exports = AuditorModel;
