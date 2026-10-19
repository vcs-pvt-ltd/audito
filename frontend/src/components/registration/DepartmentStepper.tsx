import { useEffect, useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { paidDepartmentCount, type DepartmentRule } from "@/lib/pricing/calculatePackage";
import { DEPARTMENT_LIMITS, formatMoney } from "@/lib/registration/workspaceOptions";
import { Skeleton, focusRing } from "./ui";

const MAX_PIPS = 10;

function helperText(departments: number, free: number, rate: number, rule: DepartmentRule) {
  const paid = paidDepartmentCount(departments, free, rule);
  if (paid === 0) {
    const used = departments === free ? `All ${free} free used.` : `${departments} of ${free} free used.`;
    return `${used} ${rule === "extras_only" ? `Extras ${formatMoney(rate)} each.` : `From ${free + 1}, every department is ${formatMoney(rate)}.`}`;
  }
  return rule === "extras_only"
    ? `${free} free + ${paid} × ${formatMoney(rate)} = ${formatMoney(paid * rate)}`
    : `${paid} × ${formatMoney(rate)} = ${formatMoney(paid * rate)} (all departments are charged above ${free})`;
}

export default function DepartmentStepper({ value, onChange, pricing }: {
  value: number;
  onChange: (value: number) => void;
  /** null while prices load. */
  pricing: { freeDepartments: number; deptRate: number; departmentRule: DepartmentRule } | null;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const { min, max } = DEPARTMENT_LIMITS;
  const clamp = (number: number) => Math.min(max, Math.max(min, number));
  const paid = pricing ? paidDepartmentCount(value, pricing.freeDepartments, pricing.departmentRule) : 0;
  const pipTone = (index: number) => !pricing ? "bg-white/20" : index > value - paid ? "bg-ws-gold" : "bg-ws-mint";
  const stepButton = `grid w-11 place-items-center bg-ws-raised text-ws-ink transition-colors hover:bg-ws-input disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} focus-visible:-outline-offset-2`;

  return <div>
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={id} className="text-[15px] font-bold text-ws-ink">Departments</label>
      <span className="text-xs text-ws-soft">{pricing ? pricing.departmentRule === "extras_only" ? `First ${pricing.freeDepartments} free` : `1–${pricing.freeDepartments} free` : <Skeleton className="h-3 w-16" />}</span>
    </div>
    <div className="mt-2 flex items-center gap-4">
      <div className="flex h-12 shrink-0 overflow-hidden rounded-[10px] border border-ws-input">
        <button type="button" aria-label="Remove a department" disabled={value <= min} onClick={() => onChange(clamp(value - 1))} className={stepButton}><Minus size={16} aria-hidden /></button>
        <input id={id} type="text" inputMode="numeric" pattern="[0-9]*" value={draft} aria-describedby={`${id}-help`}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
            setDraft(digits);
            const number = Number(digits);
            if (digits && number >= min && number <= max) onChange(number);
          }}
          onBlur={() => { const next = clamp(Number(draft) || min); onChange(next); setDraft(String(next)); }}
          className={`w-14 border-x border-ws-input bg-ws-bg text-center text-lg font-bold text-ws-ink tabular-nums ${focusRing} focus-visible:-outline-offset-2`} />
        <button type="button" aria-label="Add a department" disabled={value >= max} onClick={() => onChange(clamp(value + 1))} className={stepButton}><Plus size={16} aria-hidden /></button>
      </div>
      <div className="flex flex-wrap items-center gap-1" aria-hidden>
        {Array.from({ length: Math.min(value, MAX_PIPS) }, (_, index) => <span key={index} className={`h-2 w-4 rounded-full ${pipTone(index + 1)}`} />)}
        {value > MAX_PIPS && <span className="ml-1 text-xs font-bold text-ws-soft">+{value - MAX_PIPS}</span>}
      </div>
    </div>
    <p id={`${id}-help`} className="mt-2 text-xs text-ws-soft" aria-live="polite">
      {pricing ? helperText(value, pricing.freeDepartments, pricing.deptRate, pricing.departmentRule) : <Skeleton className="h-3 w-40" />}
    </p>
  </div>;
}
