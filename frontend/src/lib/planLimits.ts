export type StandardPlanName = "Basic" | "Pro" | "Elite";

/**
 * Maximum Company hierarchy depth included in each standard plan.
 * The root Company counts as level 1.
 */
export const PLAN_COMPANY_LEVEL_LIMITS: Record<StandardPlanName, number> = {
  Basic: 1,
  Pro: 2,
  Elite: 5,
};

/** Custom workspaces build on Elite. These are the lowest configurable capacities. */
export const CUSTOM_PLAN_MINIMUM_LIMITS = {
  max_company_levels: PLAN_COMPANY_LEVEL_LIMITS.Elite,
  max_departments: 16,
  max_audits: 14,
  max_checklists: 25,
  max_auditors: 15,
} as const;

/** Entity types that can start a standard-plan workspace. Customer and Audit
 * Firm workspaces require a tailored Custom plan; Company entry points depend
 * on the selected standard plan. */
export const PLAN_REGISTRATION_ENTITY_ACCESS: Record<StandardPlanName, Record<string, string[]>> = {
  Basic: {
    Customer: [],
    Company: ["Factory", "Unit", "Department"],
    "Audit Firm": [],
  },
  Pro: {
    Customer: [],
    Company: ["Cluster", "Factory", "Unit", "Department"],
    "Audit Firm": [],
  },
  Elite: {
    Customer: [],
    Company: ["Company", "Cluster", "Factory", "Unit", "Department"],
    "Audit Firm": [],
  },
};

export function canRegisterEntityType(planName: string, accountType: string, entityType: string): boolean {
  if (planName === "Custom") return true;
  const normalizedPlan = planName === "Free" ? "Basic" : planName;
  return (PLAN_REGISTRATION_ENTITY_ACCESS[normalizedPlan as StandardPlanName] || PLAN_REGISTRATION_ENTITY_ACCESS.Elite)?.[accountType]?.includes(entityType) ?? false;
}

export function getCompanyLevelLimit(planName: string, customLimit = 5): number {
  if (planName === "Custom") return Math.max(1, customLimit);
  return PLAN_COMPANY_LEVEL_LIMITS[planName as StandardPlanName] ?? PLAN_COMPANY_LEVEL_LIMITS.Basic;
}
