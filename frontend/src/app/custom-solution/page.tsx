"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import Image from "next/image";
import logo from "@/assets/logo/audito_logo.png";
import { CUSTOM_PLAN_MINIMUM_LIMITS } from "@/lib/planLimits";

const CUSTOM_FEATURES = [
  { key: "max_company_levels" as const, label: "Company levels", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_company_levels, max: 100, desc: "Company-level capacity for your workspace" },
  { key: "max_departments" as const, label: "Departments", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_departments, max: 100, desc: "Department entities in your organization" },
  { key: "max_audits" as const, label: "Audits", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_audits, max: 100, desc: "Active audit assignments" },
  { key: "max_checklists" as const, label: "Audit checklists", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_checklists, max: 100, desc: "Reusable audit checklist templates" },
  { key: "max_auditors" as const, label: "Auditors", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_auditors, max: 100, desc: "Auditor accounts on your team" },
];

type CustomLimits = {
  max_company_levels: number;
  max_departments: number;
  max_audits: number;
  max_checklists: number;
  max_auditors: number;
  allow_auditor_eval: boolean;
  allow_company_to_company: boolean;
};

const normalizeLimits = (candidate?: Partial<CustomLimits>): CustomLimits => ({
  max_company_levels: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_company_levels, Number(candidate?.max_company_levels) || CUSTOM_PLAN_MINIMUM_LIMITS.max_company_levels),
  max_departments: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_departments, Number(candidate?.max_departments) || CUSTOM_PLAN_MINIMUM_LIMITS.max_departments),
  max_audits: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_audits, Number(candidate?.max_audits) || CUSTOM_PLAN_MINIMUM_LIMITS.max_audits),
  max_checklists: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_checklists, Number(candidate?.max_checklists) || CUSTOM_PLAN_MINIMUM_LIMITS.max_checklists),
  max_auditors: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_auditors, Number(candidate?.max_auditors) || CUSTOM_PLAN_MINIMUM_LIMITS.max_auditors),
  allow_auditor_eval: true,
  allow_company_to_company: true,
});

export default function CustomSolutionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"Monthly" | "Yearly">("Monthly");
  const [limits, setLimits] = useState<CustomLimits>(() => normalizeLimits());

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem("custom_solution_draft");
      if (!draft) return;
      const parsed = JSON.parse(draft);
      if (parsed.limits) setLimits(normalizeLimits(parsed.limits));
      if (parsed.billing_cycle === "Monthly" || parsed.billing_cycle === "Yearly") setBillingCycle(parsed.billing_cycle);
    } catch {
      // Ignore malformed browser storage.
    }
  }, []);

  const updateLimit = (key: keyof typeof CUSTOM_PLAN_MINIMUM_LIMITS, value: number) => {
    const feature = CUSTOM_FEATURES.find((item) => item.key === key)!;
    setLimits((previous) => ({ ...previous, [key]: Math.min(feature.max, Math.max(feature.min, value)) }));
  };

  const handleProceedToRegister = () => {
    setSubmitting(true);
    const customSolution = normalizeLimits(limits);
    sessionStorage.setItem("custom_solution_payload", JSON.stringify({ customSolution, billing_cycle: billingCycle }));
    sessionStorage.setItem("custom_solution_draft", JSON.stringify({ limits: customSolution, billing_cycle: billingCycle }));
    router.push("/register?plan=Custom");
  };

  return (
    <div className="relative min-h-screen px-4 py-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-80 w-80 rounded-full bg-primary-600/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-60 w-60 rounded-full bg-accent-500/10 blur-3xl" />
      </div>
      <div className="glass relative mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border-white/10 shadow-2xl shadow-black/20">
        <Link href="/" aria-label="Back to Home" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6">
          <ArrowLeft size={18} />
        </Link>
        <div className="px-5 pb-5 pt-8 text-center sm:px-8 sm:pt-10">
          <Link href="/?section=home" aria-label="Go to Audito home" className="inline-block transition-opacity hover:opacity-80">
            <Image src={logo} alt="Audito" className="mx-auto h-8 object-contain" />
          </Link>
          <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Custom workspace</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Configure your custom plan</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-400">Start with every Elite feature, then expand the capacity your organization needs. Our team will provide a tailored price.</p>
        </div>

        <div className="p-5 pt-1 sm:p-8 sm:pt-2">
          <div className="mb-7 flex justify-center">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/15 p-1.5">
              {(["Monthly", "Yearly"] as const).map((cycle) => (
                <button key={cycle} type="button" onClick={() => setBillingCycle(cycle)} className={`min-w-24 rounded-lg px-5 py-2 text-xs font-semibold transition-all sm:text-sm ${billingCycle === cycle ? "bg-secondary-500 text-primary-950 shadow" : "text-gray-400 hover:text-white"}`}>
                  {cycle}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-7 rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/10 to-transparent p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary-500 text-primary-950"><Check size={14} strokeWidth={3} /></span>
              <div>
                <p className="text-sm font-semibold text-white">Elite is your starting point</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">Custom plans include the full Elite feature set. Use the volume controls to increase capacity; limits cannot go below the Elite baseline.</p>
              </div>
            </div>
          </div>

          <div className="mb-7 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Capacity</p>
            {CUSTOM_FEATURES.map((feature) => {
              const value = limits[feature.key];
              const volume = (value / feature.max) * 100;
              const eliteMarker = (feature.min / feature.max) * 100;
              return (
                <div key={feature.key} className="rounded-2xl border border-white/[0.08] bg-black/10 p-4 transition-colors hover:bg-white/[0.035]">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.9fr)] sm:items-center">
                    <div>
                      <p className="text-sm font-medium text-white">{feature.label}</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">{feature.desc}</p>
                    </div>
                    <div>
                      <div className="mb-2 flex justify-end"><output className="text-[11px] font-semibold text-secondary-300">{value}</output></div>
                      <div className="relative">
                        <input type="range" min={0} max={feature.max} value={value} onChange={(event) => updateLimit(feature.key, Number(event.target.value))} aria-label={`${feature.label} volume`} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-secondary-500" style={{ background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${volume}%, rgba(255,255,255,.1) ${volume}%, rgba(255,255,255,.1) 100%)` }} />
                        <span aria-hidden="true" className="pointer-events-none absolute -top-1 h-4 w-px bg-secondary-200" style={{ left: `${eliteMarker}%` }} />
                        <span aria-hidden="true" className="pointer-events-none absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-secondary-300" style={{ left: `${eliteMarker}%` }}>Elite {feature.min}</span>
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] text-gray-500"><span>0</span><span>{feature.max}</span></div>
                    </div>
                  </div>
                </div>
              );
            })}

            <p className="pt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Included Elite features</p>
            {[
              ["Auditor Evaluation System", "Evaluate auditor performance with tests and scoring"],
              ["Company-to-Company Linking", "Link and collaborate with external organizations"],
            ].map(([title, description]) => (
              <div key={title} className="flex items-center justify-between gap-4 rounded-2xl border border-secondary-500/15 bg-secondary-500/[0.06] p-4">
                <div><p className="text-sm font-medium text-white">{title}</p><p className="mt-0.5 text-[11px] text-gray-500">{description}</p></div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary-500/25 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-semibold text-secondary-300"><Check size={12} /> Included</span>
              </div>
            ))}
          </div>

          <div className="mb-7 rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/10 to-transparent p-4 sm:p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary-400">Your custom selection</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {CUSTOM_FEATURES.map((feature) => <span key={feature.key} className="text-gray-400">{feature.label}: <span className="font-medium text-white">{limits[feature.key]}</span></span>)}
              <span className="text-gray-400">Elite features: <span className="font-medium text-white">Included</span></span>
            </div>
          </div>

          <button type="button" onClick={handleProceedToRegister} disabled={submitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px disabled:translate-y-0 disabled:opacity-50">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <><span>Proceed to registration</span><ArrowRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
