import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePackage, type PricingConfig } from "./calculatePackage.ts";

const config: PricingConfig = { clusterFee: 50, companyFee: 100, deptRate: 10, creditPrice: 0.1, freeDepartments: 5, departmentRule: "extras_only", freeLines: 100 };
const allAfter5: PricingConfig = { ...config, departmentRule: "all_after_5" };

test("levels 1–3 have no level fee and include 100 free questions", () => {
  const quote = calculatePackage({ levels: 3, departments: 5, lines: 100 }, config);
  assert.equal(quote.levelFee, 0);
  assert.equal(quote.freeLines, 100);
  assert.equal(quote.questionsCost, 0);
  assert.equal(quote.total, 0);
  assert.equal(quote.credits, 100);
});

test("Essentials charges only questions above the free 100", () => {
  const quote = calculatePackage({ levels: 3, departments: 5, lines: 250 }, config);
  assert.equal(quote.questionsCost, 15);
  assert.equal(quote.total, 15);
  assert.equal(quote.credits, 250);
});

test("level 4 adds the cluster fee and charges every question", () => {
  const quote = calculatePackage({ levels: 4, departments: 5, lines: 100 }, config);
  assert.equal(quote.levelFee, 50);
  assert.equal(quote.freeLines, 0);
  assert.equal(quote.questionsCost, 10);
  assert.equal(quote.total, 60);
});

test("level 5 adds the company fee and charges every question", () => {
  const quote = calculatePackage({ levels: 5, departments: 5, lines: 100 }, config);
  assert.equal(quote.levelFee, 100);
  assert.equal(quote.total, 110);
});

test("5 departments are free under both rules", () => {
  for (const rule of [config, allAfter5]) {
    const quote = calculatePackage({ levels: 3, departments: 5, lines: 100 }, rule);
    assert.equal(quote.paidDepartments, 0);
    assert.equal(quote.deptFee, 0);
  }
});

test("extras_only charges only departments above 5", () => {
  const six = calculatePackage({ levels: 3, departments: 6, lines: 100 }, config);
  assert.equal(six.paidDepartments, 1);
  assert.equal(six.deptFee, 10);
  const seven = calculatePackage({ levels: 3, departments: 7, lines: 100 }, config);
  assert.equal(seven.deptFee, 20);
  assert.equal(seven.total, 20);
});

test("all_after_5 charges every department once you pass 5", () => {
  const six = calculatePackage({ levels: 3, departments: 6, lines: 100 }, allAfter5);
  assert.equal(six.paidDepartments, 6);
  assert.equal(six.deptFee, 60);
  const seven = calculatePackage({ levels: 3, departments: 7, lines: 100 }, allAfter5);
  assert.equal(seven.deptFee, 70);
});

test("audit questions have a minimum of 100 lines", () => {
  const quote = calculatePackage({ levels: 4, departments: 5, lines: 40 }, config);
  assert.equal(quote.lines, 100);
  assert.equal(quote.questionsCost, 10);
  assert.equal(quote.credits, 600);
});

test("questions cost lines × credit price without float drift", () => {
  const quote = calculatePackage({ levels: 4, departments: 5, lines: 2550 }, config);
  assert.equal(quote.questionsCost, 255);
});

test("level and department fees become bonus credits", () => {
  const quote = calculatePackage({ levels: 5, departments: 7, lines: 250 }, config);
  // $100 company + 2 × $10 departments = $120 → 1,200 credits at $0.10.
  assert.equal(quote.bonusCredits, 1200);
  assert.equal(quote.credits, 1450);
  assert.equal(quote.total, 145);
});

test("no bonus credits when nothing is charged beyond questions", () => {
  const quote = calculatePackage({ levels: 3, departments: 3, lines: 500 }, config);
  assert.equal(quote.bonusCredits, 0);
  assert.equal(quote.credits, 500);
});
