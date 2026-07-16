"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi, orgTreeApi } from "@/lib/api";
import { IconButton } from "@/components/ui";
import {
  ArrowLeft,
  ClipboardCheck,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  List,
  AlignLeft,
  ClipboardList,
  Info,
} from "lucide-react";

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: number | string | null;
  children: TreeNode[];
  [key: string]: unknown;
}

interface AuditEntity {
  entity_code: string;
  entity_type: string;
  entity_name: string;
}

interface AuditDetail {
  id: string;
  audit_code: string;
  title: string;
  audit_type: "internal" | "external";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  start_date: string;
  end_date: string;
  budget: string | number | null;
  num_workers: number | null;
  notes: string | null;
  checklist_name: string | null;
  checklist_id: number | null;
  assigned_auditor_id: string | null;
  assigned_firm_code: string | null;
  created_at: string;
  entities: AuditEntity[];
}

interface QuestionOption {
  id: string;
  option_text: string;
  marks: number;
  order_index: number;
}

interface ChecklistQuestion {
  id: string;
  question_text: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  total_marks: number;
  order_index: number;
  options: QuestionOption[];
}

interface EntityQuestion {
  entity_code: string;
  questions: ChecklistQuestion[];
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  "Customer": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Buying Office": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Supplier": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Company": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Cluster": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Factory": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Unit": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Department": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Section": "bg-green-500/20 text-green-300 border-green-500/30",
  "Audit Firm": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Audit Firm Company": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Branch": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Audit Firm Department": "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
};

const ANSWER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: ReactNode }> = {
  free_text: { label: "Free Text", color: "bg-gray-500/20 text-gray-300 border-gray-500/30", icon: <AlignLeft size={11} /> },
  single_option: { label: "Single Choice", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: <CheckSquare size={11} /> },
  multiple_options: { label: "Multiple Choice", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: <List size={11} /> },
  dropdown: { label: "Dropdown", color: "bg-teal-500/20 text-teal-300 border-teal-500/30", icon: <ChevronDown size={11} /> },
};

function pruneTree(node: TreeNode, auditEntityCodes: Set<string>): TreeNode | null {
  const nodeKey = `${node.code}__${node.edge_id ?? "null"}`;
  const isAuditEntity = auditEntityCodes.has(nodeKey) || auditEntityCodes.has(`${node.code}__null`);
  const prunedChildren: TreeNode[] = [];
  for (const child of node.children || []) {
    const pruned = pruneTree(child, auditEntityCodes);
    if (pruned) prunedChildren.push(pruned);
  }
  if (isAuditEntity || prunedChildren.length > 0) {
    return { ...node, children: prunedChildren };
  }
  return null;
}

function countDescendantQuestions(node: TreeNode, map: Record<string, ChecklistQuestion[]>): number {
  const nodeKey = `${node.code}__${node.edge_id ?? "null"}`;
  const own = (map[nodeKey] || map[`${node.code}__null`] || []).length;
  return own + (node.children ?? []).reduce((s, c) => s + countDescendantQuestions(c, map), 0);
}

function findInTree(node: TreeNode, code: string): TreeNode | null {
  if (node.code === code) return node;
  for (const child of node.children || []) {
    const r = findInTree(child, code);
    if (r) return r;
  }
  return null;
}

// ─── Entity Preview Card ─────────────────────────────────────────

function EntityPreviewCard({
  node, index, questionsMap, onClick,
}: {
  node: TreeNode; index: number;
  questionsMap: Record<string, ChecklistQuestion[]>;
  onClick: () => void;
}) {
  const totalQs = countDescendantQuestions(node, questionsMap);
  const subsections = (node.children ?? []).length;
  const typeCls = ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";

  return (
    <div onClick={onClick}
      className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer transition-all hover:border-white/20 hover:shadow-lg hover:shadow-black/20 group">
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-800 to-primary-800/60">
        <span className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-secondary-500/30 shrink-0">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{node.name || node.code}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border inline-block mt-0.5 ${typeCls}`}>{node.entity_type}</span>
        </div>
        <ChevronRight size={18} className="text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
      <div className="p-4 flex items-center gap-4 flex-wrap">
        {subsections > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Building2 size={13} className="text-gray-500" />
            <span>{subsections} Subsection{subsections !== 1 ? "s" : ""}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <ClipboardList size={13} className="text-secondary-400" />
          <span>{totalQs} Question{totalQs !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Question Preview Item ────────────────────────────────────────

function QuestionPreviewItem({
  question, index, isOpen, onToggle,
}: {
  question: ChecklistQuestion; index: number; isOpen: boolean; onToggle: () => void;
}) {
  const atConf = ANSWER_TYPE_CONFIG[question.answer_type] || ANSWER_TYPE_CONFIG.free_text;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isOpen ? "border-white/[0.12] bg-white/[0.04]" : "border-white/[0.08] bg-white/[0.02]"
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors text-left"
      >
        <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold bg-white/5 text-gray-500">
          {index}
        </span>
        <p className={`text-sm flex-1 ${isOpen ? "text-white font-medium" : "text-gray-300 truncate"}`}>
          {question.question_text}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-bold text-gray-500">{question.total_marks}pts</span>
          <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border ${atConf.color}`}>
              {atConf.icon}
              {atConf.label}
            </span>
            <span className="text-[10px] text-gray-500 ml-auto">{question.total_marks} marks</span>
          </div>
          {question.options && question.options.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {question.options.map(opt => (
                <div key={opt.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/10">
                  <div className="w-3.5 h-3.5 rounded-full border border-gray-600 shrink-0" />
                  <span className="text-[11px] text-gray-400 flex-1">{opt.option_text}</span>
                  {opt.marks > 0 && <span className="text-[9px] font-bold text-secondary-400">{opt.marks} pts</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step History Type ────────────────────────────────────────────

type Step =
  | { mode: "cards"; parentCode: string | null }
  | { mode: "questions"; entityCode: string; entityEdgeId: string | number | null; entityName: string };

// ─── Main Page ────────────────────────────────────────────────────

export default function MyAuditPreviewPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id") as string;
  const contentRef = useRef<HTMLDivElement>(null);

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [entityQuestionsMap, setEntityQuestionsMap] = useState<Record<string, ChecklistQuestion[]>>({});
  const [prunedTree, setPrunedTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stepHistory, setStepHistory] = useState<Step[]>([{ mode: "cards", parentCode: null }]);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
    if (!isLoading && admin && admin.role !== "auditor") router.push("/audits");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken || !auditId) return;
    setLoading(true);
    setError("");
    try {
      const res = await auditExecutionApi.getDetail(accessToken, auditId);
      if (res.success && res.data) {
        const data = res.data as { audit: AuditDetail };
        const auditData = data.audit;
        setAudit(auditData);

        const execData = res.data as { audit: { entity_questions?: EntityQuestion[] } };
        const map: Record<string, ChecklistQuestion[]> = {};
        for (const eq of execData.audit.entity_questions || []) {
          const k = `${eq.entity_code}__${(eq as any).org_tree_id ?? 'null'}`;
          map[k] = eq.questions;
        }
        setEntityQuestionsMap(map);

        if (auditData.entities && auditData.entities.length > 0) {
          const auditCodes = new Set(auditData.entities.map((e) => `${e.entity_code}__${(e as any).org_tree_id ?? (e as any).assigned_org_tree_id ?? "null"}`));
          const entityTreeRes = await auditExecutionApi.getEntityTree(accessToken, auditId);
          if (entityTreeRes.success && entityTreeRes.data) {
            const td = entityTreeRes.data as { tree: TreeNode };
            if (td.tree) {
              setPrunedTree(pruneTree(td.tree, auditCodes));
            }
          } else {
            const treeRes = await orgTreeApi.getTree(accessToken);
            if (treeRes.success && treeRes.data) {
              const td = treeRes.data as { tree: TreeNode };
              if (td.tree) {
                setPrunedTree(pruneTree(td.tree, auditCodes));
              }
            }
          }
        }
      } else {
        setError(res.message || "Audit not found.");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { contentRef.current?.scrollTo(0, 0); setOpenQuestionId(null); }, [stepHistory]);

  if (isLoading) {
    return (
      <div className="min-h-full bg-transparent flex items-center justify-center px-4">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin || admin.role !== "auditor") return null;

  // Navigation helpers
  const activeStep = stepHistory[stepHistory.length - 1];
  const isRoot = activeStep.mode === "cards" && activeStep.parentCode === null;
  const goBack = () => setStepHistory(h => h.length > 1 ? h.slice(0, -1) : h);

  function getCards(): TreeNode[] {
    if (!prunedTree || activeStep.mode !== "cards") return [];
    const { parentCode } = activeStep;
    if (parentCode === null) {
      return ENTITY_TYPE_COLORS[prunedTree.entity_type] ? [prunedTree] : (prunedTree.children ?? []);
    }
    const parent = findInTree(prunedTree, parentCode);
    return parent ? (parent.children ?? []) : [];
  }

  const navigateCard = (node: TreeNode) => {
    const k = `${node.code}__${node.edge_id ?? 'null'}`;
    const hasQ = (entityQuestionsMap[k] || entityQuestionsMap[`${node.code}__null`] || []).length > 0;
    const hasKids = (node.children ?? []).length > 0;
    if (!hasQ && hasKids) {
      setStepHistory(h => [...h, { mode: "cards", parentCode: node.code }]);
    } else {
      setStepHistory(h => [...h, {
        mode: "questions",
        entityCode: node.code,
        entityEdgeId: node.edge_id ?? null,
        entityName: node.name || node.code,
      }]);
    }
  };

  // Breadcrumb trail
  const breadcrumbs: string[] = [];
  for (let i = 1; i < stepHistory.length; i++) {
    const s = stepHistory[i];
    if (s.mode === "cards" && s.parentCode) {
      const found = prunedTree ? findInTree(prunedTree, s.parentCode) : null;
      breadcrumbs.push(found?.name || s.parentCode);
    } else if (s.mode === "questions") {
      breadcrumbs.push(s.entityName);
    }
  }

  return (
    <div className="h-full min-h-full bg-transparent flex">
      <div className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">

        {/* Top bar */}
        <div className="shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 bg-transparent/80 backdrop-blur-sm border-b border-white/[0.05]">
          <div className="flex items-center gap-3 min-w-0">
            <IconButton bordered onClick={isRoot ? () => router.push(`/my-audits/details?id=${auditId}`) : goBack}>
              <ArrowLeft size={14} />
            </IconButton>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate flex items-center gap-2">
                <ClipboardCheck size={16} className="text-secondary-400 shrink-0" />
                {audit?.title || "Preview Audit"}
              </h1>
              {breadcrumbs.length > 0 && (
                <div className="flex items-center gap-1 mt-0.5 min-w-0 overflow-hidden">
                  <span className="text-[11px] text-gray-600 shrink-0">Scope</span>
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1 min-w-0">
                      <ChevronRight size={10} className="text-gray-600 shrink-0" />
                      <span className={`text-[11px] truncate ${i === breadcrumbs.length - 1 ? "text-gray-300" : "text-gray-600"}`}>
                        {crumb}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {audit && isRoot && (
            <span className="text-[11px] text-gray-500 shrink-0 hidden sm:block font-mono">
              {audit.entities.length} {audit.entities.length === 1 ? "entity" : "entities"}
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="glass rounded-xl p-8 text-center max-w-sm border border-white/10">
              <AlertCircle size={28} className="text-red-400 mx-auto mb-3" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        ) : audit ? (
          <div ref={contentRef} className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
            <div className="max-w-4xl mx-auto">

              {activeStep.mode === "cards" ? (
                // ── Cards view ──────────────────────────────────
                (() => {
                  // If no tree, fall back to flat entity list
                  if (!prunedTree) {
                    if (audit.entities.length === 0) {
                      return (
                        <div className="py-16 text-center">
                          <ClipboardList size={32} className="text-gray-700 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 italic">No entities assigned to this audit.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {audit.entities.map((e, i) => {
                          const k = `${e.entity_code}__${(e as any).org_tree_id ?? (e as any).assigned_org_tree_id ?? 'null'}`;
                          const qs = entityQuestionsMap[k] || [];
                          const typeCls = ENTITY_TYPE_COLORS[e.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
                          return (
                            <div key={k}
                              onClick={() => setStepHistory(h => [...h, {
                                mode: "questions",
                                entityCode: e.entity_code,
                                entityEdgeId: (e as any).org_tree_id ?? null,
                                entityName: e.entity_name || e.entity_code,
                              }])}
                              className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer transition-all hover:border-white/20 hover:shadow-lg hover:shadow-black/20 group">
                              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-800 to-primary-800/60">
                                <span className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold text-white truncate block">{e.entity_name || e.entity_code}</span>
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border inline-block mt-0.5 ${typeCls}`}>{e.entity_type}</span>
                                </div>
                                <ChevronRight size={18} className="text-white/60 group-hover:text-white transition-all shrink-0" />
                              </div>
                              <div className="p-4 flex items-center gap-1.5 text-xs text-gray-400">
                                <ClipboardList size={13} className="text-secondary-400" />
                                <span>{qs.length} Question{qs.length !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  const cards = getCards();
                  if (cards.length === 0) {
                    return (
                      <div className="py-16 text-center">
                        <Info size={28} className="text-gray-700 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 italic">No sub-entities in this section.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {cards.map((node, i) => (
                        <EntityPreviewCard
                          key={`${node.code}__${node.edge_id ?? "null"}`}
                          node={node}
                          index={i + 1}
                          questionsMap={entityQuestionsMap}
                          onClick={() => navigateCard(node)}
                        />
                      ))}
                    </div>
                  );
                })()
              ) : (
                // ── Questions view ──────────────────────────────
                (() => {
                  const step = activeStep as {
                    mode: "questions";
                    entityCode: string;
                    entityEdgeId: string | number | null;
                    entityName: string;
                  };
                  const k = `${step.entityCode}__${step.entityEdgeId ?? 'null'}`;
                  const qs = entityQuestionsMap[k] || entityQuestionsMap[`${step.entityCode}__null`] || [];
                  const entityNode = prunedTree ? findInTree(prunedTree, step.entityCode) : null;
                  const typeCls = entityNode
                    ? (ENTITY_TYPE_COLORS[entityNode.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30")
                    : "bg-gray-500/20 text-gray-300 border-gray-500/30";
                  const subEntities = entityNode ? (entityNode.children ?? []) : [];

                  return (
                    <div className="space-y-4">
                      {/* Entity header */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
                          <Building2 size={15} className="text-secondary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{step.entityName}</p>
                          {entityNode && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border inline-block mt-0.5 ${typeCls}`}>
                              {entityNode.entity_type}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500 font-mono shrink-0">{qs.length} Questions</span>
                      </div>

                      {/* Questions */}
                      {qs.length === 0 ? (
                        <div className="py-12 text-center rounded-xl border border-dashed border-white/[0.08]">
                          <Info size={24} className="text-gray-700 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 italic">No questions mapped for this entity.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {qs.map((q, qi) => (
                            <QuestionPreviewItem
                              key={q.id}
                              question={q}
                              index={qi + 1}
                              isOpen={openQuestionId === q.id}
                              onToggle={() => setOpenQuestionId(prev => prev === q.id ? null : q.id)}
                            />
                          ))}
                        </div>
                      )}

                      {(() => {
                        const hasSubEntityQuestions = subEntities.some(c => countDescendantQuestions(c, entityQuestionsMap) > 0);
                        return (
                          <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/[0.06]">
                            <button
                              onClick={() => setStepHistory(h => h.slice(0, -1))}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                            >
                              <ArrowLeft size={14} /> Back
                            </button>
                            {hasSubEntityQuestions && (
                              <button
                                onClick={() => setStepHistory(h => [...h, { mode: "cards", parentCode: step.entityCode }])}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all shadow-lg shadow-secondary-500/20"
                              >
                                Next <ChevronRight size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()
              )}

            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
