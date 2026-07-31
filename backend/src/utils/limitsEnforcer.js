const { db } = require('../config/db');
const SubscriptionModel = require('../models/SubscriptionModel');
const crypto = require('crypto');

const DEPARTMENT_ENTITY_STORAGE = {
  Department: { table: 'company_departments', ownerColumn: 'comp_code' },
  'Audit Firm Department': { table: 'audit_firm_company_departments', ownerColumn: 'afc_code' }
};

// Enforcement uses the lenient limits lookup (getLimits), which falls back to
// Basic when the organization has no currently-live subscription. This matches
// the "downgraded to Basic limits" behaviour shown in the UI and the plan_limits
// the frontend already enforces against. Access for expired/unpaid orgs is
// blocked at login, so there is no need to hard-block creation here.

const LimitsEnforcer = {
  /**
   * Serialize a quota check and its matching create operation across every
   * backend process connected to the same MySQL server.
   */
  async acquireQuotaLock(rootEntityCode, resourceType) {
    const lockHash = crypto
      .createHash('sha256')
      .update(`${process.env.DB_NAME || 'audito'}|${rootEntityCode}|${resourceType}`)
      .digest('hex')
      .slice(0, 48);
    const lockName = `audito_quota_${lockHash}`;
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const connection = await db.getConnection();
      try {
        const [rows] = await connection.query(
          'SELECT GET_LOCK(?, 0) AS acquired',
          [lockName]
        );
        const acquired = Number(rows[0]?.acquired) === 1;
        if (acquired) {
          let released = false;
          return {
            async release() {
              if (released) return;
              released = true;
              try {
                await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
              } catch (releaseError) {
                console.error('Failed to release quota lock:', releaseError.message);
              } finally {
                connection.release();
              }
            }
          };
        }
      } catch (error) {
        connection.release();
        throw error;
      }
      connection.release();
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const error = new Error('Timed out while waiting to verify the plan limit.');
    error.code = 'QUOTA_LOCK_TIMEOUT';
    throw error;
  },

  async withQuotaLock(rootEntityCode, resourceType, callback) {
    const lock = await this.acquireQuotaLock(rootEntityCode, resourceType);
    try {
      return await callback();
    } finally {
      await lock.release();
    }
  },

  /**
   * Check structure limits. Only Company and Audit Firm departments use the
   * plan's department capacity. All other structure entities are unlimited;
   * company-level settings describe plan hierarchy access, not creation count.
   * @param {string} rootEntityCode
   * @param {string} entityType
   * @returns {string|null} Error message if limit exceeded, else null.
   */
  async checkStructureLimits(rootEntityCode, entityType) {
    const storage = DEPARTMENT_ENTITY_STORAGE[entityType];
    if (!storage) return null;

    const limits = await SubscriptionModel.getLimits(rootEntityCode);

    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) AS count FROM \`${storage.table}\` WHERE \`${storage.ownerColumn}\` = ? AND is_active = TRUE`,
      [rootEntityCode]
    );

    if (count >= limits.department) {
      return `Plan Limit Reached: Your current plan allows a maximum of ${limits.department} ${entityType} entity(s).`;
    }
    return null; // OK
  },

  /**
   * Check auditor limit.
   */
  async checkAuditorLimit(rootEntityCode) {
    const limits = await SubscriptionModel.getLimits(rootEntityCode);
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM auditors WHERE created_by_entity_code = ? AND is_active = TRUE', [rootEntityCode]
    );
    if (count >= limits.auditors) {
      return `Plan Limit Reached: Your current plan allows a maximum of ${limits.auditors} Auditor(s).`;
    }
    return null;
  },

  /**
   * Check checklist limit.
   */
  async checkChecklistLimit(rootEntityCode) {
    const limits = await SubscriptionModel.getLimits(rootEntityCode);
    const [[{ count }]] = await db.query(
      'SELECT COUNT(*) as count FROM checklists WHERE created_by = ? AND is_active = TRUE', [rootEntityCode]
    );
    if (count >= limits.checklists) {
      return `Plan Limit Reached: Your current plan allows a maximum of ${limits.checklists} Checklist(s).`;
    }
    return null;
  },

  /**
   * Check audit limit.
   */
  async checkAuditLimit(rootEntityCode) {
    const limits = await SubscriptionModel.getLimits(rootEntityCode);
    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) as count
       FROM audit_assignments
       WHERE created_by = ? AND is_active = TRUE AND status != 'cancelled'`,
      [rootEntityCode]
    );
    if (count >= limits.audits) {
      return `Plan Limit Reached: Your current plan allows a maximum of ${limits.audits} Audit(s).`;
    }
    return null;
  }
};

module.exports = LimitsEnforcer;
