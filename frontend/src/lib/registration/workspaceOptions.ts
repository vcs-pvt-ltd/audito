import type { AllEntityType, PackagePricing } from "@/lib/api";
import { DEPARTMENT_RULE, MIN_LINES, type PricingConfig } from "@/lib/pricing/calculatePackage";

export type AccountTypeKey = "customer" | "company" | "audit_firm";
/** Account type names used by the registration and contact-review APIs. */
export type AccountGroup = "Customer" | "Company" | "Audit Firm";

export const ACCOUNT_TYPES: { key: AccountTypeKey; group: AccountGroup; label: string; description: string; badge: string }[] = [
  { key: "customer", group: "Customer", label: "Customers", description: "Buyers, buying offices, suppliers", badge: "Team review" },
  { key: "company", group: "Company", label: "Company", description: "Your own sites and departments", badge: "Buy online" },
  { key: "audit_firm", group: "Audit Firm", label: "Audit Firms", description: "Firms, branches, specialist teams", badge: "Team review" },
];

export interface LadderLevel { level: number; label: string; entityType: AllEntityType }

/** Starting levels for team-reviewed workspaces, highest first. */
export const LADDERS: Record<Exclude<AccountTypeKey, "company">, LadderLevel[]> = {
  customer: [
    { level: 7, label: "Customer", entityType: "Customer" },
    { level: 6, label: "Buying Office", entityType: "Buying Office" },
    { level: 5, label: "Supplier", entityType: "Supplier" },
  ],
  audit_firm: [
    { level: 5, label: "Company", entityType: "Audit Firm Company" },
    { level: 4, label: "Branch", entityType: "Branch" },
    { level: 3, label: "Department", entityType: "Audit Firm Department" },
  ],
};

export const COMPANY_LEVEL_NAMES = ["Department", "Unit", "Factory", "Cluster", "Company"] as const;

export const PACKAGES: { levels: 3 | 4 | 5; name: string; tagline: string; entityType: AllEntityType }[] = [
  { levels: 3, name: "Essentials", tagline: "Single site", entityType: "Factory" },
  { levels: 4, name: "Group", tagline: "Factories in clusters", entityType: "Cluster" },
  { levels: 5, name: "Enterprise", tagline: "Whole company", entityType: "Company" },
];

export const DEPARTMENT_LIMITS = { min: 1, max: 200 };
export const QUESTION_LIMITS = { min: MIN_LINES, max: 5000, step: 50 };
export const QUESTION_PRESETS = [100, 250, 500, 1000, 2500];

export const packageFor = (levels: number) => PACKAGES.find((item) => item.levels === levels) ?? PACKAGES[0];
export const groupFor = (key: AccountTypeKey) => ACCOUNT_TYPES.find((item) => item.key === key)!.group;

/** Accepts "company", "Company", "Audit Firm", "audit-firm"… */
export function parseAccountType(value: string | null): AccountTypeKey | null {
  const key = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return key === "customer" || key === "company" || key === "audit_firm" ? key : null;
}

export function parseIntIn(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.min(max, Math.max(min, number)) : null;
}

export function toPricingConfig(pricing: PackagePricing): PricingConfig {
  return {
    clusterFee: pricing.company_level_charges[4] ?? 0,
    companyFee: pricing.company_level_charges[5] ?? 0,
    deptRate: pricing.department_price,
    creditPrice: pricing.token_unit_price,
    freeDepartments: pricing.free_departments,
    departmentRule: DEPARTMENT_RULE,
    freeLines: pricing.free_line_tokens ?? 0,
  };
}

export const formatMoney = (amount: number) =>
  `$${amount.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
