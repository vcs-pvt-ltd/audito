"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { capApi } from "@/lib/api";
import { getEvidenceUrl, inferEvidenceKind } from "@/utils/executionService";
import { Button, IconButton } from "@/components/ui";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  Video,
  Music,
  Paperclip,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardList,
  DollarSign,
  Eye,
  FileText,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react";

interface Cap {
  cap_id: string;
  title: string;
  status: string;
  description?: string | null;
  audit_title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface SourceAudit {
  title?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: string | number | null;
  currency?: string | null;
  num_workers?: number | null;
  checklist_name?: string | null;
  time_period_value?: string | number | null;
  time_period_unit?: string | null;
  auditor_name?: string | null;
  auditor_email?: string | null;
  auditor_phone?: string | null;
}

interface CapQuestionOption {
  id: number;
  option_text: string;
  marks: number;
}

interface CapQuestion {
  cap_question_id: string;
  entity_code: string;
  org_tree_id?: string | null;
  question_text: string;
  answer_type: string;
  total_marks: string | number;
  order_index: number;
  status: string;
  ca_description?: string | null;
  options: CapQuestionOption[];
}

interface CapResponse {
  cap_question_id: string;
  response_text: string | null;
  selected_option_ids: string | null | number[];
  marks_obtained?: number;
  remarks?: string | null;
  status: string;
  evidence?: { id: number; file_type: string; file_path: string; file_name: string }[];
}

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: string | null;
  children?: TreeNode[];
}

function normalizeSelectedOptionIds(ids: any): string[] {
  if (!ids) return [];
  if (Array.isArray(ids)) return ids.map(String);
  if (typeof ids === "string") {
    try {
      const parsed = JSON.parse(ids);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [ids];
    }
  }
  return [String(ids)];
}

function formatAnswer(q: CapQuestion, r?: CapResponse): string {
  const answerText = (r?.response_text || "").trim();
  const selected = normalizeSelectedOptionIds(r?.selected_option_ids || null);
  const selectedText = (q.options || [])
    .filter((o) => selected.includes(String(o.id)))
    .map((o) => o.option_text);
  const optStr = selectedText.length ? selectedText.join(", ") : "";
  if (answerText && optStr) return `${answerText} (${optStr})`;
  if (answerText) return answerText;
  if (optStr) return optStr;
  return "";
}

function progressKey(entityCode: string, orgTreeId: string | null | undefined) {
  return `${entityCode}__${orgTreeId ?? "null"}`;
}

function getQuestionsForNode(
  node: Pick<TreeNode, "code" | "edge_id">,
  questionsByKey: Record<string, CapQuestion[]>
) {
  return questionsByKey[progressKey(node.code, node.edge_id ?? null)] || [];
}

function subtreeHasQuestions(node: TreeNode | null, questionsByKey: Record<string, CapQuestion[]>): boolean {
  if (!node) return false;
  if (getQuestionsForNode(node, questionsByKey).length > 0) return true;
  return (node.children || []).some((c) => subtreeHasQuestions(c, questionsByKey));
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

function EntityCard({
  node,
  index,
  questionsByKey,
  responsesByQuestion,
  onClick,
}: {
  node: TreeNode;
  index: number;
  questionsByKey: Record<string, CapQuestion[]>;
  responsesByQuestion: Record<string, CapResponse>;
  onClick: () => void;
}) {
  const getSubtreeProgress = (n: TreeNode) => {
    let t = 0;
    let a = 0;
    const seen = new Set<string>();
    const walk = (nd: TreeNode) => {
      const qs = getQuestionsForNode(nd, questionsByKey);
      for (const q of qs) {
        if (seen.has(q.cap_question_id)) continue;
        seen.add(q.cap_question_id);
        t++;
        if (formatAnswer(q, responsesByQuestion[q.cap_question_id])) a++;
      }
      (nd.children || []).forEach(walk);
    };
    walk(n);
    return { total: t, answered: a };
  };

  const { total, answered } = getSubtreeProgress(node);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const subsections = (node.children ?? []).filter((c) => subtreeHasQuestions(c, questionsByKey)).length;
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
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded inline-block mt-0.5 bg-white/10 text-gray-300">
            {node.entity_type}
          </span>
        </div>
        <ChevronRight size={18} className="text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-5">
          <ProgressRing pct={pct} />
          <div className="space-y-2 flex-1">
            {subsections > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Building2 size={13} className="text-gray-500" />
                <span>{subsections} Subsection{subsections !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span className="text-gray-400">{answered} / {total} Answered</span>
            </div>
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
  question: CapQuestion;
  response?: CapResponse;
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
            {question.ca_description && (
              <div className="text-[11px] text-amber-400/80">
                <span className="font-medium mr-1 text-amber-500/70 uppercase tracking-wider">Requirement:</span>
                <span className="block mt-1 text-amber-100/90">{question.ca_description}</span>
              </div>
            )}
            <div>
              <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Answer</p>
              {ans ? (
                <p className="text-sm text-secondary-400 font-medium">{ans}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">No answer yet</p>
              )}
            </div>
            {Number(question.total_marks) > 0 && ans && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 uppercase tracking-wider">Score</span>
                <span className="text-sm font-semibold text-white">{response?.marks_obtained ?? 0}</span>
                <span className="text-sm text-gray-500">/ {Number(question.total_marks) || 0}</span>
              </div>
            )}
            {response?.remarks && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Remarks</p>
                <p className="text-xs text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">{response.remarks}</p>
              </div>
            )}
            {(response?.evidence || []).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Camera size={12} className="text-secondary-400" />
                  <span>{response?.evidence?.length} evidence file{(response?.evidence?.length ?? 0) !== 1 ? "s" : ""} attached</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(response?.evidence || []).map((ev) => {
                    const kind = inferEvidenceKind(ev.file_type, ev.file_name, ev.file_path);
                    const url = getEvidenceUrl(ev.file_path);
                    return (
                      <a key={ev.id} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] p-2 hover:border-white/20">
                        {kind === "image" ? (
                          <img src={url} alt={ev.file_name || "evidence"} className="w-full h-24 object-cover rounded-md" />
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

export default function ClientPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const capId = searchParams.get("id") as string;

  const [cap, setCap] = useState<Cap | null>(null);
  const [questions, setQuestions] = useState<CapQuestion[]>([]);
  const [responses, setResponses] = useState<CapResponse[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [sourceAudit, setSourceAudit] = useState<SourceAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
    if (!isLoading && admin && admin.role !== "admin") router.push("/");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken || !capId) return;
    setLoading(true);
    setError("");
    try {
      const [itemsRes, detailRes] = await Promise.all([
        capApi.getItems(accessToken, capId),
        capApi.get(accessToken, capId),
      ]);

      if (detailRes.success && detailRes.data) {
        setCap((detailRes.data as any).cap || null);
        setSourceAudit((detailRes.data as any).source_audit || null);
      }

      if (!itemsRes.success || !itemsRes.data) {
        setError(itemsRes.message || "Failed to load CAP preview.");
        setLoading(false);
        return;
      }

      const items = itemsRes.data as { questions: CapQuestion[]; responses: CapResponse[]; tree: TreeNode | null };
      setQuestions(items.questions || []);
      setResponses(items.responses || []);
      setTree(items.tree || null);
    } catch {
      setError("Network error.");
    }
    setLoading(false);
  }, [accessToken, capId]);

  useEffect(() => {
    load();
  }, [load]);

  const questionsByKey = useMemo(() => {
    const m: Record<string, CapQuestion[]> = {};
    for (const q of questions) {
      const k = progressKey(q.entity_code, (q as any).org_tree_id ?? null);
      if (!m[k]) m[k] = [];
      m[k].push(q);
    }
    return m;
  }, [questions]);

  const responsesByQuestion = useMemo(() => {
    const m: Record<string, CapResponse> = {};
    for (const r of responses) m[r.cap_question_id] = r;
    return m;
  }, [responses]);

  const [stepHistory, setStepHistory] = useState<
    ({ mode: "cards"; parentCode: string | null } | { mode: "questions"; entityCode: string; orgTreeId: string | null })[]
  >([{ mode: "cards", parentCode: null }]);

  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin || admin.role !== "admin") return null;

  return (
    <div className="h-screen bg-transparent flex">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <IconButton bordered onClick={() => router.push(`/caps`)}>
            <ArrowLeft size={16} />
          </IconButton>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardList size={22} className="text-secondary-400" />
              Preview CAP
            </h1>
            {cap && (
              <p className="text-sm text-gray-400 mt-0.5 font-mono truncate">
                {cap.title}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="glass rounded-xl p-8 text-center">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-2" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : !showPreview ? (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest mb-2">CAP Details</p>
                  <h2 className="text-2xl font-black text-white mb-2 break-words">{cap?.title || "CAP Plan"}</h2>
                  <p className="text-sm text-gray-400 max-w-2xl">
                    Review the corrective action plan context before opening the question preview.
                  </p>
                </div>
                <Button leftIcon={<Eye size={18}/>} onClick={() => setShowPreview(true)}>Preview Questions</Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary-500/10 text-secondary-400 border border-secondary-500/20 flex items-center justify-center">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest">Auditor Details</p>
                      <h3 className="text-lg font-black text-white">{sourceAudit?.auditor_name || "Not assigned"}</h3>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ContactLine icon={Mail} label="Email" value={sourceAudit?.auditor_email} />
                    <ContactLine icon={Phone} label="Phone" value={sourceAudit?.auditor_phone} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary-500/10 text-secondary-400 border border-secondary-500/20 flex items-center justify-center">
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-secondary-400 font-bold uppercase tracking-widest">Audit Details</p>
                      <h3 className="text-lg font-black text-white">{sourceAudit?.title || cap?.audit_title || "Source audit not available"}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DetailStat icon={Calendar} label="Timeline" value={`${fmtDate(sourceAudit?.start_date)} - ${fmtDate(sourceAudit?.end_date)}`} />
                    <DetailStat icon={DollarSign} label="Budget" value={money(sourceAudit?.budget, sourceAudit?.currency)} />
                    <DetailStat icon={Users} label="Workers" value={sourceAudit?.num_workers ? `${sourceAudit.num_workers}` : "Not set"} />
                    <DetailStat
                      icon={Clock}
                      label="Checklist Duration"
                      value={sourceAudit?.time_period_value && sourceAudit?.time_period_unit ? `${sourceAudit.time_period_value} ${sourceAudit.time_period_unit}` : "Not set"}
                    />
                  </div>
                  {cap?.description && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex gap-3">
                      <FileText size={16} className="text-gray-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-400 leading-relaxed">{cap.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : tree ? (
          <div className="max-w-5xl mx-auto">
            
            {(() => {
              const step = stepHistory[stepHistory.length - 1];
              const isRoot = step.mode === "cards" && step.parentCode === null;

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
                const code = nd.code;
                const edgeId = nd.edge_id ?? null;
                const hasQ = (questionsByKey[progressKey(code, edgeId)]?.length || 0) > 0;
                const hasKids = (nd.children ?? []).some((c) => subtreeHasQuestions(c, questionsByKey));
                if (!hasQ && hasKids) setStepHistory((h) => [...h, { mode: "cards", parentCode: code }]);
                else setStepHistory((h) => [...h, { mode: "questions", entityCode: code, orgTreeId: edgeId }]);
              };

              if (step.mode === "cards") {
                const parent = step.parentCode ? findInTree(step.parentCode) : tree;
                const cards = parent
                  ? (step.parentCode === null
                    ? ([parent].filter((n) => subtreeHasQuestions(n, questionsByKey))
                      .length
                      ? [parent]
                      : (parent.children || []).filter((c) => subtreeHasQuestions(c, questionsByKey)))
                    : (parent.children || []).filter((c) => subtreeHasQuestions(c, questionsByKey)))
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {cards.map((n, i) => (
                        <EntityCard
                          key={`${n.code}__${n.edge_id ?? "null"}`}
                          node={n}
                          index={i + 1}
                          questionsByKey={questionsByKey}
                          responsesByQuestion={responsesByQuestion}
                          onClick={() => navigateNode(n)}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              const node = findInTree(step.entityCode);
              const entityCode = step.entityCode;
              const edgeId = node?.edge_id ?? step.orgTreeId ?? null;
              const qs = getQuestionsForNode({ code: entityCode, edge_id: edgeId }, questionsByKey)
                .slice()
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
              // Next is only a drill-down action. A leaf entity has nowhere further
              // to navigate, so it must not offer a Next button.
              const hasChildrenWithQuestions = (node?.children || []).some((child) =>
                subtreeHasQuestions(child, questionsByKey)
              );

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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-white/10 text-gray-300 border-white/10">
                        {node?.entity_type || ""}
                      </span>
                      <h2 className="text-base font-semibold text-white flex-1 truncate">{node?.name || entityCode}</h2>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {qs.map((q, idx) => (
                      <QuestionPreviewCard key={q.cap_question_id} question={q} response={responsesByQuestion[q.cap_question_id]} index={idx + 1} />
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => setStepHistory(h => h.slice(0, -1))}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    {hasChildrenWithQuestions && (
                      <button
                        onClick={() => setStepHistory(h => [...h, {
                          mode: "cards",
                          parentCode: entityCode,
                        }])}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all shadow-lg shadow-secondary-500/20"
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-gray-400">Entity tree unavailable.</p>
          </div>
        )}
      </main>
    </div>
  );
}
