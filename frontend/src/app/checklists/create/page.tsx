"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { checklistApi, orgTreeApi, type QuestionPayload, type QuestionOption } from "@/lib/api";

import {
  ChevronLeft,
  Save,
  Plus,
  Trash2,
  Upload,
  Download,
  ChevronDown,
  ChevronRight,
  Info,
  FileText,
  ToggleLeft,
  CheckSquare,
  List,
  AlignLeft,
  X,
  Check,
  Building2,
  AlertCircle,
  Loader2,
  ClipboardList,
  Sparkles,
  TableProperties,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface ChecklistType {
  id: number;
  name: string;
}

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: number;
  children: TreeNode[];
  [key: string]: unknown;
}

interface QuestionForm {
  id: string;
  entity_code: string;
  org_tree_id: number | null;
  entity_type: string;
  entity_name: string;
  question_text: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  options: { text: string; marks: string }[];
}

interface ChecklistFormData {
  name: string;
  description: string;
  media_path: string;
  checklist_type_id: string;
  time_period_value: string;
  time_period_unit: string;
  repeat_duration_value: string;
  repeat_duration_unit: string;
  budget: string;
  currency: string;
  num_workers: string;
}

// ─── Constants ───────────────────────────────────────────────────

const DURATION_UNITS = ["days", "weeks", "months", "years"];

const ENTITY_TYPE_COLORS: Record<string, string> = {
  "Customer": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Buying Office": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Supplier": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Company": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Cluster": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Factory": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Unit": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Department": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Section": "bg-green-500/20 text-green-300 border-green-500/30",
  "Audit Firm": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Audit Firm Company": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Branch": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Audit Firm Department": "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
};

const ANSWER_TYPE_META = {
  free_text: { label: "Free Text", icon: AlignLeft, color: "text-blue-400", desc: "Open-ended text answer" },
  single_option: { label: "Single Option", icon: ToggleLeft, color: "text-green-400", desc: "Select one option" },
  multiple_options: { label: "Multiple Options", icon: CheckSquare, color: "text-purple-400", desc: "Select multiple options" },
  dropdown: { label: "Drop Down", icon: List, color: "text-orange-400", desc: "Select one from a list" },
};

let localIdCounter = 1;
const newLocalId = () => `local-${localIdCounter++}`;

// ─── Utility ─────────────────────────────────────────────────────

function flattenTree(node: TreeNode, result: TreeNode[] = []): TreeNode[] {
  result.push(node);
  for (const child of node.children || []) flattenTree(child, result);
  return result;
}

function nodeKey(code: string, edgeId?: number | null): string {
  return `${code}__${edgeId ?? "null"}`;
}

function questionKey(q: Pick<QuestionForm, "entity_code" | "org_tree_id">): string {
  return `${q.entity_code}__${q.org_tree_id ?? "null"}`;
}

function questionMatchesNode(q: QuestionForm, node: TreeNode): boolean {
  return q.entity_code === node.code && (q.org_tree_id ?? null) === (node.edge_id ?? null);
}

function validateQuestions(questions: QuestionForm[]): string | null {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question_text.trim()) return `Question ${i + 1}: Question text is required.`;
    if (!q.entity_code) return `Question ${i + 1}: Entity is required.`;
    if (q.answer_type !== "free_text") {
      if (q.options.length < 2) return `Question ${i + 1}: At least 2 options are required.`;
      const total = q.options.reduce((s, o) => s + (parseFloat(o.marks) || 0), 0);
      if (Math.abs(total - 10) > 0.01)
        return `Question ${i + 1}: Option marks must sum to 10 (currently ${total.toFixed(2)}).`;
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].text.trim())
          return `Question ${i + 1}, Option ${j + 1}: Option text is required.`;
      }
    }
  }
  return null;
}

// ─── Step Indicator ───────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = [
    { name: "Basic Info", icon: FileText },
    { name: "Settings", icon: ToggleLeft },
    { name: "Questions", icon: CheckSquare },
  ];
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8 py-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isActive = i + 1 === current;
        const isCompleted = i + 1 < current;
        return (
          <div key={i} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-1.5 min-w-[60px] sm:min-w-[80px]">
              <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                isActive ? "bg-secondary-500 text-primary-950 shadow-lg shadow-secondary-500/20 scale-110"
                  : isCompleted ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/5 text-gray-500 border border-white/10"
              }`}>
                {isCompleted ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
              </div>
              <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                isActive ? "text-secondary-400" : isCompleted ? "text-emerald-400/80" : "text-gray-600"
              }`}>{s.name}</span>
            </div>
            {i < total - 1 && (
              <div className="w-6 sm:w-12 h-[2px] bg-white/5 rounded-full mb-5">
                <div className="h-full bg-secondary-500 transition-all duration-500 ease-out" style={{ width: isCompleted ? "100%" : "0%" }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function SectionHeader({ num, label, desc, onboarding }: { num: number; label: string; desc: string; onboarding?: boolean }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center text-secondary-400 text-xs sm:text-sm font-bold shrink-0 shadow-inner">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">{label}</h2>
          {onboarding && (
            <span className="px-2 py-0.5 rounded-full bg-secondary-500/10 border border-secondary-500/20 text-[10px] font-bold text-secondary-400 uppercase tracking-widest">
              Setup Step
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-sm text-gray-400 mb-1.5">
      {label} {required && <span className="text-red-400">*</span>}
    </label>
  );
}

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all";

// ─── Question Card (compact) ──────────────────────────────────────

function QuestionCard({
  question, index, entities, onChange, onDelete,
}: {
  question: QuestionForm;
  index: number;
  entities: TreeNode[];
  onChange: (updated: QuestionForm) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(!question.question_text);
  const meta = ANSWER_TYPE_META[question.answer_type];
  const Icon = meta.icon;

  const setField = (field: keyof QuestionForm, value: unknown) =>
    onChange({ ...question, [field]: value });

  const addOption = () =>
    onChange({ ...question, options: [...question.options, { text: "", marks: "" }] });

  const removeOption = (i: number) =>
    onChange({ ...question, options: question.options.filter((_, idx) => idx !== i) });

  const setOption = (i: number, field: "text" | "marks", value: string) => {
    const opts = [...question.options];
    opts[i] = { ...opts[i], [field]: value };
    onChange({ ...question, options: opts });
  };

  const totalMarks = question.options.reduce((s, o) => s + (parseFloat(o.marks) || 0), 0);
  const marksOk = Math.abs(totalMarks - 10) < 0.01;
  const showOptions = question.answer_type !== "free_text";

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${
      question.question_text ? "border-white/[0.08] bg-white/[0.015]" : "border-secondary-500/20 bg-secondary-500/5"
    }`}>
      {/* Compact header — always visible */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="w-5 h-5 rounded-full bg-secondary-500/15 border border-secondary-500/20 flex items-center justify-center text-secondary-400 text-[10px] font-bold shrink-0">
          {index + 1}
        </span>

        {/* Inline answer type selector */}
        <select
          value={question.answer_type}
          onChange={e => {
            const newType = e.target.value as QuestionForm["answer_type"];
            const defaultOpts =
              newType === "free_text" ? []
                : newType === "single_option" ? [{ text: "Yes", marks: "7" }, { text: "No", marks: "3" }]
                : [{ text: "", marks: "" }, { text: "", marks: "" }];
            onChange({ ...question, answer_type: newType, options: defaultOpts });
          }}
          className={`text-[11px] font-medium bg-transparent border-none focus:outline-none cursor-pointer shrink-0 ${meta.color}`}
          onClick={e => e.stopPropagation()}
        >
          {Object.entries(ANSWER_TYPE_META).map(([val, m]) => (
            <option key={val} value={val} className="bg-[#0c2218] text-white text-xs">{m.label}</option>
          ))}
        </select>

        {/* Question preview or placeholder */}
        <span
          className={`flex-1 text-xs truncate cursor-pointer ${question.question_text ? "text-gray-300" : "text-gray-600 italic"}`}
          onClick={() => setExpanded(p => !p)}
        >
          {question.question_text || "Click to write question…"}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {question.question_text && !expanded && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${marksOk || !showOptions ? "text-emerald-400" : "text-amber-400"}`}>
              {showOptions ? `${totalMarks}/10` : "✓"}
            </span>
          )}
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
          >
            <ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
            title="Remove"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Expanded edit area */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/[0.06]">
          <div className="pt-2.5">
            <textarea
              value={question.question_text}
              onChange={e => setField("question_text", e.target.value)}
              rows={2}
              placeholder="Enter your question..."
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all resize-none"
            />
          </div>

          {showOptions && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-500 font-medium">Options & Marks</span>
                <span className={`text-[11px] font-semibold ${marksOk ? "text-emerald-400" : "text-amber-400"}`}>
                  {totalMarks.toFixed(1)} / 10 {marksOk && "✓"}
                </span>
              </div>
              <div className="space-y-1.5">
                {question.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <span className="w-4 text-[10px] text-gray-600 text-center shrink-0">{oi + 1}</span>
                    <input
                      value={opt.text}
                      onChange={e => setOption(oi, "text", e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-secondary-500/50 transition-all"
                    />
                    <input
                      type="number"
                      min="0" max="10" step="0.5"
                      value={opt.marks}
                      onChange={e => setOption(oi, "marks", e.target.value)}
                      placeholder="0"
                      className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-secondary-500/50 transition-all"
                    />
                    <span className="text-[10px] text-gray-600 shrink-0">pts</span>
                    {question.options.length > 2 && (
                      <button onClick={() => removeOption(oi)} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors shrink-0">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {question.options.length < 5 && (
                <button onClick={addOption} className="mt-1.5 flex items-center gap-1 text-[11px] text-secondary-400 hover:text-secondary-300 transition-colors">
                  <Plus size={11} /> Add option
                </button>
              )}
              {!marksOk && question.options.some(o => o.marks) && (
                <p className="mt-1 text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertCircle size={10} /> Marks must add up to exactly 10.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tree Helpers ─────────────────────────────────────────────────

function countDescendantQuestions(node: TreeNode, questions: QuestionForm[]): number {
  const own = questions.filter(q => questionMatchesNode(q, node)).length;
  return own + (node.children ?? []).reduce((s, c) => s + countDescendantQuestions(c, questions), 0);
}

// ─── Tree Entity Node ─────────────────────────────────────────────

function TreeEntityNode({
  node, questions, allEntities, onAddQuestion, onChangeQuestion, onDeleteQuestion,
  excludedEntities, onExclude, showOnlyWithQuestions, isRoot = false,
}: {
  node: TreeNode;
  questions: QuestionForm[];
  allEntities: TreeNode[];
  onAddQuestion: (code: string, orgTreeId: number | null, type: string, name: string) => void;
  onChangeQuestion: (id: string, updated: QuestionForm) => void;
  onDeleteQuestion: (id: string) => void;
  excludedEntities: Set<string>;
  onExclude: (code: string) => void;
  showOnlyWithQuestions: boolean;
  isRoot?: boolean;
}) {
  const ownQs = questions.filter(q => questionMatchesNode(q, node));
  const totalQs = countDescendantQuestions(node, questions);
  const [expanded, setExpanded] = useState(totalQs > 0);
  const typeColor = ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";

  // Filter children: exclude hidden ones; if showOnlyWithQuestions, skip empty subtrees
  const visibleChildren = (node.children ?? []).filter(child => {
    if (excludedEntities.has(nodeKey(child.code, child.edge_id ?? null))) return false;
    if (showOnlyWithQuestions && countDescendantQuestions(child, questions) === 0) return false;
    return true;
  });

  // If showOnlyWithQuestions and this node has no questions and no visible children, hide it (unless root)
  if (!isRoot && showOnlyWithQuestions && totalQs === 0 && visibleChildren.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1 group">
        <button
          onClick={() => setExpanded(p => !p)}
          className="flex-1 flex items-center gap-2 py-2 px-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
        >
          {expanded ? <ChevronDown size={12} className="text-gray-500 shrink-0" /> : <ChevronRight size={12} className="text-gray-500 shrink-0" />}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeColor} shrink-0 leading-none`}>
            {node.entity_type}
          </span>
          <span className="text-sm font-medium text-white flex-1 truncate">{node.name}</span>
          {totalQs > 0 && (
            <span className="text-[11px] text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-1.5 py-0.5 rounded-full shrink-0">
              {totalQs}Q
            </span>
          )}
          {totalQs === 0 && (
            <span className="text-[10px] text-gray-600 shrink-0">no questions</span>
          )}
        </button>
        {/* Hide button — only on sub-entities (not root) */}
        {!isRoot && (
          <button
            onClick={e => { e.stopPropagation(); onExclude(nodeKey(node.code, node.edge_id ?? null)); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-700 hover:text-red-400 transition-all shrink-0"
            title={`Hide ${node.name}`}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="ml-4 border-l border-white/[0.07] pl-2.5 mt-0.5 space-y-1 pb-1">
          {ownQs.length > 0 && (
            <div className="py-1 space-y-1.5">
              {ownQs.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={idx}
                  entities={allEntities}
                  onChange={updated => onChangeQuestion(q.id, updated)}
                  onDelete={() => onDeleteQuestion(q.id)}
                />
              ))}
            </div>
          )}

          <button
            onClick={e => { e.stopPropagation(); onAddQuestion(node.code, node.edge_id ?? null, node.entity_type, node.name); }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-secondary-400/50 hover:text-secondary-400 border border-dashed border-secondary-500/10 hover:border-secondary-500/25 rounded-lg transition-all hover:bg-secondary-500/5"
          >
            <Plus size={11} /> Add question for {node.name}
          </button>

          {visibleChildren.map(child => (
            <TreeEntityNode
              key={nodeKey(child.code, child.edge_id ?? null)}
              node={child}
              questions={questions}
              allEntities={allEntities}
              onAddQuestion={onAddQuestion}
              onChangeQuestion={onChangeQuestion}
              onDeleteQuestion={onDeleteQuestion}
              excludedEntities={excludedEntities}
              onExclude={onExclude}
              showOnlyWithQuestions={showOnlyWithQuestions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Question Modal ───────────────────────────────────────────

function AddQuestionModal({ open, entities, onClose, onAdd }: {
  open: boolean;
  entities: TreeNode[];
  onClose: () => void;
  onAdd: (entityCode: string, entityType: string, entityName: string) => void;
}) {
  const [selected, setSelected] = useState("");
  useEffect(() => { if (open) setSelected(""); }, [open]);
  if (!open) return null;
  const node = entities.find(e => e.code === selected);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-white font-semibold">Choose Entity</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-400">Select the entity to add questions for:</p>
          <select value={selected} onChange={e => setSelected(e.target.value)} className={inputCls}>
            <option value="" className="bg-[#0c2218] text-white">Select entity...</option>
            {entities.map(n => (
              <option key={n.code} value={n.code} className="bg-[#0c2218] text-white">[{n.entity_type}] {n.name}</option>
            ))}
          </select>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">Cancel</button>
            <button
              disabled={!selected}
              onClick={() => { if (node) { onAdd(node.code, node.entity_type, node.name); onClose(); } }}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50"
            >
              Add Questions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Excel Confirm Modal ─────────────────────────────────────────

function ExcelConfirmModal({ open, questions, uploadResult, treeRoot, onConfirm, onDiscard }: {
  open: boolean;
  questions: QuestionForm[];
  uploadResult: { created_count: number; errors: string[] } | null;
  treeRoot: TreeNode | null;
  onConfirm: (qs: QuestionForm[]) => void;
  onDiscard: () => void;
}) {
  if (!open) return null;
  const entityCodesWithQs = new Set(questions.map(q => questionKey(q)));
  const prunedRoot = treeRoot ? pruneTreeByEntityCodes(treeRoot, entityCodesWithQs) : null;
  const totalEntityCount = prunedRoot ? countPrunedEntities(prunedRoot) : entityCodesWithQs.size;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] glass">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary-500/20 border border-secondary-500/30 flex items-center justify-center">
              <FileText size={17} className="text-secondary-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Confirm Excel Import</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {questions.length} question{questions.length !== 1 ? "s" : ""} across {totalEntityCount} entit{totalEntityCount !== 1 ? "ies" : "y"}
                {uploadResult?.errors?.length ? ` · ${uploadResult.errors.length} row(s) skipped` : ""}
              </p>
            </div>
          </div>
          <button onClick={onDiscard} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>

        {uploadResult?.errors?.length ? (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs font-medium text-amber-400 mb-1.5">Skipped rows:</p>
            <ul className="space-y-0.5 max-h-20 overflow-y-auto">
              {uploadResult.errors.map((e, i) => <li key={i} className="text-[11px] text-amber-300/80">• {e}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {prunedRoot ? (
            ENTITY_TYPE_COLORS[prunedRoot.entity_type]
              ? <ExcelTreeEntityNode node={prunedRoot} questions={questions} />
              : (prunedRoot.children ?? []).map(child => <ExcelTreeEntityNode key={child.code} node={child} questions={questions} />)
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
              <p className="text-white font-medium mb-1">No hierarchy available</p>
              <p className="text-gray-500 text-sm">Upload succeeded but org tree is not available to preview.</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.08] flex items-center gap-3 justify-between shrink-0">
          <button onClick={onDiscard} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
            Discard
          </button>
          <button
            onClick={() => onConfirm(questions)}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
          >
            <Check size={14} />
            Add {questions.length} Question{questions.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function pruneTreeByEntityCodes(node: TreeNode, entityCodes: Set<string>): TreeNode | null {
  const prunedChildren: TreeNode[] = [];
  for (const child of node.children || []) {
    const pruned = pruneTreeByEntityCodes(child, entityCodes);
    if (pruned) prunedChildren.push(pruned);
  }
  if (entityCodes.has(nodeKey(node.code, node.edge_id ?? null)) || entityCodes.has(node.code) || prunedChildren.length > 0)
    return { ...node, children: prunedChildren };
  return null;
}

function countPrunedEntities(node: TreeNode): number {
  return 1 + (node.children ?? []).reduce((s, c) => s + countPrunedEntities(c), 0);
}

function ExcelTreeEntityNode({ node, questions }: { node: TreeNode; questions: QuestionForm[] }) {
  const ownQs = questions.filter(q => questionMatchesNode(q, node));
  const totalQs = countDescendantQuestions(node, questions);
  const [expanded, setExpanded] = useState(totalQs > 0);
  const typeColor = ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";

  return (
    <div>
      <button onClick={() => setExpanded(p => !p)} className="w-full flex items-center gap-2 py-2 px-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left">
        {expanded ? <ChevronDown size={13} className="text-gray-500 shrink-0" /> : <ChevronRight size={13} className="text-gray-500 shrink-0" />}
        <div className="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Building2 size={11} className="text-gray-400" />
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeColor} shrink-0 leading-none`}>{node.entity_type}</span>
        <span className="text-sm font-medium text-white flex-1 truncate">{node.name}</span>
        {totalQs > 0 && <span className="text-[11px] text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-1.5 py-0.5 rounded-full shrink-0">{totalQs}Q</span>}
      </button>
      {expanded && (
        <div className="ml-[18px] border-l border-white/[0.08] pl-3 mt-0.5 space-y-0.5 pb-1">
          {ownQs.length > 0 && (
            <div className="py-1.5 space-y-1.5">
              {ownQs.map((q, i) => {
                const meta = ANSWER_TYPE_META[q.answer_type];
                const Icon = meta.icon;
                return (
                  <div key={q.id} className="flex items-start gap-2 py-1.5 px-2.5 rounded-lg bg-white/[0.015] border border-white/[0.05]">
                    <span className="w-4 h-4 rounded-full bg-secondary-500/15 border border-secondary-500/20 flex items-center justify-center text-secondary-400 text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-200 leading-snug">{q.question_text}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1 py-0.5 rounded bg-white/5 border border-white/10 ${meta.color}`}>
                          <Icon size={9} />{meta.label}
                        </span>
                        {q.options.length > 0 && <span className="text-[10px] text-gray-500">{q.options.map(o => o.text).join(" · ")}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(node.children ?? []).map(child => (
            <ExcelTreeEntityNode key={nodeKey(child.code, child.edge_id ?? null)} node={child} questions={questions} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function CreateChecklistPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id") as string | undefined;
  const isEdit = !!editId;

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ChecklistFormData>({
    name: "", description: "", media_path: "",
    checklist_type_id: "", time_period_value: "", time_period_unit: "",
    repeat_duration_value: "", repeat_duration_unit: "",
    budget: "", currency: "$", num_workers: "",
  });
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [excludedEntities, setExcludedEntities] = useState<Set<string>>(new Set());
  const [showOnlyWithQuestions, setShowOnlyWithQuestions] = useState(false);
  const [checklistTypes, setChecklistTypes] = useState<ChecklistType[]>([]);
  const [treeEntities, setTreeEntities] = useState<TreeNode[]>([]);
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [currencies, setCurrencies] = useState<string[]>(["$", "€", "£", "¥", "₹", "AED", "SAR"]);

  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then(res => res.json())
      .then(data => {
        if (data?.rates) {
          const codes = Object.keys(data.rates).sort();
          setCurrencies(() => {
            const symbols = ["$", "€", "£", "¥", "₹"];
            const filteredCodes = codes.filter(c => !["USD","EUR","GBP","JPY","INR"].includes(c));
            return [...symbols, ...filteredCodes];
          });
        }
      })
      .catch(() => {});
  }, []);

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDesc, setNewTypeDesc] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ created_count: number; errors: string[] } | null>(null);
  const [uploadedQuestions, setUploadedQuestions] = useState<QuestionForm[]>([]);
  const [showUploadConfirmModal, setShowUploadConfirmModal] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaFileName, setMediaFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  useEffect(() => {
    const load = async () => {
      if (!accessToken) return;
      setLoadingData(true);

      const [typesRes, treeRes] = await Promise.all([
        checklistApi.listTypes(accessToken),
        orgTreeApi.getTree(accessToken),
      ]);

      if (typesRes.success && typesRes.data) {
        const d = typesRes.data as { types: ChecklistType[] };
        setChecklistTypes(d.types || []);
      }

      if (treeRes.success && treeRes.data) {
        const d = treeRes.data as { tree: TreeNode };
        if (d.tree) {
          setTreeEntities(flattenTree(d.tree));
          setTreeRoot(d.tree);
        }
      }

      if (isEdit && editId) {
        const clRes = await checklistApi.get(accessToken, editId);
        if (clRes.success && clRes.data) {
          const cl = (clRes.data as { checklist: Record<string, unknown> }).checklist;
          setFormData({
            name: String(cl.name || ""),
            description: String(cl.description || ""),
            media_path: String(cl.media_path || ""),
            checklist_type_id: cl.checklist_type_id != null ? String(cl.checklist_type_id) : "",
            time_period_value: cl.time_period_value != null ? String(cl.time_period_value) : "",
            time_period_unit: String(cl.time_period_unit || ""),
            repeat_duration_value: cl.repeat_duration_value != null ? String(cl.repeat_duration_value) : "",
            repeat_duration_unit: String(cl.repeat_duration_unit || ""),
            budget: cl.budget != null ? String(cl.budget) : "",
            currency: String(cl.currency || "$"),
            num_workers: cl.num_workers != null ? String(cl.num_workers) : "",
          });
          if (cl.media_path) {
            const parts = String(cl.media_path).split("/");
            setMediaFileName(parts[parts.length - 1]);
          }
          const flatForLookup = treeRes.success && treeRes.data
            ? flattenTree((treeRes.data as { tree: TreeNode }).tree)
            : [];
          const entityGroups = (cl.entity_questions as Array<{
            entity_code: string; org_tree_id?: number | null; entity_type: string; entity_name: string;
            questions: Array<{ id: number; question_text: string; answer_type: string; options: Array<{ option_text: string; marks: number }> }>;
          }>) || [];
          const loadedQs: QuestionForm[] = [];
          for (const eg of entityGroups) {
            const egTreeId = (eg.org_tree_id ?? null) as number | null;
            const entityDisplayName = flatForLookup.find(n => nodeKey(n.code, n.edge_id ?? null) === nodeKey(eg.entity_code, egTreeId))?.name || eg.entity_code;
            for (const q of eg.questions) {
              loadedQs.push({
                id: `db-${q.id}`,
                entity_code: eg.entity_code,
                org_tree_id: egTreeId,
                entity_type: eg.entity_type,
                entity_name: entityDisplayName,
                question_text: q.question_text,
                answer_type: q.answer_type as QuestionForm["answer_type"],
                options: (q.options || []).map(o => ({ text: o.option_text, marks: String(o.marks) })),
              });
            }
          }
          setQuestions(loadedQs);
          // Show only entities with questions by default when editing
          if (loadedQs.length > 0) setShowOnlyWithQuestions(true);
        }
      }
      setLoadingData(false);
    };
    load();
  }, [accessToken, isEdit, editId]);

  const setForm = (field: keyof ChecklistFormData, value: string) =>
    setFormData(p => ({ ...p, [field]: value }));

  const addQuestion = (entityCode: string, orgTreeId: number | null, entityType: string, entityName: string) => {
    setQuestions(prev => [...prev, { id: newLocalId(), entity_code: entityCode, org_tree_id: orgTreeId, entity_type: entityType, entity_name: entityName, question_text: "", answer_type: "free_text", options: [] }]);
  };
  const updateQuestion = (id: string, updated: QuestionForm) =>
    setQuestions(prev => prev.map(q => q.id === id ? updated : q));
  const deleteQuestion = (id: string) =>
    setQuestions(prev => prev.filter(q => q.id !== id));

  const handleCreateType = async () => {
    if (!newTypeName.trim() || !accessToken) return;
    setCreatingType(true);
    setSaveError("");
    try {
      const res = await checklistApi.createType(accessToken, { name: newTypeName, description: newTypeDesc });
      if (res.success && res.data) {
        const d = res.data as { type: ChecklistType };
        setChecklistTypes(prev => [...prev, d.type]);
        setForm("checklist_type_id", String(d.type.id));
        setShowTypeModal(false);
        setNewTypeName(""); setNewTypeDesc("");
      } else {
        setSaveError(res.message || "Failed to create checklist type.");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create checklist type.");
    } finally {
      setCreatingType(false);
    }
  };

  const buildChecklistPayload = () => ({
    name: formData.name.trim(),
    description: formData.description.trim() || undefined,
    media_path: formData.media_path || undefined,
    checklist_type_id: formData.checklist_type_id ? parseInt(formData.checklist_type_id, 10) : undefined,
    time_period_value: formData.time_period_value ? parseInt(formData.time_period_value, 10) : undefined,
    time_period_unit: formData.time_period_unit || undefined,
    repeat_duration_value: formData.repeat_duration_value ? parseInt(formData.repeat_duration_value, 10) : undefined,
    repeat_duration_unit: formData.repeat_duration_unit || undefined,
    budget: formData.budget ? parseFloat(formData.budget) : undefined,
    currency: formData.currency || "$",
    num_workers: formData.num_workers ? parseInt(formData.num_workers, 10) : undefined,
  });

  const handleSave = async () => {
    if (!accessToken) return;
    if (!formData.name.trim()) { setSaveError("Checklist name is required."); return; }
    if (!formData.description.trim()) { setSaveError("Description is required."); return; }
    if (!formData.checklist_type_id) { setSaveError("Checklist type is required."); return; }
    if (!formData.time_period_value) { setSaveError("Time period is required."); return; }
    if (!formData.time_period_unit) { setSaveError("Time period unit is required."); return; }
    if (!formData.repeat_duration_value) { setSaveError("Repeat duration is required."); return; }
    if (!formData.repeat_duration_unit) { setSaveError("Repeat duration unit is required."); return; }
    if (questions.length === 0) { setSaveError("At least one question is required."); return; }
    const qError = validateQuestions(questions);
    if (qError) { setSaveError(qError); return; }

    setSaving(true); setSaveError("");
    try {
      let checklistId = editId;
      const payload = buildChecklistPayload();
      if (isEdit && checklistId) {
        const res = await checklistApi.update(accessToken, checklistId, payload);
        if (!res.success) throw new Error(res.message || "Failed to update.");
        const newQs = questions.filter(q => q.id.startsWith("local-"));
        if (newQs.length > 0) {
          const qPayloads: QuestionPayload[] = newQs.map(q => ({
            entity_code: q.entity_code, org_tree_id: q.org_tree_id, entity_type: q.entity_type, entity_name: q.entity_name,
            question_text: q.question_text, answer_type: q.answer_type,
            options: q.answer_type !== "free_text" ? q.options.map(o => ({ option_text: o.text, marks: parseFloat(o.marks) || 0 })) : undefined,
          }));
          await checklistApi.addQuestions(accessToken, checklistId, qPayloads);
        }
      } else {
        const res = await checklistApi.create(accessToken, payload);
        if (!res.success) throw new Error(res.message || "Failed to create.");
        const created = (res.data as { checklist: { id: number } }).checklist;
        checklistId = String(created.id);
        if (questions.length > 0 && checklistId) {
          const qPayloads: QuestionPayload[] = questions.map(q => ({
            entity_code: q.entity_code, org_tree_id: q.org_tree_id, entity_type: q.entity_type, entity_name: q.entity_name,
            question_text: q.question_text, answer_type: q.answer_type,
            options: q.answer_type !== "free_text" ? q.options.map(o => ({ option_text: o.text, marks: parseFloat(o.marks) || 0 })) : ([] as QuestionOption[]),
          }));
          await checklistApi.addQuestions(accessToken, checklistId, qPayloads);
        }
      }
      const isOnboarding = new URLSearchParams(window.location.search).get("onboarding") === "1";
      router.push(isOnboarding ? "/audits?onboarding=1" : "/checklists");
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save checklist.");
    } finally {
      setSaving(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    try {
      setUploadingExcel(true); setUploadResult(null); setSaveError("");
      const res = await checklistApi.previewQuestionsExcel(accessToken, file);
      if (!res.success) {
        const detailErrors = Array.isArray((res as { errors?: unknown }).errors) ? ((res as { errors: string[] }).errors) : [];
        setUploadResult({ created_count: 0, errors: detailErrors });
        throw new Error(res.message || "Failed to preview Excel.");
      }
      const payload = res.data as {
        created_count: number; errors: string[]; items: Array<{
          entity_code: string; org_tree_id?: number | null; entity_type: string; entity_name: string;
          question_text: string; answer_type: QuestionForm["answer_type"]; options: Array<{ option_text: string; marks: number }>;
        }>
      } | null;
      setUploadResult(payload ? { created_count: payload.created_count, errors: payload.errors || [] } : null);

      let effectiveTreeRoot = treeRoot;
      let effectiveTreeEntities = treeEntities;
      if (!effectiveTreeRoot) {
        const treeRes = await orgTreeApi.getTree(accessToken);
        if (treeRes.success && treeRes.data) {
          const d = treeRes.data as { tree: TreeNode };
          if (d.tree) {
            effectiveTreeRoot = d.tree;
            effectiveTreeEntities = flattenTree(d.tree);
            setTreeEntities(effectiveTreeEntities);
            setTreeRoot(effectiveTreeRoot);
          }
        }
      }
      const loadedQs: QuestionForm[] = [];
      for (const it of payload?.items || []) {
        const matchingNodes = effectiveTreeEntities.filter(n => n.code === it.entity_code);
        const entityDisplayName = matchingNodes[0]?.name || it.entity_name || it.entity_code;
        loadedQs.push({
          id: newLocalId(), entity_code: it.entity_code, org_tree_id: it.org_tree_id ?? null,
          entity_type: it.entity_type, entity_name: entityDisplayName, question_text: it.question_text,
          answer_type: it.answer_type, options: (it.options || []).map(o => ({ text: o.option_text, marks: String(o.marks) })),
        });
      }
      setUploadedQuestions(loadedQs);
      setShowUploadConfirmModal(true);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to preview questions from Excel.");
    } finally {
      setUploadingExcel(false);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading || loadingData) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center pt-14 lg:pt-0">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="min-h-full bg-transparent flex flex-col relative w-full">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <button
            onClick={() => {
              const isOnboarding = new URLSearchParams(window.location.search).get("onboarding") === "1";
              router.push(`/checklists${isOnboarding ? "?onboarding=1" : ""}`);
            }}
            className="p-2 sm:p-3 rounded-xl sm:rounded-2xl text-gray-400 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ClipboardList size={20} className="text-secondary-400" />
              {isEdit ? "Edit Checklist" : "Create Checklist"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 hidden sm:block">
              Design your audit questionnaire and assign questions to specific organizational levels.
            </p>
          </div>
        </div>

        <StepIndicator current={step} total={3} />

        {saveError && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1 font-medium">{saveError}</div>
            <button onClick={() => setSaveError("")} className="p-0.5 rounded hover:bg-white/5 transition-colors"><X size={14} /></button>
          </div>
        )}

        {/* ─── STEP 1 ───── */}
        {step === 1 && (
          <div className="glass rounded-2xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SectionHeader num={1} label="Checklist Foundation" desc="Set the core identity of your checklist. Choose a clear name that helps auditors identify the task." onboarding={searchParams.get("onboarding") === "1"} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              <div className="lg:col-span-2">
                <FieldLabel label="Checklist Name" required />
                <input value={formData.name} onChange={e => setForm("name", e.target.value)} placeholder="e.g. Factory Floor Safety Audit Q1" className={inputCls} />
              </div>
              <div className="lg:col-span-2">
                <FieldLabel label="Description" required />
                <textarea value={formData.description} onChange={e => setForm("description", e.target.value)} rows={3} placeholder="Describe the purpose of this checklist..." className={`${inputCls} resize-none`} />
              </div>
              <div className="lg:col-span-2">
                <FieldLabel label="Media File (optional)" />
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => mediaRef.current?.click()} disabled={uploadingMedia}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-secondary-400 border border-secondary-500/20 hover:bg-secondary-500/10 hover:border-secondary-500/40 transition-all disabled:opacity-60">
                    {uploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingMedia ? "Uploading..." : "Choose File"}
                  </button>
                  {mediaFileName && <span className="text-sm text-gray-300 truncate max-w-xs">{mediaFileName}</span>}
                  {formData.media_path && !uploadingMedia && (
                    <button type="button" onClick={() => { setFormData(p => ({ ...p, media_path: "" })); setMediaFileName(""); }} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input ref={mediaRef} type="file" accept="image/*,application/pdf,video/mp4,video/webm" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !accessToken) return;
                    setUploadingMedia(true);
                    try {
                      const res = await checklistApi.uploadMedia(accessToken, file);
                      if (res.success && res.data) { const d = res.data as { file_path: string }; setFormData(p => ({ ...p, media_path: d.file_path })); setMediaFileName(file.name); }
                      else setSaveError(res.message || "Failed to upload media.");
                    } catch { setSaveError("Failed to upload media."); }
                    setUploadingMedia(false);
                    if (mediaRef.current) mediaRef.current.value = "";
                  }} />
                <p className="mt-1.5 text-xs text-gray-600 flex items-center gap-1"><Info size={11} /> Upload an image, PDF, or video as reference material.</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 2 ───── */}
        {step === 2 && (
          <div className="glass rounded-2xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SectionHeader num={2} label="Configuration & Schedule" desc="Define how this checklist behaves. Set its type, repetition schedule, and required resources." onboarding={searchParams.get("onboarding") === "1"} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-6 sm:gap-y-8">
              <div className="flex flex-col">
                <FieldLabel label="Checklist Type" required />
                <p className="text-[11px] text-gray-500 mb-2">Categorize this checklist</p>
                <div className="mt-auto flex gap-2">
                  <select value={formData.checklist_type_id} onChange={e => setForm("checklist_type_id", e.target.value)} className={`${inputCls} flex-1`}>
                    <option value="">Select type...</option>
                    {checklistTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button onClick={() => setShowTypeModal(true)} className="p-2.5 rounded-lg bg-secondary-500/10 text-secondary-400 border border-secondary-500/20 hover:bg-secondary-500/20 transition-all" title="Create New Type">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col">
                <FieldLabel label="Time Period" required />
                <p className="text-[11px] text-gray-500 mb-2">How long does this audit take?</p>
                <div className="mt-auto flex items-center bg-white/5 border border-white/10 rounded-lg focus-within:border-secondary-500/50 focus-within:ring-1 focus-within:ring-secondary-500/20 transition-all overflow-hidden">
                  <input type="number" min="1" value={formData.time_period_value} onChange={e => setForm("time_period_value", e.target.value)} placeholder="e.g. 3" className="flex-1 w-full bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none" />
                  <div className="w-px h-6 bg-white/10 shrink-0" />
                  <select value={formData.time_period_unit} onChange={e => setForm("time_period_unit", e.target.value)} className="bg-transparent pl-3 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none cursor-pointer appearance-none outline-none border-none shrink-0" style={{ backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem top 50%", backgroundSize: "0.65rem auto" }}>
                    <option value="" disabled>Select unit *</option>
                    {DURATION_UNITS.map(u => <option key={u} value={u} className="bg-[#0c2218] text-white">{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col">
                <FieldLabel label="Repeat Duration" required />
                <p className="text-[11px] text-gray-500 mb-2">How often to repeat this audit?</p>
                <div className="mt-auto flex items-center bg-white/5 border border-white/10 rounded-lg focus-within:border-secondary-500/50 focus-within:ring-1 focus-within:ring-secondary-500/20 transition-all overflow-hidden">
                  <input type="number" min="1" value={formData.repeat_duration_value} onChange={e => setForm("repeat_duration_value", e.target.value)} placeholder="e.g. 6" className="flex-1 w-full bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none" />
                  <div className="w-px h-6 bg-white/10 shrink-0" />
                  <select value={formData.repeat_duration_unit} onChange={e => setForm("repeat_duration_unit", e.target.value)} className="bg-transparent pl-3 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none cursor-pointer appearance-none outline-none border-none shrink-0" style={{ backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem top 50%", backgroundSize: "0.65rem auto" }}>
                    <option value="" disabled>Select unit *</option>
                    {DURATION_UNITS.map(u => <option key={u} value={u} className="bg-[#0c2218] text-white">{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col">
                <FieldLabel label="Budget" />
                <p className="text-[11px] text-gray-500 mb-2">Estimated cost for completion</p>
                <div className="mt-auto flex items-center bg-white/5 border border-white/10 rounded-lg focus-within:border-secondary-500/50 focus-within:ring-1 focus-within:ring-secondary-500/20 transition-all overflow-hidden">
                  <input type="number" min="0" step="0.01" value={formData.budget} onChange={e => setForm("budget", e.target.value)} placeholder="0.00" className="flex-1 w-full bg-transparent px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none" />
                  <div className="w-px h-6 bg-white/10 shrink-0" />
                  <select value={formData.currency} onChange={e => setForm("currency", e.target.value)} className="bg-transparent pl-3 pr-8 py-2.5 text-sm text-gray-300 focus:outline-none cursor-pointer appearance-none outline-none border-none shrink-0" style={{ backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem top 50%", backgroundSize: "0.65rem auto" }}>
                    {currencies.map(c => <option key={c} value={c} className="bg-[#0c2218] text-white">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col">
                <FieldLabel label="Number of Workers" />
                <p className="text-[11px] text-gray-500 mb-2">Required headcount to complete</p>
                <div className="mt-auto">
                  <input type="number" min="1" step="1" value={formData.num_workers} onChange={e => setForm("num_workers", e.target.value)} placeholder="e.g. 5" className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Questions ───────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SectionHeader
              num={3}
              label="Question Assignments"
              desc="Add questions manually via the org tree below, or bulk import them using the Excel template."
              onboarding={searchParams.get("onboarding") === "1"}
            />

            {/* ── Excel Import — 2 step cards ── */}
            <div className="glass rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
                <TableProperties size={14} className="text-secondary-400 shrink-0" />
                <span className="text-sm font-semibold text-white">Bulk Import via Excel</span>
                <span className="text-xs text-gray-500 ml-1">— faster way to add many questions at once</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                {/* Step 1 */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary-500/20 border border-secondary-500/30 flex items-center justify-center text-secondary-400 text-[11px] font-bold shrink-0 mt-0.5">1</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white mb-0.5">Download Template</p>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">
                        Get the Excel template with the correct columns and format. Fill it in with your questions — one row per question, assign each to an entity code.
                      </p>
                      <a
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!accessToken) return;
                          try { await checklistApi.downloadExcelTemplate(accessToken); }
                          catch (err: unknown) { setSaveError(err instanceof Error ? err.message : "Failed to download template."); }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-secondary-400 border border-secondary-500/25 hover:bg-secondary-500/10 hover:border-secondary-500/40 transition-all"
                      >
                        <Download size={13} />
                        Download Template
                      </a>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary-500/20 border border-secondary-500/30 flex items-center justify-center text-secondary-400 text-[11px] font-bold shrink-0 mt-0.5">2</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white mb-0.5">Upload Your Excel File</p>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">
                        Once the file is ready, upload it here. We'll parse and preview all questions before adding them to the checklist — you can review and confirm.
                      </p>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploadingExcel}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-white bg-secondary-500/15 border border-secondary-500/25 hover:bg-secondary-500/25 transition-all disabled:opacity-60"
                      >
                        {uploadingExcel ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        {uploadingExcel ? "Processing…" : "Upload Excel"}
                      </button>
                      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload result */}
              {uploadResult && (
                <div className={`mx-4 mb-4 mt-0 p-3 rounded-lg text-xs border ${
                  uploadResult.errors?.length > 0 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}>
                  <p className="font-medium">
                    {uploadResult.created_count} question(s) imported{uploadResult.errors?.length > 0 && `, ${uploadResult.errors.length} row(s) skipped`}.
                  </p>
                  {uploadResult.errors?.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-amber-300/80">
                      {uploadResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-gray-600 font-medium px-2">or add manually below</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* ── Org tree question builder ── */}
            {treeEntities.length === 0 ? (
              <div className="glass rounded-xl border border-white/[0.08] py-10 text-center">
                <Building2 size={28} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm mb-1">No org tree entities found</p>
                <p className="text-gray-600 text-xs">Build your organization tree first to assign questions to entities.</p>
              </div>
            ) : (
              <div className="glass rounded-xl border border-white/[0.08] overflow-hidden">
                {/* Tree header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-gray-500" />
                    <span className="text-sm font-semibold text-white">Organization Tree</span>
                    {questions.length > 0 && (
                      <span className="text-[11px] text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-2 py-0.5 rounded-full">
                        {questions.length} question{questions.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {questions.length > 0 && (
                      <button
                        onClick={() => setShowOnlyWithQuestions(p => !p)}
                        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          showOnlyWithQuestions
                            ? "bg-secondary-500/15 text-secondary-400 border-secondary-500/30"
                            : "text-gray-500 border-white/10 hover:text-gray-300"
                        }`}
                      >
                        {showOnlyWithQuestions ? "Show all" : "Show with questions"}
                      </button>
                    )}
                    {excludedEntities.size > 0 && (
                      <button
                        onClick={() => setExcludedEntities(new Set())}
                        className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        Restore {excludedEntities.size} hidden
                      </button>
                    )}
                    <p className="text-xs text-gray-600 hidden sm:block">Expand → "+ Add question"</p>
                  </div>
                </div>

                <div className="p-3 space-y-0.5">
                  {treeRoot
                    ? ENTITY_TYPE_COLORS[treeRoot.entity_type]
                      ? <TreeEntityNode node={treeRoot} questions={questions} allEntities={treeEntities} onAddQuestion={addQuestion} onChangeQuestion={updateQuestion} onDeleteQuestion={deleteQuestion} excludedEntities={excludedEntities} onExclude={code => setExcludedEntities(p => new Set([...p, code]))} showOnlyWithQuestions={showOnlyWithQuestions} isRoot />
                      : (treeRoot.children ?? []).map(child => (
                        <TreeEntityNode key={child.code} node={child} questions={questions} allEntities={treeEntities} onAddQuestion={addQuestion} onChangeQuestion={updateQuestion} onDeleteQuestion={deleteQuestion} excludedEntities={excludedEntities} onExclude={code => setExcludedEntities(p => new Set([...p, code]))} showOnlyWithQuestions={showOnlyWithQuestions} />
                      ))
                    : treeEntities.slice(0, 1).map(n => (
                      <TreeEntityNode key={n.code} node={n} questions={questions} allEntities={treeEntities} onAddQuestion={addQuestion} onChangeQuestion={updateQuestion} onDeleteQuestion={deleteQuestion} excludedEntities={excludedEntities} onExclude={code => setExcludedEntities(p => new Set([...p, code]))} showOnlyWithQuestions={showOnlyWithQuestions} isRoot />
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Wizard Nav ── */}
        <div className="mt-6 sm:mt-8 flex items-center justify-between gap-3 p-3 sm:p-4 glass rounded-xl border border-white/10">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-medium border border-white/10 hover:border-white/20 disabled:opacity-40 transition-all"
          >
            <ChevronLeft size={15} />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Back</span>
          </button>

          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1) {
                  if (!formData.name.trim()) { setSaveError("Checklist name is required to continue."); return; }
                  if (!formData.description.trim()) { setSaveError("Description is required to continue."); return; }
                }
                if (step === 2) {
                  if (!formData.checklist_type_id) { setSaveError("Checklist type is required to continue."); return; }
                  if (!formData.time_period_value) { setSaveError("Time period is required to continue."); return; }
                  if (!formData.time_period_unit) { setSaveError("Time period unit is required to continue."); return; }
                  if (!formData.repeat_duration_value) { setSaveError("Repeat duration is required to continue."); return; }
                  if (!formData.repeat_duration_unit) { setSaveError("Repeat duration unit is required to continue."); return; }
                }
                setSaveError("");
                setStep(s => s + 1);
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-5 sm:px-8 py-2.5 sm:py-3 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold rounded-xl transition-all"
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 sm:gap-2 px-5 sm:px-8 py-2.5 sm:py-3 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold rounded-xl transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Checklist"}
            </button>
          )}
        </div>

        {/* Modals */}
        <ExcelConfirmModal
          open={showUploadConfirmModal}
          questions={uploadedQuestions}
          uploadResult={uploadResult}
          treeRoot={treeRoot}
          onConfirm={(qs) => { setQuestions(qs); setShowUploadConfirmModal(false); setUploadedQuestions([]); setShowOnlyWithQuestions(true); setStep(3); }}
          onDiscard={() => { setShowUploadConfirmModal(false); setUploadedQuestions([]); setUploadResult(null); }}
        />

        <AddQuestionModal
          open={addEntityOpen}
          entities={treeEntities}
          onClose={() => setAddEntityOpen(false)}
          onAdd={(code, type, name) => {
            const nd = treeEntities.find(n => n.code === code);
            addQuestion(code, nd?.edge_id ?? null, type, name);
          }}
        />

        {showTypeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-transparent/80 backdrop-blur-sm">
            <div className="bg-primary-900 max-w-sm w-full rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <h2 className="text-lg font-semibold text-white">New Checklist Type</h2>
                <button onClick={() => setShowTypeModal(false)} className="p-1 rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-colors"><X size={18} /></button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <FieldLabel label="Type Name" required />
                  <input type="text" placeholder="e.g. Health & Safety" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} className={inputCls} autoFocus />
                </div>
                <div>
                  <FieldLabel label="Description" />
                  <textarea placeholder="Optional description..." value={newTypeDesc} onChange={(e) => setNewTypeDesc(e.target.value)} className={`${inputCls} resize-none`} rows={3} />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-white/5 bg-white/[0.01] flex items-center gap-3 justify-end">
                <button onClick={() => setShowTypeModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-medium">Cancel</button>
                <button onClick={handleCreateType} disabled={creatingType || !newTypeName.trim()} className="px-4 py-2 rounded-lg text-sm bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold transition-colors disabled:opacity-50 flex items-center gap-2">
                  {creatingType ? <Loader2 size={16} className="animate-spin" /> : "Create Type"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}