/**
 * Organization name lookup.
 *
 * Each entity type lives in its own table. Given an entity_type + entity_code,
 * resolves the organization's display name for invoices / billing records.
 */

const { db } = require('../config/db');

// entity_type -> [table, codeField]
const ENTITY_TABLE = {
  'Customer': ['customers', 'cust_code'],
  'Buying Office': ['customer_buying_offices', 'cbo_code'],
  'Supplier': ['customer_suppliers', 'csup_code'],
  'Company': ['companies', 'comp_code'],
  'Cluster': ['company_clusters', 'comp_clus_code'],
  'Factory': ['company_factories', 'comp_fact_code'],
  'Unit': ['company_units', 'comp_unit_code'],
  'Department': ['company_departments', 'comp_dept_code'],
  'Section': ['company_sections', 'comp_section_code'],
  'Audit Firm Company': ['audit_firm_companies', 'afc_code'],
  'Branch': ['audit_firm_company_branches', 'afc_branch_code'],
  'Audit Firm Department': ['audit_firm_company_departments', 'afc_dept_code'],
};

async function getOrgName(entityType, entityCode) {
  const cfg = ENTITY_TABLE[entityType];
  if (!cfg || !entityCode) return null;
  const [table, field] = cfg;
  try {
    const [rows] = await db.query(`SELECT name FROM \`${table}\` WHERE \`${field}\` = ? LIMIT 1`, [entityCode]);
    return rows[0]?.name || null;
  } catch {
    return null;
  }
}

module.exports = { getOrgName, ENTITY_TABLE };
