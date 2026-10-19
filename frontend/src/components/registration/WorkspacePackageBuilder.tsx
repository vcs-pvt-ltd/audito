"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { calculatePackage, levelFeeFor } from "@/lib/pricing/calculatePackage";
import { COMPANY_LEVEL_NAMES, LADDERS, PACKAGES, groupFor, packageFor } from "@/lib/registration/workspaceOptions";
import { packageQuery, usePackagePricing, type PackageSelection, type PackageState } from "@/lib/registration/usePackageState";
import AccountTypeSelector from "./AccountTypeSelector";
import PackageCard from "./PackageCard";
import LevelLadder from "./LevelLadder";
import DepartmentStepper from "./DepartmentStepper";
import QuestionSlider from "./QuestionSlider";
import SelectionSummary, { MobileContinueBar } from "./SelectionSummary";
import { Panel } from "./ui";

const REVIEW_STEPS = ["Choose your starting level and continue.", "Add your details. Our team reviews your request.", "We agree your setup and pricing, then activate your workspace."];

/** "Contact our team": the review request form, filled in with the current selection. */
export function contactHref(state: PackageState) {
  const query = state.accountType === "company"
    ? `account_type=company&starting_level=${state.levels}&departments=${state.departments}&lines_per_audit=${state.lines}`
    : packageQuery(state);
  return `/register?contact=1&${query}`;
}

/**
 * Account type, package, size and live price. Used by /register/start and the landing page
 * pricing section; the caller owns the selection state (URL-synced or local).
 */
export default function WorkspacePackageBuilder({ selection, eyebrow, headingAs: Heading = "h1", headingId, mobileBar = "fixed" }: {
  selection: PackageSelection;
  /** Small line above the title, e.g. the registration step. */
  eyebrow?: ReactNode;
  headingAs?: "h1" | "h2";
  headingId?: string;
  /** "fixed" on a full page; "sticky" inside a scroll container (landing slide, dialog). */
  mobileBar?: "fixed" | "sticky";
}) {
  const router = useRouter();
  const { state, startingLevel, setAccountType, setLevels, setDepartments, setLines, setStartingLevel } = selection;
  const { pricing, error: pricingError, retry } = usePackagePricing();
  const company = state.accountType === "company";
  const group = groupFor(state.accountType);
  const plan = packageFor(state.levels);
  const quote = useMemo(() => pricing && calculatePackage({ levels: state.levels, departments: state.departments, lines: state.lines }, pricing), [pricing, state.levels, state.departments, state.lines]);
  const ladder = state.accountType === "company" ? [] : LADDERS[state.accountType];
  const start = ladder.find((item) => item.level === startingLevel) ?? ladder[0];
  const levelPath = COMPANY_LEVEL_NAMES.slice(0, state.levels).reverse();

  const onContinue = () => {
    const query = packageQuery(state);
    if (company) { if (quote) router.push(`/register?${query}&total=${quote.total}`); }
    else router.push(`/register?contact=1&${query}`);
  };

  return <>
    {/* Title styled like the landing page sections: glass badge, white line + shimmering gradient line. */}
    <div className="flex flex-col items-center text-center">
      {eyebrow && <div className="glass mb-3 inline-flex items-center gap-2 rounded-full border border-secondary-500/20 px-4 py-1.5 text-sm font-medium text-[#00D492]">{eyebrow}</div>}
      <Heading id={headingId} className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
        Choose your workspace <span className="section-gradient-text">and package</span>
      </Heading>
      <p className="mt-2 max-w-2xl text-balance text-sm text-gray-300">
        {company ? "Choose an account type, package and size. Your price updates as you go." : "Choose where your workspace starts. Our team agrees the price with you."}
      </p>
    </div>

    <div className="mt-5"><AccountTypeSelector value={state.accountType} onChange={setAccountType} /></div>

    <div className="mt-3 grid gap-3 text-ws-ink md:grid-cols-2 desk:grid-cols-3">
      {company ? <>
        <Panel label="1 · Package and levels" aside="Lower levels always included">
          <div role="group" aria-label="Package" className="flex flex-col gap-2.5">
            {PACKAGES.map((item) => <PackageCard key={item.levels} name={item.name} tagline={item.tagline} levels={item.levels}
              fee={pricing ? levelFeeFor(item.levels, pricing) : null} selected={state.levels === item.levels} onSelect={() => setLevels(item.levels)} />)}
          </div>
        </Panel>
        <Panel label="2 · Size your package">
          <div className="flex flex-col gap-5">
            <DepartmentStepper value={state.departments} onChange={setDepartments} pricing={pricing} />
            <QuestionSlider value={state.lines} onChange={setLines} cost={quote ? quote.questionsCost : null} freeLines={quote ? quote.freeLines : 0} />
          </div>
        </Panel>
        <SelectionSummary mode="company" title={`Company · ${plan.name}`} planName={plan.name}
          subtitle={`Starts at ${levelPath[0]}: ${levelPath.join(" → ")} · ${state.departments.toLocaleString("en-US")} departments`}
          quote={quote} pricingError={pricingError} onRetry={retry} onContinue={onContinue} />
      </> : <>
        <Panel label="1 · Starting level">
          <p className="mb-3 text-sm text-ws-soft">Pick the level your workspace starts at. Levels below it are included.</p>
          <LevelLadder levels={ladder} value={start.level} onChange={setStartingLevel} />
        </Panel>
        <Panel label="2 · How it works">
          <h3 className="text-lg font-bold leading-snug">{group} workspaces are set up with our team</h3>
          <ol className="mt-4 space-y-3">
            {REVIEW_STEPS.map((step, index) => <li key={step} className="flex gap-3 text-sm text-ws-soft">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ws-input bg-ws-raised text-xs font-bold text-ws-gold" aria-hidden>{index + 1}</span>
              <span className="pt-1">{step}</span>
            </li>)}
          </ol>
        </Panel>
        <SelectionSummary mode="review" title={`${group} · ${start.label}`} subtitle={`Starting level L${start.level} · reviewed by the Audito team`} onContinue={onContinue} />
      </>}
    </div>

    <MobileContinueBar position={mobileBar} review={!company} total={quote ? quote.total : null} disabled={company && !quote} onContinue={onContinue} />
  </>;
}
