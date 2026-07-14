/**
 * Audit Firm Model
 * Handles: audit_firm_companies, audit_firm_company_branches
 *          audit_firm_company_departments
 *
 * Hierarchy:
 *   Audit Firm Company (L6) -> Branch (L3)
 *
 * All entities register independently. Parent codes are filled
 * when an organization link is accepted.
 */

const { db } = require('../config/db');

const AuditFirmModel = {

  // --- audit_firm_companies ---

  async createAuditFirm({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, afc_code }) {
    const [result] = await db.query(
      `INSERT INTO audit_firm_companies (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, afc_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, afc_code]
    );
    return afc_code;
  },

  async findFirmByCode(afc_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_companies WHERE afc_code = ? AND is_active = TRUE',
      [afc_code]
    );
    return rows[0] || null;
  },

  async findFirmByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_companies WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateFirm(afc_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(afc_code);
    await db.query(`UPDATE audit_firm_companies SET ${updates.join(', ')} WHERE afc_code = ?`, values);
    return true;
  },

  // --- audit_firm_company_branches ---

  async createBranch({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, afc_code, afc_branch_code }) {
    const [result] = await db.query(
      `INSERT INTO audit_firm_company_branches (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, afc_code, afc_branch_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, afc_code || null, afc_branch_code]
    );
    return afc_branch_code;
  },

  async findBranchByCode(afc_branch_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_company_branches WHERE afc_branch_code = ? AND is_active = TRUE',
      [afc_branch_code]
    );
    return rows[0] || null;
  },

  async findBranchesByFirm(afc_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_company_branches WHERE afc_code = ? AND is_active = TRUE ORDER BY name',
      [afc_code]
    );
    return rows;
  },

  // --- audit_firm_company_departments ---

  async createDepartment({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, afc_code, afc_branch_code, afc_dept_code }) {
    const [result] = await db.query(
      `INSERT INTO audit_firm_company_departments (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, afc_code, afc_branch_code, afc_dept_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, afc_code || null, afc_branch_code || null, afc_dept_code]
    );
    return afc_dept_code;
  },

  async findDepartmentByCode(afc_dept_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_company_departments WHERE afc_dept_code = ? AND is_active = TRUE',
      [afc_dept_code]
    );
    return rows[0] || null;
  },

  async findDepartmentsByBranch(afc_branch_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_company_departments WHERE afc_branch_code = ? AND is_active = TRUE ORDER BY name',
      [afc_branch_code]
    );
    return rows;
  },

  async findDepartmentsByFirm(afc_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_company_departments WHERE afc_code = ? AND is_active = TRUE ORDER BY name',
      [afc_code]
    );
    return rows;
  },

  async updateDepartment(afc_dept_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'afc_code', 'afc_branch_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(afc_dept_code);
    await db.query(`UPDATE audit_firm_company_departments SET ${updates.join(', ')} WHERE afc_dept_code = ?`, values);
    return true;
  },

  async deactivateDepartment(afc_dept_code) {
    await db.query('UPDATE audit_firm_company_departments SET is_active = FALSE WHERE afc_dept_code = ?', [afc_dept_code]);
  },

  async findBranchByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM audit_firm_company_branches WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateBranch(afc_branch_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'afc_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(afc_branch_code);
    await db.query(`UPDATE audit_firm_company_branches SET ${updates.join(', ')} WHERE afc_branch_code = ?`, values);
    return true;
  },

  async deactivateBranch(afc_branch_code) {
    await db.query('UPDATE audit_firm_company_branches SET is_active = FALSE WHERE afc_branch_code = ?', [afc_branch_code]);
  },

  // --- full structure ---

  async getFullStructure(afc_code) {
    const firm = await this.findFirmByCode(afc_code);
    if (!firm) return null;

    const branches = await this.findBranchesByFirm(afc_code);

    return {
      ...firm,
      entity_type: 'Audit Firm Company',
      branches
    };
  }
};

module.exports = AuditFirmModel;
