/**
 * User Model
 *
 * CRUD operations for the users table.
 * Users are created by admins without a password.
 * After email verification, users set their own password.
 */

const { db } = require('../config/db');

const UserModel = {

  async create({ user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, assigned_entity_type, assigned_entity_code, created_by_admin_id, created_by_entity_code, email_token, email_token_expires }) {
    const [result] = await db.query(
      `INSERT INTO users (user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, assigned_entity_type, assigned_entity_code, created_by_admin_id, created_by_entity_code, email_token, email_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_code, first_name, last_name, email, phone_number || null, nic || null, country || null, role, user_type, assigned_entity_type || null, assigned_entity_code || null, created_by_admin_id, created_by_entity_code, email_token, email_token_expires]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [id]);
    return rows[0] || null;
  },

  async findByCode(user_code) {
    const [rows] = await db.query('SELECT * FROM users WHERE user_code = ? AND is_active = TRUE', [user_code]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findByEmailToken(token) {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email_token = ? AND email_token_expires > NOW() AND is_active = TRUE',
      [token]
    );
    return rows[0] || null;
  },

  async verifyEmail(id) {
    await db.query(
      'UPDATE users SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL WHERE id = ?',
      [id]
    );
  },

  async setPassword(id, hashedPassword) {
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
  },

  async listByCreator(entityCode, userType) {
    let query = 'SELECT id, user_code, first_name, last_name, email, phone_number, nic, country, role, user_type, assigned_entity_type, assigned_entity_code, email_verified, is_active, created_at FROM users WHERE created_by_entity_code = ? AND is_active = TRUE';
    const params = [entityCode];
    if (userType) {
      query += ' AND user_type = ?';
      params.push(userType);
    }
    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, params);
    return rows;
  },

  async update(id, fields) {
    const allowed = ['first_name', 'last_name', 'phone_number', 'nic', 'country', 'assigned_entity_type', 'assigned_entity_code'];
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
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async deactivate(id) {
    await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
  },

  async regenerateToken(id, token, expires) {
    await db.query(
      'UPDATE users SET email_token = ?, email_token_expires = ? WHERE id = ?',
      [token, expires, id]
    );
  }
};

module.exports = UserModel;
