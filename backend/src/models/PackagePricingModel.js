const { db } = require('../config/db');

const RULES = Object.freeze({
  pricing_version: 3,
  free_company_levels: 3,
  free_departments: 5,
  company_level_price: 50,
  company_level_charges: Object.freeze({ 3: 0, 4: 100, 5: 150 }),
  department_price: 10,
  // 1 audit line = 1 token; a package includes at least this many line tokens.
  min_audit_lines: 100,
});

function validateUnitPrice(value) {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || Math.abs(Number(value) * 100 - cents) > 1e-8 || 1000 % cents !== 0) {
    throw new Error('Token price must be at least $0.01, use whole cents, and divide $10 into whole tokens.');
  }
  return cents;
}

// Departments 1–5 are free; with 6 or more, every department is charged.
const departmentChargeCents = departments => (departments <= RULES.free_departments ? 0 : departments * RULES.department_price * 100);

/**
 * Price of raising a workspace's departments from `fromDepartments` to
 * `toDepartments`: the difference in the department charge. Like a package's
 * capacity charges, the amount is also granted as tokens.
 */
function quoteDepartmentUpgrade(fromDepartments, toDepartments, unitPrice) {
  const from = Number(fromDepartments), to = Number(toDepartments);
  if (![from, to].every(Number.isSafeInteger) || from < 0 || to > 10000) throw new Error('Enter a whole number of departments up to 10,000.');
  if (to <= from) throw new Error(`Choose more than your current ${from} departments.`);
  const tokenCents = validateUnitPrice(unitPrice);
  const chargeCents = departmentChargeCents(to) - departmentChargeCents(from);
  const tokens = chargeCents / tokenCents;
  if (!Number.isSafeInteger(tokens)) throw new Error('Token price cannot convert the department charge into whole tokens.');
  return {
    purchase_type: 'department_upgrade', pricing_version: RULES.pricing_version,
    from_departments: from, departments: to,
    previous_department_charge: departmentChargeCents(from) / 100, department_charge: departmentChargeCents(to) / 100,
    token_unit_price: tokenCents / 100, total_tokens: tokens, total_price: chargeCents / 100,
    free_departments: RULES.free_departments, department_price: RULES.department_price,
  };
}

function quote(selection, unitPrice) {
  const levels = Number(selection?.company_levels);
  const departments = Number(selection?.departments);
  const lines = Number(selection?.lines_per_audit);
  if (![levels, departments, lines].every(Number.isSafeInteger) || levels < RULES.free_company_levels || departments < 1 || lines < 1 || levels > 5 || departments > 10000 || lines > 1000000) {
    throw new Error('Enter valid whole-number company levels, departments, and audit lines.');
  }
  if (lines < RULES.min_audit_lines) {
    throw new Error(`A package needs at least ${RULES.min_audit_lines} audit lines (${RULES.min_audit_lines} tokens).`);
  }
  const tokenCents = validateUnitPrice(unitPrice);
  const levelCents = RULES.company_level_charges[levels] * 100;
  const departmentCents = departmentChargeCents(departments);
  const lineCents = lines * tokenCents;
  const additionalTokens = (levelCents + departmentCents) / tokenCents;
  if (!Number.isSafeInteger(additionalTokens)) throw new Error('Token price cannot convert capacity charges into whole tokens.');
  return {
    company_levels: levels, departments, lines_per_audit: lines,
    token_unit_price: tokenCents / 100,
    company_level_charge: levelCents / 100,
    department_charge: departmentCents / 100,
    line_tokens: lines, line_charge: lineCents / 100,
    additional_tokens: additionalTokens,
    total_tokens: lines + additionalTokens,
    total_price: (levelCents + departmentCents + lineCents) / 100,
    ...RULES,
  };
}

const PackagePricingModel = {
  RULES,
  quote,
  quoteDepartmentUpgrade,
  validateUnitPrice,
  async get(executor = db) {
    const [rows] = await executor.query('SELECT token_unit_price, updated_at FROM package_pricing_settings WHERE id = 1');
    if (!rows.length) throw new Error('Package pricing has not been configured.');
    return { ...RULES, token_unit_price: Number(rows[0].token_unit_price), updated_at: rows[0].updated_at };
  },
  async update(unitPrice) {
    const cents = validateUnitPrice(unitPrice);
    await db.query('UPDATE package_pricing_settings SET token_unit_price = ? WHERE id = 1', [cents / 100]);
    return this.get();
  },
};

module.exports = PackagePricingModel;
