// Pure package pricing for the Company workspace. Keep this file free of imports
// so `node --test` can run its tests without the Next.js toolchain.

/**
 * How departments above the free allowance are charged.
 * - "extras_only": only departments above the free allowance are charged.
 * - "all_after_5": once you pass the free allowance, every department is charged.
 */
export type DepartmentRule = "extras_only" | "all_after_5";

/**
 * The rule the backend charges today (PackagePricingModel.departmentChargeCents).
 * Change both together, or the price shown here will not match the price charged.
 */
export const DEPARTMENT_RULE: DepartmentRule = "extras_only";

/** Must match PackagePricingModel.RULES.pricing_version; registration is refused on a mismatch. */
export const PRICING_VERSION = 4;

export const MIN_LINES = 100;

export interface PricingConfig {
  clusterFee: number;
  companyFee: number;
  deptRate: number;
  creditPrice: number;
  freeDepartments: number;
  departmentRule: DepartmentRule;
  /** Questions included free with the free levels (Essentials, levels 1–3). */
  freeLines: number;
}

export interface PackageInput {
  /** Highest company level in the package: 3 (Essentials), 4 (Group) or 5 (Enterprise). */
  levels: number;
  departments: number;
  lines: number;
}

export interface PackageQuote {
  levels: number;
  departments: number;
  lines: number;
  levelFee: number;
  /** Questions included free (Essentials only). */
  freeLines: number;
  paidDepartments: number;
  deptFee: number;
  questionsCost: number;
  total: number;
  bonusCredits: number;
  credits: number;
}

// Work in cents so 0.1-dollar credit prices do not drift.
const cents = (amount: number) => Math.round(amount * 100);

export function levelFeeFor(levels: number, config: Pick<PricingConfig, "clusterFee" | "companyFee">) {
  if (levels >= 5) return config.companyFee;
  if (levels === 4) return config.clusterFee;
  return 0;
}

export function paidDepartmentCount(departments: number, freeDepartments: number, rule: DepartmentRule) {
  if (departments <= freeDepartments) return 0;
  return rule === "extras_only" ? departments - freeDepartments : departments;
}

export function calculatePackage(input: PackageInput, config: PricingConfig): PackageQuote {
  const levels = Math.min(5, Math.max(3, Math.round(input.levels)));
  const departments = Math.max(1, Math.round(input.departments));
  const lines = Math.max(MIN_LINES, Math.round(input.lines));
  const paidDepartments = paidDepartmentCount(departments, config.freeDepartments, config.departmentRule);

  const levelCents = cents(levelFeeFor(levels, config));
  const deptCents = paidDepartments * cents(config.deptRate);
  const creditCents = cents(config.creditPrice);
  const freeLines = levels <= 3 ? Math.min(lines, config.freeLines) : 0;
  const questionsCents = (lines - freeLines) * creditCents;
  // Level and department charges are also granted as credits ("charges converted into tokens").
  const bonusCredits = creditCents > 0 ? Math.floor((levelCents + deptCents) / creditCents) : 0;

  return {
    levels, departments, lines, freeLines, paidDepartments,
    levelFee: levelCents / 100,
    deptFee: deptCents / 100,
    questionsCost: questionsCents / 100,
    total: (levelCents + deptCents + questionsCents) / 100,
    bonusCredits,
    credits: lines + bonusCredits,
  };
}
