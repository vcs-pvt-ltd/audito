"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import LimitReachedModal from "@/components/modals/LimitReachedModal";
import { auditFirmLearningApi } from "@/lib/api";
import {
  ArrowLeft, Plus, Download, X, Loader2, AlertCircle,
  Check, ChevronDown, Circle, CheckSquare,
  ClipboardList, FileText, Upload, ChevronRight,
} from "lucide-react";
import { Button, IconButton, Modal, Input, Textarea } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionForm {
  id: string;
  question_text: string;
  answer_type: "single_option" | "multiple_options" | "dropdown";
  options: { text: string; marks: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ANSWER_TYPE_META = {
  single_option: { label: "Single Choice", Icon: Circle, color: "text-green-400" },
  multiple_options: { label: "Multiple Choice", Icon: CheckSquare, color: "text-purple-400" },
  dropdown: { label: "Dropdown", Icon: ChevronDown, color: "text-amber-400" },
} as const;

let _idCtr = 1;
const uid = () => `q-${_idCtr++}`;

function normalizeAnswerType(raw: string): QuestionForm["answer_type"] {
  const v = (raw || "").toLowerCase().trim();
  if (v === "multiple_options" || v === "multiple_choice" || v === "checkbox" || v === "multi") return "multiple_options";
  if (v === "dropdown" || v === "select") return "dropdown";
  return "single_option";
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateQuestions(qs: QuestionForm[]): string | null {
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (!q.question_text.trim()) return `Question ${i + 1}: Question text is required.`;
    if (q.options.length < 2) return `Question ${i + 1}: At least 2 options are required.`;
    for (let j = 0; j < q.options.length; j++) {
      if (!q.options[j].text.trim())
        return `Question ${i + 1}, Option ${j + 1}: Option text is required.`;
    }
    const total = q.options.reduce((s, o) => s + (parseFloat(o.marks) || 0), 0);
    if (Math.abs(total - 10) > 0.01)
      return `Question ${i + 1}: Option marks must sum to 10 (currently ${total.toFixed(2)}).`;
  }
  return null;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 }) {
  const steps = [
    { label: "Paper Details", Icon: FileText },
    { label: "Questions", Icon: CheckSquare },
  ];
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4 mb-8">
      {steps.map((s, i) => {
        const isActive = i + 1 === current;
        const isDone = i + 1 < current;
        const { Icon } = s;
        return (
          <div key={i} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-1.5 min-w-[64px] sm:min-w-[88px]">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? "bg-secondary-500 text-primary-950 shadow-lg shadow-secondary-500/20 scale-110"
                    : isDone
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-gray-500 border border-white/10"
                }`}
              >
                {isDone ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                  isActive
                    ? "text-secondary-400"
                    : isDone
                    ? "text-emerald-400/80"
                    : "text-gray-600"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-8 sm:w-14 h-[2px] bg-white/5 rounded-full mb-5">
                <div
                  className="h-full bg-secondary-500 transition-all duration-500"
                  style={{ width: isDone ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ num, label, desc }: { num: number; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 mb-6">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center text-secondary-400 text-xs sm:text-sm font-bold shrink-0">
        {num}
      </div>
      <div>
        <h2 className="text-base sm:text-xl font-bold text-white tracking-tight">{label}</h2>
        <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  onChange,
  onDelete,
}: {
  question: QuestionForm;
  index: number;
  onChange: (updated: QuestionForm) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(!question.question_text);
  const meta = ANSWER_TYPE_META[question.answer_type] ?? ANSWER_TYPE_META.single_option;
  const showOptions = true;
  const totalMarks = question.options.reduce((s, o) => s + (parseFloat(o.marks) || 0), 0);
  const marksOk = Math.abs(totalMarks - 10) < 0.01;

  const changeType = (newType: QuestionForm["answer_type"]) => {
    const defaultOpts: QuestionForm["options"] =
      newType === "single_option"
        ? [{ text: "Yes", marks: "7" }, { text: "No", marks: "3" }]
        : [{ text: "", marks: "" }, { text: "", marks: "" }];
    onChange({ ...question, answer_type: newType, options: defaultOpts });
  };

  const setOption = (i: number, field: "text" | "marks", val: string) => {
    const opts = [...question.options];
    opts[i] = { ...opts[i], [field]: val };
    onChange({ ...question, options: opts });
  };

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-all ${
        question.question_text
          ? "border-white/[0.08] bg-white/[0.015]"
          : "border-secondary-500/20 bg-secondary-500/[0.04]"
      }`}
    >
      {/* Compact row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="w-5 h-5 rounded-full bg-secondary-500/15 border border-secondary-500/20 flex items-center justify-center text-secondary-400 text-[10px] font-bold shrink-0">
          {index + 1}
        </span>

        <select
          value={question.answer_type}
          onChange={(e) => changeType(e.target.value as QuestionForm["answer_type"])}
          onClick={(e) => e.stopPropagation()}
          className={`text-[11px] font-medium bg-transparent border-none focus:outline-none cursor-pointer shrink-0 ${meta.color}`}
        >
          {(Object.entries(ANSWER_TYPE_META) as [QuestionForm["answer_type"], typeof meta][]).map(
            ([val, m]) => (
              <option key={val} value={val} className="bg-[#0c2218] text-white text-xs">
                {m.label}
              </option>
            )
          )}
        </select>

        <span
          className={`flex-1 text-xs truncate cursor-pointer ${
            question.question_text ? "text-gray-300" : "text-gray-600 italic"
          }`}
          onClick={() => setExpanded((p) => !p)}
        >
          {question.question_text || "Click to write question…"}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {question.question_text && !expanded && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                !showOptions || marksOk ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {showOptions ? `${totalMarks}/10` : "✓"}
            </span>
          )}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
          >
            <ChevronDown
              size={13}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
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
        <div className="px-3 pb-3 space-y-3 border-t border-white/[0.05]">
          <div className="pt-2.5">
            <textarea
              value={question.question_text}
              onChange={(e) => onChange({ ...question, question_text: e.target.value })}
              rows={2}
              placeholder="Enter your question here..."
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all resize-none"
            />
          </div>

          {showOptions && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-gray-500 font-medium">Options &amp; Marks</span>
                <span
                  className={`text-[11px] font-semibold ${
                    marksOk ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {totalMarks.toFixed(1)} / 10 {marksOk && "✓"}
                </span>
              </div>

              <div className="space-y-1.5">
                {question.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <span className="w-4 text-[10px] text-gray-600 text-center shrink-0">
                      {oi + 1}
                    </span>
                    <input
                      value={opt.text}
                      onChange={(e) => setOption(oi, "text", e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      className="flex-1 bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-all"
                    />
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={opt.marks}
                      onChange={(e) => setOption(oi, "marks", e.target.value)}
                      placeholder="0"
                      className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-secondary-500/50 transition-all"
                    />
                    <span className="text-[10px] text-gray-600 shrink-0">pts</span>
                    {question.options.length > 2 && (
                      <button
                        onClick={() =>
                          onChange({
                            ...question,
                            options: question.options.filter((_, idx) => idx !== oi),
                          })
                        }
                        className="p-0.5 text-gray-600 hover:text-red-400 transition-colors shrink-0"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {question.options.length < 5 && (
                <button
                  onClick={() =>
                    onChange({
                      ...question,
                      options: [...question.options, { text: "", marks: "" }],
                    })
                  }
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-secondary-400 hover:text-secondary-300 transition-colors"
                >
                  <Plus size={11} /> Add option
                </button>
              )}

              {!marksOk && question.options.some((o) => o.marks) && (
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

// ─── Excel Confirm Modal ──────────────────────────────────────────────────────

function ExcelConfirmModal({
  open,
  questions,
  errors,
  onConfirm,
  onDiscard,
}: {
  open: boolean;
  questions: QuestionForm[];
  errors: string[];
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onDiscard}
      title="Confirm Excel Import"
      description={`${questions.length} question(s) parsed`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onDiscard}>Discard</Button>
          <Button leftIcon={<Check size={14}/>} disabled={questions.length === 0} onClick={onConfirm}>
            Add {questions.length} Question{questions.length !== 1 ? "s" : ""}
          </Button>
        </>
      }
    >
      {errors.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs font-medium text-amber-400 mb-1.5">Skipped rows:</p>
          <ul className="space-y-0.5 max-h-20 overflow-y-auto">
            {errors.map((e, i) => (
              <li key={i} className="text-[11px] text-amber-300/80">• {e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="space-y-2">
        {questions.map((q, idx) => (
          <div key={idx} className="border border-white/10 rounded-xl p-3 bg-white/[0.03]">
            <p className="text-sm text-white font-medium">{idx + 1}. {q.question_text}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Type: <span className="text-gray-300">{q.answer_type}</span>
            </p>
            {q.options.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {q.options.map((o, oi) => (
                  <div key={oi} className="text-xs text-gray-300 border border-white/10 rounded px-2 py-1 bg-black/10 flex items-center justify-between gap-2">
                    <span className="truncate">{o.text}</span>
                    <span className="text-gray-500 shrink-0">{o.marks}pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {questions.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">No questions parsed.</p>
        )}
      </div>
    </Modal>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CreateEvaluationPaperPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    title: "",
    description: "",
    time_limit_minutes: "",
    pass_marks: "",
  });
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [saveError, setSaveError] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelPreviewQuestions, setExcelPreviewQuestions] = useState<QuestionForm[]>([]);
  const [excelPreviewErrors, setExcelPreviewErrors] = useState<string[]>([]);
  const [excelConfirmOpen, setExcelConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  useEffect(() => {
    if (!isLoading && admin?.plan_limits && !admin.plan_limits.auditor_eval) {
      setLimitModalOpen(true);
    }
  }, [isLoading, admin]);

  if (isLoading || !admin) return null;

  if (admin.plan_limits && !admin.plan_limits.auditor_eval) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center p-6">
        <LimitReachedModal
          isOpen={limitModalOpen}
          onClose={() => router.push("/learning/evaluation-papers")}
          title="Auditor Evaluation Disabled"
          message="Your current plan does not allow access to the Auditor Evaluation System. Upgrade your subscription to enable this feature."
          limit={0}
        />
      </div>
    );
  }

  if (admin.role !== "admin") {
    return (
      <div className="p-6 pt-20 lg:pt-8 text-gray-300">
        You don&apos;t have permission to access this page.
      </div>
    );
  }

  // ── Handlers ──

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: uid(),
        question_text: "",
        answer_type: "single_option",
        options: [
          { text: "Yes", marks: "7" },
          { text: "No", marks: "3" },
        ],
      },
    ]);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setExcelUploading(true);
    setSaveError("");
    try {
      const res = await auditFirmLearningApi.previewEvaluationQuestionsExcel(accessToken, file);
      if (!res?.success) {
        const errs = Array.isArray((res as any)?.errors) ? (res as any).errors : [];
        setSaveError(errs.length ? errs.join("\n") : res?.message || "Preview failed.");
        return;
      }
      const qs = (res.data as any)?.questions || [];
      const normalized: QuestionForm[] = qs.map((q: any) => ({
        id: uid(),
        question_text: q.question_text,
        answer_type: normalizeAnswerType(q.answer_type),
        options: Array.isArray(q.options)
          ? q.options.map((o: any) => ({
              text: o.option_text ?? o.text ?? "",
              marks: String(o.marks ?? ""),
            }))
          : [],
      }));
      const errs = (res.data as any)?.errors;
      setExcelPreviewQuestions(normalized);
      setExcelPreviewErrors(Array.isArray(errs) ? errs : []);
      setExcelConfirmOpen(true);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to preview questions from Excel.");
    } finally {
      setExcelUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleFinish = async () => {
    if (!accessToken) return;
    if (!form.title.trim()) { setSaveError("Title is required."); setStep(1); return; }
    if (!form.description.trim()) { setSaveError("Description is required."); setStep(1); return; }
    if (!form.time_limit_minutes) { setSaveError("Time limit is required."); setStep(1); return; }
    if (!form.pass_marks) { setSaveError("Pass marks is required."); setStep(1); return; }
    if (questions.length === 0) { setSaveError("Add at least one question before creating."); return; }
    const qErr = validateQuestions(questions);
    if (qErr) { setSaveError(qErr); return; }

    setFinishing(true);
    setSaveError("");
    try {
      const createRes = await auditFirmLearningApi.createEvaluationPaper(accessToken, {
        title: form.title,
        description: form.description,
        time_limit_minutes: Number(form.time_limit_minutes),
        pass_marks: Number(form.pass_marks),
      });
      if (!createRes.success) { setSaveError(createRes.message || "Failed to create paper."); return; }

      const newId = (createRes.data as any)?.id ? Number((createRes.data as any).id) : null;
      if (!newId) { setSaveError("Failed to create paper (missing id)."); return; }

      const apiQuestions = questions.map((q) => ({
        question_text: q.question_text,
        answer_type: q.answer_type,
        marks: 10,
        options: q.options.map((o) => ({
          option_text: o.text,
          marks: parseFloat(o.marks) || 0,
        })),
      }));
      const attachRes = await auditFirmLearningApi.setEvaluationQuestions(
        accessToken,
        newId,
        apiQuestions
      );
      if (!attachRes.success) { setSaveError(attachRes.message || "Failed to attach questions."); return; }

      router.push("/learning/evaluation-papers");
    } finally {
      setFinishing(false);
    }
  };

  const goToStep2 = () => {
    if (!form.title.trim()) { setSaveError("Title is required to continue."); return; }
    if (!form.description.trim()) { setSaveError("Description is required to continue."); return; }
    if (!form.time_limit_minutes) { setSaveError("Time limit is required to continue."); return; }
    if (!form.pass_marks) { setSaveError("Pass marks is required to continue."); return; }
    setSaveError("");
    setStep(2);
  };

  // ── Render ──

  return (
    <div className="min-h-full bg-transparent flex flex-col">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <IconButton bordered onClick={() => router.push("/learning/evaluation-papers")}>
            <ArrowLeft size={20} />
          </IconButton>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ClipboardList size={20} className="text-secondary-400" />
              Create Evaluation Paper
            </h1>
            <p className="hidden sm:block text-xs sm:text-sm text-gray-400 mt-0.5">
              Design an assessment paper with questions to evaluate auditor knowledge.
            </p>
          </div>
        </div>

        <StepIndicator current={step} />

        {/* Error banner */}
        {saveError && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1 font-medium whitespace-pre-wrap">{saveError}</div>
            <button
              onClick={() => setSaveError("")}
              className="p-0.5 rounded hover:bg-white/5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Step 1: Paper Details ── */}
        {step === 1 && (
          <div className="glass rounded-2xl p-4 sm:p-6 md:p-8 border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SectionHeader
              num={1}
              label="Paper Details"
              desc="Set the title, description and assessment criteria for this evaluation paper."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <Input
                  label="Title"
                  required
                  placeholder="e.g. Q1 Safety Knowledge Assessment"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className="sm:col-span-2">
                <Textarea
                  label="Description"
                  required
                  rows={3}
                  placeholder="Brief description of what this evaluation paper covers..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div>
                <Input
                  label="Time Limit (minutes)"
                  required
                  type="number"
                  min={1}
                  placeholder="e.g. 60"
                  value={form.time_limit_minutes}
                  onChange={(e) => setForm((p) => ({ ...p, time_limit_minutes: e.target.value }))}
                />
              </div>

              <div>
                <Input
                  label="Pass Marks (%)"
                  required
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  placeholder="e.g. 75"
                  value={form.pass_marks}
                  onChange={(e) => setForm((p) => ({ ...p, pass_marks: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Questions ── */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <SectionHeader
              num={2}
              label="Questions"
              desc="Add questions manually or bulk-import using the Excel template."
            />

            {/* Excel import card */}
            <div className="glass rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
                <FileText size={14} className="text-secondary-400 shrink-0" />
                <span className="text-sm font-semibold text-white">Bulk Import via Excel</span>
                <span className="text-xs text-gray-500 ml-1">
                  — faster for adding many questions at once
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary-500/20 border border-secondary-500/30 flex items-center justify-center text-secondary-400 text-[11px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white mb-0.5">Download Template</p>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">
                        Get the Excel template and fill in your questions.
                      </p>
                      <button
                        onClick={async () => {
                          if (!accessToken) return;
                          const res =
                            await auditFirmLearningApi.downloadEvaluationExcelTemplate(
                              accessToken
                            );
                          if (!res.success) {
                            setSaveError(res.message || "Failed to download template.");
                            return;
                          }
                          const url = URL.createObjectURL(res.blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "evaluation_paper_questions_template.xlsx";
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-secondary-400 border border-secondary-500/25 hover:bg-secondary-500/10 hover:border-secondary-500/40 transition-all"
                      >
                        <Download size={13} /> Download Template
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-secondary-500/20 border border-secondary-500/30 flex items-center justify-center text-secondary-400 text-[11px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white mb-0.5">Upload Your File</p>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">
                        Preview and confirm questions before adding.
                      </p>
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={excelUploading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-white bg-secondary-500/15 border border-secondary-500/25 hover:bg-secondary-500/25 transition-all disabled:opacity-60"
                      >
                        {excelUploading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Upload size={13} />
                        )}
                        {excelUploading ? "Processing…" : "Upload Excel"}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleExcelUpload}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-gray-600 font-medium px-2">or add manually below</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Manual questions */}
            <div className="glass rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <CheckSquare size={14} className="text-gray-500" />
                  <span className="text-sm font-semibold text-white">Questions</span>
                  {questions.length > 0 && (
                    <span className="text-[11px] text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-2 py-0.5 rounded-full">
                      {questions.length} question{questions.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-1.5 text-xs font-medium text-secondary-400 border border-secondary-500/25 hover:bg-secondary-500/10 hover:border-secondary-500/40 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Plus size={13} /> Add Question
                </button>
              </div>

              <div className="p-3 space-y-2">
                {questions.length === 0 ? (
                  <div className="py-10 text-center">
                    <CheckSquare size={28} className="text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm mb-1">No questions yet</p>
                    <p className="text-gray-600 text-xs mb-4">
                      Import from Excel above or click &quot;Add Question&quot; to start manually.
                    </p>
                    <button
                      onClick={addQuestion}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary-400 border border-secondary-500/25 hover:bg-secondary-500/10 px-4 py-2 rounded-lg transition-all"
                    >
                      <Plus size={13} /> Add First Question
                    </button>
                  </div>
                ) : (
                  questions.map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={idx}
                      onChange={(updated) =>
                        setQuestions((prev) =>
                          prev.map((x) => (x.id === q.id ? updated : x))
                        )
                      }
                      onDelete={() =>
                        setQuestions((prev) => prev.filter((x) => x.id !== q.id))
                      }
                    />
                  ))
                )}
              </div>

              {questions.length > 0 && (
                <div className="px-3 pb-3">
                  <button
                    onClick={addQuestion}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-secondary-400/50 hover:text-secondary-400 border border-dashed border-secondary-500/10 hover:border-secondary-500/25 rounded-lg transition-all hover:bg-secondary-500/5"
                  >
                    <Plus size={11} /> Add another question
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation bar */}
        <div className="mt-6 sm:mt-8 flex items-center justify-between gap-3 p-3 sm:p-4 glass rounded-xl border border-white/10">
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft size={15} />}
            disabled={step === 1}
            onClick={() => { setSaveError(""); setStep(1); }}
          >
            Previous
          </Button>

          {step === 1 ? (
            <Button rightIcon={<ChevronRight size={15} />} onClick={goToStep2}>
              Next
            </Button>
          ) : (
            <Button loading={finishing} leftIcon={finishing ? undefined : <Check size={16} />} onClick={handleFinish}>
              {finishing ? "Creating…" : "Create Paper"}
            </Button>
          )}
        </div>

        {/* Modals */}
        <ExcelConfirmModal
          open={excelConfirmOpen}
          questions={excelPreviewQuestions}
          errors={excelPreviewErrors}
          onConfirm={() => {
            setQuestions((prev) => [...prev, ...excelPreviewQuestions]);
            setExcelConfirmOpen(false);
            setExcelPreviewQuestions([]);
            setExcelPreviewErrors([]);
          }}
          onDiscard={() => {
            setExcelConfirmOpen(false);
            setExcelPreviewQuestions([]);
            setExcelPreviewErrors([]);
          }}
        />

        <LimitReachedModal
          isOpen={limitModalOpen}
          onClose={() => setLimitModalOpen(false)}
          title="Auditor Evaluation Disabled"
          message="Your current plan does not allow the Auditor Evaluation System. Upgrade your subscription to create evaluation papers."
          limit={0}
        />
      </main>
    </div>
  );
}
