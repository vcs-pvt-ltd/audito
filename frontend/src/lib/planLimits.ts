export type StandardPlanName = "Basic" | "Pro" | "Elite";

/**
 * Maximum Company hierarchy depth included in each standard plan.
 * The root Company counts as level 1.
 */
export const PLAN_COMPANY_LEVEL_LIMITS: Record<StandardPlanName, number> = {
  Basic: 1,
  Pro: 2,
  Elite: 6,
};

export function getCompanyLevelLimit(planName: string, customLimit = 6): number {
  if (planName === "Custom") return Math.max(1, customLimit);
  return PLAN_COMPANY_LEVEL_LIMITS[planName as StandardPlanName] ?? PLAN_COMPANY_LEVEL_LIMITS.Basic;
}

