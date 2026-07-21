const { db } = require('../config/db');
const { generateCustomSolutionRequestId } = require('../utils/codeGenerator');

const CustomSolutionModel = {
  async create({
    root_entity_code,
    admin_id,
    org_name,
    org_email,
    entity_type,
    max_company_levels = 5,
    max_departments = 16,
    max_audits = 14,
    max_checklists = 25,
    max_auditors = 15,
    allow_auditor_eval = true,
    allow_company_to_company = true,
    verification_token = null,
    verification_expires_at = null,
  }, executor = db) {
    const request_id = await generateCustomSolutionRequestId();
    await executor.query(
      `INSERT INTO custom_solution_requests
        (request_id, root_entity_code, admin_id, org_name, org_email, entity_type,
         max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
         allow_auditor_eval, allow_company_to_company, status, verification_token, verification_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        request_id, root_entity_code, admin_id, org_name, org_email, entity_type,
        max_company_levels, max_departments, max_audits, max_checklists, max_auditors,
        allow_auditor_eval ? 1 : 0, allow_company_to_company ? 1 : 0, verification_token, verification_expires_at,
      ]
    );
    return request_id;
  },

  async list() {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests WHERE email_verified = TRUE ORDER BY created_at DESC`
    );
    return rows;
  },

  async listByStatus(status) {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests WHERE status = ? AND email_verified = TRUE ORDER BY created_at DESC`,
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

  async findByVerificationToken(verification_token) {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests
       WHERE verification_token = ? AND verification_expires_at > NOW()
       LIMIT 1`,
      [verification_token]
    );
    return rows[0] || null;
  },

  async verifyEmail(request_id) {
    await db.query(
      `UPDATE custom_solution_requests
       SET email_verified = TRUE, verification_token = NULL, verification_expires_at = NULL
       WHERE request_id = ?`,
      [request_id]
    );
  },

  async findByPaymentCode(payment_code) {
    const [rows] = await db.query(
      `SELECT * FROM custom_solution_requests WHERE payment_code = ? LIMIT 1`,
      [payment_code]
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

  async completeAdminSetup(request_id, admin_id) {
    await db.query(
      `UPDATE custom_solution_requests
       SET admin_id = ?, admin_setup_completed = TRUE
       WHERE request_id = ?`,
      [admin_id, request_id]
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
