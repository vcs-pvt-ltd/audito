"use client";

import { Building2, Check } from "lucide-react";
import type { PackagePricing } from "@/lib/api";
import { hierarchySelectionLabel } from "@/lib/packageHierarchy";

const freeLevels = ["Department", "Unit", "Factory"];
const paidLevels = [
  { level: 4, name: "Cluster", calculation: "$50 + $50", description: "Includes Department, Unit, Factory, and Cluster." },
  { level: 5, name: "Company", calculation: "$50 + $50 + $50", description: "Includes all five levels, from Department to Company." },
];

export default function CompanyLevelSelector({ value, onChange, pricing, idPrefix = "pricing" }: {
  value: number;
  onChange: (level: number) => void;
  pricing: PackagePricing | null;
  idPrefix?: string;
}) {
  const choiceClass = (selected: boolean) => `block cursor-pointer rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-secondary-400 ${selected ? "border-secondary-400/60 bg-secondary-500/10" : "border-white/10 bg-black/10 hover:border-white/30"}`;

  return <fieldset className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5" aria-describedby={`${idPrefix}-company-levels-help`}>
    <legend className="sr-only">Company levels</legend>
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><Building2 size={19} /></span>
      <div><h3 className="text-sm font-semibold text-white">Company levels</h3><p id={`${idPrefix}-company-levels-help`} className="mt-1 text-xs leading-5 text-gray-300">Choose the highest level you need. All levels below it are included.</p></div>
    </div>

    <div className="mt-4 space-y-3">
      <label className={choiceClass(value === 3)}>
        <span className="flex items-center gap-3">
          <input type="radio" name={`${idPrefix}-company-level`} value={3} checked={value === 3} onChange={() => onChange(3)} className="h-4 w-4 shrink-0 accent-[#e1a300]" />
          <span className="flex-1 text-sm font-semibold text-white">Levels 1–3</span>
          <span className="text-base font-bold text-secondary-300">Free</span>
        </span>
        <span className="mt-3 grid gap-2 sm:grid-cols-3">
          {freeLevels.map((name, index) => <span key={name} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2 sm:block">
            <span className="text-[11px] text-gray-400">Level {index + 1}</span>
            <span className="text-xs font-medium text-white sm:mt-1 sm:block">{name}</span>
          </span>)}
        </span>
        <span className="mt-3 block text-xs text-gray-400">All three levels are included at no level charge.</span>
      </label>

      {paidLevels.map(({ level, name, calculation, description }) => <label key={level} className={choiceClass(value === level)}>
        <span className="flex items-center gap-3">
          <input type="radio" name={`${idPrefix}-company-level`} value={level} checked={value === level} onChange={() => onChange(level)} className="h-4 w-4 shrink-0 accent-[#e1a300]" />
          <span className="min-w-0 flex-1"><span className="block text-[11px] text-gray-400">Level {level}</span><span className="block text-sm font-semibold text-white">{name}</span></span>
          <span className="shrink-0 text-right"><span className="block text-base font-bold text-secondary-300">{pricing ? `$${pricing.company_level_charges[level]}` : "—"}</span><span className="block text-[10px] text-gray-400">total level charge</span></span>
        </span>
        <span className="mt-2 block text-xs leading-5 text-gray-300">{description}</span>
      </label>)}
    </div>

    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-gray-300" aria-live="polite"><Check size={15} className="mt-0.5 shrink-0 text-secondary-300" /><span>Selected: {hierarchySelectionLabel(value)}. Choose your starting account type during registration.</span></p>
  </fieldset>;
}
