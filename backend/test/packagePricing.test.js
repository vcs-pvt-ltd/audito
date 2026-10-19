// Pure pricing math in PackagePricingModel (no database: only quote,
// quoteDepartmentUpgrade and validateUnitPrice are exercised).
const test = require('node:test');
const assert = require('node:assert/strict');
const { RULES, quote, quoteDepartmentUpgrade, validateUnitPrice } = require('../src/models/PackagePricingModel');

test('rules are frozen at pricing version 3', () => {
  assert.equal(RULES.pricing_version, 3);
  assert.ok(Object.isFrozen(RULES));
  assert.ok(Object.isFrozen(RULES.company_level_charges));
});

test('validateUnitPrice returns whole cents that divide $10', () => {
  assert.equal(validateUnitPrice(0.1), 10);
  assert.equal(validateUnitPrice('0.25'), 25);
  assert.equal(validateUnitPrice(0.01), 1);
  assert.equal(validateUnitPrice(10), 1000);
});

test('validateUnitPrice rejects zero, fractions of a cent and prices that do not divide $10', () => {
  for (const value of [0, -0.1, 0.005, 0.123, 0.03, 20, 'abc', null, undefined]) {
    assert.throws(() => validateUnitPrice(value), /Token price/, `expected ${value} to be rejected`);
  }
});

test('base package: 3 levels and up to 5 departments are free, lines cost one token each', () => {
  const q = quote({ company_levels: 3, departments: 5, lines_per_audit: 100 }, 0.1);
  assert.equal(q.company_level_charge, 0);
  assert.equal(q.department_charge, 0);
  assert.equal(q.line_tokens, 100);
  assert.equal(q.line_charge, 10);
  assert.equal(q.additional_tokens, 0);
  assert.equal(q.total_tokens, 100);
  assert.equal(q.total_price, 10);
  assert.equal(q.pricing_version, 3);
});

test('6 or more departments charges every department, and capacity charges become tokens', () => {
  const q = quote({ company_levels: 4, departments: 6, lines_per_audit: 100 }, 0.1);
  assert.equal(q.company_level_charge, 100);
  assert.equal(q.department_charge, 60);
  assert.equal(q.line_charge, 10);
  assert.equal(q.additional_tokens, 1600);
  assert.equal(q.total_tokens, 1700);
  assert.equal(q.total_price, 170);
});

test('5 levels at a $0.25 token price', () => {
  const q = quote({ company_levels: 5, departments: 10, lines_per_audit: 250 }, 0.25);
  assert.equal(q.company_level_charge, 150);
  assert.equal(q.department_charge, 100);
  assert.equal(q.line_charge, 62.5);
  assert.equal(q.additional_tokens, 1000);
  assert.equal(q.total_tokens, 1250);
  assert.equal(q.total_price, 312.5);
});

test('numeric strings are accepted as selections', () => {
  const q = quote({ company_levels: '3', departments: '1', lines_per_audit: '100' }, '0.1');
  assert.equal(q.total_tokens, 100);
});

test('quote rejects invalid selections', () => {
  const invalid = [
    undefined,
    {},
    { company_levels: 2, departments: 1, lines_per_audit: 100 },
    { company_levels: 6, departments: 1, lines_per_audit: 100 },
    { company_levels: 3, departments: 0, lines_per_audit: 100 },
    { company_levels: 3, departments: 10001, lines_per_audit: 100 },
    { company_levels: 3.5, departments: 1, lines_per_audit: 100 },
    { company_levels: 3, departments: 1, lines_per_audit: 0 },
    { company_levels: 3, departments: 1, lines_per_audit: 1000001 },
  ];
  for (const selection of invalid) {
    assert.throws(() => quote(selection, 0.1), /valid whole-number/, JSON.stringify(selection));
  }
});

test('quote requires the minimum audit lines', () => {
  assert.throws(
    () => quote({ company_levels: 3, departments: 1, lines_per_audit: RULES.min_audit_lines - 1 }, 0.1),
    /at least 100 audit lines/,
  );
});

test('quote rejects a bad token price', () => {
  assert.throws(() => quote({ company_levels: 3, departments: 1, lines_per_audit: 100 }, 0.03), /Token price/);
});

test('department upgrade from free tier charges every department', () => {
  const q = quoteDepartmentUpgrade(5, 6, 0.1);
  assert.equal(q.purchase_type, 'department_upgrade');
  assert.equal(q.previous_department_charge, 0);
  assert.equal(q.department_charge, 60);
  assert.equal(q.total_price, 60);
  assert.equal(q.total_tokens, 600);
});

test('department upgrade above the free tier charges only the difference', () => {
  const q = quoteDepartmentUpgrade(6, 8, 0.1);
  assert.equal(q.previous_department_charge, 60);
  assert.equal(q.department_charge, 80);
  assert.equal(q.total_price, 20);
  assert.equal(q.total_tokens, 200);
});

test('department upgrade within the free tier is free', () => {
  const q = quoteDepartmentUpgrade(1, 5, 0.1);
  assert.equal(q.total_price, 0);
  assert.equal(q.total_tokens, 0);
});

test('department upgrade rejects invalid ranges', () => {
  assert.throws(() => quoteDepartmentUpgrade(5, 5, 0.1), /Choose more than your current 5/);
  assert.throws(() => quoteDepartmentUpgrade(8, 6, 0.1), /Choose more/);
  assert.throws(() => quoteDepartmentUpgrade(-1, 6, 0.1), /whole number of departments/);
  assert.throws(() => quoteDepartmentUpgrade(1.5, 6, 0.1), /whole number of departments/);
  assert.throws(() => quoteDepartmentUpgrade(5, 10001, 0.1), /whole number of departments/);
  assert.throws(() => quoteDepartmentUpgrade(5, 6, 0.03), /Token price/);
});
