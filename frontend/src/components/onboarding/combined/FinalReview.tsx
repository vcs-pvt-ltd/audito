"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import type { OnboardingDraft } from "@/lib/api";
import { CURRENCIES, DURATION_UNITS } from "./model";
import { SectionHeader, inputClass } from "./ui";

type ChecklistDetails = OnboardingDraft["checklist"];
type ChecklistType = { checklist_type_id: string; name: string };
const NEW_TYPE = "__new__";
const labelClass = "block text-sm text-gray-300";

// Choose a saved checklist type, or add one without leaving setup. When the
// sheet names a type that is not saved yet, it can be created in one step.
function ChecklistTypeField({ value, sheetType, types, busy, onSelect, onCreate }: {
  value: string; sheetType: string; types: ChecklistType[]; busy: boolean;
  onSelect: (id: string) => void; onCreate: (name: string) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");
  const sheetMatch = sheetType ? types.find(type => sameName(type.name, sheetType)) : undefined;
  const duplicate = name.trim() ? types.find(type => sameName(type.name, name)) : undefined;
  async function create(typeName: string) {
    if (!typeName.trim() || creating) return;
    setCreating(true);
    const id = await onCreate(typeName.trim());
    setCreating(false);
    if (id) { onSelect(id); setAdding(false); setName(""); }
  }
  return <div className={labelClass}>
    <label htmlFor="checklist-type">Type</label>
    <select id="checklist-type" required className={`${inputClass} mt-1`} disabled={busy || creating} value={adding ? NEW_TYPE : value}
      onChange={event => { if (event.target.value === NEW_TYPE) { setAdding(true); setName(sheetMatch ? "" : sheetType); } else { setAdding(false); onSelect(event.target.value); } }}>
      <option value="" disabled>Choose a type</option>
      {types.map(type => <option key={type.checklist_type_id} value={type.checklist_type_id}>{type.name}</option>)}
      <option value={NEW_TYPE}>+ New type…</option>
    </select>
    {adding && <div className="mt-2 flex flex-wrap gap-2">
      <input aria-label="New type name" autoFocus className={`${inputClass} min-w-[11rem] flex-1`} placeholder="Type name" value={name} maxLength={255} disabled={creating}
        onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !duplicate) { event.preventDefault(); void create(name); } }} />
      <Button size="sm" disabled={!name.trim() || Boolean(duplicate) || creating} loading={creating} leftIcon={<Plus size={14} />} onClick={() => void create(name)}>Add</Button>
      <Button size="sm" variant="ghost" disabled={creating} onClick={() => setAdding(false)}>Cancel</Button>
      {duplicate && <p className="w-full text-xs text-amber-200">“{duplicate.name}” already exists. <button type="button" className="underline" onClick={() => { onSelect(duplicate.checklist_type_id); setAdding(false); }}>Use it</button></p>}
    </div>}
    {!adding && !value && sheetType && (sheetMatch
      ? <button type="button" disabled={busy} className="mt-1.5 text-xs font-semibold text-secondary-300 underline" onClick={() => onSelect(sheetMatch.checklist_type_id)}>Use “{sheetMatch.name}” from your sheet</button>
      : <button type="button" disabled={busy || creating} className="mt-1.5 text-xs font-semibold text-secondary-300 underline" onClick={() => void create(sheetType)}>Create “{sheetType}” from your sheet</button>)}
  </div>;
}

/** The last step: the checklist details. All fields are required. */
export default function FinalReview({ draft, types, areaCount, questionCount, planIssue, busy, onChecklist, onCreateType }: {
  draft: OnboardingDraft; types: ChecklistType[]; areaCount: number; questionCount: number; planIssue: string; busy: boolean;
  onChecklist: (fields: Partial<ChecklistDetails>) => void; onCreateType: (name: string) => Promise<string | null>;
}) {
  const c = draft.checklist;
  const number = (value: string) => (value === "" ? null : Number(value));
  return <section className="mx-auto max-w-2xl space-y-5">
    <SectionHeader title="Checklist details" description={`${areaCount} areas · ${questionCount} questions. Fill in every field, then save.`} />
    {planIssue && <p role="alert" className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-100">{planIssue}</p>}
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/[.12] p-4 sm:p-5">
      <label className={labelClass}>Name<input required className={`${inputClass} mt-1`} disabled={busy} value={c.name} placeholder="Checklist name" onChange={event => onChecklist({ name: event.target.value, source_reference: "Manually reviewed" })} /></label>
      <label className={labelClass}>Description<textarea required className={`${inputClass} mt-1`} disabled={busy} rows={2} value={c.description} placeholder="What this checklist covers" onChange={event => onChecklist({ description: event.target.value, source_reference: "Manually reviewed" })} /></label>
      <ChecklistTypeField value={c.checklist_type_id} sheetType={c.type_name} types={types} busy={busy} onSelect={id => onChecklist({ checklist_type_id: id })} onCreate={onCreateType} />
      <div className="grid gap-4 sm:grid-cols-2">{(["time_period", "repeat_duration"] as const).map(prefix => {
        const label = prefix === "time_period" ? "Audit takes" : "Repeat every";
        return <div key={prefix} className={labelClass}>
          <span>{label}</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input aria-label={`${label} number`} required className={inputClass} type="number" min={1} step={1} placeholder="Number" disabled={busy} value={c[`${prefix}_value`] ?? ""} onChange={event => onChecklist({ [`${prefix}_value`]: number(event.target.value) })} />
            <select aria-label={`${label} unit`} required className={inputClass} disabled={busy} value={c[`${prefix}_unit`]} onChange={event => onChecklist({ [`${prefix}_unit`]: event.target.value })}><option value="" disabled>Unit</option>{DURATION_UNITS.map(unit => <option key={unit}>{unit}</option>)}</select>
          </div>
        </div>;
      })}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={labelClass}>
          <label htmlFor="checklist-budget">Budget</label>
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
            <input id="checklist-budget" required className={inputClass} type="number" min={0} step={0.01} placeholder="0.00" disabled={busy} value={c.budget ?? ""} onChange={event => onChecklist({ budget: number(event.target.value) })} />
            <select aria-label="Currency" className={`${inputClass} !w-24`} disabled={busy} value={c.currency || "$"} onChange={event => onChecklist({ currency: event.target.value })}>
              {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
        </div>
        <label className={labelClass}>Workers<input required className={`${inputClass} mt-1`} type="number" min={1} step={1} placeholder="For example: 5" disabled={busy} value={c.num_workers ?? ""} onChange={event => onChecklist({ num_workers: number(event.target.value) })} /></label>
      </div>
    </div>
  </section>;
}
