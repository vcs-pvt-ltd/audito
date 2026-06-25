"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { capApi } from "@/lib/api";
import CompleteCapModal from "@/components/cap/CompleteCapModal";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Play,
  TrendingUp,
  Clock,
  User,
  Send,
  Loader2,
  Zap,
  FileText,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui";

// ─── Types ───────────────────────────────────────────────────────

interface Cap {
  id: number;
  cap_plan_code: string;
  audit_id: number;
  audit_code: string;
  audit_title: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CapQuestion {
  id: number;
  cap_id: number;
  corrective_action_id: number;
  entity_code: string;
  org_tree_id: number | null;
  question_id: number;
  status: string;
  question_text: string;
  answer_type: string;
  total_marks: string | number;
  order_index: number;
  ca_description: string | null;
  responsible_person_code: string | null;
  responsible_person_name: string | null;
  due_date: string | null;
  severity: string;
  options: { id: number; option_text: string; marks: number }[];
}

interface CapEntity {
  id: number;
  cap_id: number;
  entity_code: string;
  entity_type: string;
}

interface CapProgress {
  id: number;
  cap_id: number;
  entity_code: string;
  org_tree_id: number | null;
  total_questions: number;
  answered_questions: number;
  status: string;
  completed_at: string | null;
}

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  children: TreeNode[];
  [key: string]: unknown;
}

interface EntityHead {
  user_code: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  assigned_entity_code: string;
}

interface CapResponse {
  cap_question_id: number;
  response_text: string | null;
  status: string;
  responded_by: string;
}

// ─── Config ──────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  plan: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  plan: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  Customer: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Buying Office": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Company: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Cluster: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  Factory: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Unit: "bg-green-500/20 text-green-300 border-green-500/30",
  Department: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Section": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Audit Firm Company": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Branch: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

const Q_STATUS_BADGE: Record<string, string> = {
  not_started: "bg-gray-500/15 text-gray-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-400",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function daysRemaining(endDate: string | null) {
  if (!endDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Progress Meter ───────────────────────────────────────────────

function ProgressMeter({
  pct,
  answered,
  total,
  dueDate,
}: {
  pct: number;
  answered: number;
  total: number;
  dueDate: string | null;
}) {
  const remaining = daysRemaining(dueDate);
  const isUrgent = remaining > 0 && remaining <= 5;
  const isOverdue = remaining <= 0;

  // Arc SVG params
  const r = 54;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * r; // half circle
  const strokeDash = (pct / 100) * circumference;

  const arcColor =
    pct === 100
      ? "#10b981"
      : isOverdue
        ? "#ef4444"
        : isUrgent
          ? "#f59e0b"
          : "#38bdf8";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Arc meter */}
      <div className="relative w-36 h-20 overflow-hidden">
        <svg viewBox="0 0 140 80" className="w-full h-full" style={{ overflow: "visible" }}>
          {/* Track */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Fill */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={arcColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${strokeDash} ${circumference}`}
            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s ease", filter: `drop-shadow(0 0 6px ${arcColor}80)` }}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-2xl font-bold text-white leading-none">{pct}%</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-gray-400">
          <span className="text-white font-semibold">{answered}</span>
          <span className="text-gray-600"> / {total} actions</span>
        </span>
      </div>
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────
// (Moved to execute page - no longer used on details page)

// ─── Page ─────────────────────────────────────────────────────────

export default function MyCapDetailPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm } = useUiFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();
  const capId = searchParams.get("id") as string;

  // Determine back route based on role
  const backPath = admin?.role === "admin" ? "/caps" : "/my-caps";

  const [cap, setCap] = useState<Cap | null>(null);
  const [questions, setQuestions] = useState<CapQuestion[]>([]);
  const [progress, setProgress] = useState<CapProgress[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [progressError, setProgressError] = useState("");

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken || !capId) return;
    setLoading(true);
    setError("");
    try {
      const detailRes = await capApi.get(accessToken, capId);
      if (detailRes.success && detailRes.data) {
        const data = detailRes.data as {
          cap: Cap;
          questions: CapQuestion[];
          entities: CapEntity[];
          progress: CapProgress[];
          tree: TreeNode | null;
        };
        setCap(data.cap);
        setQuestions(data.questions || []);
        setProgress(data.progress || []);
        setTree(data.tree || null);
      } else {
        setError(detailRes.message || "Failed to load CAP details.");
      }
    } catch {
      setError("Network error.");
    }
    setLoading(false);
  }, [accessToken, capId]);

  useEffect(() => { load(); }, [load]);

  const handleOpenComplete = async () => {
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!accessToken || !cap) return;
    setCompleting(true);
    setProgressError("");
    const res = await capApi.complete(accessToken, capId);
    if (res.success) {
      setShowCompleteModal(false);
      await load();
    } else {
      setProgressError(res.message || "Failed to complete CAP.");
    }
    setCompleting(false);
  };

  // Calculate progress
  const totalQ = questions.length;
  const completedQ = questions.filter(q => q.status === "completed").length;
  const pct = totalQ > 0 ? Math.round((completedQ / totalQ) * 100) : 0;
  const allCompleted = progress.length > 0 && progress.every(p => p.status === "completed");

  if (isLoading || loading) return <Loading />;
  if (!admin) return null;

  if (error || !cap) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center border border-white/10">
          <AlertCircle className="text-red-500 w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error || "Could not load CAP details"}</p>
          <button onClick={() => router.back()} className="w-full bg-white/5 py-3 rounded-xl text-white font-bold">Back</button>
        </div>
      </div>
    );
  }

  const isCompleted = cap.status === "completed";
  const isInProgress = cap.status === "in_progress";
  const isPending = cap.status === "plan" || cap.status === "pending";

  return (
    <div className="min-h-screen text-white pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <IconButton bordered onClick={() => router.push(backPath)}>
            <ArrowLeft size={18} />
          </IconButton>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black font-semibold truncate">{cap.title}</h1>
          </div>
        </div>

        {/* Info & Progress Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Hero Card */}
          <div className="lg:col-span-8 glass rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${isCompleted ? 'bg-emerald-500' : isInProgress ? 'bg-blue-500' : 'bg-amber-500'}`} />

            <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
              <ProgressMeter
                pct={pct}
                answered={completedQ}
                total={totalQ}
                dueDate={null}
              />
              <div className="flex-1 space-y-6 text-center sm:text-left w-full">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Created Date</p>
                    <p className="text-sm font-semibold">{fmtDate(cap.created_at)}</p>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Last Updated</p>
                    <p className="text-sm font-semibold">{fmtDate(cap.updated_at)}</p>
                  </div>
                </div>

                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex gap-3 text-left">
                  <ClipboardList size={16} className="text-gray-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">Source Audit</p>
                    <p className="text-xs text-gray-300 font-medium truncate">{cap.audit_title}</p>
                  </div>
                </div>

                {cap.description && (
                  <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex gap-3 text-left">
                    <FileText size={16} className="text-gray-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-400 leading-relaxed italic">{cap.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5">
              {isPending && (
                <Button
                  fullWidth
                  onClick={() => router.push(`/my-caps/execute?id=${capId}`)}
                  leftIcon={<Zap size={18} />}
                  className="py-3 rounded-xl font-black shadow-lg shadow-secondary-500/15"
                >
                  Start CAP
                </Button>
              )}
              {isInProgress && (
                <>
                  <button
                    onClick={() => router.push(`/my-caps/execute?id=${capId}`)}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/15"
                  >
                    <Zap size={18} /> Continue
                  </button>
                  {pct >= 100 && (
                    <button
                      onClick={handleOpenComplete}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15"
                    >
                      <CheckCircle2 size={18} /> Complete
                    </button>
                  )}
                </>
              )}
              {isCompleted && (
                <>
                  <Button
                    variant="secondary"
                    fullWidth
                    disabled
                    leftIcon={<Zap size={18} />}
                    className="py-3 rounded-xl font-black"
                  >
                    Completed
                  </Button>
                  <button
                    onClick={() => router.push(`/my-caps/report?id=${capId}`)}
                    className="w-full bg-emerald-500 text-primary-950 font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15"
                  >
                    <BarChart3 size={18} /> Report
                  </button>
                </>
              )}

              <Button
                variant="secondary"
                fullWidth
                onClick={() => router.push(`/my-caps/preview?id=${capId}`)}
                leftIcon={<Building2 size={17} />}
                className="py-3 rounded-xl font-bold glass"
              >
                Preview
              </Button>
            </div>
          </div>

          {/* Side Cards */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass rounded-3xl p-6 border border-white/10 flex flex-col items-center justify-center text-center space-y-2">
              <TrendingUp size={32} className="text-secondary-400 mb-2" />
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan Efficiency</h4>
              <p className="text-3xl font-black text-white">{pct}%</p>
              <p className="text-[10px] text-gray-500">Based on action completion</p>
            </div>

            <button
              onClick={() => isCompleted && router.push(`/my-caps/corrective-actions?id=${capId}`)}
              className={`w-full glass rounded-3xl p-6 border transition-all flex flex-col items-center justify-center text-center group border-white/10 hover:border-secondary-500/30 cursor-pointer`}
            >
              <ClipboardList size={32} className={`${isCompleted ? "text-gray-500 group-hover:text-secondary-400" : "text-gray-700"} mb-2 transition-colors`} />
              <h4 className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isCompleted ? "text-gray-400 group-hover:text-white" : "text-gray-600"}`}>Recursive CAPs</h4>
              <p className="text-[10px] text-gray-600 mt-2">
                {isCompleted ? "Manage nested findings" : "Available after resolution"}
              </p>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>

      <CompleteCapModal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onConfirm={handleConfirmComplete}
        loading={completing}
        progress={progress}
        error={progressError}
        accessToken={accessToken!}
        capId={capId}
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="h-screen bg-transparent flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
