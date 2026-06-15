"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi, capApi } from "@/lib/api";
import { getEvidenceUrl, inferEvidenceKind } from "@/utils/executionService";
import { AlertCircle, ArrowLeft, BarChart3, Building2, CheckCircle2, ChevronDown, ChevronRight, TrendingUp, AlertTriangle, FileText, Camera, Video, Music, Paperclip, HelpCircle } from "lucide-react";
import { CapPdfRenderer } from "@/components/cap/CapPdfRenderer";

interface Cap {
  id: number;
  cap_plan_code: string;
  audit_id?: number;
  title: string;
  status: string;
  start_date?: string;
  end_date?: string;
}
interface CapQuestion {
  id: number;
  entity_code: string;
  org_tree_id?: number | null;
  question_text: string;
  total_marks: string | number;
  status: string;
  order_index?: number;
  ca_description?: string;
}
interface CapResponse {
  id?: number;
  cap_question_id: number;
  response_text: string | null;
  selected_option_ids?: string | null | number[];
  marks_obtained?: number;
  remarks?: string | null;
  cap_required?: number;
  status: string;
  evidence?: { id: number; file_type: string; file_path: string; file_name: string; file_size?: number }[];
}
interface CapProgress {
  entity_code: string;
  entity_name?: string;
  org_tree_id?: number | null;
  total_questions: number;
  answered_questions: number;
  total_marks?: number;
  obtained_marks?: number;
  status: string;
}
interface TreeNode {
  code: string;
  name: string;
  entity_type: string;
  edge_id?: number | null;
  children: TreeNode[];
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

function EntityTreeSection({
  node,
  questionsByEntity,
  responses,
  progMap,
  depth = 0,
}: {
  node: TreeNode;
  questionsByEntity: Record<string, CapQuestion[]>;
  responses: Record<number, CapResponse>;
  progMap: Map<string, CapProgress>;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const nodeKey = `${node.code}__${(node as any).edge_id ?? "null"}`;
  const entityQuestions = questionsByEntity[nodeKey] || [];
  const entityProgress = progMap.get(nodeKey);
  const hasQuestions = entityQuestions.length > 0;
  const hasChildren = (node.children || []).length > 0;

  const pct = (entityProgress && (entityProgress.total_marks || 0) > 0)
    ? Math.round(((entityProgress.obtained_marks || 0) / (entityProgress.total_marks || 1)) * 100)
    : 0;

  const getScoreColor = (pct: number) => {
    if (pct >= 100) return "text-emerald-400";
    if (pct > 0) return "text-secondary-400";
    return "text-gray-400";
  };
  const getScoreBarColor = (pct: number) => {
    if (pct >= 100) return "from-emerald-500 to-emerald-400";
    if (pct > 0) return "from-secondary-500 to-secondary-400";
    return "from-gray-500 to-gray-400";
  };

  return (
    <div className={depth > 0 ? "ml-5 border-l border-white/[0.06] pl-3" : ""}>
      <div className="bg-emerald-500/8 backdrop-blur-sm rounded-xl border border-emerald-500/20 overflow-hidden mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-emerald-500/10 transition-colors text-left"
        >
          {expanded ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
          <Building2 size={14} className="text-secondary-400 shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{node.name || node.code}</span>
            {node.entity_type && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 shrink-0">
                {node.entity_type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {hasChildren && <span className="text-[10px] text-gray-600">{node.children.length} sub</span>}
            {entityProgress && entityProgress.total_questions > 0 && (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${getScoreColor(pct)}`}>{pct}%</span>
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${getScoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            {entityProgress && (entityProgress.total_marks || 0) > 0 && (
              <span className="text-[10px] text-gray-500">
                {entityProgress.obtained_marks}/{entityProgress.total_marks}
              </span>
            )}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-emerald-500/15">
            {hasQuestions && (
              <div className="px-5 py-3 space-y-2">
                {entityQuestions.map((q, idx) => {
                  const resp = responses[q.id];
                  const hasResp = !!resp?.response_text;
                  const isDone = q.status === "completed" || hasResp;
                  const totalMarks = Number(q.total_marks || 0);
                  const obtained = Number(resp?.marks_obtained || 0);
                  return (
                    <div key={q.id} className={`flex gap-3 px-3 py-2.5 rounded-lg ${!isDone ? "bg-amber-500/5 border border-amber-500/10" : "bg-white/[0.02] border border-white/[0.04]"}`}>
                      <span className="shrink-0 w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-gray-500 font-mono mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-gray-200 leading-snug">{q.question_text}</p>
                          {isDone ? (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] text-emerald-400">
                              <CheckCircle2 size={10} /> Completed
                            </span>
                          ) : (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] text-amber-400">
                              <AlertTriangle size={10} /> Pending
                            </span>
                          )}
                        </div>
                        {q.ca_description && (
                          <div className="pt-1 pb-1 text-[11px] text-amber-400/80">
                            <span className="font-medium mr-1 text-amber-500/70">Requirement:</span>{q.ca_description}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <span className={`font-bold ${obtained >= totalMarks && totalMarks > 0 ? "text-emerald-400" : obtained > 0 ? "text-secondary-400" : "text-gray-500"}`}>
                            {obtained}/{totalMarks}
                          </span>
                          {resp?.remarks && (
                            <span className="flex items-center gap-1 text-blue-400">
                              <FileText size={10} /> {resp.remarks}
                            </span>
                          )}
                          {(resp?.evidence || []).length > 0 && (
                            <span className="flex items-center gap-1 text-purple-400">
                              <Camera size={10} /> {(resp?.evidence || []).length}
                            </span>
                          )}
                        </div>
                        {hasResp && (
                          <div className="mt-2 text-xs text-secondary-500 break-words">
                            Response: {resp.response_text}
                          </div>
                        )}
                        {(resp?.evidence || []).length > 0 && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(resp?.evidence || []).map((ev) => {
                              const kind = inferEvidenceKind(ev.file_type, ev.file_name, ev.file_path);
                              const url = getEvidenceUrl(ev.file_path);
                              return (
                                <a key={ev.id} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.03] p-2 hover:border-white/20">
                                  {kind === "image" ? (
                                    <img src={url} alt={ev.file_name || "evidence"} className="w-full h-20 object-cover rounded-md" />
                                  ) : (
                                    <div className="w-full h-20 rounded-md bg-white/[0.04] flex items-center justify-center text-gray-300">
                                      {kind === "video" ? <Video size={16} /> : kind === "audio" ? <Music size={16} /> : <Paperclip size={16} />}
                                    </div>
                                  )}
                                  <p className="mt-1 text-[10px] text-gray-400 truncate">{ev.file_name || "Evidence"}</p>
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
            {hasChildren && (
              <div className="px-4 pb-3 pt-2 border-t border-emerald-500/15 bg-emerald-500/5 space-y-0">
                {node.children.map((child) => (
                  <EntityTreeSection
                    key={`${child.code}__${(child as any).edge_id ?? "null"}`}
                    node={child}
                    questionsByEntity={questionsByEntity}
                    responses={responses}
                    progMap={progMap}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
            {!hasQuestions && !hasChildren && (
              <p className="px-5 py-3 text-xs text-gray-600 italic">No CAP actions required for this entity.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PDF Export Function ──────────────────────────────────────────

export default function MyCapReportPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const capId = searchParams.get("id") as string;

  const [cap, setCap] = useState<Cap | null>(null);
  const [questions, setQuestions] = useState<CapQuestion[]>([]);
  const [responses, setResponses] = useState<CapResponse[]>([]);
  const [progress, setProgress] = useState<CapProgress[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auditMeta, setAuditMeta] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    const [detailRes, respRes] = await Promise.all([
      capApi.get(accessToken, capId),
      capApi.getResponses(accessToken, capId),
    ]);
    setLoading(false);
    if (!detailRes.success || !detailRes.data) {
      setError(detailRes.message || "Failed to load CAP report.");
      return;
    }
    const detail = detailRes.data as {
      cap: Cap;
      source_audit?: Record<string, any> | null;
      questions: CapQuestion[];
      progress: CapProgress[];
      tree?: TreeNode | null;
    };
    setCap(detail.cap);
    setQuestions(detail.questions || []);
    setProgress(detail.progress || []);
    if (detail.tree) setTree(detail.tree);

    if (detail.source_audit) {
      setAuditMeta(detail.source_audit);
    } else {
      const sourceAuditId = detail.cap?.audit_id;
      if (sourceAuditId) {
        const auditDetailRes = await auditExecutionApi.getDetail(accessToken, sourceAuditId);
        if (auditDetailRes.success && auditDetailRes.data) {
          const payload = auditDetailRes.data as any;
          setAuditMeta(payload?.audit || payload);
        } else {
          setAuditMeta(null);
        }
      } else {
        setAuditMeta(null);
      }
    }

    if (respRes.success && respRes.data) {
      setResponses((respRes.data as { responses: CapResponse[] }).responses || []);
    }
  }, [accessToken, capId]);

  useEffect(() => { load(); }, [load]);

  const responseMap = useMemo(() => {
    const m: Record<number, CapResponse> = {};
    for (const r of responses) m[r.cap_question_id] = r;
    return m;
  }, [responses]);

  const totalQ = questions.length;
  const answeredQ = questions.filter((q) => q.status === "completed" || !!responseMap[q.id]?.response_text).length;
  const pct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;
  const pendingQ = totalQ - answeredQ;

  const byEntity = useMemo(() => {
    const m: Record<string, CapQuestion[]> = {};
    if (!tree) return m;

    const walk = (node: TreeNode) => {
      const nodeOrgTreeId = (node as any).edge_id ?? null;
      const nodeKey = `${node.code}__${nodeOrgTreeId ?? "null"}`;
      
      const nodeQuestions = questions.filter(q => sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true }));
      if (nodeQuestions.length > 0) m[nodeKey] = nodeQuestions;
      
      (node.children || []).forEach(walk);
    };
    walk(tree);
    return m;
  }, [questions, tree]);

  const prunedTree = useMemo(() => {
    if (!tree) return null;

    const hasQuestionsForNode = (n: TreeNode) => {
      const edgeId = (n as any).edge_id ?? null;
      return questions.some(q => sameEntityInstance(n.code, edgeId, q, { allowGeneric: true }));
    };

    const prune = (n: TreeNode | null): TreeNode | null => {
      if (!n) return null;
      const prunedChildren = (n.children || [])
        .map((c) => prune(c))
        .filter(Boolean) as TreeNode[];
      if (hasQuestionsForNode(n) || prunedChildren.length > 0) {
        return { ...n, children: prunedChildren };
      }
      return null;
    };

    return prune(tree);
  }, [tree, byEntity]);
  
  const progMap = useMemo(() => {
    if (!tree || !questions) return new Map<string, CapProgress>();
    
    const map = new Map<string, CapProgress>();

    const getAggregatedData = (node: TreeNode): CapProgress => {
      const nodeOrgTreeId = (node as any).edge_id ?? null;
      const nodeKey = `${node.code}__${nodeOrgTreeId ?? "null"}`;
      
      // Own questions
      const nodeQuestions = questions.filter(q => sameEntityInstance(node.code, nodeOrgTreeId, q, { allowGeneric: true }));
      
      let total_questions = nodeQuestions.length;
      let answered_questions = nodeQuestions.filter(q => q.status === "completed" || !!responseMap[q.id]?.response_text).length;
      let total_marks = 0;
      let obtained_marks = 0;

      nodeQuestions.forEach(q => {
        total_marks += Number(q.total_marks || 0);
        const resp = responseMap[q.id];
        if (resp) {
          obtained_marks += Number(resp.marks_obtained || 0);
        }
      });

      // Child questions
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          const childData = getAggregatedData(child);
          total_questions += childData.total_questions;
          answered_questions += childData.answered_questions;
          total_marks += (childData.total_marks || 0);
          obtained_marks += (childData.obtained_marks || 0);
        });
      }

      const result: CapProgress = {
        entity_code: node.code,
        entity_name: node.name,
        org_tree_id: (node as any).edge_id ?? null,
        total_questions,
        answered_questions,
        total_marks,
        obtained_marks,
        status: total_marks > 0 && obtained_marks === total_marks ? "completed" : "pending"
      };
      map.set(nodeKey, result);
      return result;
    };

    getAggregatedData(tree);

    return map;
  }, [tree, questions, responseMap]);

  const capPdfReport = useMemo(() => {
    if (!cap) return null;

    const entitiesMap = new Map<string, { entity_code: string; entity_type: string; entity_name: string }>();
    const walk = (n: TreeNode | null) => {
      if (!n) return;
      if (n.code && n.code !== "__root__") {
        entitiesMap.set(n.code, {
          entity_code: n.code,
          entity_type: n.entity_type || "",
          entity_name: n.name || n.code,
        });
      }
      for (const c of n.children || []) walk(c);
    };
    walk(prunedTree || tree);

    const normalizedQuestions = questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      answer_type: "free_text",
      total_marks: Number(q.total_marks || 0),
      entity_code: q.entity_code,
      order_index: q.order_index || 0,
      options: [],
    }));

    const normalizedResponses = questions.map((q) => {
      const r = responseMap[q.id];
      return {
        id: r?.id || q.id,
        question_id: q.id,
        entity_code: q.entity_code,
        org_tree_id: q.org_tree_id ?? null,
        answer_text: r?.response_text || null,
        selected_option_ids: (r?.selected_option_ids as string | null) || null,
        marks_obtained: Number(r?.marks_obtained || 0),
        remarks: r?.remarks || null,
        cap_required: Number(r?.cap_required || 0),
        status: r?.status || q.status || "plan",
        evidence: r?.evidence || [],
      };
    });

    const marksByEntity: Record<string, { total: number; obtained: number }> = {};
    const toProgressKey = (entityCode: string, orgTreeId?: number | null) =>
      `${entityCode}__${orgTreeId ?? "null"}`;
    for (const q of normalizedQuestions) {
      const orgTreeId = (questions.find((x) => x.id === q.id)?.org_tree_id ?? null);
      const k = toProgressKey(q.entity_code, orgTreeId);
      if (!marksByEntity[k]) marksByEntity[k] = { total: 0, obtained: 0 };
      marksByEntity[k].total += Number(q.total_marks || 0);
    }
    for (const r of normalizedResponses) {
      const k = toProgressKey(r.entity_code, r.org_tree_id ?? null);
      if (!marksByEntity[k]) marksByEntity[k] = { total: 0, obtained: 0 };
      marksByEntity[k].obtained += Number(r.marks_obtained || 0);
    }

    const normalizedProgress = progress.map((p) => ({
      entity_code: p.entity_code,
      entity_name: p.entity_name || entitiesMap.get(p.entity_code)?.entity_name || p.entity_code,
      total_questions: Number(p.total_questions || 0),
      answered_questions: Number(p.answered_questions || 0),
      total_marks:
        Number(p.total_marks || 0) ||
        marksByEntity[toProgressKey(p.entity_code, p.org_tree_id ?? null)]?.total ||
        0,
      obtained_marks:
        Number(p.obtained_marks || 0) ||
        marksByEntity[toProgressKey(p.entity_code, p.org_tree_id ?? null)]?.obtained ||
        0,
      status: p.status || "plan",
      org_tree_id: p.org_tree_id ?? null,
    }));

    const totalMarks = normalizedQuestions.reduce((s, q) => s + (Number(q.total_marks) || 0), 0);
    const obtainedMarks = normalizedResponses.reduce((s, r) => s + (Number(r.marks_obtained) || 0), 0);
    const answeredQuestions = normalizedResponses.filter((r) => (r.answer_text || "").trim().length > 0).length;
    const totalQuestions = normalizedQuestions.length;

    return {
      audit: {
        id: cap.id,
        audit_code: cap.cap_plan_code,
        title: cap.title,
        status: cap.status,
        start_date: String(
          auditMeta?.start_date ||
          auditMeta?.audit_start_date ||
          cap.start_date ||
          ""
        ),
        end_date: String(
          auditMeta?.end_date ||
          auditMeta?.audit_end_date ||
          cap.end_date ||
          ""
        ),
        organization_name: auditMeta?.organization_name || auditMeta?.org_name || "",
        organization_email: auditMeta?.organization_email || auditMeta?.org_email || "",
        organization_phone: auditMeta?.organization_phone || auditMeta?.org_phone_number || "",
        auditor_name:
          auditMeta?.auditor_name ||
          [auditMeta?.assigned_auditor_first_name, auditMeta?.assigned_auditor_last_name]
            .filter(Boolean)
            .join(" ") ||
          "",
        auditor_email: auditMeta?.auditor_email || auditMeta?.assigned_auditor_email || "",
        auditor_phone: auditMeta?.auditor_phone || auditMeta?.assigned_auditor_phone || "",
        entities: Array.from(entitiesMap.values()),
      },
      responses: normalizedResponses,
      progress: normalizedProgress,
      questions: normalizedQuestions,
      summary: {
        total_marks: totalMarks,
        obtained_marks: obtainedMarks,
        score_pct: totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0,
        total_questions: totalQuestions,
        answered_questions: answeredQuestions,
        total_entities: entitiesMap.size,
      },
    };
  }, [cap, questions, progress, responseMap, tree, prunedTree, auditMeta]);

  if (isLoading) return <div className="h-screen bg-transparent flex items-center justify-center"><div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" /></div>;
  if (!admin) return null;

  return (
    <div className="h-screen bg-transparent flex">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/my-caps/details?id=${capId}`)} className="p-2 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 size={22} className="text-emerald-400" />CAP Report</h1>
              {cap && <p className="text-sm text-gray-400 mt-0.5 truncate">{cap.title} </p>}
            </div>
          </div>
          {cap && (
            <CapPdfRenderer report={capPdfReport as any} entityTree={(prunedTree || tree) as any} />
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : error ? (
          <div className="glass rounded-xl p-8 text-center"><AlertCircle size={32} className="text-red-400 mx-auto mb-2" /><p className="text-red-400">{error}</p></div>
        ) : (
          <div className="space-y-4 sm:space-y-6 max-w-5xl justify-center mx-auto">
            {/* Summary Cards - Same style as audit report */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5 text-center">
                <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-3">
                  <svg className="w-16 h-16 sm:w-20 sm:h-20 -rotate-90" viewBox="0 0 36 36">
                    <path d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    <path
                      d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0-31.831"
                      fill="none"
                      stroke={pct === 100 ? "#10b981" : pct >= 50 ? "#38bdf8" : "#f59e0b"}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${pct}, 100`}
                    />
                  </svg>
                  <span className={`absolute text-base sm:text-xl font-bold ${pct === 100 ? "text-emerald-400" : pct >= 50 ? "text-secondary-400" : "text-amber-400"}`}>
                    {pct}%
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-400">Total Completion</p>
                <p className="text-[8px] sm:text-[10px] text-gray-600 mt-0.5">{answeredQ}/{totalQ} actions done</p>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5">
                <HelpCircle size={16} className="text-blue-400 mb-2 sm:w-5 sm:h-5" />
                <p className="text-xl sm:text-2xl font-bold text-white">{answeredQ}</p>
                <p className="text-[10px] sm:text-xs text-gray-400">of {totalQ} Actions</p>
                <div className="h-1 bg-white/10 rounded-full mt-2 sm:mt-3 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full"
                    style={{ width: `${totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0}%` }}
                  />
                </div>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5">
                <AlertTriangle size={16} className="text-orange-400 mb-2 sm:w-5 sm:h-5" />
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {responses.filter((r) => Number(r.cap_required || 0) === 1).length}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-400">CAP Required</p>
              </div>
            </div>

            {/* Entity Breakdown */}
            <div>
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-secondary-400" />
                Entity Breakdown
              </h2>
              <div className="space-y-0">
                {tree ? (
                  <EntityTreeSection node={(prunedTree || tree) as any} questionsByEntity={byEntity} responses={responseMap} progMap={progMap} />
                ) : (
                  Object.entries(byEntity).map(([entityKey, qs]) => (
                    <EntityTreeSection
                      key={entityKey}
                      node={{
                        code: entityKey.split("__")[0],
                        name: entityKey.split("__")[0],
                        entity_type: "",
                        edge_id: entityKey.split("__")[1] === "null" ? null : Number(entityKey.split("__")[1]),
                        children: [],
                      }}
                      questionsByEntity={byEntity}
                      responses={responseMap}
                      progMap={progMap}
                    />
                  ))
                )}
              </div>
            </div>

          
          </div>
        )}
      </main>
    </div>
  );
}
