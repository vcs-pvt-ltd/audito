"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi } from "@/lib/api";
import { getEvidenceUrl, inferEvidenceKind } from "@/utils/executionService";
import { IconButton } from "@/components/ui";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Camera,
  Video,
  Music,
  Paperclip,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  CheckCircle2,
} from "lucide-react";

// ── Interfaces ────────────────────────────────────────────────────

interface Evidence {
  evidence_id: string;
  file_type: string;
  file_path: string;
  file_name: string;
}

interface AuditResponse {
  audit_response_id: string;
  checklist_question_id: string;
  entity_code: string;
  org_tree_id?: string | null;
  answer_text: string | null;
  selected_option_ids: string | null;
  marks_obtained: number;
  remarks: string | null;
  cap_required: number;
  evidence: Evidence[];
}

interface QuestionOption {
  option_id: string;
  option_text: string;
  marks: number;
}

interface ChecklistQuestion {
  question_id: string;
  question_text: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  total_marks: number;
  order_index: number;
  options: QuestionOption[];
}

interface EntityQuestion {
  entity_code: string;
  org_tree_id?: string | null;
  questions: ChecklistQuestion[];
}

interface AuditEntity {
  entity_code: string;
  entity_type: string;
  entity_name: string;
  org_tree_id?: string | null;
}

interface AuditDetail {
  audit_id: string;
  audit_code: string;
  title: string;
  status: string;
  entities: AuditEntity[];
  entity_questions?: EntityQuestion[];
  entity_progress?: Array<{
    audit_entity_progress_id?: string;
    entity_code: string;
    org_tree_id?: string | null;
    total_questions: number;
    answered_questions: number;
  }>;
}

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: string | null;
  children?: TreeNode[];
}

// ── Helpers ───────────────────────────────────────────────────────

function progressKey(entityCode: string, orgTreeId: string | null | undefined) {
  return `${entityCode}__${orgTreeId ?? "null"}`;
}

function getQuestionListForNode(
  node: Pick<TreeNode, "code" | "edge_id">,
  questionsMap: Record<string, ChecklistQuestion[]>
) {
  const direct = questionsMap[progressKey(node.code, node.edge_id ?? null)] || [];
  if (direct.length > 0) return direct;
  return questionsMap[progressKey(node.code, null)] || [];
}

function getProgressForNode(
  node: Pick<TreeNode, "code" | "edge_id">,
  progressMap: Record<string, { total_questions: number; answered_questions: number }>,
  questionsMap: Record<string, ChecklistQuestion[]>
) {
  const direct = progressMap[progressKey(node.code, node.edge_id ?? null)];
  if (direct) return direct;
  const fallback = progressMap[progressKey(node.code, null)];
  if (fallback) return fallback;
  return { total_questions: getQuestionListForNode(node, questionsMap).length, answered_questions: 0 };
}

function normalizeSelectedOptionIds(raw: string | null): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];
  try {
    if (s.startsWith("[")) {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [String(parsed)];
    }
  } catch { /* ignored */ }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

function formatAnswer(q: ChecklistQuestion, r?: AuditResponse): string {
  const answerText = (r?.answer_text || "").trim();
  const selected = normalizeSelectedOptionIds(r?.selected_option_ids || null);
  const selectedText = (q.options || [])
    .filter((o) => selected.includes(String(o.option_id)))
    .map((o) => o.option_text);
  const optStr = selectedText.length ? selectedText.join(", ") : "";
  if (answerText && optStr) return `${answerText} (${optStr})`;
  if (answerText) return answerText;
  if (optStr) return optStr;
  return "";
}

function subtreeHasQuestions(
  node: TreeNode | null,
  questionsMap: Record<string, ChecklistQuestion[]>
): boolean {
  if (!node) return false;
  if (getQuestionListForNode(node, questionsMap).length > 0) return true;
  return (node.children || []).some((c) => subtreeHasQuestions(c, questionsMap));
}

function findNodeByEdgeId(node: TreeNode, edgeId: string | null): TreeNode | null {
  if (node.edge_id === edgeId) return node;
  for (const c of node.children || []) {
    const f = findNodeByEdgeId(c, edgeId);
    if (f) return f;
  }
  return null;
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

// ── Components ────────────────────────────────────────────────────

function EntityCard({
  node,
  index,
  questionsMap,
  progressMap,
  onClick,
}: {
  node: TreeNode;
  index: number;
  questionsMap: Record<string, ChecklistQuestion[]>;
  progressMap: Record<string, { total_questions: number; answered_questions: number }>;
  onClick: () => void;
}) {
  const getSubtreeProgress = (n: TreeNode): { total: number, answered: number } => {
    let t = 0;
    let a = 0;
    const walk = (nd: TreeNode) => {
      const prog = getProgressForNode(nd, progressMap, questionsMap);
      t += prog.total_questions;
      a += prog.answered_questions;
      (nd.children || []).forEach(walk);
    };
    walk(n);
    return { total: t, answered: a };
  };

  const { total, answered } = getSubtreeProgress(node);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const subsections = (node.children ?? []).filter((c) => subtreeHasQuestions(c, questionsMap)).length;
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
  question: ChecklistQuestion;
  response?: AuditResponse;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const ans = formatAnswer(question, response);
  const answered = !!ans;
  const hasEvidence = (response?.evidence || []).length > 0;
  const capRequired = !!response?.cap_required;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${!answered ? "border-white/[0.06] bg-white/[0.02]" : "border-emerald-500/20 bg-white/[0.03]"}`}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-500 font-mono">
          {index}
        </span>
        <p className={`text-sm flex-1 ${open ? "text-white font-medium" : "text-gray-300 truncate"}`}>{question.question_text}</p>
        <div className="flex items-center gap-2">
          {capRequired && (
            <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">CAP</span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${!answered ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"}`}>
            {!answered ? "Pending" : "Answered"}
          </span>
          <ChevronDown size={14} className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/[0.06]">
          <div className="pt-3 space-y-3">
            <div>
              <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider">Answer</p>
              {answered ? (
                <p className="text-sm text-secondary-400 font-medium">{ans}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">No answer yet</p>
              )}
            </div>

            {question.total_marks > 0 && answered && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 uppercase tracking-wider">Score</span>
                <span className="text-sm font-semibold text-white">{response?.marks_obtained ?? 0}</span>
                <span className="text-sm text-gray-500">/ {question.total_marks}</span>
              </div>
            )}

            {response?.remarks && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                  <FileText size={11} /> Remarks
                </p>
                <p className="text-xs text-gray-400 bg-white/[0.03] rounded-lg px-3 py-2">{response.remarks}</p>
              </div>
            )}

            {hasEvidence && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Camera size={12} className="text-secondary-400" />
                  <span>{response?.evidence.length} evidence file{(response?.evidence.length ?? 0) !== 1 ? "s" : ""} attached</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(response?.evidence || []).map((ev) => {
                    const kind = inferEvidenceKind(ev.file_type, ev.file_name, ev.file_path);
                    const url = getEvidenceUrl(ev.file_path);
                    return (
                      <a
                        key={ev.evidence_id}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 bg-white/[0.03] p-2 hover:border-white/20"
                      >
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

// ── Page ──────────────────────────────────────────────────────────

export default function EntityHeadAuditPreviewPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const auditId = searchParams.get("audit_id");

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [responses, setResponses] = useState<AuditResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "entity_head")) router.push("/login");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken || !auditId) return;
    setLoading(true);
    setError("");
    try {
      const [detailRes, respRes, treeRes] = await Promise.all([
        auditExecutionApi.getDetail(accessToken, auditId),
        auditExecutionApi.getResponses(accessToken, auditId),
        auditExecutionApi.getEntityTree(accessToken, auditId),
      ]);
      if (detailRes.success && detailRes.data) {
        setAudit((detailRes.data as { audit: AuditDetail }).audit);
      } else {
        setError(detailRes.message || "Audit not found.");
      }
      if (respRes.success && respRes.data) {
        setResponses((respRes.data as { responses: AuditResponse[] }).responses || []);
      }
      if (treeRes.success && treeRes.data) {
        setTree((treeRes.data as { tree: TreeNode }).tree || null);
      }
    } catch {
      setError("Network error.");
    }
    setLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => { load(); }, [load]);

  const questionsMap = useMemo(() => {
    const m: Record<string, ChecklistQuestion[]> = {};
    for (const eq of audit?.entity_questions || []) {
      const k = progressKey(eq.entity_code, (eq as any).org_tree_id ?? null);
      m[k] = eq.questions || [];
    }
    return m;
  }, [audit]);

  const progressMap = useMemo(() => {
    const m: Record<string, { total_questions: number; answered_questions: number }> = {};
    for (const p of audit?.entity_progress || []) {
      const k = progressKey(p.entity_code, (p as any).org_tree_id ?? null);
      m[k] = { total_questions: p.total_questions || 0, answered_questions: p.answered_questions || 0 };
    }
    return m;
  }, [audit]);

  const responseByEntityQuestion = useMemo(() => {
    const m = new Map<string, AuditResponse>();
    for (const r of responses) {
      const k = progressKey(r.entity_code, (r as any).org_tree_id ?? null);
      m.set(`${k}::${r.checklist_question_id}`, r);
    }
    return m;
  }, [responses]);

  const [stepHistory, setStepHistory] = useState<
    ({ mode: "cards"; parentCode: string | null } | { mode: "questions"; entityCode: string; orgTreeId: string | null })[]
  >([{ mode: "cards", parentCode: null }]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin || admin.role !== "entity_head") return null;

  return (
    <div className="h-screen bg-transparent flex">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <IconButton bordered onClick={() => router.push("/entity-head/audits")}>
            <ArrowLeft size={16} />
          </IconButton>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck size={22} className="text-secondary-400" />
              Audit Preview
            </h1>
            {audit && (
              <p className="text-sm text-gray-400 mt-0.5 font-mono truncate">
               {audit.title}
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
                const hasQ = getQuestionListForNode(nd, questionsMap).length > 0;
                const hasKids = (nd.children || []).some((c) => subtreeHasQuestions(c, questionsMap));
                if (!hasQ && hasKids) setStepHistory((h) => [...h, { mode: "cards", parentCode: nd.code }]);
                else setStepHistory((h) => [...h, { mode: "questions", entityCode: nd.code, orgTreeId: nd.edge_id ?? null }]);
              };

              if (step.mode === "cards") {
                const parent = step.parentCode ? findInTree(step.parentCode) : tree;
                const cards = parent
                  ? (step.parentCode === null
                    ? ([parent].filter((n) => subtreeHasQuestions(n, questionsMap))
                      .length
                      ? [parent]
                      : (parent.children || []).filter((c) => subtreeHasQuestions(c, questionsMap)))
                    : (parent.children || []).filter((c) => subtreeHasQuestions(c, questionsMap)))
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
                          questionsMap={questionsMap}
                          progressMap={progressMap}
                          onClick={() => navigateNode(n)}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              const node = step.orgTreeId != null
                ? findNodeByEdgeId(tree, step.orgTreeId)
                : findInTree(step.entityCode);
              const entityCode = step.entityCode;
              const edgeId = node?.edge_id ?? step.orgTreeId ?? null;
              const key = progressKey(entityCode, edgeId);
              const qs = (questionsMap[key] || []).slice().sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
              const hasSubEntityQuestions = (node?.children || []).some(c => subtreeHasQuestions(c, questionsMap));

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
                      <QuestionPreviewCard key={q.question_id} question={q} response={responseByEntityQuestion.get(`${key}::${q.question_id}`)} index={idx + 1} />
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => setStepHistory(h => h.slice(0, -1))}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    {hasSubEntityQuestions && (
                      <button
                        onClick={() => setStepHistory(h => [...h, { mode: "cards", parentCode: entityCode }])}
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
