"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, Building2, Check, Globe, LayoutGrid, LockKeyhole, ShieldCheck, User } from "lucide-react";
import type { AllEntityType } from "@/lib/api";
import { canRegisterPackageEntry, hierarchySelectionLabel, type CompanyEntryType } from "@/lib/packageHierarchy";

export type AccountGroup = "Customer" | "Company" | "Audit Firm";
type Entry = { name: AllEntityType; label?: string; level: number; color: string; desc: string };
const accountTypes = [
  { key: "Customer" as const, label: "Customers", icon: Building2, description: "For buyer, buying-office, and supplier workspaces", entityTypes: [
    { name: "Customer", level: 7, color: "bg-secondary-500", desc: "Best for a main buyer managing its supplier network." },
    { name: "Buying Office", level: 6, color: "bg-secondary-500/80", desc: "For a regional office that manages local suppliers." },
    { name: "Supplier", level: 5, color: "bg-secondary-500/60", desc: "For a supplier completing customer audits and actions." },
  ] as Entry[], capabilities: [{ icon: Globe, label: "Manage global supplier audits" }, { icon: ShieldCheck, label: "Control compliance across regions" }, { icon: BarChart3, label: "Centralized reporting" }] },
  { key: "Company" as const, label: "Company", icon: LayoutGrid, description: "For company operations, sites, and departments", entityTypes: [
    { name: "Company", level: 5, color: "bg-primary-400", desc: "Best for the main organization that owns the workspace." },
    { name: "Cluster", level: 4, color: "bg-primary-400/80", desc: "For a group of factories or operating sites." },
    { name: "Factory", level: 3, color: "bg-primary-400/60", desc: "For one manufacturing or operating site." },
    { name: "Unit", level: 2, color: "bg-primary-400/40", desc: "For an operational unit inside a factory." },
    { name: "Department", level: 1, color: "bg-primary-400/30", desc: "For a department-level audit workspace." },
  ] as Entry[], capabilities: [{ icon: LayoutGrid, label: "Multi-level org structure" }, { icon: ShieldCheck, label: "Factory & unit management" }, { icon: BarChart3, label: "Operational reporting" }] },
  { key: "Audit Firm" as const, label: "Audit Firms", icon: User, description: "For audit firms, branches, and specialist teams", entityTypes: [
    { name: "Audit Firm Company", label: "Company", level: 5, color: "bg-accent-500", desc: "Best for the main audit-firm workspace." },
    { name: "Branch", level: 4, color: "bg-accent-500/80", desc: "For a branch that manages local audit teams." },
    { name: "Audit Firm Department", label: "Department", level: 3, color: "bg-accent-500/60", desc: "For a specialist audit department or team." },
  ] as Entry[], capabilities: [{ icon: User, label: "Manage audit teams" }, { icon: Globe, label: "Multi-branch operations" }, { icon: ShieldCheck, label: "Client audit linking" }] },
];
const allLevels = [7, 6, 5, 4, 3, 2, 1];

export default function AccountTypeStep({ selectedGroup, selectedEntityType, companyLevels, hasPackage, defaultGroup, mode, packageSetupHref, onGroupSelect, onEntityTypeSelect, onNext, error }: {
  selectedGroup: AccountGroup | "";
  selectedEntityType: AllEntityType | "";
  companyLevels: number;
  hasPackage: boolean;
  defaultGroup: AccountGroup;
  mode: "package" | "contact";
  packageSetupHref: string;
  onGroupSelect: (group: AccountGroup) => void;
  onEntityTypeSelect: (type: AllEntityType) => void;
  onNext: () => void;
  error: string;
}) {
  const activeGroup = selectedGroup || defaultGroup;
  const activeConfig = accountTypes.find((group) => group.key === activeGroup)!;
  const selectedEntity = activeConfig.entityTypes.find((entry) => entry.name === selectedEntityType);
  const selectedLevel = selectedEntity?.level;
  const ActiveIcon = activeConfig.icon;
  const canSelectGroup = (group: AccountGroup) => mode === "package" ? group === "Company" : group !== "Company";
  const available = (group: AccountGroup, entry: Entry) => canSelectGroup(group) && (group !== "Company" || (hasPackage && canRegisterPackageEntry(entry.name as CompanyEntryType, companyLevels)));
  const badge = (group: AccountGroup, entry: Entry) => group === "Company"
    ? entry.level <= 3 ? "Free level" : "Included"
    : "Team review";
  const selectGroup = (group: AccountGroup) => {
    if (!canSelectGroup(group)) return;
    onGroupSelect(group);
    const first = accountTypes.find((item) => item.key === group)!.entityTypes.find((entry) => available(group, entry));
    if (first) onEntityTypeSelect(first.name);
  };
  const selectEntry = (group: AccountGroup, entry: Entry) => {
    if (!available(group, entry)) return;
    if (selectedGroup !== group) onGroupSelect(group);
    onEntityTypeSelect(entry.name);
  };

  return <div className="p-5 pt-1 sm:p-8 sm:pt-2">
    <div className="mb-5 flex items-start gap-3"><Link href={packageSetupHref} aria-label="Go back to package setup" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6"><ArrowLeft size={18} /></Link>
      <div><h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Choose your account type</h3><p className="mt-1 text-sm leading-relaxed text-gray-400">{mode === "package" ? "Choose where your workspace starts. Levels 1–3 are free. Your package selection unlocks Level 4 or Level 5." : "Choose your organization type and starting level. Our team will review your request."}</p></div></div>

    {mode === "package" && hasPackage && <div className="mb-5 rounded-xl border border-secondary-500/20 bg-secondary-500/10 p-3 text-xs leading-5 text-gray-300"><span className="font-semibold text-white">Your selection: </span>{hierarchySelectionLabel(companyLevels)}. <Link href={packageSetupHref} className="font-medium text-secondary-300 underline">Change levels</Link></div>}

    <div className="space-y-5 sm:hidden">
      <div className="grid grid-cols-3 gap-2">{accountTypes.map((group) => { const Icon = group.icon; const active = selectedGroup === group.key; const locked = !canSelectGroup(group.key); return <button key={group.key} type="button" disabled={locked} onClick={() => selectGroup(group.key)} className={`relative flex min-h-[86px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 transition-all ${locked ? "cursor-not-allowed border-white/[0.06] bg-black/10 opacity-45" : active ? "border-secondary-500/50 bg-secondary-500/12 shadow-lg shadow-black/10" : "border-white/10 bg-white/[0.035]"}`}><Icon size={18} className={active ? "text-secondary-400" : "text-gray-400"} /><span className={`text-center text-[11px] font-semibold leading-tight ${active ? "text-secondary-400" : "text-white"}`}>{group.label}</span>{locked && <LockKeyhole size={11} className="absolute right-2 top-2 text-gray-400" />}</button>; })}</div>
      <div className="space-y-2"><p className="px-1 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Choose organizational level</p>{activeConfig.entityTypes.map((entry) => { const locked = !available(activeGroup, entry); const selected = selectedGroup === activeGroup && selectedEntityType === entry.name; return <button key={entry.name} type="button" disabled={locked} onClick={() => selectEntry(activeGroup, entry)} className={`flex min-h-[68px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${locked ? "cursor-not-allowed border-white/[0.06] bg-black/10 opacity-45" : selected ? "border-secondary-500/45 bg-secondary-500/10 shadow-lg shadow-black/10" : "border-white/10 bg-white/[0.035]"}`}><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${entry.color}`} /><span className="min-w-0 flex-1"><span className={`block text-sm font-semibold ${selected ? "text-secondary-400" : "text-white"}`}>{entry.label ?? entry.name}</span><span className="mt-0.5 block text-xs text-gray-400">{activeGroup === "Company" ? `Level ${entry.level} · ` : ""}{entry.desc}</span></span><span className="shrink-0 self-end text-[10px] font-semibold text-secondary-300">{locked ? <LockKeyhole size={13} /> : badge(activeGroup, entry)}</span>{selected && <Check size={15} className="shrink-0 text-secondary-400" />}</button>; })}</div>
    </div>

    <div className="hidden sm:block">
      <div className="mb-7 grid grid-cols-3 gap-3">{accountTypes.map((group) => { const Icon = group.icon; const active = selectedGroup === group.key; const locked = !canSelectGroup(group.key); return <button key={group.key} type="button" disabled={locked} onClick={() => selectGroup(group.key)} className={`group relative min-h-[132px] rounded-2xl border p-4 text-left transition-all duration-200 ${locked ? "cursor-not-allowed border-white/[0.06] bg-black/10 opacity-45" : active ? "border-secondary-500/50 bg-secondary-500/10 shadow-lg shadow-black/10" : "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.055]"}`}>{active && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-secondary-500 text-primary-950"><Check size={12} strokeWidth={3} /></span>}{locked && <LockKeyhole size={14} className="absolute right-3 top-3 text-gray-400" />}<span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-secondary-500/20" : "bg-white/5 group-hover:bg-white/10"}`}><Icon size={18} className={active ? "text-secondary-400" : "text-gray-400"} /></span><span className={`block text-sm font-semibold ${active ? "text-secondary-400" : "text-white"}`}>{group.label}</span><span className="mt-0.5 block text-xs leading-snug text-gray-500">{group.description}</span></button>; })}</div>
      <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4 sm:p-5"><div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Organization levels</p><p className="mt-1 text-xs text-gray-400">Choose an available starting level below.</p></div><span className="hidden text-[10px] text-gray-400 md:inline">Select one level to continue</span></div>
        <div className="grid grid-cols-3 gap-3">{accountTypes.map((group) => <div key={group.key} className="flex flex-col gap-1.5">{allLevels.map((level) => { const entry = group.entityTypes.find((item) => item.level === level); const locked = Boolean(entry && !available(group.key, entry)); const selected = selectedGroup === group.key && selectedLevel === level && Boolean(entry); return <div key={level} className="flex items-center gap-2"><span className={`w-5 shrink-0 text-right font-mono text-[9px] ${entry ? "text-secondary-600" : "text-white/10"}`}>L{level}</span><button type="button" disabled={!entry || locked} onClick={() => entry && selectEntry(group.key, entry)} title={locked ? (canSelectGroup(group.key) ? `Choose Level ${entry?.level} in pricing to unlock this account type.` : "This account type uses the other registration route.") : undefined} className={`relative h-10 flex-1 rounded-xl px-3 text-left text-xs font-medium transition-all ${!entry ? "cursor-default opacity-[0.08]" : locked ? "cursor-not-allowed bg-white/[0.035] text-gray-400" : `cursor-pointer text-white hover:translate-x-0.5 hover:brightness-110 ${entry.color}`} ${selected ? "ring-2 ring-secondary-300 ring-offset-2 ring-offset-[#0a1d15] shadow-lg shadow-black/20" : ""}`}><span className="flex items-center justify-between gap-1"><span className="truncate">{entry?.label ?? entry?.name ?? ""}</span>{locked ? <LockKeyhole size={11} className="shrink-0" /> : selected && <Check size={12} className="shrink-0" strokeWidth={3} />}</span>{entry && !locked && <span className="absolute bottom-1 right-2 text-[9px] font-semibold text-secondary-200">{badge(group.key, entry)}</span>}</button></div>; })}</div>)}</div>
      </div>
      {selectedGroup && selectedEntity && <div className="mt-6 overflow-hidden rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/[0.11] via-primary-500/[0.08] to-transparent"><div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"><div className="flex min-w-0 flex-1 items-center gap-3.5"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-secondary-500/25 bg-secondary-500/15 text-secondary-400 shadow-lg shadow-black/10"><ActiveIcon size={21} /></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-500">Currently selected</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-base font-semibold text-white">{selectedEntity.label ?? selectedEntity.name}</p><span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[10px] font-medium text-gray-400">Level {selectedEntity.level}</span></div><p className="mt-1 text-xs leading-relaxed text-gray-400">{selectedEntity.desc}</p></div></div><div className="flex flex-wrap gap-2 sm:max-w-[46%] sm:justify-end">{activeConfig.capabilities.map(({ icon: Icon, label }) => <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-2.5 py-1.5 text-[10px] font-medium text-gray-300"><Icon size={11} className="text-secondary-400" />{label}</span>)}</div></div></div>}
    </div>
    {mode === "package" && <p className="mt-5 text-center text-sm text-gray-400">Customer and Audit Firm accounts are reviewed separately. <Link href="/register?contact=1" className="font-medium text-secondary-400 underline">Contact the Audito team</Link>.</p>}
    {mode === "contact" && <p className="mt-5 text-center text-sm text-gray-400">For a Company workspace, <Link href="/register/select-package" className="font-medium text-secondary-400 underline">select your package</Link> first.</p>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
    <button type="button" onClick={onNext} disabled={!selectedEntityType || (mode === "package" && !hasPackage)} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3.5 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50">Continue Setup <ArrowRight size={18} /></button>
    <p className="mt-5 text-center text-sm text-gray-400">Already have an account? <Link href="/login" className="font-medium text-secondary-400 hover:text-secondary-300">Log in</Link></p>
  </div>;
}
