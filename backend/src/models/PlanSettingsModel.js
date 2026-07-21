const { db } = require('../config/db');

const STANDARD_PLANS = ['Basic', 'Pro', 'Elite'];

const PlanSettingsModel = {
  STANDARD_PLANS,

  async list() {
    const [plans] = await db.query(
      `SELECT plan_name, monthly_price, yearly_discount_percent, max_company_levels,
              max_departments, max_audits, max_checklists, max_auditors,
              allow_auditor_eval, allow_company_to_company, is_active, updated_at
       FROM plan_settings
       ORDER BY FIELD(plan_name, 'Basic', 'Pro', 'Elite'), plan_name ASC`
    );
    const [entryPrices] = await db.query(
      `SELECT entity_type, monthly_price FROM plan_entry_prices ORDER BY entity_type`
    );
    return { plans, entry_prices: entryPrices };
  },

  async find(planName) {
    const [rows] = await db.query(
      `SELECT plan_name, monthly_price, yearly_discount_percent, max_company_levels,
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

  async updatePlan(planName, data) {
    await db.query(
      `UPDATE plan_settings
       SET monthly_price = ?, max_company_levels = ?, max_departments = ?,
           max_audits = ?, max_checklists = ?, max_auditors = ?,
           allow_auditor_eval = ?, allow_company_to_company = ?, is_active = ?
       WHERE plan_name = ?`,
      [
        data.monthly_price, data.max_company_levels, data.max_departments,
        data.max_audits, data.max_checklists, data.max_auditors,
        data.allow_auditor_eval ? 1 : 0, data.allow_company_to_company ? 1 : 0,
        data.is_active ? 1 : 0, planName,
      ]
    );
    return this.find(planName);
  },

  async createPlan(data) {
    await db.query(
      `INSERT INTO plan_settings
       (plan_name, monthly_price, yearly_discount_percent,
        max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
        allow_auditor_eval, allow_company_to_company, is_active)
       VALUES (?, ?, (SELECT yearly_discount_percent FROM (SELECT * FROM plan_settings) AS settings LIMIT 1), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.plan_name, data.monthly_price, data.max_company_levels, data.max_departments, data.max_audits,
        data.max_checklists, data.max_auditors, data.allow_auditor_eval ? 1 : 0,
        data.allow_company_to_company ? 1 : 0, data.is_active ? 1 : 0,
      ]
    );
    return this.find(data.plan_name);
  },

  async updateYearlyDiscount(yearlyDiscountPercent) {
    await db.query(
      'UPDATE plan_settings SET yearly_discount_percent = ?',
      [yearlyDiscountPercent]
    );
    return this.list();
  },

  async updateEntryPrice(entityType, monthlyPrice) {
    await db.query(
      `INSERT INTO plan_entry_prices (entity_type, monthly_price) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE monthly_price = VALUES(monthly_price)`,
      [entityType, monthlyPrice]
    );
    return this.findEntryPrice(entityType);
  },
};

module.exports = PlanSettingsModel;
