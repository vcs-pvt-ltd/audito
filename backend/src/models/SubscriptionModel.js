const { db } = require('../config/db');

const PLAN_LIMITS = {
  Basic: {
    company_level: 1,
    department: 4,
    audits: 2,
    checklists: 3,
    auditors: 1,
    auditor_eval: false,
    company_to_company: false
  },
  Pro: {
    company_level: 2,
    department: 8,
    audits: 6,
    checklists: 6,
    auditors: 3,
    auditor_eval: false,
    company_to_company: false
  },
  Elite: {
    company_level: 6,
    department: 16,
    audits: 14,
    checklists: 25,
    auditors: 15,
    auditor_eval: true,
    company_to_company: true
  }
};

// Database enum values are: Basic | Pro | Elite
const PLAN_NAME_ALIASES = {
  Free: 'Basic',
  Basic: 'Basic',
  Pro: 'Pro',
  Elite: 'Elite'
};

// Monthly list price (USD). Yearly applies a 20% discount on 12 months.
const PLAN_PRICING = {
  Basic: 0,
  Pro: 99,
  Elite: 299
};

function normalizePlanName(planName) {
  if (!planName) return 'Basic';
  const key = String(planName).trim();
  return PLAN_NAME_ALIASES[key] || 'Basic';
}

// Authoritative server-side price for a plan + billing cycle.
function computeAmount(planName, billingCycle) {
  const monthly = PLAN_PRICING[normalizePlanName(planName)] ?? 0;
  if (!monthly) return 0;
  return billingCycle === 'Yearly' ? Math.round(monthly * 12 * 0.8) : monthly;
}

const SubscriptionModel = {
  PLAN_LIMITS,
  PLAN_PRICING,
  normalizePlanName,
  computeAmount,

  async createSubscription(connection, rootEntityCode, planName, billingCycle, isActive = true) {
    const start = new Date();
    const end = new Date();

    if (billingCycle === 'Yearly') {
      end.setFullYear(end.getFullYear() + 1);
    } else if (billingCycle === 'Monthly') {
      end.setMonth(end.getMonth() + 1);
    } else {
      // Free / None – assume 100 years
      end.setFullYear(end.getFullYear() + 100);
    }

    const effectivePlanName = normalizePlanName(planName);
    const limits = PLAN_LIMITS[effectivePlanName] || PLAN_LIMITS['Basic'];

    await connection.query(
      `INSERT INTO subscriptions (
        root_entity_code, plan_name, billing_cycle, start_date, end_date, is_active,
        max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
        allow_auditor_eval, allow_company_to_company
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rootEntityCode, effectivePlanName, billingCycle, start, end, isActive,
        limits.company_level, limits.department, limits.audits, limits.checklists, limits.auditors,
        limits.auditor_eval, limits.company_to_company
      ]
    );

    return { start, end };
  },

  // Called after a successful payment. The subscriptions table has a UNIQUE key
  // on root_entity_code (one row per org), so this upserts that row: updates the
  // plan / billing period / limits in place if it exists, or inserts it for a
  // paid registration where the row was deferred. Returns { start, end }.
  async activatePaidSubscription(rootEntityCode, planName, billingCycle) {
    const start = new Date();
    const end = new Date();

    if (billingCycle === 'Yearly') {
      end.setFullYear(end.getFullYear() + 1);
    } else if (billingCycle === 'Monthly') {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 100);
    }

    const effectivePlanName = normalizePlanName(planName);
    const limits = PLAN_LIMITS[effectivePlanName] || PLAN_LIMITS['Basic'];

    await db.query(
      `INSERT INTO subscriptions (
        root_entity_code, plan_name, billing_cycle, start_date, end_date, is_active,
        max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
        allow_auditor_eval, allow_company_to_company
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        plan_name = VALUES(plan_name),
        billing_cycle = VALUES(billing_cycle),
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        is_active = 1,
        max_company_levels = VALUES(max_company_levels),
        max_departments = VALUES(max_departments),
        max_audits = VALUES(max_audits),
        max_checklists = VALUES(max_checklists),
        max_auditors = VALUES(max_auditors),
        allow_auditor_eval = VALUES(allow_auditor_eval),
        allow_company_to_company = VALUES(allow_company_to_company)`,
      [
        rootEntityCode, effectivePlanName, billingCycle, start, end,
        limits.company_level, limits.department, limits.audits, limits.checklists, limits.auditors,
        limits.auditor_eval, limits.company_to_company
      ]
    );

    return { start, end };
  },

  async getActivePlan(rootEntityCode) {
    const [rows] = await db.query(
      `SELECT plan_name, is_active, end_date 
       FROM subscriptions 
       WHERE root_entity_code = ? AND is_active = 1
         AND end_date > NOW()
       ORDER BY id DESC LIMIT 1`,
      [rootEntityCode]
    );

    if (rows.length > 0) {
      return rows[0].plan_name;
    }
    return 'Basic'; // Default fallback if no active row
  },

  /**
   * Strict limits lookup — reads ONLY the live subscriptions row.
   * Returns null when the organization has no active subscription
   * (no hardcoded fallback). Use this for enforcement.
   */
  async getActiveLimits(rootEntityCode) {
    const [rows] = await db.query(
      `SELECT max_company_levels, max_departments, max_audits, max_checklists, max_auditors, allow_auditor_eval, allow_company_to_company
       FROM subscriptions
       WHERE root_entity_code = ? AND is_active = 1
         AND end_date > NOW()
       ORDER BY id DESC LIMIT 1`,
      [rootEntityCode]
    );

    if (rows.length === 0) return null;

    const dbLimits = rows[0];
    return {
      company_level: dbLimits.max_company_levels,
      department: dbLimits.max_departments,
      audits: dbLimits.max_audits,
      checklists: dbLimits.max_checklists,
      auditors: dbLimits.max_auditors,
      auditor_eval: dbLimits.allow_auditor_eval ? true : false,
      company_to_company: dbLimits.allow_company_to_company ? true : false
    };
  },

  /**
   * Lenient limits lookup — used only to feed UI feature flags for display.
   * Falls back to Basic so the UI still renders; NOT for enforcement.
   */
  async getLimits(rootEntityCode) {
    const limits = await this.getActiveLimits(rootEntityCode);
    return limits ?? PLAN_LIMITS['Basic'];
  },

  /**
   * Returns the latest subscription row's status for an organization,
   * with an `is_expired` flag derived from end_date. Used at login / getMe
   * to identify expired plans. Free/None plans have a far-future end_date,
   * so they never report as expired.
   */
  async getStatus(rootEntityCode) {
    if (!rootEntityCode) {
      return { has_subscription: false, plan_name: 'Basic', billing_cycle: null, start_date: null, end_date: null, is_active: false, is_expired: false };
    }

    const [rows] = await db.query(
      `SELECT plan_name, billing_cycle, start_date, end_date, is_active,
              (end_date <= NOW()) AS is_expired
       FROM subscriptions
       WHERE root_entity_code = ?
       ORDER BY id DESC LIMIT 1`,
      [rootEntityCode]
    );

    if (rows.length === 0) {
      return { has_subscription: false, plan_name: 'Basic', billing_cycle: null, start_date: null, end_date: null, is_active: false, is_expired: false };
    }

    const r = rows[0];
    return {
      has_subscription: true,
      plan_name: r.plan_name,
      billing_cycle: r.billing_cycle,
      start_date: r.start_date,
      end_date: r.end_date,
      is_active: !!r.is_active,
      is_expired: !!r.is_expired,
    };
  },

  /**
   * Deactivates any still-active subscription rows whose end_date has passed.
   * Once deactivated, limit lookups fall back to Basic, downgrading an expired
   * organization until it renews. Returns true if a row was deactivated.
   */
  async deactivateExpired(rootEntityCode) {
    if (!rootEntityCode) return false;
    const [result] = await db.query(
      `UPDATE subscriptions
       SET is_active = 0
       WHERE root_entity_code = ? AND is_active = 1 AND end_date <= NOW()`,
      [rootEntityCode]
    );
    return result.affectedRows > 0;
  }
};

module.exports = SubscriptionModel;
