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

function normalizePlanName(planName) {
  if (!planName) return 'Basic';
  const key = String(planName).trim();
  return PLAN_NAME_ALIASES[key] || 'Basic';
}

const SubscriptionModel = {
  PLAN_LIMITS,

  async createSubscription(connection, rootEntityCode, planName, billingCycle) {
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
        rootEntityCode, effectivePlanName, billingCycle, start, end, true,
        limits.company_level, limits.department, limits.audits, limits.checklists, limits.auditors,
        limits.auditor_eval, limits.company_to_company
      ]
    );
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
  }
};

module.exports = SubscriptionModel;
