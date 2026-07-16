const { db } = require('../config/db');
const SubscriptionModel = require('../models/SubscriptionModel');

const COMPANY_HIERARCHY_DEPTH = {
  Company: 1,
  Cluster: 2,
  Factory: 3,
  Unit: 4,
  Department: 5,
  Section: 6
};

// Enforcement uses the lenient limits lookup (getLimits), which falls back to
// Basic when the organization has no currently-live subscription. This matches
// the "downgraded to Basic limits" behaviour shown in the UI and the plan_limits
// the frontend already enforces against. Access for expired/unpaid orgs is
// blocked at login, so there is no need to hard-block creation here.

const LimitsEnforcer = {
  /**
   * Check structure limits (Companies and Departments).
   * @param {string} rootEntityCode
   * @param {string} entityType
   * @returns {string|null} Error message if limit exceeded, else null.
   */
  async checkStructureLimits(rootEntityCode, entityType) {
    const limits = await SubscriptionModel.getLimits(rootEntityCode);

    // max_company_levels is a hierarchy-depth limit, not a count of records.
    // The registered Company root is depth 1; each entity type below it adds
    // one level. For independently registered sub-entities, depth is measured
    // relative to that entity so their root still counts as level 1.
    const requestedDepth = COMPANY_HIERARCHY_DEPTH[entityType];
    if (requestedDepth) {
      const [adminRows] = await db.query(
        'SELECT entity_type FROM admins WHERE entity_code = ? LIMIT 1',
        [rootEntityCode]
      );
      const rootDepth = COMPANY_HIERARCHY_DEPTH[adminRows[0]?.entity_type];
      if (rootDepth) {
        const relativeDepth = requestedDepth - rootDepth + 1;
        if (relativeDepth > limits.company_level) {
          return `Plan Limit Reached: Your current plan allows ${limits.company_level} Company hierarchy level(s). Upgrade to create ${entityType}.`;
        }
      }
    }

    if (entityType === 'Department') {
      const [[{ count: compDeptCount }]] = await db.query(
        'SELECT COUNT(*) as count FROM company_departments WHERE (cust_code = ? OR comp_code = ?) AND is_active = TRUE', [rootEntityCode, rootEntityCode]
      );
      if (compDeptCount >= limits.department) {
        return `Plan Limit Reached: Your current plan allows a maximum of ${limits.department} Department entity(s).`;
      }
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
      'SELECT COUNT(*) as count FROM audit_assignments WHERE created_by = ? AND is_active = TRUE',
      [rootEntityCode]
    );
    if (count >= limits.audits) {
      return `Plan Limit Reached: Your current plan allows a maximum of ${limits.audits} Audit(s).`;
    }
    return null;
  }
};

module.exports = LimitsEnforcer;
