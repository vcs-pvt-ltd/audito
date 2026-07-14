const { db } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');

const ENTITY_CONFIG = {
  'Customer': { table: 'customers', codeField: 'cust_code' },
  'Buying Office': { table: 'customer_buying_offices', codeField: 'cbo_code' },
  'Supplier': { table: 'customer_suppliers', codeField: 'csup_code' },
  'Company': { table: 'companies', codeField: 'comp_code' },
  'Cluster': { table: 'company_clusters', codeField: 'comp_clus_code' },
  'Factory': { table: 'company_factories', codeField: 'comp_fact_code' },
  'Unit': { table: 'company_units', codeField: 'comp_unit_code' },
  'Department': { table: 'company_departments', codeField: 'comp_dept_code' },
  'Section': { table: 'company_sections', codeField: 'comp_section_code' },
  'Audit Firm Company': { table: 'audit_firm_companies', codeField: 'afc_code' },
  'Branch': { table: 'audit_firm_company_branches', codeField: 'afc_branch_code' },
  'Audit Firm Department': { table: 'audit_firm_company_departments', codeField: 'afc_dept_code' }
};

exports.getTimezone = async (req, res) => {
  try {
    const { role, entityType, entityCode, assignedEntityType, assignedEntityCode } = req.user;

    // We get the timezone for the entity the user is currently representing.
    let eType = entityType || assignedEntityType;
    let eCode = entityCode || assignedEntityCode;

    // Special case for 'Audit Firm' admin role missing 'Company' appended to Entity Type in req.user
    if (eType === 'Audit Firm') {
      eType = 'Audit Firm Company';
    }

    if (!eType || !eCode) {
      return errorResponse(res, 'User is not associated with any specific entity.', 400);
    }

    const config = ENTITY_CONFIG[eType];
    if (!config) {
      return errorResponse(res, 'Unknown entity type', 400);
    }

    const [rows] = await db.query(`SELECT timezone FROM ${config.table} WHERE ${config.codeField} = ?`, [eCode]);

    if (rows.length === 0) {
      return successResponse(res, { timezone: null });
    }

    return successResponse(res, { timezone: rows[0].timezone });
  } catch (error) {
    console.error('Error fetching timezone:', error);
    return errorResponse(res, 'Server error', 500);
  }
};

exports.setTimezone = async (req, res) => {
  try {
    const { timezone } = req.body;
    let { role, entityType, entityCode } = req.user;

    // Only admins should ideally update the organization timezone
    if (role !== 'admin') {
      return errorResponse(res, 'Only admins can update timezone settings.', 403);
    }

    if (!timezone) {
      return errorResponse(res, 'Timezone is required.', 400);
    }

    if (entityType === 'Audit Firm') {
      entityType = 'Audit Firm Company';
    }

    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      return errorResponse(res, 'Unknown entity type', 400);
    }

    await db.query(`UPDATE ${config.table} SET timezone = ? WHERE ${config.codeField} = ?`, [timezone, entityCode]);

    return successResponse(res, { timezone }, 'Timezone updated successfully');
  } catch (error) {
    console.error('Error updating timezone:', error);
    return errorResponse(res, 'Server error', 500);
  }
};
