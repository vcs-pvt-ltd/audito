const { db } = require('../config/db');
const PlanSettingsModel = require('./PlanSettingsModel');

let subIdCounter = null;

async function genSubscriptionId() {
  if (subIdCounter === null) {
    const [rows] = await db.query(
      "SELECT MAX(CAST(SUBSTRING(subscription_id, 5) AS UNSIGNED)) AS max_num FROM subscriptions WHERE subscription_id LIKE 'SUB-%'"
    );
    subIdCounter = (rows[0].max_num || 0) + 1;
  }
  const id = `SUB-${String(subIdCounter).padStart(6, '0')}`;
  subIdCounter++;
  return id;
}

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
    company_level: 5,
    department: 16,
    audits: 14,
    checklists: 25,
    auditors: 15,
    auditor_eval: true,
    company_to_company: true
  }
};

// Database enum values are: Basic | Pro | Elite | Custom
const PLAN_NAME_ALIASES = {
  Free: 'Basic',
  Basic: 'Basic',
  Pro: 'Pro',
  Elite: 'Elite',
  Custom: 'Custom'
};

// Monthly list price (USD). Yearly applies a 20% discount on 12 months.
const PLAN_PRICING = {
  Basic: 99,
  Pro: 199,
  Elite: 299
};

// Customer-family workspaces use their own monthly subscription prices,
// independent of the standard Company / Audit Firm plan price.
const CUSTOMER_ENTITY_PRICING = {
  Customer: 999,
  'Buying Office': 599,
  Supplier: 299
};

function normalizePlanName(planName) {
  if (!planName) return 'Basic';
  const key = String(planName).trim();
  return PLAN_NAME_ALIASES[key] || key;
}

// Authoritative server-side price for a plan + billing cycle.
async function getPlanLimits(planName) {
  const config = await PlanSettingsModel.find(normalizePlanName(planName));
  if (!config) return PLAN_LIMITS[normalizePlanName(planName)] || PLAN_LIMITS.Basic;
  return {
    company_level: Number(config.max_company_levels),
    department: Number(config.max_departments),
    audits: Number(config.max_audits),
    checklists: Number(config.max_checklists),
    auditors: Number(config.max_auditors),
    auditor_eval: !!config.allow_auditor_eval,
    company_to_company: !!config.allow_company_to_company,
  };
}

async function computeAmount(planName, billingCycle, entityType = null) {
  // Customer-family subscriptions have entity-specific billing. Company and
  // Audit Firm hierarchy prices are registration entry labels; their standard
  // plan checkout still uses the selected plan's configured price.
  const customerEntryTypes = ['Customer', 'Buying Office', 'Supplier'];
  const entryPrice = customerEntryTypes.includes(entityType) ? await PlanSettingsModel.findEntryPrice(entityType) : null;
  const config = await PlanSettingsModel.find(normalizePlanName(planName));
  const monthly = entryPrice ? Number(entryPrice.monthly_price) : Number(config?.monthly_price ?? PLAN_PRICING[normalizePlanName(planName)] ?? 0);
  if (!monthly) return 0;
  const discount = Number(config?.yearly_discount_percent ?? 20);
  return billingCycle === 'Yearly' ? Math.round(monthly * 12 * (1 - discount / 100) * 100) / 100 : monthly;
}

/**
 * Custom subscriptions are an expansion of Elite, never a downgrade from it.
 * Normalising here protects the limits even if a request is altered outside
 * the registration interface.
 */
async function normalizeCustomLimits(limits = {}) {
  const eliteLimits = await getPlanLimits('Elite');
  const atLeast = (value, minimum) => {
    const parsed = Number.parseInt(value, 10);
    return Math.max(minimum, Number.isFinite(parsed) ? parsed : minimum);
  };

  return {
    company_level: atLeast(limits.company_level, eliteLimits.company_level),
    department: atLeast(limits.department, eliteLimits.department),
    audits: atLeast(limits.audits, eliteLimits.audits),
    checklists: atLeast(limits.checklists, eliteLimits.checklists),
    auditors: atLeast(limits.auditors, eliteLimits.auditors),
    auditor_eval: true,
    company_to_company: true,
  };
}

const SubscriptionModel = {
  PLAN_LIMITS,
  PLAN_PRICING,
  CUSTOMER_ENTITY_PRICING,
  normalizePlanName,
  getPlanLimits,
  computeAmount,
  normalizeCustomLimits,

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
    const limits = await getPlanLimits(effectivePlanName);

    const subscription_id = await genSubscriptionId();
    await connection.query(
      `INSERT INTO subscriptions (
        subscription_id, root_entity_code, plan_name, billing_cycle, start_date, end_date, is_active,
        max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
        allow_auditor_eval, allow_company_to_company
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subscription_id, rootEntityCode, effectivePlanName, billingCycle, start, end, isActive,
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
  async activatePaidSubscription(rootEntityCode, planName, billingCycle, customLimits = null) {
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
    const limits = effectivePlanName === 'Custom'
      ? await normalizeCustomLimits(customLimits)
      : await getPlanLimits(effectivePlanName);

    const subscription_id = await genSubscriptionId();
    await db.query(
      `INSERT INTO subscriptions (
        subscription_id, root_entity_code, plan_name, billing_cycle, start_date, end_date, is_active,
        max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
        allow_auditor_eval, allow_company_to_company
      ) VALUES (?, ?, ?, ?, ?,?, 1, ?, ?, ?, ?, ?, ?, ?)
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
        subscription_id, rootEntityCode, effectivePlanName, billingCycle, start, end,
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
       ORDER BY subscription_id DESC LIMIT 1`,
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
       ORDER BY subscription_id DESC LIMIT 1`,
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
    return limits ?? await getPlanLimits('Basic');
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
       ORDER BY subscription_id DESC LIMIT 1`,
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
