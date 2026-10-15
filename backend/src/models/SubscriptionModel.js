const { db } = require('../config/db');
const { packageLimits, quotedAccountLimits } = require('../config/packageHierarchy');

// Limits for a workspace whose package is not active yet (registration payment
// still pending). A paid package replaces these with the purchased limits.
const DEFAULT_LIMITS = Object.freeze({
  company_level: 1,
  department: 4,
  audits: 2,
  checklists: 3,
  auditors: 1,
  auditor_eval: false,
  company_to_company: false,
});

function parseSnapshot(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

/** Limits bought by a paid registration, from its pricing snapshot. */
function limitsFromSnapshot(snapshot) {
  if (snapshot?.purchase_type === 'company_package') return packageLimits(snapshot);
  if (snapshot?.purchase_type === 'quoted_account') return quotedAccountLimits(snapshot);
  return null;
}

/**
 * A workspace's package is its paid registration payment: a Company package
 * ('Package') or a quoted Customer / Audit Firm account ('Custom'). Packages
 * are permanent, and the payment's pricing snapshot holds the bought limits.
 */
const SubscriptionModel = {
  DEFAULT_LIMITS,
  limitsFromSnapshot,

  async getActivePackage(rootEntityCode) {
    if (!rootEntityCode) return null;
    const [rows] = await db.query(
      `SELECT plan_name, pricing_snapshot, paid_at
         FROM payment_transactions
        WHERE root_entity_code = ? AND purpose = 'registration' AND status = 'paid'
        ORDER BY paid_at DESC, id DESC LIMIT 1`,
      [rootEntityCode]
    );
    if (!rows[0]) return null;
    const limits = limitsFromSnapshot(parseSnapshot(rows[0].pricing_snapshot));
    if (!limits) return null;
    // Paid department upgrades raise the package's department limit.
    const [upgrades] = await db.query(
      `SELECT pricing_snapshot FROM payment_transactions
        WHERE root_entity_code = ? AND purpose = 'plan_upgrade' AND status = 'paid'`,
      [rootEntityCode]
    );
    for (const upgrade of upgrades) {
      const snapshot = parseSnapshot(upgrade.pricing_snapshot);
      if (snapshot?.purchase_type === 'department_upgrade' && Number.isSafeInteger(Number(snapshot.departments))) {
        limits.department = Math.max(limits.department, Number(snapshot.departments));
      }
    }
    return { plan_name: rows[0].plan_name, activated_at: rows[0].paid_at, limits };
  },

  /** 'Package' or 'Custom' for an active workspace, otherwise null. */
  async getActivePlan(rootEntityCode) {
    return (await this.getActivePackage(rootEntityCode))?.plan_name || null;
  },

  /** Purchased limits, or null when the workspace has no active package. */
  async getActiveLimits(rootEntityCode) {
    return (await this.getActivePackage(rootEntityCode))?.limits || null;
  },

  /** Limits for display and enforcement; DEFAULT_LIMITS until the package is paid. */
  async getLimits(rootEntityCode) {
    return (await this.getActiveLimits(rootEntityCode)) ?? { ...DEFAULT_LIMITS };
  },

  /** Package status returned at login / getMe. Packages never expire. */
  async getStatus(rootEntityCode) {
    const active = await this.getActivePackage(rootEntityCode);
    return {
      has_subscription: Boolean(active),
      plan_name: active?.plan_name || null,
      billing_cycle: null,
      start_date: active?.activated_at || null,
      end_date: null,
      is_active: Boolean(active),
      is_expired: false,
      is_perpetual: Boolean(active),
    };
  },
};

module.exports = SubscriptionModel;
