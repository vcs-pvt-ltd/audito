"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import Image from "next/image";
import logo from "@/assets/logo/audito_logo.png";

const CUSTOM_FEATURES = [
  { key: "max_company_levels" as const, label: "Company Levels", min: 1, max: 20, desc: "Hierarchical organizational levels" },
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
    max_company_levels: 1,
    max_departments: 4,
    max_audits: 2,
    max_checklists: 3,
    max_auditors: 1,
    allow_auditor_eval: false,
    allow_company_to_company: false,
  });

  const handleProceedToRegister = () => {
    setSubmitting(true);
    sessionStorage.setItem("custom_solution_payload", JSON.stringify({ customSolution: limits, billing_cycle: billingCycle }));
    router.push("/register?plan=Custom");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[radial-gradient(ellipse_at_top,_#0a2e1f_0%,_#051510_50%,_#020a06_100%)]">
      <Link
        href="/"
        className="fixed top-5 left-5 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors z-50"
      >
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Image src={logo} alt="Audito" className="h-10 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-white mb-2">Configure Your Custom Plan</h1>
          <p className="text-sm text-gray-400">Specify the features and limits your organization needs. Our team will review your requirements and assign a custom price.</p>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8">
          {/* Billing Cycle Toggle */}
          <div className="flex justify-center mb-6">
            <div className="glass rounded-lg p-1 flex items-center gap-1 border border-white/5">
              {(["Monthly", "Yearly"] as const).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`relative px-5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${
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

          <div className="space-y-5 mb-6">
            <p className="text-[10px] tracking-[2px] text-secondary-600 uppercase">Resource Limits</p>
            {CUSTOM_FEATURES.map((feat) => (
              <div key={feat.key} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-sm font-medium text-white">{feat.label}</p>
                  <p className="text-[11px] text-gray-500">{feat.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLimits((prev) => ({ ...prev, [feat.key]: Math.max(feat.min, prev[feat.key] - 1) }))}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg font-bold"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-white font-semibold text-lg">{limits[feat.key]}</span>
                  <button
                    type="button"
                    onClick={() => setLimits((prev) => ({ ...prev, [feat.key]: Math.min(feat.max, prev[feat.key] + 1) }))}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <p className="text-[10px] tracking-[2px] text-secondary-600 uppercase pt-2">Premium Features</p>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
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
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
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
          <div className="p-4 rounded-xl bg-secondary-500/10 border border-secondary-500/20 mb-6">
            <p className="text-xs text-secondary-400 font-semibold uppercase tracking-wide mb-2">Your Custom Selection</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-400">Company Levels: <span className="text-white font-medium">{limits.max_company_levels}</span></span>
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
            className="w-full flex items-center justify-center gap-2 py-3 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold rounded-xl transition-all disabled:opacity-50"
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
