"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditFirmLearningApi } from "@/lib/api";
import { ArrowLeft, Plus, Upload, Download, X, FileText, Loader2, AlertCircle } from "lucide-react";

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${i + 1 === current
              ? "w-8 bg-secondary-500"
              : i + 1 < current
                ? "w-6 bg-secondary-500/40"
                : "w-6 bg-white/10"
            }`}
        />
      ))}
    </div>
  );
}

function SectionHeader({ num, label, desc }: { num: number; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-7 h-7 rounded-full bg-secondary-500/20 border border-secondary-500/30 flex items-center justify-center text-secondary-400 text-xs font-bold shrink-0">
        {num}
      </div>
      <div>
        <h2 className="text-white font-semibold text-base">{label}</h2>
        <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <label className="block text-sm text-gray-400 mb-1.5">{label}</label>;
}

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all";

function ExcelConfirmModal({
  open,
  questions,
  errors,
  onConfirm,
  onDiscard,
}: {
  open: boolean;
  questions: any[];
  errors: string[];
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onDiscard} />
      <div className="relative w-full max-w-3xl glass border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white font-semibold">Confirm Excel Questions</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Parsed <span className="text-gray-300 font-medium">{questions.length}</span> question(s).
            </p>
          </div>
          <button onClick={onDiscard} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-4 border border-red-500/20 bg-red-500/10 rounded-xl p-3">
            <p className="text-xs text-red-300 font-medium">Validation errors</p>
            <pre className="text-xs text-red-200 whitespace-pre-wrap mt-2">{errors.join("\n")}</pre>
          </div>
        )}

        <div className="max-h-[55vh] overflow-auto space-y-3">
          {questions.map((q, idx) => (
            <div key={idx} className="border border-white/10 rounded-xl p-3 bg-white/[0.03]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white font-medium break-words">
                    {idx + 1}. {q.question_text}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Type: <span className="text-gray-300">{q.answer_type}</span>
                  </p>
                </div>
              </div>

              {Array.isArray(q.options) && q.options.length > 0 && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((o: any, oi: number) => (
                    <div key={oi} className="text-xs text-gray-300 border border-white/10 rounded-lg px-2.5 py-2 bg-black/10">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{o.option_text}</span>
                        <span className="text-gray-500 shrink-0">{o.marks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {questions.length === 0 && (
            <div className="text-sm text-gray-400">No questions parsed.</div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition-all"
          >
            Discard
          </button>
          <button
            onClick={onConfirm}
            disabled={errors.length > 0 || questions.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}



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

  const [createdPaperId, setCreatedPaperId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelMessage, setExcelMessage] = useState<string | null>(null);

  const [excelPreviewQuestions, setExcelPreviewQuestions] = useState<any[]>([]);
  const [excelPreviewErrors, setExcelPreviewErrors] = useState<string[]>([]);
  const [excelConfirmOpen, setExcelConfirmOpen] = useState(false);

  const [preparedQuestions, setPreparedQuestions] = useState<any[] | null>(null);
  const [draftRaw, setDraftRaw] = useState<string | null>(null);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    setExcelUploading(true);
    setExcelMessage(null);
    setExcelPreviewQuestions([]);
    setExcelPreviewErrors([]);

    try {
      const res = await auditFirmLearningApi.previewEvaluationQuestionsExcel(accessToken, file);
      if (!res?.success) {
        const errs = Array.isArray(res?.errors) ? res.errors : null;
        if (errs && errs.length > 0) {
          setExcelMessage(`${res?.message || "Preview failed."}\n${errs.join("\n")}`);
        } else {
          setExcelMessage(res?.message || "Preview failed.");
        }
        return;
      }

      const qs = (res.data as any)?.questions || [];
      const normalized = qs.map((q: any) => ({
        question_text: q.question_text,
        answer_type: q.answer_type,
        marks: 10,
        options: Array.isArray(q.options) ? q.options : [],
      }));

      const errs = (res.data as any)?.errors;
      setExcelPreviewQuestions(normalized);
      setExcelPreviewErrors(Array.isArray(errs) ? errs : []);
      setDraftRaw(JSON.stringify(normalized, null, 2));
      setExcelConfirmOpen(true);
    } catch (err: any) {
      setExcelMessage(err?.message || "Failed to preview questions from Excel.");
    } finally {
      setExcelUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  if (isLoading || !admin) return null;

  if (admin.role !== "admin") {
    return (
      <div className="p-6 pt-20 lg:pt-8 text-gray-300">
        You don’t have permission to access this page.
      </div>
    );
  }

  const handleFinish = async () => {
    if (!accessToken) return;
    if (!preparedQuestions || preparedQuestions.length === 0) {
      setExcelMessage('Preview and save questions first.');
      return;
    }

    setFinishing(true);
    setExcelMessage(null);
    try {
      const createRes = await auditFirmLearningApi.createEvaluationPaper(accessToken, {
        title: form.title,
        description: form.description,
        time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
        pass_marks: form.pass_marks ? Number(form.pass_marks) : null,
      });

      if (!createRes.success) {
        setExcelMessage(createRes.message || 'Failed to create.');
        return;
      }

      const newId = (createRes.data as any)?.id ? Number((createRes.data as any).id) : null;
      setCreatedPaperId(newId);
      if (!newId) {
        setExcelMessage('Failed to create paper (missing id).');
        return;
      }

      const attachRes = await auditFirmLearningApi.setEvaluationQuestions(accessToken, newId, preparedQuestions);
      if (!attachRes.success) {
        setExcelMessage(attachRes.message || 'Failed to attach questions.');
        return;
      }

      router.push('/learning/evaluation-papers');
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="h-screen bg-transparent flex">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <ExcelConfirmModal
          open={excelConfirmOpen}
          questions={excelPreviewQuestions}
          errors={excelPreviewErrors}
          onDiscard={() => {
            setExcelConfirmOpen(false);
            setExcelPreviewQuestions([]);
            setExcelPreviewErrors([]);
          }}
          onConfirm={() => {
            const mapped = excelPreviewQuestions.map(q => ({
              ...q,
              marks: 10
            }));
            setPreparedQuestions(mapped);
            setDraftRaw(JSON.stringify(mapped, null, 2));
            setExcelConfirmOpen(false);
          }}
        />

       <div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <button
      onClick={() => router.push("/learning/evaluation-papers")}
      className="p-2 rounded-xl text-gray-400 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all shrink-0"
    >
      <ArrowLeft size={18} />
    </button>
    <div>
      <h1 className="text-xl font-bold text-white">Create Evaluation Paper</h1>
      <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
        Create the paper, then upload questions (one time only)
      </p>
    </div>
  </div>
</div>

        <StepIndicator current={step} total={2} />

        {excelMessage && (
          <div className="glass rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 mt-0.5" />
            <pre className="text-xs text-red-200 whitespace-pre-wrap">{excelMessage}</pre>
          </div>
        )}

        {step === 1 ? (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <SectionHeader num={1} label="Paper Details" desc="Set the title, description and pass criteria" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <FieldLabel label="Title" />
                <input
                  className={inputCls}
                  value={form.title || ""}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <FieldLabel label="Description" />
                <textarea
                  className={inputCls}
                  value={form.description || ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel label="Time Limit (minutes)" />
                <input
                  className={inputCls}
                  type="number"
                  value={form.time_limit_minutes || ""}
                  onChange={(e) => setForm((p) => ({ ...p, time_limit_minutes: e.target.value }))}
                />
              </div>
              <div>
                <FieldLabel label="Pass Marks (%)" />
                <input
                  className={inputCls}
                  type="number"
                  step="any"
                  min={0}
                  max={100}
                  value={form.pass_marks || ""}
                  onChange={(e) => setForm((p) => ({ ...p, pass_marks: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl border border-white/10 p-6">
            <SectionHeader num={2} label="Upload Questions" desc="Upload Excel, preview, then attach to this paper" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel label="Excel File (.xlsx)" />
                  {excelUploading && (
                    <span className="flex items-center gap-1 text-xs text-secondary-400">
                      <Loader2 size={12} className="animate-spin" />
                      Parsing...
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileRef}
                  accept=".xlsx,.xls"
                  className={inputCls}
                  onChange={handleExcelUpload}
                  disabled={excelUploading}
                />
              </div>
              <div className="flex items-end">
                <button
                  disabled={!accessToken}
                  onClick={async () => {
                    if (!accessToken) return;
                    setExcelMessage(null);
                    const res = await auditFirmLearningApi.downloadEvaluationExcelTemplate(accessToken);
                    if (!res.success) {
                      setExcelMessage(res.message || "Failed to download template.");
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition-all disabled:opacity-50 h-[42px]"
                >
                  <Download size={16} />
                  Download Template
                </button>
              </div>
            </div>

            {preparedQuestions && preparedQuestions.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h3 className="text-white font-semibold text-sm">Uploaded Questions ({preparedQuestions.length})</h3>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {preparedQuestions.map((q, idx) => (
                    <div key={idx} className="border border-white/10 rounded-xl p-3 bg-white/[0.02]">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-bold text-secondary-400 shrink-0">Q{idx + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white font-medium break-words">{q.question_text}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-gray-400">
                            <span>Type: <span className="text-gray-300 capitalize">{q.answer_type.replace('_', ' ')}</span></span>
                          </div>
                        </div>
                      </div>
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="mt-2.5 pl-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((o: any, oi: number) => (
                            <div key={oi} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20 border border-white/5 text-xs text-gray-300">
                              <span className="truncate">{o.option_text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 transition-all"
              >
                Back
              </button>
              <button
                disabled={!accessToken || finishing}
                onClick={handleFinish}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50"
              >
                {finishing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Paper
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

