"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import logo from "@/assets/logo/audito_logo.png";

const CUSTOM_FEATURES = [
  { key: "max_departments" as const, label: "Departments", min: 1, max: 100, desc: "Department entities in your organization" },
  { key: "max_audits" as const, label: "Audits", min: 1, max: 100, desc: "Active audit assignments" },
  { key: "max_checklists" as const, label: "Audit Checklists", min: 1, max: 100, desc: "Reusable audit checklist templates" },
  { key: "max_auditors" as const, label: "Auditors", min: 1, max: 100, desc: "Auditor accounts on your team" },
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

export default function CustomSolutionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"Monthly" | "Yearly">("Monthly");

  const [limits, setLimits] = useState<CustomLimits>({
    max_company_levels: 6,
    max_departments: 4,
    max_audits: 2,
    max_checklists: 3,
    max_auditors: 1,
    allow_auditor_eval: false,
    allow_company_to_company: false,
  });

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem("custom_solution_draft");
      if (!draft) return;
      const parsed = JSON.parse(draft);
      if (parsed.limits) setLimits({ ...parsed.limits, max_company_levels: 6 });
      if (parsed.billing_cycle === "Monthly" || parsed.billing_cycle === "Yearly") {
        setBillingCycle(parsed.billing_cycle);
      }
    } catch {
      // Ignore malformed browser storage.
    }
  }, []);

  const handleProceedToRegister = () => {
    setSubmitting(true);
    const customSolution = { ...limits, max_company_levels: 6 };
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
        <Link
          href="/"
          aria-label="Back to Home"
          className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="px-5 pb-5 pt-8 text-center sm:px-8 sm:pt-10">
          <Image src={logo} alt="Audito" className="mx-auto h-8 object-contain" />
          <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Custom workspace</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Configure your custom plan</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-400">Choose the capacity and premium features your organization needs. Our team will review your request and provide a tailored price.</p>
        </div>

        <div className="p-5 pt-1 sm:p-8 sm:pt-2">
          {/* Billing Cycle Toggle */}
          <div className="mb-7 flex justify-center">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/15 p-1.5">
              {(["Monthly", "Yearly"] as const).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`relative min-w-24 rounded-lg px-5 py-2 text-xs font-semibold transition-all sm:text-sm ${
                    billingCycle === cycle
                      ? "bg-secondary-500 text-primary-950 shadow"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-7 space-y-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/10 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">All six Company hierarchy levels included</p>
                <p className="mt-1 text-xs text-gray-400">Company, Cluster, Factory, Unit, Department, and Section are always available with Custom.</p>
              </div>
              <span className="w-fit rounded-full border border-secondary-500/20 bg-black/10 px-3 py-1.5 text-xs font-semibold text-secondary-400">6 levels</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Resource limits</p>
            {CUSTOM_FEATURES.map((feat) => (
              <div key={feat.key} className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-black/10 p-4 transition-colors hover:bg-white/[0.035]">
                <div>
                  <p className="text-sm font-medium text-white">{feat.label}</p>
                  <p className="text-[11px] text-gray-500">{feat.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLimits((prev) => ({ ...prev, [feat.key]: Math.max(feat.min, prev[feat.key] - 1) }))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg font-bold text-white transition-colors hover:bg-white/15"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-white font-semibold text-lg">{limits[feat.key]}</span>
                  <button
                    type="button"
                    onClick={() => setLimits((prev) => ({ ...prev, [feat.key]: Math.min(feat.max, prev[feat.key] + 1) }))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg font-bold text-white transition-colors hover:bg-white/15"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <p className="pt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Premium features</p>
            <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Auditor Evaluation System</p>
                  <p className="text-[11px] text-gray-500">Evaluate auditor performance with tests and scoring</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLimits((prev) => ({ ...prev, allow_auditor_eval: !prev.allow_auditor_eval }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${limits.allow_auditor_eval ? "bg-secondary-500" : "bg-white/20"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${limits.allow_auditor_eval ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Company-to-Company Linking</p>
                  <p className="text-[11px] text-gray-500">Link and collaborate with external organizations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLimits((prev) => ({ ...prev, allow_company_to_company: !prev.allow_company_to_company }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${limits.allow_company_to_company ? "bg-secondary-500" : "bg-white/20"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${limits.allow_company_to_company ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Selection summary */}
          <div className="mb-7 rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/10 to-transparent p-4 sm:p-5">
            <p className="text-xs text-secondary-400 font-semibold uppercase tracking-wide mb-2">Your Custom Selection</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-400">Company Levels: <span className="text-white font-medium">6 (all levels)</span></span>
              <span className="text-gray-400">Departments: <span className="text-white font-medium">{limits.max_departments}</span></span>
              <span className="text-gray-400">Audits: <span className="text-white font-medium">{limits.max_audits}</span></span>
              <span className="text-gray-400">Checklists: <span className="text-white font-medium">{limits.max_checklists}</span></span>
              <span className="text-gray-400">Auditors: <span className="text-white font-medium">{limits.max_auditors}</span></span>
              <span className="text-gray-400">Auditor Eval: <span className="text-white font-medium">{limits.allow_auditor_eval ? "Yes" : "No"}</span></span>
              <span className="text-gray-400">Company Link: <span className="text-white font-medium">{limits.allow_company_to_company ? "Yes" : "No"}</span></span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleProceedToRegister}
            disabled={submitting}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px disabled:translate-y-0 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Proceed to Registration
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
