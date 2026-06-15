/**
 * Auditor Model
 *
 * CRUD operations for the auditors table.
 * Auditors are common across the organization (no entity assignment).
 */

const { db } = require('../config/db');

const AuditorModel = {

  async create({ user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires }) {
    const [result] = await db.query(
      `INSERT INTO auditors (user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_code, first_name, last_name, email, phone_number || null, nic || null, country || null, role, user_type, auditor_type || null, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, email_token, email_token_expires]
    );
    return result.insertId;
  },

  async createVerified({ user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password }) {
    const [result] = await db.query(
      `INSERT INTO auditors (user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [user_code, first_name, last_name, email, phone_number || null, nic || null, country || null, role, user_type, auditor_type || null, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, password]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM auditors WHERE id = ? AND is_active = TRUE', [id]);
    return rows[0] || null;
  },

  async findByCode(user_code) {
    const [rows] = await db.query('SELECT * FROM auditors WHERE user_code = ? AND is_active = TRUE', [user_code]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM auditors WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findByEmailToken(token) {
    const [rows] = await db.query(
      'SELECT * FROM auditors WHERE email_token = ? AND email_token_expires > NOW() AND is_active = TRUE',
      [token]
    );
    return rows[0] || null;
  },

  async verifyEmail(id) {
    await db.query(
      'UPDATE auditors SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL WHERE id = ?',
      [id]
    );
  },

  async setPassword(id, hashedPassword) {
    await db.query('UPDATE auditors SET password = ? WHERE id = ?', [hashedPassword, id]);
  },

  async listByCreator(entityCode) {
    const [rows] = await db.query(
      'SELECT id, user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM auditors WHERE created_by_entity_code = ? AND is_active = TRUE ORDER BY created_at DESC',
      [entityCode]
    );
    return rows;
  },

  async listByCreators(entityCodes) {
    if (!entityCodes.length) return [];
    const placeholders = entityCodes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT id, user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, auditor_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM auditors WHERE created_by_entity_code IN (${placeholders}) AND is_active = TRUE ORDER BY created_at DESC`,
      entityCodes
    );
    return rows;
  },

  async update(id, fields) {
    const allowed = ['first_name', 'last_name', 'phone_number', 'nic', 'country', 'assigned_entity_type', 'assigned_entity_code', 'assigned_org_tree_id'];
    const sets = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`\`${key}\` = ?`);
        values.push(fields[key]);
      }
    }
    if (sets.length === 0) return;
    values.push(id);
    await db.query(`UPDATE auditors SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async deleteById(id) {
    await db.query('DELETE FROM auditors WHERE id = ?', [id]);
  },

  async regenerateToken(id, token, expires) {
    await db.query(
      'UPDATE auditors SET email_token = ?, email_token_expires = ? WHERE id = ?',
      [token, expires, id]
    );
  }
};

module.exports = AuditorModel;
