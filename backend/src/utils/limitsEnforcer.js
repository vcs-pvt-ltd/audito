const { db } = require('../config/db');
const SubscriptionModel = require('../models/SubscriptionModel');

const FIRST_CHILD_BY_ROOT_ENTITY_TYPE = {
  Company: 'Cluster',
  Cluster: 'Factory',
  Factory: 'Unit',
  Unit: 'Department',
  Department: 'Section',
  'Audit Firm Company': 'Branch',
  Branch: 'Audit Firm Department'
};

const STRUCTURE_ENTITY_STORAGE = {
  Cluster: { table: 'company_clusters', ownerColumn: 'comp_code' },
  Factory: { table: 'company_factories', ownerColumn: 'comp_code' },
  Unit: { table: 'company_units', ownerColumn: 'comp_code' },
  Department: { table: 'company_departments', ownerColumn: 'comp_code' },
  Section: { table: 'company_sections', ownerColumn: 'comp_code' },
  Branch: { table: 'audit_firm_company_branches', ownerColumn: 'afc_code' },
  'Audit Firm Department': { table: 'audit_firm_company_departments', ownerColumn: 'afc_code' }
};

// Enforcement uses the lenient limits lookup (getLimits), which falls back to
// Basic when the organization has no currently-live subscription. This matches
// the "downgraded to Basic limits" behaviour shown in the UI and the plan_limits
// the frontend already enforces against. Access for expired/unpaid orgs is
// blocked at login, so there is no need to hard-block creation here.

const LimitsEnforcer = {
  /**
   * Check structure limits. The first entity type below the registered root
   * uses the plan's company-level capacity. Each later structure entity type
   * uses the plan's department capacity.
   * @param {string} rootEntityCode
   * @param {string} entityType
   * @returns {string|null} Error message if limit exceeded, else null.
   */
  async checkStructureLimits(rootEntityCode, entityType) {
    const limits = await SubscriptionModel.getLimits(rootEntityCode);

    const storage = STRUCTURE_ENTITY_STORAGE[entityType];
    if (!storage) return null;

    const [adminRows] = await db.query(
      'SELECT entity_type FROM admins WHERE entity_code = ? LIMIT 1',
      [rootEntityCode]
    );
    const rootEntityType = adminRows[0]?.entity_type;
    const isFirstChildType = FIRST_CHILD_BY_ROOT_ENTITY_TYPE[rootEntityType] === entityType;
    const limit = isFirstChildType ? limits.company_level : limits.department;

    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) AS count FROM \`${storage.table}\` WHERE \`${storage.ownerColumn}\` = ? AND is_active = TRUE`,
      [rootEntityCode]
    );

    if (count >= limit) {
      const capacityName = isFirstChildType ? 'company-level' : 'department';
      return `Plan Limit Reached: Your current plan allows a maximum of ${limit} ${entityType} entity(s) under the ${capacityName} capacity.`;
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
