"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { myLearningApi } from "@/lib/api";
import { ArrowLeft, CheckCircle2, Circle, Loader2, Clock, AlertTriangle, Trophy } from "lucide-react";

interface Paper {
  id: number;
  title: string;
  description?: string | null;
  time_limit_minutes?: number | null;
  pass_marks?: number | null;
  due_date?: string | null;
  assignment_status?: string;
}

interface Option {
  id: number;
  option_text: string;
  marks?: number;
}

interface Question {
  id: number;
  question_text: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  marks: number;
  sort_order: number;
  options: Option[];
}

type AnswerState =
  | { answer_type: "free_text"; answer_text: string }
  | { answer_type: "single_option" | "dropdown"; selected_option_id: number | null }
  | { answer_type: "multiple_options"; selected_option_ids: number[] };

export default function EvaluationPaperAttemptPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { alert } = useUiFeedback();
  const searchParams = useSearchParams();
  const router = useRouter();

  const paperId = Number(searchParams.get("id"));

  const [paper, setPaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; max_score: number; passed: boolean | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  const maxScore = useMemo(
    () => questions.reduce((sum, q) => sum + Number(q.marks || 0), 0),
    [questions]
  );

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    const res = await myLearningApi.getEvaluationPaper(accessToken, paperId);
    if (!res.success) {
      setError(res.message || "Failed to load evaluation paper.");
      setLoading(false);
      return;
    }

    const d = res.data as any;
    
    // Check closing date
    if (d.paper.due_date && new Date() > new Date(d.paper.due_date)) {
      setError("The closing date for this evaluation paper has passed. You can no longer attempt it.");
      setLoading(false);
      return;
    }

    // Check status
    if (d.paper.assignment_status === "submitted") {
      setError("You have already submitted this evaluation paper.");
      setLoading(false);
      return;
    }

    setPaper(d.paper);
    setQuestions(d.questions || []);

    // init blank answers
    const initial: Record<number, AnswerState> = {};
    (d.questions || []).forEach((q: any) => {
      const t = q.answer_type as Question["answer_type"];
      if (t === "free_text") initial[q.id] = { answer_type: "free_text", answer_text: "" };
      else if (t === "multiple_options") initial[q.id] = { answer_type: "multiple_options", selected_option_ids: [] };
      else initial[q.id] = { answer_type: t || "single_option", selected_option_id: null } as AnswerState;
    });
    setAnswers(initial);

    // Setup timer
    if (d.paper.time_limit_minutes && d.paper.time_limit_minutes > 0) {
      setTimeLeftSeconds(d.paper.time_limit_minutes * 60);
      setTimerActive(true);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!accessToken || !Number.isFinite(paperId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, paperId]);

  const handleSubmit = async (isAutoSubmit = false) => {
    if (!accessToken) return;
    setSubmitting(true);
    setResult(null);
    setTimerActive(false);

    try {
      const payloadAnswers = Object.entries(answers).map(([qid, a]) => {
        if (a.answer_type === "free_text") {
          return { question_id: Number(qid), answer_text: a.answer_text };
        }
        if (a.answer_type === "multiple_options") {
          return { question_id: Number(qid), selected_option_ids: a.selected_option_ids };
        }
        return { question_id: Number(qid), selected_option_id: a.selected_option_id };
      });

      const res = await myLearningApi.submitEvaluationPaper(accessToken, paperId, payloadAnswers);
      if (res.success && res.data) {
        const d = res.data as any;
        setResult({ score: d.score, max_score: d.max_score, percent: d.percent ?? (d.max_score ? Math.round((d.score / d.max_score) * 100) : 0), passed: d.passed ?? null });
        if (isAutoSubmit) {
          await alert({
            title: "Time Limit Reached",
            message: "Your attempt has been automatically submitted.",
            variant: "warning",
          });
        }
      } else {
        setError(res.message || "Submit failed.");
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred during submission.");
    } finally {
      setSubmitting(false);
    }
  };

  // Timer Tick-Down Effect
  useEffect(() => {
    if (!timerActive || timeLeftSeconds === null) return;

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading || !admin) return null;

  if (admin.role !== "auditor") {
    return (
      <div className="p-6 pt-20 lg:pt-8 text-gray-300">
        Only auditors can access this page.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 pt-20 lg:pt-8 text-gray-400 flex items-center gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-4">
        <button
          onClick={() => router.push("/my-learning/evaluation-papers")}
          className="text-gray-300 hover:text-white inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="glass border border-red-500/20 bg-red-500/10 rounded-2xl p-5 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="p-6 lg:p-8 pt-20 lg:pt-8 max-w-2xl mx-auto space-y-6 text-center">
        <div className="glass border border-white/10 rounded-3xl p-8 space-y-6 flex flex-col items-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-tr ${
            result.passed
              ? "from-emerald-500/20 to-teal-500/30 border border-emerald-500/30 text-emerald-400"
              : "from-red-500/20 to-orange-500/30 border border-red-500/30 text-red-400"
          }`}>
            {result.passed ? <Trophy size={40} /> : <AlertTriangle size={40} />}
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Evaluation Completed!</h2>
            <p className="text-gray-400 text-sm">{paper?.title}</p>
          </div>

          <div className="glass bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Your Score</p>
              <p className="text-3xl font-extrabold text-white mt-1">
                  <span className="text-secondary-400">{result.percent ?? (result.max_score ? Math.round((result.score / result.max_score) * 100) : 0)}%</span>
                </p>
            </div>
            
            <div className="h-px bg-white/10" />

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Result Status</span>
              <span className={`font-bold px-3 py-1 rounded-full text-xs uppercase ${
                result.passed 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {result.passed ? "Passed" : "Failed"}
              </span>
            </div>
          </div>

          <button
            onClick={() => router.push("/my-learning/evaluation-papers")}
            className="w-full max-w-xs px-6 py-3 rounded-xl font-bold text-primary-950 bg-secondary-500 hover:bg-secondary-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-secondary-500/10 hover:shadow-secondary-500/25"
          >
            <ArrowLeft size={16} /> Back to Evaluation Papers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/my-learning/evaluation-papers")}
            className="text-gray-300 hover:text-white inline-flex items-center gap-2 text-sm"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-xl font-bold text-white mt-2">{paper?.title}</h1>
          {paper?.description && <p className="text-sm text-gray-400 mt-1">{paper.description}</p>}
          <p className="text-xs text-gray-500 mt-2">
            Total marks: {maxScore}
            {paper?.time_limit_minutes ? `  |  Time limit: ${paper.time_limit_minutes} min` : ""}
            {paper?.pass_marks ? `  |  Pass: ${paper.pass_marks}%` : ""}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {timeLeftSeconds !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border ${
              timeLeftSeconds < 60
                ? "border-red-500/30 bg-red-500/10 text-red-400 animate-pulse"
                : "border-secondary-500/30 bg-secondary-500/10 text-secondary-400"
            }`}>
              <Clock size={16} />
              <span>{timeLeftSeconds === 0 ? "Time's up!" : formatTime(timeLeftSeconds)}</span>
            </div>
          )}

          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting || questions.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="glass border border-white/10 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white font-semibold">Q{idx + 1}. {q.question_text}</p>
                <p className="text-xs text-gray-500 mt-1">Marks: {q.marks}</p>
              </div>
            </div>

            {q.answer_type === "free_text" ? (
              <div className="mt-4">
                <textarea
                  value={(() => {
                    const a = answers[q.id];
                    if (a && a.answer_type === "free_text" && "answer_text" in a) return a.answer_text;
                    return "";
                  })()}
                  onChange={(e) =>
                    setAnswers((p) => ({
                      ...p,
                      [q.id]: { answer_type: "free_text", answer_text: e.target.value },
                    }))
                  }
                  className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-colors"
                  placeholder="Type your answer..."
                />
                <p className="text-xs text-gray-500 mt-2">This question is not auto-scored.</p>
              </div>
            ) : q.answer_type === "multiple_options" ? (
              <div className="mt-4 space-y-2">
                {q.options.map((o) => {
                  const current = answers[q.id];
                  const selectedIds = current && current.answer_type === "multiple_options" && "selected_option_ids" in current
                    ? current.selected_option_ids
                    : [];
                  const checked = selectedIds.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() =>
                        setAnswers((p) => {
                          const cur = p[q.id];
                          const ids = cur && cur.answer_type === "multiple_options" && "selected_option_ids" in cur
                            ? [...cur.selected_option_ids]
                            : [];
                          const next = checked ? ids.filter((x) => x !== o.id) : [...ids, o.id];
                          return { ...p, [q.id]: { answer_type: "multiple_options", selected_option_ids: next } };
                        })
                      }
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-2 ${
                        checked
                          ? 'border-secondary-500/60 bg-secondary-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {checked ? (
                        <CheckCircle2 size={16} className="text-secondary-400 mt-0.5" />
                      ) : (
                        <Circle size={16} className="text-gray-500 mt-0.5" />
                      )}
                      <span className="text-sm text-gray-200">
                        {o.option_text}
                        {typeof o.marks === 'number' ? (
                          <span className="text-xs text-gray-500"> {`(+${o.marks})`}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {q.options.map((o) => {
                  const current = answers[q.id];
                  const selectedId = current && (current.answer_type === "single_option" || current.answer_type === "dropdown")
                    ? current.selected_option_id
                    : null;
                  const checked = selectedId === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() =>
                        setAnswers((p) => ({
                          ...p,
                          [q.id]: { answer_type: q.answer_type, selected_option_id: o.id } as AnswerState,
                        }))
                      }
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-2 ${
                        checked
                          ? 'border-secondary-500/60 bg-secondary-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {checked ? (
                        <CheckCircle2 size={16} className="text-secondary-400 mt-0.5" />
                      ) : (
                        <Circle size={16} className="text-gray-500 mt-0.5" />
                      )}
                      <span className="text-sm text-gray-200">
                        {o.option_text}
                        {typeof o.marks === 'number' ? (
                          <span className="text-xs text-gray-500"> {`(+${o.marks})`}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
