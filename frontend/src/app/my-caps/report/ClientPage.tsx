"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi, capApi } from "@/lib/api";
import { CapPdfRenderer } from "@/components/cap/CapPdfRenderer";
import { IconButton } from "@/components/ui";
import { getEvidenceUrl, inferEvidenceKind } from "@/utils/executionService";

import {
  ArrowLeft,
  BarChart3,
  Building2,
  AlertTriangle,
  TrendingUp,
  HelpCircle,
  FileText,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Paperclip,
  Video,
  Music,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface Cap {
  cap_id: string; audit_id?: string;
  title: string; status: string; start_date?: string; end_date?: string;
}

interface CapQuestion {
  cap_question_id: string; entity_code: string; org_tree_id?: string | null;
  question_text: string; total_marks: string | number; status: string;
  order_index?: number; ca_description?: string; checklist_question_id?: string;
  options?: { id: string; checklist_question_option_id?: string; option_text: string; marks: number }[];
}

interface CapResponse {
  cap_response_id?: string; cap_question_id: string; response_text: string | null;
  selected_option_ids?: string | null | string[]; marks_obtained?: number;
  remarks?: string | null; cap_required?: number; status: string;
  evidence?: { id: string; file_type: string; file_path: string; file_name: string; file_size?: number }[];
}

interface CapProgress {
  entity_code: string; entity_name?: string; org_tree_id?: string | null;
  total_questions: number; answered_questions: number;
  total_marks?: number; obtained_marks?: number; status: string;
}

interface CapEntity {
  entity_code: string; entity_type?: string; org_tree_id?: string | null;
}

interface EntityTreeNode {
  code: string; name: string; entity_type: string;
  edge_id?: string | null; children: EntityTreeNode[];
}

// ─── Helpers ──────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getScoreColor(pct: number) {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-red-400";
}

function getScoreBarColor(pct: number) {
  if (pct >= 80) return "from-emerald-500 to-emerald-400";
  if (pct >= 60) return "from-amber-500 to-amber-400";
  return "from-red-500 to-red-400";
}

function getScoreStroke(pct: number) {
  if (pct >= 80) return "#10b981";
  if (pct >= 60) return "#f59e0b";
  return "#ef4444";
}

function sameEntityInstance(
  entityCode: string,
  orgTreeId: string | null | undefined,
  item: { entity_code: string; org_tree_id?: string | null },
  { allowGeneric = false }: { allowGeneric?: boolean } = {}
) {
  const normalizedOrgTreeId = orgTreeId ?? null;
  const itemOrgTreeId = item.org_tree_id ?? null;
  if (allowGeneric && itemOrgTreeId === null) return item.entity_code === entityCode;
  if (itemOrgTreeId !== null || normalizedOrgTreeId !== null)
    return item.entity_code === entityCode && itemOrgTreeId === normalizedOrgTreeId;
  return item.entity_code === entityCode;
}

// ─── Entity Tree Section ──────────────────────────────────────────

function EntityTreeSection({
  node, questions, responses, depth = 0, aggregatedMap, capEntityCodes,
}: {
  node: EntityTreeNode;
  questions: CapQuestion[];
  responses: CapResponse[];
  depth?: number;
  aggregatedMap?: Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number; answered_questions: number; total_questions: number }>;
  capEntityCodes?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const nodeOrgTreeId = node.edge_id ?? null;
  const nodeKey = `${node.code}__${nodeOrgTreeId ?? "null"}`;

  const isCapEntity = !capEntityCodes || capEntityCodes.has(nodeKey);

  const subtreeHasCapEntity = (n: EntityTreeNode): boolean => {
    const k = `${n.code}__${(n.edge_id ?? null) === null ? "null" : n.edge_id}`;
    if (capEntityCodes?.has(k)) return true;
    return (n.children || []).some(subtreeHasCapEntity);
  };

  const visibleChildren = capEntityCodes
    ? (node.children || []).filter(subtreeHasCapEntity)
    : (node.children || []);

  if (capEntityCodes && !isCapEntity && visibleChildren.length === 0) return null;

  const progress = aggregatedMap?.get(nodeKey);

  const entityName = node.name || node.code;

  const nodeQuestions = isCapEntity ? questions.filter((q) =>
    sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true })
  ) : [];

  const nodeResponses = isCapEntity ? responses.filter((r) => {
    const q = questions.find((qq) => qq.cap_question_id === r.cap_question_id);
    return q && sameEntityInstance(node.code, nodeOrgTreeId, q);
  }) : [];

  const capRequiredCount =
    progress?.cap_required_count ?? nodeResponses.filter((r) => r.cap_required === 1).length;

  const pct =
    progress && progress.total_marks > 0
      ? Math.round((progress.obtained_marks / progress.total_marks) * 100)
      : 0;

  const hasQuestions = nodeQuestions.length > 0;
  const hasVisibleChildren = visibleChildren.length > 0;

  return (
    <div className={depth > 0 ? "ml-4 border-l border-white/[0.06] pl-3 mt-1" : "mt-1.5"}>
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        {/* Entity header row */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          {expanded
            ? <ChevronDown size={13} className="text-gray-500 shrink-0" />
            : <ChevronRight size={13} className="text-gray-500 shrink-0" />}

          <div className="w-6 h-6 rounded-md bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
            <Building2 size={11} className="text-secondary-400" />
          </div>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{entityName}</span>
            {node.entity_type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 shrink-0 hidden sm:inline">
                {node.entity_type}
              </span>
            )}
          </div>

          {/* Right side stats */}
          <div className="flex items-center gap-3 shrink-0">
            {capRequiredCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <AlertTriangle size={9} /> {capRequiredCount} CAP
              </span>
            )}
            {progress && (
              <>
                <span className={`text-sm font-semibold ${getScoreColor(pct)}`}>{pct}%</span>
                <div className="w-14 h-1.5 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getScoreBarColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-500 hidden sm:inline">
                  {progress.obtained_marks}/{progress.total_marks}
                </span>
              </>
            )}
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-white/[0.06]">

            {/* Questions */}
            {hasQuestions && (
              <div className="px-4 py-3 space-y-2">
                {nodeQuestions.map((q) => {
                  const resp = nodeResponses.find(
                    (r) => r.cap_question_id === q.cap_question_id
                  );
                  const hasCap = (resp?.cap_required || 0) === 1;
                  const qPct = Number(q.total_marks) > 0
                    ? Math.round(((Number(resp?.marks_obtained) || 0) / Number(q.total_marks)) * 100)
                    : 0;
                  return (
                    <div
                      key={q.cap_question_id}
                      className={`flex gap-3 px-3 py-2.5 rounded-lg ${
                        hasCap
                          ? "bg-orange-500/5 border border-orange-500/10"
                          : "bg-white/[0.02] border border-white/[0.04]"
                      }`}
                    >
                      <span className="shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] text-gray-500 font-mono mt-0.5">
                        {(q.order_index ?? 0) + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-xs text-gray-200 leading-snug">{q.question_text}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs font-semibold ${getScoreColor(qPct)}`}>
                            {resp?.marks_obtained ?? 0}/{q.total_marks} pts
                          </span>
                          {resp?.response_text && (
                            <span className="text-[10px] text-gray-500 truncate max-w-[200px]">
                              &ldquo;{resp.response_text}&rdquo;
                            </span>
                          )}
                          {resp?.remarks && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-400">
                              <FileText size={9} /> {resp.remarks}
                            </span>
                          )}
                          {hasCap && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-orange-400">
                              <AlertTriangle size={9} /> CAP Required
                            </span>
                          )}
                        </div>
                        {resp?.evidence && resp.evidence.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {resp.evidence.map((ev) => {
                              const kind = inferEvidenceKind(ev.file_type, ev.file_name, ev.file_path);
                              const url = getEvidenceUrl(ev.file_path);
                              return (
                                <a key={ev.id} href={url} target="_blank" rel="noreferrer"
                                  className="relative flex items-center justify-center overflow-hidden rounded-md bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors shrink-0"
                                  style={{ width: 80, height: 60 }}>
                                  {kind === "image" ? (
                                    <img src={url} alt={ev.file_name || "evidence"} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center p-1.5 text-gray-400">
                                      {kind === "video" ? <Video size={16} /> : kind === "audio" ? <Music size={16} /> : <Paperclip size={16} />}
                                      <span className="text-[8px] truncate w-full text-center mt-1">{ev.file_name || "File"}</span>
                                    </div>
                                  )}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Children */}
            {hasVisibleChildren && (
              <div className={`px-3 pb-3 space-y-0 ${hasQuestions ? "border-t border-white/[0.06] pt-2" : "pt-2"}`}>
                {visibleChildren.map((child) => (
                  <EntityTreeSection
                    key={`${child.code}__${child.edge_id ?? "null"}`}
                    node={child}
                    questions={questions}
                    responses={responses}
                    depth={depth + 1}
                    aggregatedMap={aggregatedMap}
                    capEntityCodes={capEntityCodes}
                  />
                ))}
              </div>
            )}

            {!hasQuestions && !hasVisibleChildren && (
              <p className="px-4 py-3 text-xs text-gray-600 italic">
                No CAP actions required for this entity.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function MyCapReportPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const capId = searchParams.get("id") as string;

  const [cap, setCap] = useState<Cap | null>(null);
  const [questions, setQuestions] = useState<CapQuestion[]>([]);
  const [responses, setResponses] = useState<CapResponse[]>([]);
  const [entities, setEntities] = useState<CapEntity[]>([]);
  const [progress, setProgress] = useState<CapProgress[]>([]);
  const [entityTree, setEntityTree] = useState<EntityTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auditMeta, setAuditMeta] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError("");
    const [detailRes, respRes] = await Promise.all([
      capApi.get(accessToken, capId),
      capApi.getResponses(accessToken, capId),
    ]);
    setLoading(false);
    if (!detailRes.success || !detailRes.data) {
      setError(detailRes.message || "Failed to load CAP report."); return;
    }
    const detail = detailRes.data as {
      cap: Cap; source_audit?: Record<string, any> | null;
      questions: CapQuestion[]; entities: CapEntity[];
      progress: CapProgress[]; tree?: EntityTreeNode | null;
    };
    setCap(detail.cap);
    setQuestions(detail.questions || []);
    setEntities(detail.entities || []);
    setProgress(detail.progress || []);
    if (detail.tree) setEntityTree(detail.tree);

    if (detail.source_audit) {
      setAuditMeta(detail.source_audit);
    } else {
      const sourceAuditId = detail.cap?.audit_id;
      if (sourceAuditId) {
        const auditRes = await auditExecutionApi.getDetail(accessToken, sourceAuditId);
        if (auditRes.success && auditRes.data) {
          const p = auditRes.data as any;
          setAuditMeta(p?.audit || p);
        } else setAuditMeta(null);
      } else setAuditMeta(null);
    }

    if (respRes.success && respRes.data)
      setResponses((respRes.data as { responses: CapResponse[] }).responses || []);
  }, [accessToken, capId]);

  useEffect(() => { load(); }, [load]);

  const responseMap = useMemo(() => {
    const m: Record<string, CapResponse> = {};
    for (const r of responses) m[r.cap_question_id] = r;
    return m;
  }, [responses]);

  const aggregatedProgressMap = useMemo(() => {
    if (!entityTree) return new Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number; answered_questions: number; total_questions: number }>();

    const map = new Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number; answered_questions: number; total_questions: number }>();

    const getAggregatedData = (node: EntityTreeNode): { total_marks: number; obtained_marks: number; cap_required_count: number; answered_questions: number; total_questions: number } => {
      const nodeOrgTreeId = node.edge_id ?? null;
      const nodeQuestions = questions.filter((q) =>
        sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true })
      );
      const nodeResponses = responses.filter((r) => {
        const q = questions.find((qq) => qq.cap_question_id === r.cap_question_id);
        return q && sameEntityInstance(node.code, nodeOrgTreeId, q);
      });

      let total_marks = 0, obtained_marks = 0, cap_required_count = 0, answered_questions = 0;
      nodeQuestions.forEach((q) => {
        total_marks += Number(q.total_marks || 0);
        const r = nodeResponses.find((resp) => resp.cap_question_id === q.cap_question_id);
        if (r) {
          obtained_marks += Number(r.marks_obtained || 0);
          if (r.cap_required === 1) cap_required_count++;
          if (q.status === "completed" || r.response_text) answered_questions++;
        }
      });

      let totalQ = nodeQuestions.length;

      if (node.children?.length > 0) {
        node.children.forEach((child) => {
          const c = getAggregatedData(child);
          total_marks += c.total_marks;
          obtained_marks += c.obtained_marks;
          cap_required_count += c.cap_required_count;
          answered_questions += c.answered_questions;
          totalQ += c.total_questions;
        });
      }

      const key = `${node.code}__${nodeOrgTreeId ?? "null"}`;
      const result = { total_marks, obtained_marks, cap_required_count, answered_questions, total_questions: totalQ };
      map.set(key, result);
      return result;
    };

    if (entityTree.code === "__root__") entityTree.children.forEach((c) => getAggregatedData(c));
    else getAggregatedData(entityTree);

    return map;
  }, [entityTree, questions, responses]);

  const capEntityCodes = useMemo(() => {
    const codes = new Set<string>();

    // Primary: use entities from cap_assignment_entities (source of truth)
    for (const e of entities) {
      const k = `${e.entity_code}__${e.org_tree_id ?? "null"}`;
      codes.add(k);
    }

    // Also include any question entity_codes not already in the set
    for (const q of questions) {
      const k = `${q.entity_code}__${q.org_tree_id ?? "null"}`;
      codes.add(k);
    }

    return codes;
  }, [entities, questions]);

  const summaryData = useMemo(() => {
    const totalMarks = questions.reduce((s, q) => s + (Number(q.total_marks) || 0), 0);
    const obtainedMarks = responses.reduce((s, r) => s + (Number(r.marks_obtained) || 0), 0);
    const answeredCount = questions.filter(q => {
      const r = responseMap[q.cap_question_id];
      return q.status === "completed" || r?.response_text;
    }).length;
    return {
      score_pct: totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0,
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      total_questions: questions.length,
      answered_questions: answeredCount,
    };
  }, [questions, responses, responseMap]);

  const capPdfReport = useMemo(() => {
    if (!cap) return null;
    const entitiesMap = new Map<string, { entity_code: string; entity_type: string; entity_name: string }>();
    const walkTree = (n: EntityTreeNode | null) => {
      if (!n) return;
      if (n.code && n.code !== "__root__") entitiesMap.set(n.code, { entity_code: n.code, entity_type: n.entity_type || "", entity_name: n.name || n.code });
      for (const c of n.children || []) walkTree(c);
    };
    walkTree(entityTree);
    const normalizedQuestions = questions.map(q => ({ id: q.cap_question_id, cap_question_id: q.cap_question_id, question_text: q.question_text, answer_type: "free_text", total_marks: Number(q.total_marks || 0), entity_code: q.entity_code, order_index: q.order_index || 0, options: (q as any).options || [] }));
    const normalizedResponses = questions.map(q => {
      const r = responseMap[q.cap_question_id];
      return { id: r?.cap_response_id || q.cap_question_id, cap_question_id: q.cap_question_id, entity_code: q.entity_code, org_tree_id: q.org_tree_id ?? null, answer_text: r?.response_text || null, selected_option_ids: (r?.selected_option_ids as string | null) || null, marks_obtained: Number(r?.marks_obtained || 0), remarks: r?.remarks || null, cap_required: Number(r?.cap_required || 0), status: r?.status || q.status || "plan", evidence: r?.evidence || [] };
    });
    const normalizedProgress = Array.from(aggregatedProgressMap.entries()).map(([key, p]) => ({
      entity_code: key.split("__")[0],
      entity_name: key.split("__")[0],
      total_questions: p.total_questions || 0,
      answered_questions: p.answered_questions || 0,
      total_marks: p.total_marks || 0,
      obtained_marks: p.obtained_marks || 0,
      status: "plan",
      org_tree_id: key.includes("__") ? (key.split("__")[1] === "null" ? null : key.split("__")[1]) : null,
    }));
    return {
      audit: { audit_id: cap.cap_id, audit_code: cap.cap_id, title: cap.title, status: cap.status, start_date: String(auditMeta?.start_date || cap.start_date || ""), end_date: String(auditMeta?.end_date || cap.end_date || ""), organization_name: auditMeta?.organization_name || "", organization_email: auditMeta?.organization_email || "", organization_phone: auditMeta?.organization_phone || "", auditor_name: auditMeta?.auditor_name || [auditMeta?.assigned_auditor_first_name, auditMeta?.assigned_auditor_last_name].filter(Boolean).join(" ") || "", auditor_email: auditMeta?.auditor_email || "", auditor_phone: auditMeta?.auditor_phone || "", entities: Array.from(entitiesMap.values()) },
      responses: normalizedResponses, progress: normalizedProgress, questions: normalizedQuestions,
      summary: { total_marks: summaryData.total_marks, obtained_marks: summaryData.obtained_marks, score_pct: summaryData.score_pct, total_questions: summaryData.total_questions, answered_questions: summaryData.answered_questions, total_entities: entitiesMap.size },
    };
  }, [cap, questions, responseMap, entityTree, auditMeta, aggregatedProgressMap, summaryData]);

  if (isLoading) {
    return (
      <div className="min-h-full bg-transparent flex items-center justify-center px-4 pt-14 lg:pt-0">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="min-h-full bg-transparent flex flex-col">
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-28 pt-20 sm:p-6 sm:pb-28 lg:p-8 lg:pb-10 lg:pt-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── Header ── */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconButton bordered onClick={() => router.push(`/my-caps/details?id=${capId}`)}>
                <ArrowLeft size={16} />
              </IconButton>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-secondary-400" />
                  CAP Report
                </h1>
                {cap && (
                  <p className="text-sm text-gray-400 mt-0.5 hidden sm:block">{cap.title}</p>
                )}
              </div>
            </div>
            {cap && capPdfReport && (
              <div className="shrink-0">
                <CapPdfRenderer report={capPdfReport as any} entityTree={entityTree as any} />
              </div>
            )}
          </div>

          {/* ── Loading / Error ── */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
            </div>

          ) : error ? (
            <div className="glass rounded-xl p-10 text-center border border-red-500/20">
              <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>

          ) : cap ? (
            <>
              {/* ── Summary Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">

                {/* Score ring */}
                <div className="glass rounded-xl border border-white/[0.08] p-4 sm:p-5 flex flex-col items-center text-center">
                  <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-2">
                    <svg className="w-16 h-16 sm:w-20 sm:h-20 -rotate-90" viewBox="0 0 36 36">
                      <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                        fill="none"
                        stroke={getScoreStroke(summaryData.score_pct)}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${summaryData.score_pct}, 100`}
                      />
                    </svg>
                    <span className={`absolute text-base sm:text-lg font-bold ${getScoreColor(summaryData.score_pct)}`}>
                      {summaryData.score_pct}%
                    </span>
                  </div>
                  <p className="text-xs font-medium text-white">Overall Score</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {summaryData.obtained_marks}/{summaryData.total_marks} marks
                  </p>
                </div>

                {/* Questions */}
                <div className="glass rounded-xl border border-white/[0.08] p-4 sm:p-5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
                    <HelpCircle size={15} className="text-blue-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{summaryData.answered_questions}</p>
                  <p className="text-xs text-gray-400 mt-0.5">of {summaryData.total_questions} answered</p>
                  <div className="h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${summaryData.total_questions > 0 ? Math.round((summaryData.answered_questions / summaryData.total_questions) * 100) : 0}%` }} />
                  </div>
                </div>

                {/* CAP */}
                <div className="glass rounded-xl border border-white/[0.08] p-4 sm:p-5 col-span-2 sm:col-span-1">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-3">
                    <AlertTriangle size={15} className="text-orange-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {responses.filter((r) => r.cap_required === 1).length}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">CAP Required</p>
                </div>
              </div>

              {/* ── Schedule info ── */}
              <div className="glass rounded-xl border border-white/[0.08] px-4 py-3">
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-secondary-400 shrink-0" />
                    <span className="text-gray-500">Start:</span>
                    <span className="text-white">{fmtDate(auditMeta?.start_date || cap.start_date || null)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-secondary-400 shrink-0" />
                    <span className="text-gray-500">End:</span>
                    <span className="text-white">{fmtDate(auditMeta?.end_date || cap.end_date || null)}</span>
                  </div>
                </div>
              </div>

              {/* ── Entity Breakdown ── */}
              <div>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp size={14} className="text-secondary-400" />
                  Entity Breakdown
                </h2>
                <div>
                  {entityTree ? (
                    entityTree.code === "__root__" ? (
                      (entityTree.children as EntityTreeNode[]).map((node, idx) => (
                        <EntityTreeSection
                          key={`${node.code}-${idx}`}
                          node={node}
                          questions={questions}
                          responses={responses}
                          aggregatedMap={aggregatedProgressMap}
                          capEntityCodes={capEntityCodes}
                        />
                      ))
                    ) : (
                      <EntityTreeSection
                        node={entityTree}
                        questions={questions}
                        responses={responses}
                        aggregatedMap={aggregatedProgressMap}
                        capEntityCodes={capEntityCodes}
                      />
                    )
                  ) : (
                    entities.length > 0 ? (
                      entities.map((entity, idx) => (
                        <EntityTreeSection
                          key={`${entity.entity_code}-${idx}`}
                          node={{
                            code: entity.entity_code,
                            name: entity.entity_code,
                            entity_type: entity.entity_type || "",
                            edge_id: entity.org_tree_id ?? null,
                            children: [],
                          }}
                          questions={questions}
                          responses={responses}
                          aggregatedMap={aggregatedProgressMap}
                          capEntityCodes={capEntityCodes}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">No entity data available.</p>
                    )
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
