"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditApi, auditExecutionApi } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  FileText,
  PlayCircle,
  Zap,
  CheckCircle2,
  BarChart3,
  ClipboardList,
  Building2,
  Clock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import CompleteAuditModal, { EntityProgress } from "@/components/audit/CompleteAuditModal";
import { Button, IconButton } from "@/components/ui";

// --- Components ---

function ProgressMeter({
  pct,
  answered,
  total,
  endDate,
}: {
  pct: number;
  answered: number;
  total: number;
  endDate: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  const remaining = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const isUrgent = remaining > 0 && remaining <= 5;
  const isOverdue = remaining <= 0;

  const r = 54;
  const cx = 70;
  const cy = 70;
  const circumference = Math.PI * r;
  const strokeDash = (pct / 100) * circumference;

  const arcColor = pct === 100 ? "#10b981" : isOverdue ? "#ef4444" : isUrgent ? "#f59e0b" : "#38bdf8";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-40 h-24">
        <svg viewBox="0 0 140 80" className="w-full h-full">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={arcColor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${strokeDash} ${circumference}`}
            className="transition-all duration-1000 ease-in-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-3xl font-black text-white leading-none">{Math.round(pct)}%</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
          <span className="text-white font-bold text-xs">{answered}</span>
          <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">/ {total} Questions</span>
        </div>
        {isOverdue ? (
          <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest mt-1">Overdue</span>
        ) : (
          <div className="flex items-center gap-1 mt-1">
            <Clock size={10} className={isUrgent ? "text-amber-400" : "text-gray-600"} />
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isUrgent ? "text-amber-400" : "text-gray-600"}`}>
              {remaining} Days Left
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MyAuditDetailsContent() {
  const { admin, accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id");

  useEffect(() => {
    if (!auditId) {
      router.replace("/my-audits");
    }
  }, [auditId, router]);

  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [starting, setStarting] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const loadAudit = useCallback(async () => {
    if (!accessToken || !auditId) return;
    setLoading(true);
    try {
      const res = await auditExecutionApi.getDetail(accessToken, auditId);
      if (res.success && res.data) {
        const data = res.data as { audit: any };
        let auditData = data.audit;

        // Fetch responses to calculate marks
        const respRes = await auditExecutionApi.getResponses(accessToken, auditId);

        let total = 0;
        let answered = 0;
        let totalMarks = 0;
        let obtainedMarks = 0;

        // Use progress from getDetail when available
        const progress = auditData.entity_progress || [];
        if (progress.length > 0) {
          total = progress.reduce((s: number, p: any) => s + (p.total_questions || 0), 0);
          answered = progress.reduce((s: number, p: any) => s + (p.answered_questions || 0), 0);
        } else {
          // Fallback: count questions from entity_questions
          const eqs = auditData.entity_questions || [];
          for (const eq of eqs) {
            const qs = eq.questions || [];
            total += qs.length;
          }
        }

        if (respRes.success && respRes.data) {
          const rd = respRes.data as { responses: any[] };
          obtainedMarks = rd.responses.reduce((s, r) => s + (Number(r.marks_obtained) || 0), 0);
          // Total marks is harder without the full checklist questions here, 
          // but we can estimate or focus on progress/count for now.
        }

        auditData = {
          ...auditData,
          progress_pct: total > 0 ? (answered / total) * 100 : 0,
          answered_questions: answered,
          total_questions: total,
          obtained_marks: obtainedMarks,
          pending_count: Math.max(0, total - answered)
        };

        setAudit(auditData);
      } else {
        setError(res.message || "Audit not found.");
      }
    } catch {
      setError("Network error.");
    }
    setLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  if (loading) return <Loading />;

  if (error || !audit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center border border-white/10">
          <AlertTriangle className="text-red-500 w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error || "Could not load audit details"}</p>
          <Button variant="secondary" fullWidth onClick={() => router.back()}>Back</Button>
        </div>
      </div>
    );
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const isCompleted = audit.status === "completed";
  const isInProgress = audit.status === "in_progress";
  const isPending = audit.status === "plan" || audit.status === "pending";

  const handleStart = async () => {
    if (!accessToken || !auditId) return;
    setStarting(true);
    const res = await auditExecutionApi.start(accessToken, auditId);
    setStarting(false);
    if (res.success) {
      router.push(`/my-audits/execute?id=${auditId}`);
    }
  };

  const handleComplete = async () => {
    if (!accessToken || !auditId) return;
    setCompleting(true);
    setCompleteError("");
    const res = await auditExecutionApi.complete(accessToken, auditId);
    if (res.success) {
      setCompleteModalOpen(false);
      loadAudit(); // Refresh data
    } else {
      setCompleteError(res.message || "Failed to complete audit.");
    }
    setCompleting(false);
  };

  return (
    <div className="min-h-screen text-white pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <IconButton bordered onClick={() => router.push("/my-audits")}>
            <ArrowLeft size={18} />
          </IconButton>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black font-semibold">{audit.title}</h1>

          </div>
        </div>

        {/* Info & Progress Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Hero Card */}
          <div className="lg:col-span-8 glass rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${isCompleted ? 'bg-emerald-500' : isInProgress ? 'bg-blue-500' : 'bg-amber-500'}`} />

            <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
              <ProgressMeter
                pct={audit.progress_pct || 0}
                answered={audit.answered_questions || 0}
                total={audit.total_questions || 0}
                endDate={audit.end_date}
              />
              <div className="flex-1 space-y-6 text-center sm:text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Start Date</p>
                    <p className="text-sm font-semibold">{fmtDate(audit.start_date)}</p>
                  </div>
                  <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Expiry Date</p>
                    <p className="text-sm font-semibold">{fmtDate(audit.end_date)}</p>
                  </div>
                </div>
                {audit.notes && (
                  <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex gap-3 text-left">
                    <FileText size={16} className="text-gray-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-400 leading-relaxed italic">{audit.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5">
              {isPending && (
                <Button fullWidth leftIcon={starting ? undefined : <PlayCircle size={18}/>} loading={starting} onClick={handleStart}>Start Audit</Button>
              )}
              {isInProgress && (
                <>
                  <button
                    onClick={() => router.push(`/my-audits/execute?id=${audit.audit_id}`)}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/15"
                  >
                    <Zap size={18} /> Continue
                  </button>
                  {audit.progress_pct >= 100 && (
                    <button
                      onClick={() => setCompleteModalOpen(true)}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15"
                    >
                      <CheckCircle2 size={18} /> Complete
                    </button>
                  )}
                </>
              )}
              {isCompleted && (
                <>
                  <button
                    disabled
                    className="w-full bg-white/[0.03] text-gray-500 font-black py-3 rounded-xl text-sm border border-white/10 flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Zap size={18} /> Completed
                  </button>
                  <button
                    onClick={() => router.push(`/my-audits/report?id=${audit.audit_id}`)}
                    className="w-full bg-emerald-500 text-primary-950 font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15"
                  >
                    <BarChart3 size={18} /> Report
                  </button>
                </>
              )}

              <button
                onClick={() => router.push(`/my-audits/preview?id=${audit.audit_id}`)}
                className="w-full glass hover:bg-white/5 text-gray-300 font-bold py-3 rounded-xl text-sm border border-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Building2 size={17} /> Preview
              </button>
            </div>
          </div>

          {/* Side Cards */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass rounded-3xl p-6 border border-white/10 flex flex-col items-center justify-center text-center space-y-2">
              <TrendingUp size={32} className="text-secondary-400 mb-2" />
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Efficiency</h4>
              <p className="text-3xl font-black text-white">{Math.round(audit.progress_pct || 0)}%</p>
              <p className="text-[10px] text-gray-500">Based on audit progress</p>
            </div>

            <button
              onClick={() => isCompleted && router.push(`/my-audits/corrective-actions?id=${audit.audit_id}`)}
              className={`w-full glass rounded-3xl p-6 border transition-all flex flex-col items-center justify-center text-center group border-white/10 hover:border-secondary-500/30 cursor-pointer`}
            >
              <ClipboardList size={32} className={`${isCompleted ? "text-gray-500 group-hover:text-secondary-400" : "text-gray-700"} mb-2 transition-colors`} />
              <h4 className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isCompleted ? "text-gray-400 group-hover:text-white" : "text-gray-600"}`}>CAP Actions</h4>
              <p className="text-[10px] text-gray-600 mt-2">
                {isCompleted ? "Manage findings & resolutions" : "Available after completion"}
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

      {audit && (
        <CompleteAuditModal
          open={completeModalOpen}
          onClose={() => setCompleteModalOpen(false)}
          onConfirm={handleComplete}
          loading={completing}
          error={completeError}
          accessToken={accessToken!}
          auditId={audit.audit_id}
          progress={audit.entity_progress as any}
        />
      )}
    </div>
  );
}

export default function MyAuditDetailsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MyAuditDetailsContent />
    </Suspense>
  );
}
