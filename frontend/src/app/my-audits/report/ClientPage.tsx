"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi } from "@/lib/api";
import { AuditPdfRenderer } from "@/components/audit/AuditPdfRenderer";
import { IconButton } from "@/components/ui";
import { getEvidenceUrl, inferEvidenceKind } from "@/utils/executionService";

import {
  ArrowLeft,
  BarChart3,
  Building2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  HelpCircle,
  FileText,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  Paperclip,
  Video,
  Music,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface EntityProgress {
  audit_entity_progress_id?: string;
  entity_code: string;
  org_tree_id?: string | null;
  entity_name?: string;
  total_questions: number;
  answered_questions: number;
  total_marks: number;
  obtained_marks: number;
  status: string;
}

interface Evidence {
  id: string;
  file_type: string;
  file_path: string;
  file_name: string;
  file_size: number;
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
  status: string;
  evidence: Evidence[];
}

interface QuestionOption {
  id: string;
  checklist_question_option_id: string;
  option_text: string;
  marks: number;
}

interface Question {
  id: string;
  checklist_question_id: string;
  question_text: string;
  answer_type: string;
  total_marks: number;
  entity_code: string;
  org_tree_id?: string | null;
  order_index: number;
  options: QuestionOption[];
}

interface AuditEntity {
  entity_code: string;
  org_tree_id?: string | null;
  entity_type: string;
  entity_name: string;
}

interface EntityTreeNode {
  code: string;
  name: string;
  entity_type: string;
  edge_id?: string | null;
  children: EntityTreeNode[];
}

interface ReportData {
  audit: {
    audit_id: string;
    audit_code: string;
    title: string;
    status: string;
    start_date: string;
    end_date: string;
    entities: AuditEntity[];
  };
  responses: AuditResponse[];
  progress: EntityProgress[];
  questions: Question[];
  summary: {
    total_marks: number;
    obtained_marks: number;
    score_pct: number;
    total_questions: number;
    answered_questions: number;
    total_entities: number;
  };
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
  node, report, depth = 0, aggregatedMap, auditEntityCodes,
}: {
  node: EntityTreeNode;
  report: ReportData;
  depth?: number;
  aggregatedMap?: Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number }>;
  auditEntityCodes?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const nodeOrgTreeId = node.edge_id ?? null;
  const nodeKey = `${node.code}__${nodeOrgTreeId ?? "null"}`;

  const isAuditEntity = !auditEntityCodes || auditEntityCodes.has(nodeKey);

  const subtreeHasAuditEntity = (n: EntityTreeNode): boolean => {
    const k = `${n.code}__${(n.edge_id ?? null) === null ? "null" : n.edge_id}`;
    if (auditEntityCodes?.has(k)) return true;
    return (n.children || []).some(subtreeHasAuditEntity);
  };

  const visibleChildren = auditEntityCodes
    ? (node.children || []).filter(subtreeHasAuditEntity)
    : (node.children || []);

  if (auditEntityCodes && !isAuditEntity && visibleChildren.length === 0) return null;

  const progress = aggregatedMap?.get(nodeKey) ||
    report.progress.find((p) => sameEntityInstance(node.code, nodeOrgTreeId, p));

  const entityName = node.name ||
    (progress && "entity_name" in progress ? (progress as any).entity_name : null) ||
    report.audit.entities.find((e) => sameEntityInstance(node.code, nodeOrgTreeId, e))?.entity_name ||
    node.code;

  const questions = isAuditEntity ? report.questions.filter((q) =>
    sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true })
  ) : [];
  const responses = isAuditEntity ? report.responses.filter((r) =>
    sameEntityInstance(node.code, nodeOrgTreeId, r)
  ) : [];
  const capRequiredCount =
    progress && "cap_required_count" in progress
      ? (progress as any).cap_required_count
      : responses.filter((r) => r.cap_required === 1).length;

  const pct =
    progress && progress.total_marks > 0
      ? Math.round((progress.obtained_marks / progress.total_marks) * 100)
      : 0;

  const hasQuestions = questions.length > 0;
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
                {questions.map((q) => {
                  const resp = responses.find(
                    (r) => r.checklist_question_id === q.checklist_question_id && sameEntityInstance(node.code, nodeOrgTreeId, r)
                  );
                  const hasCap = (resp?.cap_required || 0) === 1;
                  const qPct = q.total_marks > 0
                    ? Math.round(((resp?.marks_obtained || 0) / q.total_marks) * 100)
                    : 0;
                  return (
                    <div
                      key={q.id}
                      className={`flex gap-3 px-3 py-2.5 rounded-lg ${
                        hasCap
                          ? "bg-orange-500/5 border border-orange-500/10"
                          : "bg-white/[0.02] border border-white/[0.04]"
                      }`}
                    >
                      <span className="shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] text-gray-500 font-mono mt-0.5">
                        {q.order_index + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-xs text-gray-200 leading-snug">{q.question_text}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs font-semibold ${getScoreColor(qPct)}`}>
                            {resp?.marks_obtained ?? 0}/{q.total_marks} pts
                          </span>
                          {resp?.answer_text && (
                            <span className="text-[10px] text-gray-500 truncate max-w-[200px]">
                              &ldquo;{resp.answer_text}&rdquo;
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
                    key={child.code}
                    node={child}
                    report={report}
                    depth={depth + 1}
                    aggregatedMap={aggregatedMap}
                    auditEntityCodes={auditEntityCodes}
                  />
                ))}
              </div>
            )}

            {!hasQuestions && !hasVisibleChildren && (
              <p className="px-4 py-3 text-xs text-gray-600 italic">
                No questions recorded for this entity.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function MyAuditReportPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id") as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [entityTree, setEntityTree] = useState<EntityTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const aggregatedProgressMap = useMemo(() => {
    if (!report || !entityTree)
      return new Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number }>();

    const map = new Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number }>();

    const getAggregatedData = (node: EntityTreeNode) => {
      const nodeOrgTreeId = node.edge_id ?? null;
      const nodeQuestions = report.questions.filter((q) =>
        sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true })
      );
      const nodeResponses = report.responses.filter((r) =>
        sameEntityInstance(node.code, nodeOrgTreeId, r)
      );

      let total_marks = 0, obtained_marks = 0, cap_required_count = 0;
      nodeQuestions.forEach((q) => {
        total_marks += Number(q.total_marks || 0);
        const r = nodeResponses.find((resp) => resp.checklist_question_id === q.checklist_question_id);
        if (r) {
          obtained_marks += Number(r.marks_obtained || 0);
          if (r.cap_required === 1) cap_required_count++;
        }
      });

      if (node.children?.length > 0) {
        node.children.forEach((child) => {
          const c = getAggregatedData(child);
          total_marks += c.total_marks;
          obtained_marks += c.obtained_marks;
          cap_required_count += c.cap_required_count;
        });
      }

      const key = `${node.code}__${nodeOrgTreeId ?? "null"}`;
      const result = { total_marks, obtained_marks, cap_required_count };
      map.set(key, result);
      return result;
    };

    if (entityTree.code === "__root__") entityTree.children.forEach((c) => getAggregatedData(c));
    else getAggregatedData(entityTree);

    return map;
  }, [report, entityTree]);

  const auditEntityCodes = useMemo(() => {
    if (!report) return new Set<string>();
    return new Set(
      (report.audit.entities || []).map((e) => {
        const id = (e.org_tree_id ?? null);
        return `${e.entity_code}__${id === null ? "null" : id}`;
      })
    );
  }, [report]);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const loadReport = useCallback(async () => {
    if (!accessToken || !auditId) return;
    setLoading(true);
    setError("");
    const [reportRes, treeRes] = await Promise.all([
      auditExecutionApi.getReport(accessToken, auditId),
      auditExecutionApi.getEntityTree(accessToken, auditId),
    ]);
    if (reportRes.success && reportRes.data) setReport(reportRes.data as ReportData);
    else setError(reportRes.message || "Failed to load report.");
    if (treeRes.success && treeRes.data)
      setEntityTree((treeRes.data as { tree: EntityTreeNode }).tree);
    setLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => { loadReport(); }, [loadReport]);

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
              <IconButton bordered onClick={() => router.push(`/my-audits/details?id=${auditId}`)}>
                <ArrowLeft size={16} />
              </IconButton>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-secondary-400" />
                  Audit Report
                </h1>
                {report && (
                  <p className="text-sm text-gray-400 mt-0.5 hidden sm:block">{report.audit.title}</p>
                )}
              </div>
            </div>
            {report && (
              <div className="shrink-0">
                <AuditPdfRenderer report={report} entityTree={entityTree} />
              </div>
            )}
          </div>

          {/* ── Loading ── */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
            </div>

          ) : error ? (
            <div className="glass rounded-xl p-10 text-center border border-red-500/20">
              <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>

          ) : report ? (
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
                        stroke={getScoreStroke(report.summary.score_pct)}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${report.summary.score_pct}, 100`}
                      />
                    </svg>
                    <span className={`absolute text-base sm:text-lg font-bold ${getScoreColor(report.summary.score_pct)}`}>
                      {report.summary.score_pct}%
                    </span>
                  </div>
                  <p className="text-xs font-medium text-white">Overall Score</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {report.summary.obtained_marks}/{report.summary.total_marks} marks
                  </p>
                </div>

                {/* Questions */}
                <div className="glass rounded-xl border border-white/[0.08] p-4 sm:p-5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
                    <HelpCircle size={15} className="text-blue-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{report.summary.answered_questions}</p>
                  <p className="text-xs text-gray-400 mt-0.5">of {report.summary.total_questions} answered</p>
                  <div className="h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${report.summary.total_questions > 0 ? Math.round((report.summary.answered_questions / report.summary.total_questions) * 100) : 0}%` }} />
                  </div>
                </div>

                {/* CAP */}
                <div className="glass rounded-xl border border-white/[0.08] p-4 sm:p-5 col-span-2 sm:col-span-1">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-3">
                    <AlertTriangle size={15} className="text-orange-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {report.responses.filter((r) => r.cap_required === 1).length}
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
                    <span className="text-white">{fmtDate(report.audit.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-secondary-400 shrink-0" />
                    <span className="text-gray-500">End:</span>
                    <span className="text-white">{fmtDate(report.audit.end_date)}</span>
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
                          report={report}
                          aggregatedMap={aggregatedProgressMap}
                          auditEntityCodes={auditEntityCodes}
                        />
                      ))
                    ) : (
                      <EntityTreeSection
                        node={entityTree}
                        report={report}
                        aggregatedMap={aggregatedProgressMap}
                        auditEntityCodes={auditEntityCodes}
                      />
                    )
                  ) : (
                    report.audit.entities.map((entity, idx) => (
                      <EntityTreeSection
                        key={`${entity.entity_code}-${idx}`}
                        node={{
                          code: entity.entity_code,
                          name: entity.entity_name,
                          entity_type: entity.entity_type,
                          edge_id: entity.org_tree_id ?? null,
                          children: [],
                        }}
                        report={report}
                        aggregatedMap={aggregatedProgressMap}
                        auditEntityCodes={auditEntityCodes}
                      />
                    ))
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
