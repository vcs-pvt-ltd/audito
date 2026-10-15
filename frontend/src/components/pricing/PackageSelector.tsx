"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, Check, CircleHelp, Coins, Layers3, ListChecks, Minus, Plus, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import basicHierarchy from "@/assets/landing/pricing-plans/basic-plan-hierarchy.png";
import proHierarchy from "@/assets/landing/pricing-plans/pro-plan-hierarchy.png";
import eliteHierarchy from "@/assets/landing/pricing-plans/elite-plan-hierarchy.png";
import { packagePricingApi, type PackagePricing } from "@/lib/api";
import { FREE_COMPANY_LEVELS, MIN_AUDIT_LINES, hierarchySelectionLabel } from "@/lib/packageHierarchy";
import CompanyLevelSelector from "../landing/CompanyLevelSelector";

const money = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const workspaceExamples = [
  { title: "Focused operations", description: "Organize audits around one site and its teams.", image: basicHierarchy, alt: "Illustration of one site connected to audit functions" },
  { title: "Connected sites", description: "Bring several operating sites into one view.", image: proHierarchy, alt: "Illustration of a headquarters connected to operating sites and auditors" },
  { title: "Larger structures", description: "See the organization from leadership to local teams.", image: eliteHierarchy, alt: "Illustration of a layered organization connected to an audit team" },
];

function QuantityField({ id, label, icon: Icon, value, onChange, min = 1, max, description, badge, hint }: {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max: number;
  description: string;
  badge: string;
  /** Shown under the input when the value is below the minimum. */
  hint?: string;
}) {
  const parsed = Number(value);
  const belowMin = value.trim() !== "" && Number.isFinite(parsed) && parsed < min;
  const adjust = (change: number) => {
    const current = Number.isSafeInteger(parsed) && parsed >= min ? parsed : min;
    onChange(String(Math.max(min, Math.min(max, current + change))));
  };
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition-colors focus-within:border-secondary-400/50 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><Icon size={19} /></span>
        <div><label htmlFor={id} className="block text-sm font-semibold text-white">{label}</label><p className="mt-1 max-w-lg text-xs leading-5 text-gray-400">{description}</p></div>
      </div>
      <span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2.5 py-1 text-[11px] font-semibold text-secondary-300">{badge}</span>
    </div>
    <div className="mt-4 flex w-full max-w-[240px] items-stretch overflow-hidden rounded-xl border border-white/15 bg-[#09231d]">
      <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => adjust(-1)} disabled={parsed <= min} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"><Minus size={16} /></button>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} step={1} value={value} onChange={(event) => onChange(event.target.value)}
        onBlur={() => { if (belowMin) onChange(String(min)); }}
        aria-invalid={belowMin || undefined} aria-describedby={hint ? `${id}-hint` : undefined}
        className="min-w-0 flex-1 border-x border-white/10 bg-transparent px-2 text-center text-base font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
      <button type="button" aria-label={`Increase ${label.toLowerCase()}`} onClick={() => adjust(1)} disabled={parsed >= max} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"><Plus size={16} /></button>
    </div>
    {hint && <p id={`${id}-hint`} className={`mt-2 text-xs ${belowMin ? "text-amber-200" : "text-gray-500"}`}>{hint}</p>}
  </div>;
}

export default function PackageSelector({ dialog = false, standalone = false }: { dialog?: boolean; standalone?: boolean }) {
  const compact = dialog || standalone;
  const [pricing, setPricing] = useState<PackagePricing | null>(null);
  const [pricingError, setPricingError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [levels, setLevels] = useState(FREE_COMPANY_LEVELS);
  const [departmentsInput, setDepartmentsInput] = useState("5");
  const [linesInput, setLinesInput] = useState(String(MIN_AUDIT_LINES));
  const departments = Number(departmentsInput);
  const lines = Number(linesInput);

  useEffect(() => {
    if (!compact) return;
    const params = new URLSearchParams(window.location.search);
    const selectedLevels = Number(params.get("company_levels"));
    const selectedDepartments = Number(params.get("departments"));
    const selectedLines = Number(params.get("lines_per_audit"));
    if ([3, 4, 5].includes(selectedLevels)) setLevels(selectedLevels);
    if (Number.isSafeInteger(selectedDepartments) && selectedDepartments >= 1 && selectedDepartments <= 10000) setDepartmentsInput(String(selectedDepartments));
    if (Number.isSafeInteger(selectedLines) && selectedLines >= MIN_AUDIT_LINES && selectedLines <= 1000000) setLinesInput(String(selectedLines));
  }, [compact]);

  useEffect(() => {
    let active = true;
    packagePricingApi.get().then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.success && result.data?.pricing_version === 3) { setPricing(result.data); setPricingError(""); }
      else { setPricing(null); setPricingError(result.message || "Pricing is unavailable. Try again shortly."); }
    });
    return () => { active = false; };
  }, [refreshKey]);

  const validCounts = Number.isSafeInteger(departments) && departments >= 1 && departments <= 10000 && Number.isSafeInteger(lines) && lines >= MIN_AUDIT_LINES && lines <= 1000000;
  const quote = useMemo(() => {
    if (!pricing || !validCounts) return null;
    const levelCharge = pricing.company_level_charges[levels];
    const departmentCharge = departments <= 5 ? 0 : departments * 10;
    const lineCharge = lines * pricing.token_unit_price;
    const additionalTokens = (levelCharge + departmentCharge) / pricing.token_unit_price;
    if (!Number.isSafeInteger(additionalTokens)) return null;
    return {
      levelCharge, departmentCharge, lineCharge, additionalTokens,
      totalTokens: lines + additionalTokens,
      totalPrice: levelCharge + departmentCharge + lineCharge,
    };
  }, [pricing, validCounts, levels, departments, lines]);

  return <section className={`relative isolate text-white ${standalone ? "px-5 pb-5 pt-2 sm:px-8 sm:pt-2" : compact ? "px-4 pb-10 pt-12 sm:px-6 sm:pt-8 lg:px-8" : "px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-24 lg:px-8"}`}>
    {!standalone && <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_18%_18%,rgba(0,168,115,0.13),transparent_38%),radial-gradient(ellipse_at_88%_42%,rgba(217,163,70,0.09),transparent_36%)]" />}
    <div className="relative mx-auto max-w-6xl">
      <header className={standalone ? "grid gap-5 border-b border-white/10 pb-6 text-left lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center" : "mx-auto max-w-3xl text-center"}>
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-secondary-400/20 bg-secondary-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-300"><Coins size={14} /> Clear, flexible pricing</span>
          <h1 id={dialog ? "package-setup-title" : undefined} className={`mt-4 font-bold tracking-tight text-white ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-5xl"}`}>Select your own <span className="bg-gradient-to-r from-[#A8D0AF] via-[#8BB9AC] to-[#D4AF37] bg-clip-text text-transparent">package</span></h1>
          <p className={`mt-3 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base ${standalone ? "" : "mx-auto"}`}>Choose your company level, departments, and audit lines. See your price and tokens before you continue.</p>
        </div>
        <div className={standalone ? "rounded-2xl border border-secondary-400/20 bg-[#0b2a23]/80 p-4 shadow-lg shadow-black/10" : "mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl border border-secondary-400/20 bg-[#0b2a23]/80 px-4 py-2.5 text-sm shadow-lg shadow-black/10"}>
          {standalone && <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-300">How tokens work</p>}
          <span className="font-semibold text-white">1 token = 1 audit line</span>
          {standalone ? <span className="mt-1 block text-xs text-gray-300">One line is one audit question</span> : <><span className="hidden h-4 w-px bg-white/20 sm:block" /><span className="text-gray-300">One line is one audit question</span></>}
          {pricing && <>{!standalone && <span className="hidden h-4 w-px bg-white/20 sm:block" />}<span className={standalone ? "mt-2 block text-sm font-semibold text-secondary-300" : "font-semibold text-secondary-300"}>{money(pricing.token_unit_price)} per token</span></>}
        </div>
      </header>

      <div className={`${compact ? "mt-7" : "mt-10"} grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,0.75fr)] ${standalone ? "lg:h-[clamp(700px,84dvh,780px)] lg:items-stretch" : ""}`}>
        <div className={`rounded-3xl border border-white/10 bg-[#0b211e]/85 p-5 shadow-2xl shadow-black/20 sm:p-7 ${standalone ? "lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden" : ""}`}>
          <div className="mb-6 flex items-center justify-between gap-3 lg:shrink-0"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">Your selections</p><h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Build your package</h2></div><div className="flex items-center gap-2">{standalone && <span className="hidden text-xs text-gray-400 sm:inline">Scroll options</span>}<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-secondary-300"><Layers3 size={20} /></span></div></div>
          <div className={`space-y-3 ${standalone ? "package-card-scroll max-h-[min(68dvh,640px)] pr-2 lg:min-h-0 lg:max-h-none lg:flex-1" : ""}`} tabIndex={standalone ? 0 : undefined} aria-label={standalone ? "Package options" : undefined}>
            <CompanyLevelSelector value={levels} onChange={setLevels} pricing={pricing} idPrefix={dialog ? "package-dialog" : standalone ? "select-package" : "pricing-page"} />
            <QuantityField id={dialog ? "dialog-department-count" : standalone ? "select-package-department-count" : "department-count"} label="Departments" icon={Layers3} value={departmentsInput} onChange={setDepartmentsInput} max={10000} description="How many departments do you need? 1–5 are free. If you choose 6 or more, all departments cost $10 each. Example: 6 × $10 = $60." badge="1–5 free" />
            <QuantityField id={dialog ? "dialog-audit-line-count" : standalone ? "select-package-audit-line-count" : "audit-line-count"} label="Lines per audit" icon={ListChecks} value={linesInput} onChange={setLinesInput} min={MIN_AUDIT_LINES} max={1000000} description="1 audit line means 1 audit question and uses 1 token. Example: 100 lines need 100 tokens." badge={`Min ${MIN_AUDIT_LINES} tokens`} hint={`Minimum ${MIN_AUDIT_LINES} lines (${MIN_AUDIT_LINES} tokens).`} />
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3 text-xs leading-5 text-gray-300 lg:shrink-0"><CircleHelp size={16} className="mt-0.5 shrink-0 text-secondary-400" /><span>Level and department charges also give you tokens. We divide those charges by the token price and add the tokens to your audit-line tokens.</span></div>
        </div>

        <aside className={`overflow-hidden rounded-3xl border border-secondary-400/25 bg-gradient-to-b from-[#143b33] via-[#0d2c26] to-[#09221e] shadow-2xl shadow-black/25 ${standalone ? "lg:flex lg:h-full lg:min-h-0 lg:flex-col" : "lg:sticky lg:top-8"}`} aria-label="Package estimate">
          <div className="border-b border-white/10 p-6 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-300">Price summary</p><h2 className="mt-1 text-xl font-semibold text-white">Your package</h2></div><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-secondary-400/20 bg-secondary-500/10 text-secondary-300"><Coins size={20} /></span></div>
            {loading ? <div className="mt-6 h-12 w-40 animate-pulse rounded-lg bg-white/10" aria-label="Loading price" /> : quote ? <div className="mt-5" aria-live="polite"><span className="block text-4xl font-bold tracking-tight text-white sm:text-5xl">{money(quote.totalPrice)}</span><span className="mt-1 block text-xs text-gray-400">Total price</span></div> : <p className="mt-5 text-sm text-gray-300">Your total will appear here when the selections are valid.</p>}
          </div>
          <div className={`space-y-4 p-6 text-sm sm:p-7 ${standalone ? "package-card-scroll lg:min-h-0 lg:flex-1" : ""}`}>
            {pricingError && <div role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-xs text-red-200">{pricingError}<button type="button" onClick={() => { setLoading(true); setPricingError(""); setRefreshKey((key) => key + 1); }} className="mt-2 flex items-center gap-1 font-semibold text-white underline"><RefreshCw size={13} /> Retry</button></div>}
            {!validCounts && <p role="alert" className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">Enter whole numbers: 1–10,000 departments and {MIN_AUDIT_LINES.toLocaleString()}–1,000,000 audit lines.</p>}
            <div className="space-y-3 text-gray-300">
              <div className="flex items-start justify-between gap-3"><div><span className="block text-white">Company levels</span><span className="text-xs text-gray-400">{hierarchySelectionLabel(levels)}</span></div><strong className="font-semibold text-white">{quote ? money(quote.levelCharge) : "—"}</strong></div>
              <div className="flex items-start justify-between gap-3"><div><span className="block text-white">Departments</span><span className="text-xs text-gray-400">{validCounts ? departments <= 5 ? `${departments} included` : `${departments} × $10.00` : "Enter a valid quantity"}</span></div><strong className="font-semibold text-white">{quote ? money(quote.departmentCharge) : "—"}</strong></div>
              <div className="flex items-start justify-between gap-3"><div><span className="block text-white">Audit line tokens</span><span className="text-xs text-gray-400">{validCounts && pricing ? `${lines.toLocaleString()} × ${money(pricing.token_unit_price)}` : `1 token per line · min ${MIN_AUDIT_LINES}`}</span></div><strong className="font-semibold text-white">{quote ? money(quote.lineCharge) : "—"}</strong></div>
            </div>
            <div className="border-t border-white/10 pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-secondary-300">Tokens included</p><div className="space-y-2 text-xs text-gray-300"><div className="flex justify-between gap-3"><span>For audit lines</span><strong className="text-white">{quote ? quote.totalTokens - quote.additionalTokens : "—"}</strong></div><div className="flex justify-between gap-3"><span>From level and department charges</span><strong className="text-white">{quote ? quote.additionalTokens.toLocaleString() : "—"}</strong></div></div><div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold"><span>Total tokens</span><span className="text-secondary-300">{quote ? quote.totalTokens.toLocaleString() : "—"}</span></div></div>
            {quote ? <Link href={`/register?company_levels=${levels}&departments=${departments}&lines_per_audit=${lines}`} className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#EECA53] to-[#E1A300] px-4 py-3 font-semibold text-[#062D27] shadow-lg shadow-black/20 transition hover:brightness-110 active:scale-[0.99]">Continue to registration <ArrowRight size={17} /></Link> : <button type="button" disabled className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-white/10 px-4 py-3 font-semibold text-gray-400">Continue to registration</button>}
            <p className="text-center text-[11px] leading-5 text-gray-400">Next: choose an available account type and enter your details.</p>
          </div>
        </aside>
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><Building2 size={19} /></span><div><h2 className="text-sm font-semibold text-white">Need a Customer, Buying Office, Supplier, or Audit Firm account?</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-gray-400">Choose your account type and send your contact details. The Audito team will review your request.</p></div></div><Link href="/register?contact=1" className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl border border-secondary-400/30 px-4 py-2.5 text-sm font-semibold text-secondary-300 transition hover:border-secondary-400 hover:bg-secondary-500/10">Contact our team <ArrowUpRight size={16} /></Link></div>

      {!compact && <div className="mt-16 border-t border-white/10 pt-10"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">Workspace examples</p><h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">See how Audito brings your structure together</h2></div><p className="max-w-xs text-xs leading-5 text-gray-400">Illustrations of workspaces. Your package is based on the selections above.</p></div><div className="grid gap-4 sm:grid-cols-3">{workspaceExamples.map((example) => <article key={example.title} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#0b211e]/80 transition-all hover:-translate-y-1 hover:border-secondary-400/30 hover:shadow-xl hover:shadow-black/20"><div className="overflow-hidden"><Image src={example.image} alt={example.alt} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" sizes="(min-width: 640px) 33vw, 100vw" /></div><div className="p-4"><div className="flex items-center gap-2"><Check size={14} className="text-secondary-300" /><h3 className="text-sm font-semibold text-white">{example.title}</h3></div><p className="mt-1 text-xs leading-5 text-gray-400">{example.description}</p></div></article>)}</div></div>}
    </div>
  </section>;
}
