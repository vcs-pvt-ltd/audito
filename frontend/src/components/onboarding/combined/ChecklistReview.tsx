"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { notice } from "../motion";
import { AlertTriangle, Plus, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { OnboardingQuestion, OrganizationAiDraftNode } from "@/lib/api";
import { ANSWER_TYPES, CHOICE_TYPES, ROOT_AREA, areaOfQuestion, lacksAnswers, validMark } from "./model";
import { AreaTree, buildAreaTree, orderedAreas, parentIds, useCollapsed } from "./OrganizationReview";
import { AnswerChips, SectionHeader, inputClass } from "./ui";

export const SUGGEST_ANSWERS_MESSAGE = "Suggest the most suitable answer type, answers and points for every selected question that has no answer type or is missing points. Keep answers and points that are already complete.";

type Item = { q: OnboardingQuestion; index: number };

export default function ChecklistReview({ questions, areas, root, rootName, questionIssues, busy, aiAvailable, onChange, onBulk, onAdd, onAskAi, onReadAgain }: {
  questions: OnboardingQuestion[]; areas: OrganizationAiDraftNode[]; root: string; rootName: string; questionIssues: Map<string, string[]>;
  busy: boolean; aiAvailable: boolean;
  onChange: (id: string, fields: Partial<OnboardingQuestion>) => void;
  onBulk: (ids: Set<string>, fields: Partial<OnboardingQuestion>) => void;
  /** Adds an empty question to an area and returns its id. */
  onAdd: (nodeId: string) => string | null; onAskAi: (message: string) => void;
  /** Reads the questions from the sheet again. */
  onReadAgain: () => void;
}) {
  // Areas open in the accordion, and the question being edited.
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const ordered = useMemo(() => orderedAreas(areas), [areas]);
  const tree = useMemo(() => buildAreaTree(root, rootName, areas), [root, rootName, areas]);
  // Areas whose child areas are hidden (the tree), separate from areas whose questions are open.
  const { collapsed, setCollapsed, toggle: toggleChildren } = useCollapsed();
  const byArea = useMemo(() => {
    const ids = new Set([ROOT_AREA, ...areas.map(n => n.id)]);
    const map = new Map<string, Item[]>();
    questions.forEach((q, index) => { const area = areaOfQuestion(q, ids); map.set(area, [...(map.get(area) || []), { q, index }]); });
    return map;
  }, [questions, areas]);
  const selectedCount = questions.filter(q => q.selected).length;
  const missingAnswers = questions.filter(lacksAnswers).length;
  const issueCount = questionIssues.size;
  const allAreaIds = [ROOT_AREA, ...ordered.map(({ node }) => node.id)];

  const countChip = (id: string) => {
    const items = byArea.get(id) || [];
    const chosen = items.filter(({ q }) => q.selected).length;
    return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${chosen ? "bg-secondary-500/15 text-secondary-200" : "bg-white/[.05] text-gray-500"}`}>{chosen}</span>;
  };
  const hasIssue = (id: string) => (byArea.get(id) || []).some(({ q }) => questionIssues.has(q.id));
  const toggleArea = (id: string) => setOpenAreas(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const add = (nodeId: string) => {
    const id = onAdd(nodeId);
    if (!id) return;
    setOpenAreas(current => new Set(current).add(nodeId));
    setOpenQuestion(id);
  };

  // One area's questions, shown under its row while the area is open.
  const areaPanel = (areaId: string) => {
    const items = byArea.get(areaId) || [];
    return <motion.div key={`${areaId}-panel`} variants={notice} initial="initial" animate="animate" exit="exit" className="overflow-hidden">
      <div className="mb-1 ml-10 mt-1.5 space-y-2 rounded-xl border border-white/[.06] bg-black/[.12] p-2 sm:p-3">
        {items.length > 1 && <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-gray-500">{items.filter(({ q }) => q.selected).length} of {items.length} included</span>
          <span className="flex gap-3">
            <button type="button" disabled={busy} className="text-secondary-300 hover:text-secondary-200" onClick={() => onBulk(new Set(items.map(({ q }) => q.id)), { selected: true })}>Select all</button>
            <button type="button" disabled={busy} className="text-gray-400 hover:text-white" onClick={() => onBulk(new Set(items.map(({ q }) => q.id)), { selected: false })}>Select none</button>
          </span>
        </div>}
        {!items.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-gray-400">No questions here yet.</p>}
        {items.map(({ q, index }) => {
          const issues = questionIssues.get(q.id);
          const expanded = openQuestion === q.id;
          return <article key={q.id} className={`rounded-xl border ${issues ? "border-red-400/30 bg-red-400/[.03]" : q.selected ? "border-white/[.08] bg-white/[.02]" : "border-white/[.05] opacity-60"}`}>
            <div className="flex items-start gap-2 p-2 sm:p-3">
              <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg hover:bg-white/[.04]">
                <input type="checkbox" className="h-[18px] w-[18px] accent-emerald-400" aria-label={`Include question ${index + 1}`} checked={q.selected} disabled={busy} onChange={event => onChange(q.id, { selected: event.target.checked })} />
              </label>
              <button type="button" className="min-w-0 flex-1 py-1.5 text-left" aria-expanded={expanded} onClick={() => setOpenQuestion(expanded ? null : q.id)}>
                <span className="line-clamp-2 break-words text-sm text-white"><span className="mr-1 text-gray-400">{index + 1}.</span>{q.question_text || <i className="text-red-200">New question</i>}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <AnswerChips q={q} />
                  {issues && <span className="flex items-center gap-1 text-[10px] font-semibold text-red-200"><AlertTriangle size={11} />{issues[0]}</span>}
                </span>
              </button>
            </div>
            <AnimatePresence initial={false}>
              {expanded && <motion.div key="editor" variants={notice} initial="initial" animate="animate" exit="exit" className="overflow-hidden">
                <QuestionEditor q={q} busy={busy} onChange={fields => onChange(q.id, fields)} />
              </motion.div>}
            </AnimatePresence>
          </article>;
        })}
        <button type="button" disabled={busy} onClick={() => add(areaId)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-secondary-500/15 py-2 text-xs text-secondary-400/70 transition-all hover:border-secondary-500/30 hover:bg-secondary-500/5 hover:text-secondary-300 disabled:opacity-40">
          <Plus size={12} /> Add question
        </button>
      </div>
    </motion.div>;
  };

  return <section className="space-y-4">
    <SectionHeader title="Check your questions" description={`${selectedCount} questions. Tap an area to see its questions. Use the arrows to show or hide the areas below.`}
      actions={<>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(parentIds(tree)))}>{collapsed.size ? "Expand all" : "Collapse all"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpenAreas(openAreas.size ? new Set() : new Set(allAreaIds))}>{openAreas.size ? "Close questions" : "Open questions"}</Button>
        <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} disabled={busy || !aiAvailable} title={aiAvailable ? undefined : "Upload your sheet again to read it"} onClick={onReadAgain}>Read again</Button>
      </>} />

    {missingAnswers > 0 && <div className="flex flex-col gap-3 rounded-2xl bg-violet-500/[.09] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2.5 text-sm text-violet-100"><Wand2 size={16} className="mt-0.5 shrink-0" />{missingAnswers} question{missingAnswers === 1 ? " needs" : "s need"} answers and points.</p>
      <Button size="sm" leftIcon={<Sparkles size={14} />} disabled={busy || !aiAvailable} title={aiAvailable ? undefined : "Upload your sheet again to use AI"} onClick={() => onAskAi(SUGGEST_ANSWERS_MESSAGE)}>Let AI suggest them</Button>
    </div>}
    {issueCount > 0 && <p role="status" className="flex items-center gap-2 text-sm font-semibold text-red-200"><AlertTriangle size={15} aria-hidden />Fix {issueCount} question{issueCount === 1 ? "" : "s"} in the areas marked in red.</p>}

    <ul className="space-y-1">
      <AreaTree node={tree} collapsed={collapsed} onToggle={toggleChildren} onSelect={toggleArea}
        issueOf={hasIssue} trailingOf={countChip} openOf={id => openAreas.has(id)}
        panelOf={id => <AnimatePresence initial={false}>{openAreas.has(id) && areaPanel(id)}</AnimatePresence>} />
    </ul>
    {!questions.length && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">No questions found. Open an area to add one.</p>}
  </section>;
}

function QuestionEditor({ q, busy, onChange }: { q: OnboardingQuestion; busy: boolean; onChange: (fields: Partial<OnboardingQuestion>) => void }) {
  const total = q.options.reduce((sum, o) => sum + (validMark(o.marks) ? o.marks as number : 0), 0);
  return <div className="space-y-3 border-t border-white/[.07] p-3 sm:p-4">
    <label className="block text-xs text-gray-400">Question<textarea className={`${inputClass} mt-1`} rows={3} value={q.question_text} disabled={busy} onChange={event => onChange({ question_text: event.target.value })} /></label>
    <label className="block text-xs text-gray-400">Answer type<select className={`${inputClass} mt-1`} disabled={busy} value={q.answer_type} onChange={event => onChange({ answer_type: event.target.value, options: event.target.value === "free_text" ? [] : q.options.length ? q.options : [{ option_text: "Yes", marks: 10 }, { option_text: "No", marks: 0 }] })}>
      <option value="" disabled>Choose answer type</option>{ANSWER_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {CHOICE_TYPES.has(q.answer_type) && <div className="space-y-2 rounded-xl border border-white/[.07] bg-black/[.12] p-3">
      <div className="flex items-center justify-between text-xs"><span className="text-gray-400">Answers and points</span><span className={`font-semibold tabular-nums ${Math.abs(total - 10) <= 0.01 ? "text-secondary-200" : "text-amber-200"}`}>{Math.round(total * 100) / 100} / 10</span></div>
      {q.options.map((option, oi) => <div className="flex gap-2" key={oi}>
        <input aria-label={`Answer ${oi + 1}`} className={inputClass} disabled={busy} value={option.option_text} onChange={event => onChange({ options: q.options.map((o, i) => i === oi ? { ...o, option_text: event.target.value } : o) })} />
        <input aria-label={`Points for answer ${oi + 1}`} className={`${inputClass} !w-24`} type="number" min={0} max={10} step={0.01} placeholder="Points" disabled={busy} value={option.marks ?? ""} onChange={event => onChange({ options: q.options.map((o, i) => i === oi ? { ...o, marks: event.target.value === "" ? null : Number(event.target.value) } : o) })} />
        <button type="button" aria-label={`Remove answer ${oi + 1}`} disabled={busy} onClick={() => onChange({ options: q.options.filter((_, i) => i !== oi) })} className="px-1 text-gray-500 hover:text-red-300"><Trash2 size={16} /></button>
      </div>)}
      <button type="button" disabled={busy || q.options.length >= 5} className="text-sm font-semibold text-secondary-300 disabled:opacity-40" onClick={() => onChange({ options: [...q.options, { option_text: "", marks: null }] })}>+ Add answer</button>
    </div>}
  </div>;
}


