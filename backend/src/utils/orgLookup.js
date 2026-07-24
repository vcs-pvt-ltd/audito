/**
 * Organization name lookup.
 *
 * Each entity type lives in its own table. Given an entity_type + entity_code,
 * resolves the organization's display name for invoices / billing records.
 */

const { db } = require('../config/db');

const COUNTRIES_API_URL = 'https://general.apivcm.shop/api/countries';
let dialingCodeLookupPromise = null;

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

async function getOrgDetails(entityType, entityCode) {
  const cfg = ENTITY_TABLE[entityType];
  if (!cfg || !entityCode) return null;
  const [table, field] = cfg;
  try {
    const [rows] = await db.query(
      `SELECT name, email, phone_number, address_line_1, address_line_2, address_line_3, country
         FROM \`${table}\`
        WHERE \`${field}\` = ?
        LIMIT 1`,
      [entityCode]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      name: row.name || null,
      email: row.email || null,
      phoneNumber: row.phone_number || null,
      country: row.country || null,
      address: [row.address_line_1, row.address_line_2, row.address_line_3, row.country]
        .filter(Boolean)
        .join(', ') || null,
    };
  } catch {
    return null;
  }
}

async function getCountryDialingCode(country) {
  if (!country) return null;

  if (!dialingCodeLookupPromise) {
    dialingCodeLookupPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const countries = [];
        let offset = 0;
        let total = Infinity;
        while (offset < total) {
          const response = await fetch(`${COUNTRIES_API_URL}?limit=100&offset=${offset}`, {
            signal: controller.signal,
          });
          const payload = await response.json();
          const page = Array.isArray(payload?.data) ? payload.data : [];
          if (!page.length) break;
          countries.push(...page);
          total = payload?.pagination?.total ?? page.length;
          offset += page.length;
        }
        return new Map(countries.map((item) => [
          String(item.country || '').trim().toLocaleLowerCase(),
          item.international_dialing || null,
        ]));
      } catch {
        return new Map();
      } finally {
        clearTimeout(timeout);
      }
    })();
  }

  const dialingCodes = await dialingCodeLookupPromise;
  return dialingCodes.get(String(country).trim().toLocaleLowerCase()) || null;
}

module.exports = { getOrgName, getOrgDetails, getCountryDialingCode, ENTITY_TABLE };
