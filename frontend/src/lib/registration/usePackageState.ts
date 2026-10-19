"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { packagePricingApi } from "@/lib/api";
import { PRICING_VERSION, type PricingConfig } from "@/lib/pricing/calculatePackage";
import {
  DEPARTMENT_LIMITS, LADDERS, QUESTION_LIMITS, parseAccountType, parseIntIn, toPricingConfig, type AccountTypeKey,
} from "./workspaceOptions";

type ReviewedType = Exclude<AccountTypeKey, "company">;

export interface PackageState {
  accountType: AccountTypeKey;
  levels: 3 | 4 | 5;
  departments: number;
  lines: number;
  /** Starting level per team-reviewed account type, kept when switching between types. */
  startingLevels: Record<ReviewedType, number>;
}

const DEFAULT_STARTING_LEVELS: Record<ReviewedType, number> = { customer: LADDERS.customer[0].level, audit_firm: LADDERS.audit_firm[0].level };

function readState(search: URLSearchParams): PackageState {
  const accountType = parseAccountType(search.get("account_type")) ?? "company";
  const startingLevels = { ...DEFAULT_STARTING_LEVELS };
  const startingLevel = parseIntIn(search.get("starting_level"), 1, 7);
  if (accountType !== "company" && LADDERS[accountType].some((item) => item.level === startingLevel)) startingLevels[accountType] = startingLevel!;
  return {
    accountType,
    levels: (parseIntIn(search.get("company_levels"), 3, 5) ?? 3) as 3 | 4 | 5,
    departments: parseIntIn(search.get("departments"), DEPARTMENT_LIMITS.min, DEPARTMENT_LIMITS.max) ?? 5,
    lines: parseIntIn(search.get("lines_per_audit"), QUESTION_LIMITS.min, QUESTION_LIMITS.max) ?? QUESTION_LIMITS.min,
    startingLevels,
  };
}

export function packageQuery(state: PackageState) {
  const params = new URLSearchParams({ account_type: state.accountType });
  if (state.accountType === "company") {
    params.set("company_levels", String(state.levels));
    params.set("departments", String(state.departments));
    params.set("lines_per_audit", String(state.lines));
  } else params.set("starting_level", String(state.startingLevels[state.accountType]));
  return params.toString();
}

export type PackageSelection = ReturnType<typeof usePackageSelection>;

/** Package selections, initialised from (and kept in sync with) the URL query. */
export function usePackageState() {
  const search = useSearchParams();
  const selection = usePackageSelection(() => readState(new URLSearchParams(search.toString())));
  const { state } = selection;

  // Next.js keeps useSearchParams in sync with history.replaceState, without a navigation per slider tick.
  useEffect(() => { window.history.replaceState(window.history.state, "", `?${packageQuery(state)}`); }, [state]);

  return selection;
}

/** Package selections held in component state only (e.g. the landing page pricing section). */
export function usePackageSelection(initial: () => PackageState = () => readState(new URLSearchParams())) {
  const [state, setState] = useState<PackageState>(initial);

  const update = useCallback((patch: Partial<PackageState>) => setState((current) => ({ ...current, ...patch })), []);
  return {
    state,
    startingLevel: state.accountType === "company" ? null : state.startingLevels[state.accountType],
    setAccountType: useCallback((accountType: AccountTypeKey) => update({ accountType }), [update]),
    setLevels: useCallback((levels: 3 | 4 | 5) => update({ levels }), [update]),
    setDepartments: useCallback((departments: number) => update({ departments }), [update]),
    setLines: useCallback((lines: number) => update({ lines }), [update]),
    setStartingLevel: useCallback((level: number) => setState((current) => current.accountType === "company"
      ? current
      : { ...current, startingLevels: { ...current.startingLevels, [current.accountType]: level } }), []),
  };
}

/** Prices from the existing package pricing endpoint. */
export function usePackagePricing() {
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    packagePricingApi.get().then((result) => {
      if (!active) return;
      if (result.success && result.data?.pricing_version === PRICING_VERSION) { setPricing(toPricingConfig(result.data)); setError(""); }
      else setError(result.message || "Pricing is unavailable. Try again shortly.");
    });
    return () => { active = false; };
  }, [attempt]);

  return { pricing, error, retry: useCallback(() => { setError(""); setAttempt((value) => value + 1); }, []) };
}
