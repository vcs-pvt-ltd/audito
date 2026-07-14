/**
 * Company Model
 * Handles: companies, company_clusters, company_factories, company_units, company_departments
 *
 * Hierarchy:
 *   Company (L5) -> Cluster (L4) -> Factory (L3) -> Unit (L2) -> Department (L1)
 *
 * All entities register independently. Parent codes are filled
 * when an organization link is accepted.
 */

const { db } = require('../config/db');

const CompanyModel = {

  // --- companies ---

  async createCompany({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, company_type }) {
    const [result] = await db.query(
      `INSERT INTO companies (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, company_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, comp_code, cust_code || null, company_type || null]
    );
    return comp_code;
  },

  async findCompanyByCode(comp_code) {
    const [rows] = await db.query(
      'SELECT * FROM companies WHERE comp_code = ? AND is_active = TRUE',
      [comp_code]
    );
    return rows[0] || null;
  },

  async findCompanyByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM companies WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async findCompaniesByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM companies WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  async deactivateCompany(comp_code) {
    await db.query('UPDATE companies SET is_active = FALSE WHERE comp_code = ?', [comp_code]);
  },

  async updateCompany(comp_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'is_active', 'company_type'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(comp_code);
    await db.query(`UPDATE companies SET ${updates.join(', ')} WHERE comp_code = ?`, values);
    return true;
  },

  // --- company_clusters ---

  async createCluster({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code }) {
    const [result] = await db.query(
      `INSERT INTO company_clusters (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, comp_code || null, cust_code || null, comp_clus_code]
    );
    return comp_clus_code;
  },

  async findClusterByCode(comp_clus_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_clusters WHERE comp_clus_code = ? AND is_active = TRUE',
      [comp_clus_code]
    );
    return rows[0] || null;
  },

  async findClustersByCompany(comp_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_clusters WHERE comp_code = ? AND is_active = TRUE ORDER BY name',
      [comp_code]
    );
    return rows;
  },

  async findClusterByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM company_clusters WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateCluster(comp_clus_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'comp_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(comp_clus_code);
    await db.query(`UPDATE company_clusters SET ${updates.join(', ')} WHERE comp_clus_code = ?`, values);
    return true;
  },

  async deactivateCluster(comp_clus_code) {
    await db.query('UPDATE company_clusters SET is_active = FALSE WHERE comp_clus_code = ?', [comp_clus_code]);
  },

  async findClustersByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_clusters WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  // --- company_factories ---

  async createFactory({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code, comp_fact_code }) {
    const [result] = await db.query(
      `INSERT INTO company_factories (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code, comp_fact_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, comp_code || null, cust_code || null, comp_clus_code || null, comp_fact_code]
    );
    return comp_fact_code;
  },

  async findFactoryByCode(comp_fact_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_factories WHERE comp_fact_code = ? AND is_active = TRUE',
      [comp_fact_code]
    );
    return rows[0] || null;
  },

  async findFactoriesByCompany(comp_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_factories WHERE comp_code = ? AND is_active = TRUE ORDER BY name',
      [comp_code]
    );
    return rows;
  },

  async findFactoriesByCluster(comp_clus_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_factories WHERE comp_clus_code = ? AND is_active = TRUE ORDER BY name',
      [comp_clus_code]
    );
    return rows;
  },

  async findFactoryByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM company_factories WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateFactory(comp_fact_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'comp_code', 'comp_clus_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(comp_fact_code);
    await db.query(`UPDATE company_factories SET ${updates.join(', ')} WHERE comp_fact_code = ?`, values);
    return true;
  },

  async deactivateFactory(comp_fact_code) {
    await db.query('UPDATE company_factories SET is_active = FALSE WHERE comp_fact_code = ?', [comp_fact_code]);
  },

  async findFactoriesByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_factories WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  // --- company_units ---

  async createUnit({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code, comp_fact_code, comp_unit_code }) {
    const [result] = await db.query(
      `INSERT INTO company_units (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code, comp_fact_code, comp_unit_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, comp_code || null, cust_code || null, comp_clus_code || null, comp_fact_code || null, comp_unit_code]
    );
    return comp_unit_code;
  },

  async findUnitByCode(comp_unit_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_units WHERE comp_unit_code = ? AND is_active = TRUE',
      [comp_unit_code]
    );
    return rows[0] || null;
  },

  async findUnitsByFactory(comp_fact_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_units WHERE comp_fact_code = ? AND is_active = TRUE ORDER BY name',
      [comp_fact_code]
    );
    return rows;
  },

  async findUnitsByCompany(comp_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_units WHERE comp_code = ? AND is_active = TRUE ORDER BY name',
      [comp_code]
    );
    return rows;
  },

  async findUnitByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM company_units WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateUnit(comp_unit_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'comp_code', 'comp_fact_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(comp_unit_code);
    await db.query(`UPDATE company_units SET ${updates.join(', ')} WHERE comp_unit_code = ?`, values);
    return true;
  },

  async deactivateUnit(comp_unit_code) {
    await db.query('UPDATE company_units SET is_active = FALSE WHERE comp_unit_code = ?', [comp_unit_code]);
  },

  async findUnitsByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_units WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  // --- company_departments ---

  async createDepartment({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code, comp_fact_code, comp_unit_code, comp_dept_code }) {
    const [result] = await db.query(
      `INSERT INTO company_departments (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_clus_code, comp_fact_code, comp_unit_code, comp_dept_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, comp_code || null, cust_code || null, comp_clus_code || null, comp_fact_code || null, comp_unit_code || null, comp_dept_code]
    );
    return comp_dept_code;
  },

  async findDepartmentByCode(comp_dept_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_departments WHERE comp_dept_code = ? AND is_active = TRUE',
      [comp_dept_code]
    );
    return rows[0] || null;
  },

  async findDepartmentsByUnit(comp_unit_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_departments WHERE comp_unit_code = ? AND is_active = TRUE ORDER BY name',
      [comp_unit_code]
    );
    return rows;
  },

  async findDepartmentsByCompany(comp_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_departments WHERE comp_code = ? AND is_active = TRUE ORDER BY name',
      [comp_code]
    );
    return rows;
  },

  async findDepartmentByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM company_departments WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateDepartment(comp_dept_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'comp_code', 'comp_unit_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(comp_dept_code);
    await db.query(`UPDATE company_departments SET ${updates.join(', ')} WHERE comp_dept_code = ?`, values);
    return true;
  },

  async deactivateDepartment(comp_dept_code) {
    await db.query('UPDATE company_departments SET is_active = FALSE WHERE comp_dept_code = ?', [comp_dept_code]);
  },

  async findDepartmentsByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_departments WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  // --- company_sections ---

  async createSection({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_dept_code, comp_section_code }) {
    const [result] = await db.query(
      `INSERT INTO company_sections (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, comp_code, cust_code, comp_dept_code, comp_section_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, comp_code || null, cust_code || null, comp_dept_code || null, comp_section_code]
    );
    return comp_section_code;
  },

  async findSectionByCode(comp_section_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_sections WHERE comp_section_code = ? AND is_active = TRUE',
      [comp_section_code]
    );
    return rows[0] || null;
  },

  async findSectionsByDepartment(comp_dept_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_sections WHERE comp_dept_code = ? AND is_active = TRUE ORDER BY name',
      [comp_dept_code]
    );
    return rows;
  },

  async findSectionsByCompany(comp_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_sections WHERE comp_code = ? AND is_active = TRUE ORDER BY name',
      [comp_code]
    );
    return rows;
  },

  async findSectionByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM company_sections WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateSection(comp_section_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'comp_code', 'comp_dept_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(comp_section_code);
    await db.query(`UPDATE company_sections SET ${updates.join(', ')} WHERE comp_section_code = ?`, values);
    return true;
  },

  async deactivateSection(comp_section_code) {
    await db.query('UPDATE company_sections SET is_active = FALSE WHERE comp_section_code = ?', [comp_section_code]);
  },

  async findSectionsByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM company_sections WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  // --- full structure ---

  async getFullStructure(comp_code) {
    const company = await this.findCompanyByCode(comp_code);
    if (!company) return null;

    const clusters     = await this.findClustersByCompany(comp_code);
    const allFactories = await this.findFactoriesByCompany(comp_code);

    const buildFactoryTree = async (factory) => {
      const units = await this.findUnitsByFactory(factory.comp_fact_code);
      const unitsWithDepts = await Promise.all(
        units.map(async (unit) => ({
          ...unit,
          departments: await this.findDepartmentsByUnit(unit.comp_unit_code)
        }))
      );
      return { ...factory, units: unitsWithDepts };
    };

    // Factories directly under company (no cluster)
    const directFactories = await Promise.all(
      allFactories.filter(f => !f.comp_clus_code).map(buildFactoryTree)
    );

    // Clusters with their factories
    const clustersWithFactories = await Promise.all(
      clusters.map(async (cluster) => {
        const clusterFactories = await this.findFactoriesByCluster(cluster.comp_clus_code);
        const factories = await Promise.all(clusterFactories.map(buildFactoryTree));
        return { ...cluster, factories };
      })
    );

    return {
      ...company,
      entity_type: 'Company',
      clusters: clustersWithFactories,
      factories: directFactories
    };
  }
};

module.exports = CompanyModel;
