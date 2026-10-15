const { db } = require('../config/db');

const PlanSettingsModel = {
  async find(planName) {
    const [rows] = await db.query(
      `SELECT plan_name, display_name, description, sort_order,
              monthly_price, activation_price, token_unit_price, included_tokens,
              signup_tokens, daily_free_tokens, token_billing_enabled,
              yearly_discount_percent, max_company_levels,
              max_departments, max_audits, max_checklists, max_auditors,
              allow_auditor_eval, allow_company_to_company, is_active
       FROM plan_settings WHERE plan_name = ? LIMIT 1`,
      [planName]
    );
    return rows[0] || null;
  },

  async findEntryPrice(entityType) {
    const [rows] = await db.query(
      'SELECT monthly_price FROM plan_entry_prices WHERE entity_type = ? LIMIT 1',
      [entityType]
    );
    return rows[0] || null;
  },

};

module.exports = PlanSettingsModel;
