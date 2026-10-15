"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "../motion";
import { AlignLeft, Boxes, Building, Building2, Check, CheckSquare, Factory, LayoutGrid, List, Network, ToggleLeft, Truck, Users, X } from "lucide-react";
import type { OnboardingQuestion, OrganizationAiDraftNode } from "@/lib/api";
import { STEPS, isChangedRecord, isUnplacedRecord } from "./model";

export const inputClass = "w-full rounded-xl border border-white/10 bg-black/[.18] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-secondary-400/50 disabled:cursor-not-allowed disabled:opacity-60";
export const cardClass = "rounded-3xl border border-white/[.07] bg-white/[.025]";

const TYPE_ICONS: Record<string, typeof Building> = {
  Cluster: Network, Factory, Unit: Boxes, Department: Users, Section: LayoutGrid, "Buying Office": Building2, Supplier: Truck,
};
export function TypeIcon({ type, size = 15, className = "" }: { type: string; size?: number; className?: string }) {
  const Icon = TYPE_ICONS[type] || Building;
  return <Icon size={size} className={className} aria-hidden />;
}

export function NodeBadge({ node }: { node: OrganizationAiDraftNode }) {
  const [text, tone] = isUnplacedRecord(node) ? ["Your record", "border-sky-400/20 bg-sky-400/10 text-sky-200"]
    : !node.source_edge_id ? ["New", "border-secondary-400/20 bg-secondary-400/10 text-secondary-200"]
      : isChangedRecord(node) ? ["Changed", "border-amber-400/20 bg-amber-400/10 text-amber-200"]
        : ["Existing", "border-white/10 bg-white/[.04] text-gray-400"];
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{text}</span>;
}

export function Source({ origin, reference, existing, placed = true }: { origin?: string; reference?: string; existing?: boolean; placed?: boolean }) {
  if (existing) return <p className="text-xs text-gray-400">{placed ? "Existing organization record" : "Your existing entity record · will be added to the organization tree"}{reference ? ` · also in the document: ${reference}` : ""}</p>;
  if (origin === "manual") return <p className="text-xs text-sky-200">Added or changed by you · not from the document</p>;
  if (origin === "document" && reference) return <p className="text-xs text-gray-400">From the document: <span className="text-gray-300">{reference}</span></p>;
  return <p className="text-xs text-amber-200">Needs review · no clear document reference</p>;
}

export function QuestionSource({ q }: { q: OnboardingQuestion }) {
  const details = q.answer_type || q.node_id;
  return <div className="space-y-1">
    <Source origin={q.origin} reference={q.source_reference} />
    {details && q.details_origin === "manual" && <p className="text-xs text-sky-200">Area, answers or points set by you · not from the document</p>}
    {details && q.details_origin === "document" && <p className="text-xs text-gray-400">Area and answer choices from the document</p>}
    {details && q.details_origin === "default" && <p className="text-xs text-amber-200">Default points applied · check them</p>}
    {details && q.details_origin === "suggested" && <p className="text-xs text-violet-200">Answer type and points suggested by Audito AI · check them</p>}
  </div>;
}

// Answer types as the checklist create page shows them.
const ANSWER_TYPE_STYLE: Record<string, { label: string; icon: typeof AlignLeft; color: string }> = {
  free_text: { label: "Free Text", icon: AlignLeft, color: "text-blue-400" },
  single_option: { label: "Single Option", icon: ToggleLeft, color: "text-green-400" },
  multiple_options: { label: "Multiple Options", icon: CheckSquare, color: "text-purple-400" },
  dropdown: { label: "Drop Down", icon: List, color: "text-orange-400" },
};

// The answer type, then a compact "YES 10 · NO 0" summary of the answers.
export function AnswerChips({ q }: { q: OnboardingQuestion }) {
  const style = ANSWER_TYPE_STYLE[q.answer_type];
  if (!style) return <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">No answer type</span>;
  const Icon = style.icon;
  return <>
    <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[.04] px-2 py-0.5 text-[10px] font-semibold text-gray-200"><Icon size={11} className={style.color} aria-hidden />{style.label}</span>
    {q.answer_type !== "free_text" && q.options.map((option, index) => <span key={index} className="rounded-full border border-white/10 bg-white/[.04] px-2 py-0.5 text-[10px] text-gray-300">{option.option_text || "—"} <b className={option.marks === null ? "text-red-300" : "text-white"}>{option.marks ?? "?"}</b></span>)}
  </>;
}

export function StatTile({ label, value, tone = "default", onClick, active }: { label: string; value: number | string; tone?: "default" | "warn" | "bad" | "good"; onClick?: () => void; active?: boolean }) {
  const tones = { default: "text-white", warn: "text-amber-200", bad: "text-red-200", good: "text-secondary-200" };
  const body = <><span className="block text-[11px] leading-tight text-gray-400">{label}</span><span className={`mt-0.5 block text-lg font-bold tabular-nums sm:text-xl ${tones[tone]}`}>{value}</span></>;
  const className = `min-w-0 rounded-xl border px-2.5 py-2 text-left transition-colors sm:px-3 sm:py-2.5 ${active ? "border-secondary-400/40 bg-secondary-500/10" : "border-white/[.08] bg-white/[.03]"}`;
  return onClick ? <button type="button" onClick={onClick} className={`${className} hover:border-white/20`}>{body}</button> : <div className={className}>{body}</div>;
}

// The one progress indicator on the AI setup screen. Reached steps can be revisited.
export function Stepper({ step, reachable, onSelect }: { step: number; reachable: number; onSelect: (step: number) => void }) {
  return <nav aria-label="AI setup progress">
    <ol className="grid grid-cols-4">
      {STEPS.map((item, index) => {
        const complete = index < step;
        const active = index === step;
        const enabled = index <= reachable && !active;
        return <li key={item.title} className="relative min-w-0">
          {index > 0 && <span aria-hidden className="absolute left-[calc(-50%+20px)] right-[calc(50%+20px)] top-[15px] h-0.5 overflow-hidden rounded-full bg-white/10">
            <motion.span className="absolute inset-0 origin-left bg-primary-400" initial={false} animate={{ scaleX: index <= step ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
          </span>}
          <button type="button" disabled={!enabled} aria-current={active ? "step" : undefined} onClick={() => onSelect(index)}
            aria-label={`Step ${index + 1} of ${STEPS.length}: ${item.title}${complete ? ", done" : ""}`}
            className="group relative flex w-full min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-1 text-center disabled:cursor-default">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-colors ${complete ? "bg-primary-400 text-primary-950 group-enabled:group-hover:bg-primary-300" : active ? "bg-secondary-400 text-primary-950 ring-4 ring-secondary-400/15" : "border border-white/15 bg-surface-dark text-gray-400"}`}>
              {complete ? <Check size={15} strokeWidth={3} aria-hidden /> : index + 1}
            </span>
            <span className={`block max-w-full truncate text-xs sm:text-sm ${active ? "font-semibold text-white" : complete ? "text-gray-300 group-enabled:group-hover:text-white" : "text-gray-500"}`}>
              <span className="sm:hidden">{item.short}</span><span className="hidden sm:inline">{item.title}</span>
            </span>
          </button>
        </li>;
      })}
    </ol>
  </nav>;
}

type ProvenanceKind = "document" | "review" | "manual" | "existing";
const PROVENANCE: Record<ProvenanceKind, { label: string; tone: string; hint: string }> = {
  document: { label: "From document", tone: "border-primary-400/25 bg-primary-400/10 text-primary-200", hint: "Found in your uploaded document." },
  review: { label: "Needs review", tone: "border-amber-400/25 bg-amber-400/10 text-amber-200", hint: "Suggested without a clear place in the document. Check it." },
  manual: { label: "Added by you", tone: "border-sky-400/25 bg-sky-400/10 text-sky-200", hint: "Added or changed by you. Not from the document." },
  existing: { label: "Existing record", tone: "border-white/10 bg-white/[.04] text-gray-300", hint: "Already saved in your organization." },
};

/** Where a suggestion came from, using the same rules as Source. */
export function provenanceOf(origin?: string, reference?: string, existing?: boolean): ProvenanceKind {
  if (existing) return "existing";
  if (origin === "manual") return "manual";
  if (origin === "document" && reference) return "document";
  return "review";
}

export function ProvenanceChip({ kind }: { kind: ProvenanceKind }) {
  const item = PROVENANCE[kind];
  return <span title={item.hint} className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${item.tone}`}>{item.label}</span>;
}

/** Explains the source labels used on organization areas and questions. */
export function SourceLegend({ kinds = ["document", "review", "manual"] }: { kinds?: ProvenanceKind[] }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-white/[.07] bg-white/[.02] px-3 py-2.5 text-xs text-gray-400">
    <span className="font-semibold text-gray-300">Labels:</span>
    {kinds.map(kind => <ProvenanceChip key={kind} kind={kind} />)}
  </div>;
}

/** Marks an item that changed after the latest AI correction. */
export function ChangedBadge() {
  return <span className="shrink-0 rounded-full border border-secondary-300/40 bg-secondary-400/20 px-2 py-0.5 text-[10px] font-semibold text-secondary-100">Updated</span>;
}

export function SectionHeader({ title, description, actions }: { icon?: ReactNode; title: string; description: string; actions?: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div><h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2><p className="mt-1 text-sm text-gray-400">{description}</p></div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>;
}

// Segmented filter with counts, e.g. All 175 · Needs attention 3.
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; count?: number; tone?: "bad" | "warn" }[]; onChange: (value: T) => void; label: string }) {
  return <div role="group" aria-label={label} className="flex max-w-full flex-wrap gap-1 rounded-xl bg-black/[.2] p-1">
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${value === option.value ? "bg-white/[.1] text-white" : "text-gray-400 hover:text-white"}`}>
      {option.label}{option.count !== undefined && <span className={`rounded-full px-1.5 tabular-nums ${option.count && option.tone === "bad" ? "bg-red-400/15 text-red-200" : option.count && option.tone === "warn" ? "bg-amber-400/15 text-amber-200" : "bg-white/[.07] text-gray-300"}`}>{option.count}</span>}
    </button>)}
  </div>;
}

// Side panel on large screens, bottom sheet on phones.
export function Drawer({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [wide, setWide] = useState(true);
  const panel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setMounted(true);
    const query = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  // Callers pass inline handlers; keep the latest one without re-running the
  // focus effect, which would pull focus out of the message box on each render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); previous?.focus?.(); };
  }, [open]);
  if (!mounted) return null;
  const offset = wide ? { x: 32, opacity: 0 } : { y: 48, opacity: 0 };
  return createPortal(<AnimatePresence>
    {open && <div className="fixed inset-0 z-[70]">
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
      <motion.div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} initial={offset} animate={{ x: 0, y: 0, opacity: 1 }} exit={offset} transition={{ duration: 0.22, ease: EASE }}
        className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-surface shadow-2xl outline-none sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[420px] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0"><h2 className="font-semibold text-white">{title}</h2>{description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white/[.06] hover:text-white"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>}
  </AnimatePresence>, document.body);
}