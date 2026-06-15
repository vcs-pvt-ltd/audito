"use client";

import { useEffect, useState, useCallback,useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi } from "@/lib/api";
import { AuditPdfRenderer } from "@/components/audit/AuditPdfRenderer";

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
  Camera,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────

interface EntityProgress {
  entity_code: string;
  org_tree_id?: number | null;
  entity_name?: string;
  total_questions: number;
  answered_questions: number;
  total_marks: number;
  obtained_marks: number;
  status: string;
}

interface Evidence {
  id: number;
  file_type: string;
  file_path: string;
  file_name: string;
  file_size: number;
}

interface AuditResponse {
  id: number;
  question_id: number;
  entity_code: string;
  org_tree_id?: number | null;
  answer_text: string | null;
  selected_option_ids: string | null;
  marks_obtained: number;
  remarks: string | null;
  cap_required: number;
  status: string;
  evidence: Evidence[];
}

interface QuestionOption {
  id: number;
  option_text: string;
  marks: number;
}

interface Question {
  id: number;
  question_text: string;
  answer_type: string;
  total_marks: number;
  entity_code: string;
  org_tree_id?: number | null;
  order_index: number;
  options: QuestionOption[];
}

interface AuditEntity {
  entity_code: string;
  org_tree_id?: number | null;
  entity_type: string;
  entity_name: string;
}

interface EntityTreeNode {
  code: string;
  name: string;
  entity_type: string;
  edge_id?: number | null;
  children: EntityTreeNode[];
}

interface ReportData {
  audit: {
    id: number;
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

// ─── Constants & Helpers ──────────────────────────────────────────

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

function sameEntityInstance(
  entityCode: string,
  orgTreeId: number | null | undefined,
  item: { entity_code: string; org_tree_id?: number | null },
  { allowGeneric = false }: { allowGeneric?: boolean } = {}
) {
  const normalizedOrgTreeId = orgTreeId ?? null;
  const itemOrgTreeId = item.org_tree_id ?? null;
  if (allowGeneric && itemOrgTreeId === null) {
    return item.entity_code === entityCode;
  }
  if (itemOrgTreeId !== null || normalizedOrgTreeId !== null) {
    return item.entity_code === entityCode && itemOrgTreeId === normalizedOrgTreeId;
  }
  return item.entity_code === entityCode;
}

// ─── Entity Tree Section (recursive accordion) ──────────────────

function EntityTreeSection({
  node,
  report,
  depth = 0,
  aggregatedMap,
}: {
  node: EntityTreeNode;
  report: ReportData;
  depth?: number;
  aggregatedMap?: Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const nodeOrgTreeId = node.edge_id ?? null;
  const nodeKey = `${node.code}__${nodeOrgTreeId ?? "null"}`;

  const progress = aggregatedMap?.get(nodeKey) || report.progress.find((p) => sameEntityInstance(node.code, nodeOrgTreeId, p));

  const entityName = node.name ||
    (progress && 'entity_name' in progress ? (progress as any).entity_name : null) ||
    report.audit.entities.find((e) => sameEntityInstance(node.code, nodeOrgTreeId, e))?.entity_name ||
    node.code;

  const questions = report.questions.filter((q) => sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true }));
  const responses = report.responses.filter((r) => sameEntityInstance(node.code, nodeOrgTreeId, r));
  const capRequiredCount = progress && 'cap_required_count' in progress 
    ? (progress as any).cap_required_count 
    : responses.filter((r) => r.cap_required === 1).length;

  const pct =
    progress && progress.total_marks > 0
      ? Math.round((progress.obtained_marks / progress.total_marks) * 100)
      : 0;

  const hasQuestions = questions.length > 0;
  const hasChildren = node.children?.length > 0;

  return (
    <div className={depth > 0 ? "ml-3 sm:ml-5 border-l border-white/[0.06] pl-2 sm:pl-3" : ""}>
      <div className="bg-emerald-500/8 backdrop-blur-sm rounded-xl border border-emerald-500/20 overflow-hidden mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 hover:bg-emerald-500/10 transition-colors text-left"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {expanded ? (
              <ChevronDown size={12} className="text-gray-500 shrink-0 sm:w-3.5 sm:h-3.5" />
            ) : (
              <ChevronRight size={12} className="text-gray-500 shrink-0 sm:w-3.5 sm:h-3.5" />
            )}
            <Building2 size={12} className="text-secondary-400 shrink-0 sm:w-3.5 sm:h-3.5" />
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="text-xs sm:text-sm font-medium text-white truncate">{entityName}</span>
              {node.entity_type && (
                <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-white/5 text-gray-400 w-fit">
                  {node.entity_type}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 ml-5 sm:ml-0">
            {hasChildren && (
              <span className="text-[9px] sm:text-[10px] text-gray-600 whitespace-nowrap">
                {node.children.length} sub
              </span>
            )}
            {capRequiredCount > 0 && (
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 whitespace-nowrap">
                <AlertTriangle size={8} className="sm:w-2.5 sm:h-2.5" /> {capRequiredCount}
              </span>
            )}
            {progress && (
              <>
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className={`text-xs sm:text-sm font-bold ${getScoreColor(pct)}`}>{pct}%</span>
                  <div className="w-12 sm:w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${getScoreBarColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[9px] sm:text-[10px] text-gray-500 whitespace-nowrap">
                  {progress.obtained_marks}/{progress.total_marks}
                </span>
              </>
            )}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-emerald-500/15">
            {/* Questions for this entity */}
            {hasQuestions && (
              <div className="px-3 sm:px-5 py-2 sm:py-3 space-y-2">
                {questions.map((q) => {
                  const resp = responses.find(
                    (r) => r.question_id === q.id && sameEntityInstance(node.code, nodeOrgTreeId, r)
                  );
                  const hasCap = (resp?.cap_required || 0) === 1;
                  const qPct =
                    q.total_marks > 0
                      ? Math.round(((resp?.marks_obtained || 0) / q.total_marks) * 100)
                      : 0;
                  return (
                    <div
                      key={q.id}
                      className={`flex flex-col sm:flex-row gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg ${
                        hasCap
                          ? "bg-orange-500/5 border border-orange-500/10"
                          : "bg-white/[0.02]"
                      }`}
                    >
                      <span className="shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/5 flex items-center justify-center text-[8px] sm:text-[10px] text-gray-500 font-mono">
                        {q.order_index}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-[11px] sm:text-xs text-gray-200 leading-snug">{q.question_text}</p>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-3 flex-wrap">
                          <span className={`text-[11px] sm:text-xs font-bold ${getScoreColor(qPct)}`}>
                            {resp?.marks_obtained ?? 0}/{q.total_marks}
                          </span>
                          {resp?.answer_text && (
                            <span className="text-[9px] sm:text-[10px] text-gray-500 truncate max-w-[200px] sm:max-w-xs">
                              &ldquo;{resp.answer_text}&rdquo;
                            </span>
                          )}
                          {resp?.remarks && (
                            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-blue-400">
                              <FileText size={8} className="sm:w-2.5 sm:h-2.5" /> {resp.remarks}
                            </span>
                          )}
                          {hasCap && (
                            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-orange-400">
                              <AlertTriangle size={8} className="sm:w-2.5 sm:h-2.5" /> CAP Required
                            </span>
                          )}
                          {resp?.evidence && resp.evidence.length > 0 && (
                            <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-purple-400">
                              <Camera size={8} className="sm:w-2.5 sm:h-2.5" /> {resp.evidence.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Children — nested recursively */}
            {hasChildren && (
            <div className="px-2 sm:px-4 pb-2 sm:pb-3 pt-1 sm:pt-2 border-t border-emerald-500/15 bg-emerald-500/5 space-y-0">
                {node.children.map((child) => (
                  <EntityTreeSection
                    key={child.code}
                    node={child}
                    report={report}
                    depth={depth + 1}
                    aggregatedMap={aggregatedMap}
                  />
                ))}
              </div>
            )}

            {!hasQuestions && !hasChildren && (
              <p className="px-3 sm:px-5 py-2 sm:py-3 text-[10px] sm:text-xs text-gray-600 italic">
                No questions recorded for this entity.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

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
    if (!report || !entityTree) return new Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number }>();
    
    const map = new Map<string, { total_marks: number; obtained_marks: number; cap_required_count: number }>();

    const getAggregatedData = (node: EntityTreeNode) => {
      const nodeOrgTreeId = node.edge_id ?? null;
      
      // Own questions
      const nodeQuestions = report.questions.filter(q => sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true }));
      const nodeResponses = report.responses.filter(r => sameEntityInstance(node.code, nodeOrgTreeId, r));
      
      let total_marks = 0;
      let obtained_marks = 0;
      let cap_required_count = 0;

      nodeQuestions.forEach(q => {
        total_marks += Number(q.total_marks || 0);
        const r = nodeResponses.find(resp => resp.question_id === q.id);
        if (r) {
          obtained_marks += Number(r.marks_obtained || 0);
          if (r.cap_required === 1) cap_required_count++;
        }
      });

      // Child questions
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          const childData = getAggregatedData(child);
          total_marks += childData.total_marks;
          obtained_marks += childData.obtained_marks;
          cap_required_count += childData.cap_required_count;
        });
      }

      const key = `${node.code}__${nodeOrgTreeId ?? "null"}`;
      const result = { total_marks, obtained_marks, cap_required_count };
      map.set(key, result);
      return result;
    };

    if (entityTree.code === "__root__") {
      entityTree.children.forEach(child => getAggregatedData(child));
    } else {
      getAggregatedData(entityTree);
    }

    return map;
  }, [report, entityTree]);

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
    if (reportRes.success && reportRes.data) {
      setReport(reportRes.data as ReportData);
    } else {
      setError(reportRes.message || "Failed to load report.");
    }
    if (treeRes.success && treeRes.data) {
      setEntityTree((treeRes.data as { tree: EntityTreeNode }).tree);
    }
    setLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="relative">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
          </div>
        </div>
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 pt-16 sm:pt-6 md:pt-8">

        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push(`/my-audits/details?id=${auditId}`)}
              className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-400 sm:w-5 sm:h-5" />
                Audit Report
              </h1>
              {report && (
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  {report.audit.title}
                </p>
              )}
            </div>
          </div>
          {report && (
            <div className="w-full sm:w-auto">
              <AuditPdfRenderer report={report} entityTree={entityTree} />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="relative">
              <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 sm:p-8 text-center border border-white/10">
            <AlertCircle size={28} className="text-red-400 mx-auto mb-3 sm:w-8 sm:h-8" />
            <p className="text-red-400 text-sm sm:text-base">{error}</p>
          </div>
        ) : report ? (
          <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto">

            {/* Summary Cards - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {/* Overall Score */}
              <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5 text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3">
                  <svg className="w-16 h-16 sm:w-20 sm:h-20 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    <path
                      d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                      fill="none"
                      stroke={report.summary.score_pct >= 80 ? "#10b981" : report.summary.score_pct >= 60 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${report.summary.score_pct}, 100`}
                    />
                  </svg>
                  <span className={`absolute text-base sm:text-xl font-bold ${getScoreColor(report.summary.score_pct)}`}>
                    {report.summary.score_pct}%
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400">Overall Score</p>
                <p className="text-[8px] sm:text-[10px] text-gray-600 mt-0.5">
                  {report.summary.obtained_marks}/{report.summary.total_marks} marks
                </p>
              </div>

              {/* Questions */}
              <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5">
                <HelpCircle size={16} className="text-blue-400 mb-2 sm:w-5 sm:h-5" />
                <p className="text-xl sm:text-2xl font-bold text-white">{report.summary.answered_questions}</p>
                <p className="text-[10px] sm:text-xs text-gray-400">of {report.summary.total_questions} Questions</p>
                <div className="h-1 bg-white/10 rounded-full mt-2 sm:mt-3 overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${report.summary.total_questions > 0 ? Math.round((report.summary.answered_questions / report.summary.total_questions) * 100) : 0}%` }}
                  />
                </div>
              </div>

            

              {/* CAP Required */}
              <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5">
                <AlertTriangle size={16} className="text-orange-400 mb-2 sm:w-5 sm:h-5" />
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {report.responses.filter((r) => r.cap_required === 1).length}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400">CAP Required</p>
              </div>
            </div>

            {/* Schedule Info - Responsive */}
            <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-[10px] sm:text-xs">
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-secondary-400 shrink-0" />
                  <span className="text-gray-500">Start:</span>
                  <span className="text-white">{fmtDate(report.audit.start_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-secondary-400 shrink-0" />
                  <span className="text-gray-500">End:</span>
                  <span className="text-white">{fmtDate(report.audit.end_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Status:</span>
                  <span className="text-emerald-400 capitalize">{report.audit.status.replace("_", " ")}</span>
                </div>
              </div>
            </div>

            {/* Entity Breakdown */}
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-3 flex items-center gap-2">
                <TrendingUp size={12} className="text-secondary-400 sm:w-3.5 sm:h-3.5" />
                Entity Breakdown
              </h2>
              <div className="space-y-0">
                {entityTree ? (
                  entityTree.code === "__root__" ? (
                    (entityTree.children as EntityTreeNode[]).map((node, idx) => (
                      <EntityTreeSection key={`${node.code}-${idx}`} node={node} report={report} aggregatedMap={aggregatedProgressMap} />
                    ))
                  ) : (
                    <EntityTreeSection node={entityTree} report={report} aggregatedMap={aggregatedProgressMap} />
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
                    />
                  ))
                )}
              </div>
            </div>

         
          </div>
        ) : null}
      </main>
    </div>
  );
}


