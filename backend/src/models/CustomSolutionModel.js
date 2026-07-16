const { db } = require('../config/db');
const { generateCustomSolutionRequestId } = require('../utils/codeGenerator');

const CustomSolutionModel = {
  async create({
    root_entity_code,
    admin_id,
    org_name,
    org_email,
    entity_type,
    max_company_levels = 6,
    max_departments = 16,
    max_audits = 14,
    max_checklists = 25,
    max_auditors = 15,
    allow_auditor_eval = true,
    allow_company_to_company = true,
  }) {
    const request_id = await generateCustomSolutionRequestId();
    await db.query(
      `INSERT INTO custom_solution_requests
        (request_id, root_entity_code, admin_id, org_name, org_email, entity_type,
         max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
         allow_auditor_eval, allow_company_to_company, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        request_id, root_entity_code, admin_id, org_name, org_email, entity_type,
        max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
        allow_auditor_eval ? 1 : 0, allow_company_to_company ? 1 : 0,
      ]
    );
    return request_id;
  },

  async list() {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests ORDER BY created_at DESC`
    );
    return rows;
  },

  async listByStatus(status) {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );
    return rows;
  },

  async findByRequestId(request_id) {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests WHERE request_id = ? LIMIT 1`,
      [request_id]
    );
    return rows[0] || null;
  },

  async findByOrgCode(root_entity_code) {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests WHERE root_entity_code = ? LIMIT 1`,
      [root_entity_code]
    );
    return rows[0] || null;
  },

  async findByOrgCodePending(root_entity_code) {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests WHERE root_entity_code = ? AND status = 'pending' LIMIT 1`,
      [root_entity_code]
    );
    return rows[0] || null;
  },

  async assignPrice(request_id, { assigned_price, assigned_billing_cycle, admin_notes }) {
    await db.query(
      `UPDATE custom_solution_requests
       SET status = 'priced', assigned_price = ?, assigned_billing_cycle = ?, admin_notes = ?
       WHERE request_id = ?`,
      [assigned_price, assigned_billing_cycle, admin_notes || null, request_id]
    );
  },

  async updatePaymentCode(request_id, payment_code) {
    await db.query(
      `UPDATE custom_solution_requests SET payment_code = ? WHERE request_id = ?`,
      [payment_code, request_id]
    );
  },

  async updateStatus(request_id, status) {
    await db.query(
      `UPDATE custom_solution_requests SET status = ? WHERE request_id = ?`,
      [status, request_id]
    );
  },
};

module.exports = CustomSolutionModel;
