/**
 * Customer Model
 * Handles: customers, customer_buying_offices
 *
 * Hierarchy:
 *   Customer (L8) -> Buying Office (L7)
 *
 * All entities register independently. Parent codes are filled
 * when an organization link is accepted.
 */

const { db } = require('../config/db');

const CustomerModel = {

  // --- customers ---

  async createCustomer({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, cust_code }) {
    const [result] = await db.query(
      `INSERT INTO customers (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, cust_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, cust_code]
    );
    return cust_code;
  },

  async findCustomerByCode(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM customers WHERE cust_code = ? AND is_active = TRUE',
      [cust_code]
    );
    return rows[0] || null;
  },

  async findCustomerByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM customers WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateCustomer(cust_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(cust_code);
    await db.query(`UPDATE customers SET ${updates.join(', ')} WHERE cust_code = ?`, values);
    return true;
  },

  // --- customer_buying_offices ---

  async createBuyingOffice({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, cust_code, cbo_code }) {
    const [result] = await db.query(
      `INSERT INTO customer_buying_offices (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, cust_code, cbo_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, cust_code || null, cbo_code]
    );
    return cbo_code;
  },

  async findBuyingOfficeByCode(cbo_code) {
    const [rows] = await db.query(
      'SELECT * FROM customer_buying_offices WHERE cbo_code = ? AND is_active = TRUE',
      [cbo_code]
    );
    return rows[0] || null;
  },

  async findBuyingOfficesByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM customer_buying_offices WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  async findBuyingOfficeByRegNumber(registration_number) {
    const [rows] = await db.query(
      'SELECT * FROM customer_buying_offices WHERE registration_number = ?',
      [registration_number]
    );
    return rows[0] || null;
  },

  async updateBuyingOffice(cbo_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'cust_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(cbo_code);
    await db.query(`UPDATE customer_buying_offices SET ${updates.join(', ')} WHERE cbo_code = ?`, values);
    return true;
  },

  async deactivateBuyingOffice(cbo_code) {
    await db.query('UPDATE customer_buying_offices SET is_active = FALSE WHERE cbo_code = ?', [cbo_code]);
  },

  // --- customer_suppliers ---

  async createSupplier({ name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, cust_code, csup_code }) {
    const [result] = await db.query(
      `INSERT INTO customer_suppliers (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, cust_code, csup_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, cust_code || null, csup_code]
    );
    return csup_code;
  },

  async findSupplierByCode(csup_code) {
    const [rows] = await db.query(
      'SELECT * FROM customer_suppliers WHERE csup_code = ? AND is_active = TRUE',
      [csup_code]
    );
    return rows[0] || null;
  },

  async findSuppliersByCustomer(cust_code) {
    const [rows] = await db.query(
      'SELECT * FROM customer_suppliers WHERE cust_code = ? AND is_active = TRUE ORDER BY name',
      [cust_code]
    );
    return rows;
  },

  async updateSupplier(csup_code, fields) {
    const allowed = ['name', 'registration_number', 'email', 'address_line_1', 'address_line_2', 'address_line_3', 'country', 'phone_number', 'cust_code', 'is_active'];
    const updates = [], values = [];
    for (const [k, v] of Object.entries(fields)) {
      if (allowed.includes(k)) { updates.push(`${k} = ?`); values.push(v); }
    }
    if (!updates.length) return false;
    values.push(csup_code);
    await db.query(`UPDATE customer_suppliers SET ${updates.join(', ')} WHERE csup_code = ?`, values);
    return true;
  },

  async deactivateSupplier(csup_code) {
    await db.query('UPDATE customer_suppliers SET is_active = FALSE WHERE csup_code = ?', [csup_code]);
  },

  // --- full structure ---

  async getFullStructure(cust_code) {
    const customer = await this.findCustomerByCode(cust_code);
    if (!customer) return null;
    const buyingOffices = await this.findBuyingOfficesByCustomer(cust_code);
    return {
      ...customer,
      entity_type: 'Customer',
      buying_offices: buyingOffices
    };
  }
};

module.exports = CustomerModel;
