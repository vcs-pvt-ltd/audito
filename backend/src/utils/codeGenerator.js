/**
 * Code Generator Utility
 *
 * Generates unique sequential codes for each entity table.
 *
 * Customer:         CUST-00001    (customers)
 * Buying Office:    CBO-00001     (customer_buying_offices)
 * Supplier:         SUP-00001     (customer_suppliers)
 * Company:          COMP-00001    (companies)
 * Cluster:          CC-00001      (company_clusters)
 * Company Factory:  COMPF-00001   (company_factories)
 * Unit:             CU-00001      (company_units)
 * Department:       CD-00001      (company_departments)
 * Audit Firm:       AFC-00001     (audit_firm_companies)
 * Branch:           AFCB-00001    (audit_firm_company_branches)
 * Link:             LINK-00001    (organization_links)
 * Admin User:       USR-00000001  (admins)
 */

const { db } = require('../config/db');

/**
 * Generic code generator: queries a specific table/field to get the next sequential number.
 */
const generateCode = async (table, codeField, prefix, padLen = 5) => {
  const [rows] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(\`${codeField}\`, ${prefix.length + 2}) AS UNSIGNED)) AS max_num FROM \`${table}\``
  );
  const next = (rows[0].max_num || 0) + 1;
  return `${prefix}-${String(next).padStart(padLen, '0')}`;
};

// --- Entity code generators ---

const generateCustCode = () => generateCode('customers', 'cust_code', 'CUST');
const generateCboCode = () => generateCode('customer_buying_offices', 'cbo_code', 'CBO');
const generateSupplierCode = () => generateCode('customer_suppliers', 'csup_code', 'SUP');
const generateCompCode = () => generateCode('companies', 'comp_code', 'COMP');
const generateCompClusCode = () => generateCode('company_clusters', 'comp_clus_code', 'CC');
const generateCompFactCode = () => generateCode('company_factories', 'comp_fact_code', 'COMPF');
const generateCompUnitCode = () => generateCode('company_units', 'comp_unit_code', 'CU');
const generateCompDeptCode = () => generateCode('company_departments', 'comp_dept_code', 'CD');
const generateCompSectionCode = () => generateCode('company_sections', 'comp_section_code', 'CS');
const generateAfcCode = () => generateCode('audit_firm_companies', 'afc_code', 'AFC');
const generateAfcBranchCode = () => generateCode('audit_firm_company_branches', 'afc_branch_code', 'AFCB');
const generateAfcDeptCode = () => generateCode('audit_firm_company_departments', 'afc_dept_code', 'AFCD');
const generateLinkCode = () => generateCode('organization_links', 'link_code', 'LINK');

// --- Admin user code generator ---

const generateAdminUserCode = async () => {
  const [rows] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(user_id, 5) AS UNSIGNED)) AS max_num FROM admins WHERE user_id LIKE 'USR-%'"
  );
  const next = (rows[0].max_num || 0) + 1;
  return `USR-${String(next).padStart(8, '0')}`;
};

module.exports = {
  generateCustCode,
  generateCboCode,
  generateSupplierCode,
  generateCompCode,
  generateCompClusCode,
  generateCompFactCode,
  generateCompUnitCode,
  generateCompDeptCode,
  generateCompSectionCode,
  generateAfcCode,
  generateAfcBranchCode,
  generateAfcDeptCode,
  generateLinkCode,
  generateAdminUserCode
};
