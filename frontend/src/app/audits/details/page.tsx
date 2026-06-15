"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditApi, auditExecutionApi } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Eye,
  FileText,
  Mail,
  ClipboardList,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  Phone,
  User,
  Users,
  Camera,
  Video,
  Music,
  Paperclip,
} from "lucide-react";
import { 
  getEvidenceUrl, 
  inferEvidenceKind, 
  normalizeSelectedOptionIds, 
  progressKey,
  calculateProgress 
} from "@/utils/executionService";
import { ENTITY_TYPE_COLORS } from "@/utils/executionFormatters";

// --- Interfaces ---

interface AuditEntity {
  entity_code: string;
  entity_type: string;
  entity_name: string;
  org_tree_id?: number | null;
}

interface AuditDetail {
  id: number;
  title: string;
  status: string;
  entities: AuditEntity[];
  checklist_name?: string;
  checklist_id?: number;
  budget: string | number | null;
  currency: string | null;
  num_workers: number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  time_period_value?: number | string | null;
  time_period_unit?: string | null;
  auditor_name?: string | null;
  auditor_email?: string | null;
  auditor_phone?: string | null;
  assigned_company?: {
    name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    entity_type?: string | null;
  } | null;
}

interface QuestionOption {
  id: number;
  option_text: string;
  marks: number;
}

interface AuditQuestion {
  id: number;
  question_text: string;
  answer_type: string;
  total_marks: number;
  order_index: number;
  options: QuestionOption[];
}

interface AuditResponse {
  id: number;
  question_id: number;
  entity_code: string;
  org_tree_id: number;
  answer_text: string | null;
  selected_option_ids: string | null | number[];
  marks_obtained: number;
  remarks: string | null;
  status: string;
  evidence: { id: number; file_type: string; file_path: string; file_name: string }[];
}

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: number | null;
  children?: TreeNode[];
}

// --- Helper Functions ---

function formatAnswer(q: AuditQuestion, r?: AuditResponse): string {
  const answerText = (r?.answer_text || "").trim();
  const selected = normalizeSelectedOptionIds(r?.selected_option_ids || null);
  const selectedText = (q.options || [])
    .filter((o) => selected.includes(o.id))
    .map((o) => o.option_text);
  const optStr = selectedText.length ? selectedText.join(", ") : "";
  if (answerText && optStr) return `${answerText} (${optStr})`;
  if (answerText) return answerText;
  if (optStr) return optStr;
  return "";
}

function ProgressRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  let color = "#ef4444";
  if (clamped >= 100) color = "#34d399";
  else if (clamped > 0) color = "#38bdf8";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="4" fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">{clamped}%</div>
    </div>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "Not set";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function money(value?: string | number | null, currency?: string | null) {
  if (value === null || value === undefined || value === "") return "Not set";
  return `${currency || ""} ${value}`.trim();
}

function DetailStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary-500/10 text-secondary-400 border border-secondary-500/20 flex items-center justify-center shrink-0">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{label}</p>
          <p className="text-sm text-white font-semibold break-words">{value}</p>
          {detail && <p className="text-xs text-gray-500 mt-1 break-words">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

function ContactLine({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <Icon size={16} className="text-secondary-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm text-white font-semibold break-words">{value || "Not available"}</p>
      </div>
    </div>
  );
}

// --- Components ---

function EntityCard({
  node,
  index,
  questionsByKey,
  responsesByQuestionId,
  onClick,
}: {
  node: TreeNode;
  index: number;
  questionsByKey: Record<string, AuditQuestion[]>;
  responsesByQuestionId: Record<number, AuditResponse>;
  onClick: () => void;
}) {
  const getSubtreeProgress = (n: TreeNode) => {
    let t = 0;
    let a = 0;
    const walk = (nd: TreeNode) => {
      const k = progressKey(nd.code, nd.edge_id ?? null);
      const qs = questionsByKey[k] || [];
      const ans = qs.reduce((s, q) => {
        const hasAns = !!formatAnswer(q, responsesByQuestionId[q.id]);
        return s + (hasAns ? 1 : 0);
      }, 0);
      t += qs.length;
      a += ans;
      (nd.children || []).forEach(walk);
    };
    walk(n);
    return { total: t, answered: a };
  };

  const { total, answered } = getSubtreeProgress(node);
  const pct = calculateProgress(answered, total);
  const status = pct >= 100 ? "Completed" : answered > 0 ? "In Progress" : "Not Started";
  const statusCls = pct >= 100 ? "bg-emerald-500 text-white" : answered > 0 ? "bg-blue-500 text-white" : "bg-gray-600 text-white";

  return (
    <div
      onClick={onClick}
      className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer transition-all hover:border-white/20 hover:shadow-lg hover:shadow-black/20 group"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-800 to-primary-800/60">
        <span className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-secondary-500/30">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{node.name || node.code}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded inline-block mt-0.5 ${ENTITY_TYPE_COLORS[node.entity_type] || "bg-white/10 text-gray-300"}`}>
            {node.entity_type}
          </span>
        </div>
        <ChevronRight size={18} className="text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-5">
          <ProgressRing pct={pct} />
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span className="text-gray-400">{answered} / {total} Answered</span>
            </div>
            {(node.children || []).length > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <Building2 size={11} />
                <span>{(node.children || []).length} Subsections</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <span className={`text-[10px] font-semibold px-3 py-1 rounded-full ${statusCls}`}>{status}</span>
        </div>
      </div>
    </div>
  );
}

function QuestionPreviewCard({
  question,
  response,
  index,
}: {
  question: AuditQuestion;
  response?: AuditResponse;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const ans = formatAnswer(question, response);
  const pending = !ans;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${pending ? "border-white/[0.06] bg-white/[0.02]" : "border-emerald-500/20 bg-white/[0.03]"}`}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-500 font-mono">
          {index}
        </span>
        <p className={`text-sm flex-1 ${open ? "text-white font-medium" : "text-gray-300 truncate"}`}>{question.question_text}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${pending ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"}`}>
          {pending ? "Pending" : "Answered"}
        </span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/[0.06]">
          <div className="pt-3 space-y-3">
            <div>
              <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider font-bold">Answer</p>
              {ans ? (
                <p className="text-sm text-secondary-400 font-medium">{ans}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">No answer yet</p>
              )}
            </div>
            {Number(question.total_marks) > 0 && ans && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">Score</span>
                <span className="text-sm font-semibold text-white">{response?.marks_obtained ?? 0}</span>
                <span className="text-sm text-gray-500">/ {Number(question.total_marks) || 0}</span>
              </div>
            )}
            {response?.remarks && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider font-bold">Remarks</p>
                <p className="text-xs text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">{response.remarks}</p>
              </div>
            )}
            {(response?.evidence || []).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 justify-between">
                  <div className="flex items-center gap-1.5 ">
                    <Camera size={12} className="text-secondary-400" />
                    <span>{response?.evidence?.length} evidence file{(response?.evidence?.length ?? 0) !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(response?.evidence || []).map((ev) => {
                    const kind = inferEvidenceKind(ev.file_type, ev.file_name, ev.file_path);
                    const url = getEvidenceUrl(ev.file_path);
                    return (
                      <a key={ev.id} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] p-2 hover:border-white/20">
                        {kind === "image" ? (
                          <img src={url} alt={ev.file_name} className="w-full h-24 object-cover rounded-md" />
                        ) : (
                          <div className="w-full h-24 rounded-md bg-white/[0.04] flex items-center justify-center text-gray-300">
                            {kind === "video" ? <Video size={18} /> : kind === "audio" ? <Music size={18} /> : <Paperclip size={18} />}
                          </div>
                        )}
                        <p className="mt-1 text-[11px] text-gray-400 truncate">{ev.file_name || "Evidence"}</p>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditDetailsContent() {
  const { admin, accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id");

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [questions, setQuestions] = useState<AuditQuestion[]>([]);
  const [responses, setResponses] = useState<AuditResponse[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const [stepHistory, setStepHistory] = useState<
    ({ mode: "cards"; parentCode: string | null } | { mode: "questions"; entityCode: string; orgTreeId: number | null })[]
  >([{ mode: "cards", parentCode: null }]);

  const fetchAuditData = useCallback(async () => {
    if (!accessToken || !auditId) return;

    try {
      setLoading(true);
      const [detailRes, itemsRes, responsesRes, treeRes] = await Promise.all([
        auditApi.get(accessToken, auditId),
        auditExecutionApi.getDetail(accessToken, auditId),
        auditExecutionApi.getResponses(accessToken, auditId),
        auditExecutionApi.getEntityTree(accessToken, auditId),
      ]);
      
      if (detailRes.success && detailRes.data) {
        setAudit((detailRes.data as any).audit);
        setQuestions((detailRes.data as any).audit.entities || []); // Fallback or use detail
      }

      if (itemsRes.success && itemsRes.data) {
        const auditData = (itemsRes.data as any).audit;
        const allQs: AuditQuestion[] = [];
        for (const eq of auditData.entity_questions || []) {
          // Flatten questions if needed, or identify them by entity_code + org_tree_id
          // For the preview map, we'll store them by entity key
          (eq.questions || []).forEach((q: any) => {
            allQs.push({
               ...q,
               entity_code: eq.entity_code,
               org_tree_id: (eq as any).org_tree_id ?? null
            });
          });
        }
        setQuestions(allQs);
      }

      if (responsesRes.success && responsesRes.data) {
        setResponses((responsesRes.data as any).responses || []);
      }

      if (treeRes.success && treeRes.data) {
        setTree((treeRes.data as any).tree || null);
      }
    } catch (err) {
      console.error("Error fetching audit details:", err);
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, auditId]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  const questionsByKey = useMemo(() => {
    const m: Record<string, AuditQuestion[]> = {};
    for (const q of questions) {
      const k = progressKey((q as any).entity_code, (q as any).org_tree_id ?? null);
      if (!m[k]) m[k] = [];
      m[k].push(q);
    }
    return m;
  }, [questions]);

  const responsesByQuestionId = useMemo(() => {
    const m: Record<number, AuditResponse> = {};
    for (const r of responses) m[r.question_id] = r;
    return m;
  }, [responses]);

  if (loading) return <Loading />;

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center border border-white/10 shadow-2xl">
          <AlertTriangle className="text-red-500 w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error || "Audit not found"}</p>
          <button
            onClick={() => router.back()}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const findInTree = (code: string) => {
    const walk = (n: TreeNode): TreeNode | null => {
      if (n.code === code) return n;
      for (const c of n.children || []) {
        const f = walk(c);
        if (f) return f;
      }
      return null;
    };
    return tree ? walk(tree) : null;
  };

  const findNodeByEdgeId = (node: TreeNode, edgeId: number): TreeNode | null => {
    if (node.edge_id === edgeId) return node;
    for (const c of node.children || []) {
      const f = findNodeByEdgeId(c, edgeId);
      if (f) return f;
    }
    return null;
  };

  const subtreeHasQuestions = (node: TreeNode | null): boolean => {
    if (!node) return false;
    const k = progressKey(node.code, node.edge_id ?? null);
    if ((questionsByKey[k] || []).length > 0) return true;
    return (node.children || []).some(subtreeHasQuestions);
  };

  return (
    <div className="min-h-screen bg-transparent text-white pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push(`/audits`)}
            className="p-2 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardList size={22} className="text-secondary-400" />
              Preview Audit
            </h1>
            {audit && (
              <p className="text-sm text-gray-400 mt-0.5 font-mono truncate">
                {audit.title}
              </p>
            )}
          </div>
        </div>

      

        {!showPreview ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest mb-2">Audit Details</p>
                  <h2 className="text-2xl font-black text-white mb-2 break-words">{audit.title}</h2>
                  <p className="text-sm text-gray-400 max-w-2xl">
                    Review the assignment information before opening the question preview.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className="w-full sm:w-auto bg-secondary-500 hover:bg-secondary-400 text-primary-950 font-black px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-secondary-500/15"
                >
                  <Eye size={18} /> Preview Questions
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary-500/10 text-secondary-400 border border-secondary-500/20 flex items-center justify-center">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest">Auditor Details</p>
                      <h3 className="text-lg font-black text-white">{audit.auditor_name || "Not assigned"}</h3>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ContactLine icon={Mail} label="Email" value={audit.auditor_email} />
                    <ContactLine icon={Phone} label="Phone" value={audit.auditor_phone} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary-500/10 text-secondary-400 border border-secondary-500/20 flex items-center justify-center">
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest">Audit Details</p>
                      <h3 className="text-lg font-black text-white">{audit.checklist_name || "Checklist not selected"}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DetailStat icon={Calendar} label="Timeline" value={`${fmtDate(audit.start_date)} - ${fmtDate(audit.end_date)}`} />
                    <DetailStat icon={DollarSign} label="Budget" value={money(audit.budget, audit.currency)} />
                    <DetailStat icon={Users} label="Workers" value={audit.num_workers ? `${audit.num_workers}` : "Not set"} />
                    <DetailStat
                      icon={Clock}
                      label="Checklist Duration"
                      value={audit.time_period_value && audit.time_period_unit ? `${audit.time_period_value} ${audit.time_period_unit}` : "Not set"}
                    />
                  </div>
                  {audit.notes && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex gap-3">
                      <FileText size={16} className="text-gray-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-400 leading-relaxed">{audit.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : tree ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-secondary-400 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Audit Details
              </button>
            </div>
            {(() => {
              const step = stepHistory[stepHistory.length - 1];
              const isRoot = step.mode === "cards" && step.parentCode === null;

              const breadcrumbNodes: { label: string; goTo: () => void }[] = [];
              if (!isRoot) {
                const seen = new Set<string>();
                for (let i = 0; i < stepHistory.length; i++) {
                  const s = stepHistory[i];
                  const code = s.mode === "questions" ? s.entityCode : s.parentCode;
                  if (code && !seen.has(code)) {
                    seen.add(code);
                    const nd = findInTree(code);
                    const idx = i;
                    breadcrumbNodes.push({ label: nd?.name || code, goTo: () => setStepHistory((h) => h.slice(0, idx + 1)) });
                  }
                }
              }

              const navigateNode = (nd: TreeNode) => {
                const k = progressKey(nd.code, nd.edge_id ?? null);
                const hasQ = (questionsByKey[k] || []).length > 0;
                const hasKids = (nd.children || []).some(subtreeHasQuestions);
                if (!hasQ && hasKids) setStepHistory((h) => [...h, { mode: "cards", parentCode: nd.code }]);
                else setStepHistory((h) => [...h, { mode: "questions", entityCode: nd.code, orgTreeId: nd.edge_id ?? null }]);
              };

              if (step.mode === "cards") {
                const parent = step.parentCode ? findInTree(step.parentCode) : tree;
                const cards = parent
                  ? (step.parentCode === null
                    ? ([parent].filter(subtreeHasQuestions).length ? [parent] : (parent.children || []).filter(subtreeHasQuestions))
                    : (parent.children || []).filter(subtreeHasQuestions))
                  : [];

                return (
                  <div className="space-y-5">
                    {!isRoot && (
                      <nav className="flex items-center gap-1.5 flex-wrap mb-2 text-xs">
                        <button
                          onClick={() => setStepHistory([{ mode: "cards", parentCode: null }])}
                          className="flex items-center gap-1 text-gray-400 hover:text-secondary-400 transition-colors"
                        >
                          <ArrowLeft size={12} /> All Entities
                        </button>
                        {breadcrumbNodes.map((bc, i) => (
                           <span key={i} className="flex items-center gap-1.5">
                             <ChevronRight size={12} className="text-gray-600" />
                             <button onClick={bc.goTo} className="text-gray-400 hover:text-secondary-400 transition-colors">{bc.label}</button>
                           </span>
                        ))}
                      </nav>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cards.map((n, i) => (
                        <EntityCard
                          key={`${n.code}__${n.edge_id ?? "null"}`}
                          node={n}
                          index={i + 1}
                          questionsByKey={questionsByKey}
                          responsesByQuestionId={responsesByQuestionId}
                          onClick={() => navigateNode(n)}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              const node = step.orgTreeId != null
                ? findNodeByEdgeId(tree, Number(step.orgTreeId))
                : findInTree(step.entityCode);
              const entityCode = step.entityCode;
              const edgeId = node?.edge_id ?? step.orgTreeId ?? null;
              const key = progressKey(entityCode, edgeId);
              const qs = (questionsByKey[key] || []).slice().sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

              return (
                <div className="space-y-5">
                  <nav className="flex items-center gap-1.5 flex-wrap mb-2 text-xs">
                    <button
                      onClick={() => setStepHistory([{ mode: "cards", parentCode: null }])}
                      className="flex items-center gap-1 text-gray-400 hover:text-secondary-400 transition-colors"
                    >
                      <ArrowLeft size={12} /> All Entities
                    </button>
                    {breadcrumbNodes.map((bc, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <ChevronRight size={12} className="text-gray-600" />
                        <button onClick={bc.goTo} className="text-gray-400 hover:text-secondary-400 transition-colors">{bc.label}</button>
                      </span>
                    ))}
                  </nav>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ENTITY_TYPE_COLORS[node?.entity_type || ''] || 'bg-white/10 text-gray-300'}`}>
                        {node?.entity_type || ""}
                      </span>
                      <h2 className="text-base font-semibold text-white flex-1 truncate">{node?.name || entityCode}</h2>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {qs.length > 0 ? (
                      qs.map((q, idx) => (
                        <QuestionPreviewCard key={q.id} question={q} response={responsesByQuestionId[q.id]} index={idx + 1} />
                      ))
                    ) : (
                      <div className="glass rounded-xl p-8 text-center border border-dashed border-white/10">
                        <p className="text-gray-500 italic">No questions found for this entity.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="glass rounded-xl p-8 text-center border border-white/10">
            <p className="text-gray-400">Audit entity tree unavailable.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}

export default function AuditDetailsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AuditDetailsContent />
    </Suspense>
  );
}
