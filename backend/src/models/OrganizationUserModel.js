/**
 * Organization User Model
 *
 * CRUD operations for the organization_users table.
 * Their data visibility is defined by organization_user_scopes.
 */

const { db } = require('../config/db');

const OrganizationUserModel = {

  async create({ organization_user_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires }, executor = db) {
    await executor.query(
      `INSERT INTO organization_users (organization_user_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, email_token, email_token_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organization_user_id, first_name, last_name, email, phone_number || null, country || null, role, user_type, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, email_token, email_token_expires]
    );
    return organization_user_id;
  },

  async createVerified({ organization_user_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password }, executor = db) {
    await executor.query(
      `INSERT INTO organization_users (organization_user_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, created_by_admin_id, created_by_entity_code, password, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [organization_user_id, first_name, last_name, email, phone_number || null, country || null, role, user_type, assigned_entity_type || null, assigned_entity_code || null, assigned_org_tree_id || null, created_by_admin_id, created_by_entity_code, password]
    );
    return organization_user_id;
  },

  async findById(organization_user_id) {
    const [rows] = await db.query('SELECT * FROM organization_users WHERE organization_user_id = ? AND is_active = TRUE', [organization_user_id]);
    return rows[0] || null;
  },

  async findByCode(organization_user_id) {
    const [rows] = await db.query('SELECT * FROM organization_users WHERE organization_user_id = ? AND is_active = TRUE', [organization_user_id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await db.query('SELECT * FROM organization_users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async getOnboardingStatus(organization_user_id) {
    const [rows] = await db.query(
      `SELECT onboarding_completed, onboarding_skipped, onboarding_completed_at
       FROM organization_users
       WHERE organization_user_id = ?`,
      [organization_user_id]
    );
    return rows[0] || null;
  },

  async updateOnboardingStatus(organization_user_id, { completed, skipped }) {
    await db.query(
      `UPDATE organization_users
       SET onboarding_completed = ?, onboarding_skipped = ?,
           onboarding_completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE onboarding_completed_at END
       WHERE organization_user_id = ?`,
      [completed ? 1 : 0, skipped ? 1 : 0, completed ? 1 : 0, organization_user_id]
    );
  },

  async resetOnboardingStatus(organization_user_id) {
    await db.query(
      `UPDATE organization_users
       SET onboarding_completed = 0, onboarding_skipped = 0, onboarding_completed_at = NULL
       WHERE organization_user_id = ?`,
      [organization_user_id]
    );
  },

  async findByEmailToken(token) {
    const [rows] = await db.query(
      'SELECT * FROM organization_users WHERE email_token = ? AND email_token_expires > NOW() AND is_active = TRUE',
      [token]
    );
    return rows[0] || null;
  },

  async verifyEmail(organization_user_id) {
    await db.query(
      'UPDATE organization_users SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL WHERE organization_user_id = ?',
      [organization_user_id]
    );
  },

  async setPassword(organization_user_id, hashedPassword) {
    await db.query('UPDATE organization_users SET password = ? WHERE organization_user_id = ?', [hashedPassword, organization_user_id]);
  },

  async listByCreator(entityCode, userType) {
    let query = 'SELECT organization_user_id AS user_code, organization_user_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM organization_users WHERE created_by_entity_code = ? AND is_active = TRUE';
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
    let query = `SELECT organization_user_id AS user_code, organization_user_id, first_name, last_name, email, phone_number, country, role, user_type, assigned_entity_type, assigned_entity_code, assigned_org_tree_id, email_verified, is_active, created_at, created_by_entity_code FROM organization_users WHERE created_by_entity_code IN (${placeholders}) AND is_active = TRUE`;
    const params = [...entityCodes];
    if (userType) {
      query += ' AND user_type = ?';
      params.push(userType);
    }
    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, params);
    return rows;
  },

  async update(organization_user_id, fields, executor = db) {
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
    values.push(organization_user_id);
    await executor.query(`UPDATE organization_users SET ${sets.join(', ')} WHERE organization_user_id = ?`, values);
  },

  async deleteById(organization_user_id) {
    await db.query('DELETE FROM organization_users WHERE organization_user_id = ?', [organization_user_id]);
  },

  async findByEntityCode(entityCode) {
    const [rows] = await db.query(
      `SELECT DISTINCT eh.organization_user_id, eh.first_name, eh.last_name, eh.email, eh.role,
              eh.user_type, eh.assigned_entity_type, eh.assigned_entity_code
         FROM organization_users eh
         LEFT JOIN organization_user_scopes ous
           ON ous.organization_user_id = eh.organization_user_id AND ous.is_active = TRUE
        WHERE (eh.assigned_entity_code = ? OR ous.entity_code = ?)
          AND eh.is_active = TRUE`,
      [entityCode, entityCode]
    );
    return rows;
  },

  async findByOrgTreeIds(orgTreeIds) {
    const ids = (orgTreeIds || []).filter((v) => v !== null && v !== undefined);
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT DISTINCT eh.organization_user_id, eh.first_name, eh.last_name, eh.email, eh.role,
              eh.user_type, eh.assigned_entity_type, eh.assigned_entity_code,
              COALESCE(ous.org_tree_id, eh.assigned_org_tree_id) AS assigned_org_tree_id
         FROM organization_users eh
         LEFT JOIN organization_user_scopes ous
           ON ous.organization_user_id = eh.organization_user_id AND ous.is_active = TRUE
        WHERE (eh.assigned_org_tree_id IN (${placeholders})
           OR ous.org_tree_id IN (${placeholders}))
          AND eh.is_active = TRUE`,
      [...ids, ...ids]
    );
    return rows;
  },

  async findOneByOrgTreeId(orgTreeId) {
    if (!orgTreeId) return null;
    const [rows] = await db.query(
      `SELECT DISTINCT eh.organization_user_id, eh.first_name, eh.last_name, eh.email, eh.role,
              eh.user_type, eh.assigned_entity_type, eh.assigned_entity_code,
              COALESCE(ous.org_tree_id, eh.assigned_org_tree_id) AS assigned_org_tree_id
         FROM organization_users eh
         LEFT JOIN organization_user_scopes ous
           ON ous.organization_user_id = eh.organization_user_id AND ous.is_active = TRUE
        WHERE (eh.assigned_org_tree_id = ? OR ous.org_tree_id = ?)
          AND eh.is_active = TRUE
        ORDER BY eh.created_at DESC
       LIMIT 1`,
      [orgTreeId, orgTreeId]
    );
    return rows[0] || null;
  },

  async regenerateToken(organization_user_id, token, expires) {
    await db.query(
      'UPDATE organization_users SET email_token = ?, email_token_expires = ? WHERE organization_user_id = ?',
      [token, expires, organization_user_id]
    );
  }
};

module.exports = OrganizationUserModel;
