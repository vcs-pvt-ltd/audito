/**
 * Entity Head Model
 *
 * CRUD operations for the entity_heads table.
 * Entity heads are assigned to a specific entity in the org tree
 * (e.g. Buying Office Head, Factory Head, Unit Head, etc.).
 */

const { db } = require('../config/db');

const EntityHeadModel = {

  async create({ entity_head_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires }) {
    await db.query(
      `INSERT INTO entity_heads (entity_head_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity_head_id, first_name, last_name, email, phone_number || null, country || null, role, user_type, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, email_token, email_token_expires]
    );
    return entity_head_id;
  },

  async createVerified({ entity_head_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password }) {
    await db.query(
      `INSERT INTO entity_heads (entity_head_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [entity_head_id, first_name, last_name, email, phone_number || null, country || null, role, user_type, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, password]
    );
    return entity_head_id;
  },

  async findById(entity_head_id) {
    const [rows] = await db.query('SELECT * FROM entity_heads WHERE entity_head_id = ? AND is_active = TRUE', [entity_head_id]);
    return rows[0] || null;
  },

  async findByCode(entity_head_id) {
    const [rows] = await db.query('SELECT * FROM entity_heads WHERE entity_head_id = ? AND is_active = TRUE', [entity_head_id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM entity_heads WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async getOnboardingStatus(entity_head_id) {
    const [rows] = await db.query(
      `SELECT onboarding_completed, onboarding_skipped, onboarding_completed_at
       FROM entity_heads
       WHERE entity_head_id = ?`,
      [entity_head_id]
    );
    return rows[0] || null;
  },

  async updateOnboardingStatus(entity_head_id, { completed, skipped }) {
    await db.query(
      `UPDATE entity_heads
       SET onboarding_completed = ?, onboarding_skipped = ?,
           onboarding_completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE onboarding_completed_at END
       WHERE entity_head_id = ?`,
      [completed ? 1 : 0, skipped ? 1 : 0, completed ? 1 : 0, entity_head_id]
    );
  },

  async resetOnboardingStatus(entity_head_id) {
    await db.query(
      `UPDATE entity_heads
       SET onboarding_completed = 0, onboarding_skipped = 0, onboarding_completed_at = NULL
       WHERE entity_head_id = ?`,
      [entity_head_id]
    );
  },

  async findByEmailToken(token) {
    const [rows] = await db.query(
      'SELECT * FROM entity_heads WHERE email_token = ? AND email_token_expires > NOW() AND is_active = TRUE',
      [token]
    );
    return rows[0] || null;
  },

  async verifyEmail(entity_head_id) {
    await db.query(
      'UPDATE entity_heads SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL WHERE entity_head_id = ?',
      [entity_head_id]
    );
  },

  async setPassword(entity_head_id, hashedPassword) {
    await db.query('UPDATE entity_heads SET password = ? WHERE entity_head_id = ?', [hashedPassword, entity_head_id]);
  },

  async listByCreator(entityCode, userType) {
    let query = 'SELECT entity_head_id AS user_code, entity_head_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM entity_heads WHERE created_by_entity_code = ? AND is_active = TRUE';
    const params = [entityCode];
    if (userType) {
      query += ' AND user_type = ?';
      params.push(userType);
    }
    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, params);
    return rows;
  },

  async listByCreators(entityCodes, userType) {
    if (!entityCodes.length) return [];
    const placeholders = entityCodes.map(() => '?').join(',');
    let query = `SELECT entity_head_id AS user_code, entity_head_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM entity_heads WHERE created_by_entity_code IN (${placeholders}) AND is_active = TRUE`;
    const params = [...entityCodes];
    if (userType) {
      query += ' AND user_type = ?';
      params.push(userType);
    }
    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, params);
    return rows;
  },

  async update(entity_head_id, fields) {
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
    values.push(entity_head_id);
    await db.query(`UPDATE entity_heads SET ${sets.join(', ')} WHERE entity_head_id = ?`, values);
  },

  async deleteById(entity_head_id) {
    await db.query('DELETE FROM entity_heads WHERE entity_head_id = ?', [entity_head_id]);
  },

  async findByEntityCode(entityCode) {
    const [rows] = await db.query(
      `SELECT entity_head_id, first_name, last_name, email, role, user_type, assigned_entity_type, assigned_entity_code
       FROM entity_heads
       WHERE assigned_entity_code = ? AND is_active = TRUE`,
      [entityCode]
    );
    return rows;
  },

  async findByOrgTreeIds(orgTreeIds) {
    const ids = (orgTreeIds || []).filter((v) => v !== null && v !== undefined);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT entity_head_id, first_name, last_name, email, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id
       FROM entity_heads
       WHERE assigned_org_tree_id IN (${placeholders}) AND is_active = TRUE`,
      ids
    );
    return rows;
  },

  async findOneByOrgTreeId(orgTreeId) {
    if (!orgTreeId) return null;
    const [rows] = await db.query(
      `SELECT entity_head_id, first_name, last_name, email, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id
       FROM entity_heads
       WHERE assigned_org_tree_id = ? AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgTreeId]
    );
    return rows[0] || null;
  },

  async regenerateToken(entity_head_id, token, expires) {
    await db.query(
      'UPDATE entity_heads SET email_token = ?, email_token_expires = ? WHERE entity_head_id = ?',
      [token, expires, entity_head_id]
    );
  }
};

module.exports = EntityHeadModel;
