"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi, orgTreeApi } from "@/lib/api";
import {
  ArrowLeft,
  ClipboardCheck,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  CheckSquare,
  List,
  AlignLeft,
  Building,
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
  id: number;
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
  assigned_auditor_code: string | null;
  assigned_firm_code: string | null;
  created_at: string;
  entities: AuditEntity[];
}

interface QuestionOption {
  id: number;
  option_text: string;
  marks: number;
  order_index: number;
}

interface ChecklistQuestion {
  id: number;
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
  // Also check by just code for root nodes that might not have edge_id
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

function EntityTreeNode({
  node,
  questionsMap,
  auditEntityCodes,
  depth,
}: {
  node: TreeNode;
  questionsMap: Record<string, ChecklistQuestion[]>;
  auditEntityCodes: Set<string>;
  depth: number;
}) {
  const k = `${node.code}__${node.edge_id ?? 'null'}`;
  const isAuditEntity = auditEntityCodes.has(k) || auditEntityCodes.has(`${node.code}__null`);
  const questions = (questionsMap[k] || questionsMap[`${node.code}__null`] || []);
  const totalQs = countDescendantQuestions(node, questionsMap);
  const [expanded, setExpanded] = useState(totalQs > 0 || isAuditEntity);
  const typeColor = ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const hasChildren = (node.children ?? []).length > 0;
  const isLeaf = !hasChildren && questions.length === 0;

  return (
    <div className="relative">
      <div
        className="relative"
        style={{ paddingLeft: depth === 0 ? 0 : 28 }}
      >
        {/* Tree connector lines */}
        {depth > 0 && (
          <>
            <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-transparent" />
            <div className="absolute left-[13px] top-[22px] w-[15px] h-px bg-gradient-to-r from-white/[0.12] to-white/[0.04]" />
            <div className="absolute left-[11px] top-[20px] w-1.5 h-1.5 rounded-full bg-white/[0.15] ring-1 ring-white/[0.06]" />
          </>
        )}

        <button
          onClick={() => setExpanded((p) => !p)}
          className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border transition-all duration-200 text-left group ${
            isAuditEntity
              ? "bg-white/[0.04] border-white/[0.12] hover:bg-white/[0.07] hover:border-white/[0.22] shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
              : "bg-transparent border-transparent hover:bg-white/[0.02]"
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {!isLeaf && (
              <div className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 ${
                expanded ? "bg-white/[0.08] text-gray-300" : "bg-white/[0.04] text-gray-600 group-hover:text-gray-400"
              }`}>
                {expanded ? <ChevronDown size={12} strokeWidth={2.5} /> : <ChevronRight size={12} strokeWidth={2.5} />}
              </div>
            )}
            {isLeaf && <div className="w-5 shrink-0" />}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${typeColor} shrink-0 transition-all duration-200 ${
              isAuditEntity ? "shadow-[0_0_12px_rgba(255,255,255,0.04)]" : ""
            }`}>
              <Building2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${typeColor.split(' ')[1]} mb-0.5 block`}>
                {node.entity_type}
              </span>
              <span className={`text-sm font-semibold truncate block ${isAuditEntity ? "text-white" : "text-gray-400"}`}>
                {node.name}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {totalQs > 0 && (
              <span className="text-[10px] font-bold text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-2.5 py-1 rounded-lg">
                {totalQs} Questions
              </span>
            )}
          </div>
        </button>
      </div>

      {expanded && (
        <div className="mt-1 space-y-1">
          {questions.length > 0 && (
            <div
              className="space-y-3 py-2"
              style={{ paddingLeft: depth === 0 ? 56 : 84 }}
            >
              {questions.map((q, qi) => {
                const atConf = ANSWER_TYPE_CONFIG[q.answer_type] || ANSWER_TYPE_CONFIG.free_text;
                return (
                  <div key={q.id} className="relative group/q">
                    {/* Subtle connector for questions */}
                    <div className="absolute -left-5 top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.06] to-transparent" />
                    <div className="absolute -left-5 top-6 w-4 h-px bg-white/[0.06]" />
                    
                    <div className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-lg transition-all duration-200 hover:border-white/[0.18] bg-white/[0.02] backdrop-blur-sm">
                      {/* Card header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                        <span className="w-6 h-6 rounded-lg bg-secondary-500/15 border border-secondary-500/20 flex items-center justify-center text-secondary-400 text-[11px] font-bold shrink-0">
                          {qi + 1}
                        </span>
                        <span className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight ${atConf.color.split(' ')[1]}`}>
                          {atConf.icon}
                          {atConf.label}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                           <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{q.total_marks} Marks</span>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        <p className="text-sm text-gray-200 leading-relaxed font-medium">
                          {q.question_text}
                        </p>
                        
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {q.options.map((opt) => (
                              <div key={opt.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 transition-all hover:bg-white/[0.05]">
                                <div className="w-4 h-4 rounded-full border-2 border-gray-600 shrink-0" />
                                <span className="text-xs text-gray-400 flex-1">{opt.option_text}</span>
                                {opt.marks > 0 && (
                                  <span className="text-[9px] font-bold text-secondary-400 px-1.5 py-0.5 rounded-md bg-secondary-500/10 border border-secondary-500/20">
                                    {opt.marks} pts
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(node.children ?? []).map((child) => (
            <EntityTreeNode
              key={child.edge_id ?? child.code}
              node={child}
              questionsMap={questionsMap}
              auditEntityCodes={auditEntityCodes}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntityListItem({
  entity,
  questions,
}: {
  entity: AuditEntity;
  questions: ChecklistQuestion[];
}) {
  const [expanded, setExpanded] = useState(questions.length > 0);
  const colorClass = ENTITY_TYPE_COLORS[entity.entity_type] || "bg-gray-500/20 text-gray-300 border-gray-500/30";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-all hover:border-white/20">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 py-3 px-4 hover:bg-white/[0.03] transition-colors text-left"
      >
         <div className="shrink-0 text-gray-500">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClass} shrink-0`}>
          <Building2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${colorClass.split(' ')[1]} mb-0.5 block`}>
            {entity.entity_type}
          </span>
          <span className="text-sm font-semibold text-white truncate block">{entity.entity_name || entity.entity_code}</span>
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          {questions.length > 0 && (
            <span className="text-[10px] font-bold text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-2.5 py-1 rounded-lg">
              {questions.length} Questions
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {questions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/5 p-3 rounded-xl border border-dashed border-white/10">
               <Info size={14} /> No questions mapped for this entity.
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, qi) => {
                const atConf = ANSWER_TYPE_CONFIG[q.answer_type] || ANSWER_TYPE_CONFIG.free_text;
                return (
                  <div key={q.id} className="glass rounded-2xl border border-white/10 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-3.5 py-2.5 bg-white/[0.02] border-b border-white/[0.06]">
                      <span className="w-5 h-5 rounded-lg bg-secondary-500/15 border border-secondary-500/20 flex items-center justify-center text-secondary-400 text-[10px] font-bold">
                        {qi + 1}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight ${atConf.color.split(' ')[1]}`}>
                        {atConf.icon}
                        {atConf.label}
                      </span>
                      <span className="ml-auto text-[10px] font-bold text-gray-500 uppercase tracking-widest">{q.total_marks} Marks</span>
                    </div>
                    <div className="p-4 space-y-3">
                       <p className="text-sm text-gray-200 font-medium">{q.question_text}</p>
                       {q.options && q.options.length > 0 && (
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {q.options.map((opt) => (
                              <div key={opt.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/10">
                                <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />
                                <span className="text-xs text-gray-400 flex-1">{opt.option_text}</span>
                                {opt.marks > 0 && <span className="text-[9px] font-bold text-secondary-400">{opt.marks}pts</span>}
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyAuditPreviewPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id") as string;

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [entityQuestionsMap, setEntityQuestionsMap] = useState<Record<string, ChecklistQuestion[]>>({});
  const [prunedTree, setPrunedTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    load();
  }, [load]);

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
  if (!admin || admin.role !== "auditor") return null;

  return (
    <div className="min-h-screen ">
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 md:py-8 pt-16 sm:pt-6 md:pt-8">
        
        {/* Header - Responsive */}
        <div className="flex items-center gap-2 sm:gap-3 mb-6">
          <button
            onClick={() => router.push(`/my-audits/details?id=${auditId}`)}
            className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
          >
            <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck size={18} className="text-secondary-400 sm:w-5 sm:h-5" />
              Preview Audit
            </h1>
            {audit && (
              <p className="text-[11px] sm:text-sm text-gray-400 mt-0.5 font-mono truncate">
                {audit.title}
              </p>
            )}
          </div>
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
        ) : audit ? (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Audit Scope Card */}
            <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-6 space-y-4 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2.5">
                  <ClipboardList size={14} className="text-secondary-400" />
                  Audit Scope & Questions
                  <span className="text-gray-700 font-medium normal-case ml-1">({audit.entities.length} assigned entities)</span>
                </h3>
              </div>

              {audit.entities.length === 0 ? (
                <div className="py-12 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/10">
                  <p className="text-sm text-gray-600 italic">No entities assigned to this audit.</p>
                </div>
              ) : prunedTree ? (
                <div className="bg-white/[0.02] rounded-2xl border border-white/[0.08] p-3 sm:p-5 space-y-1 shadow-inner">
                  {(() => {
                    const auditCodes = new Set(audit.entities.map((e) => `${e.entity_code}__${(e as any).org_tree_id ?? (e as any).assigned_org_tree_id ?? 'null'}`));
                    const root = prunedTree;
                    return ENTITY_TYPE_COLORS[root.entity_type] ? (
                      <EntityTreeNode node={root} questionsMap={entityQuestionsMap} auditEntityCodes={auditCodes} depth={0} />
                    ) : (
                      (root.children ?? []).map((child) => (
                        <EntityTreeNode key={`${child.code}__${child.edge_id ?? 'null'}`} node={child} questionsMap={entityQuestionsMap} auditEntityCodes={auditCodes} depth={0} />
                      ))
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  {audit.entities.map((e) => (
                    <EntityListItem
                      key={`${e.entity_code}__${(e as any).org_tree_id ?? (e as any).assigned_org_tree_id ?? 'null'}`}
                      entity={e}
                      questions={entityQuestionsMap[`${e.entity_code}__${(e as any).org_tree_id ?? 'null'}`] || []}
                    />
                  ))}
                </div>
              )}

              {/* Show assigned entities that might be missing from the tree */}
              {prunedTree && audit.entities.some(e => {
                const k = `${e.entity_code}__${(e as any).org_tree_id ?? 'null'}`;
                const findInTree = (node: TreeNode): boolean => {
                  if (`${node.code}__${node.edge_id ?? 'null'}` === k) return true;
                  return (node.children || []).some(findInTree);
                };
                return !findInTree(prunedTree);
              }) && (
                <div className="mt-8 space-y-4">
                   <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest pl-2">Other Assigned Entities</h4>
                   <div className="space-y-3">
                     {audit.entities.filter(e => {
                       const k = `${e.entity_code}__${(e as any).org_tree_id ?? 'null'}`;
                       const findInTree = (node: TreeNode): boolean => {
                         if (`${node.code}__${node.edge_id ?? 'null'}` === k) return true;
                         return (node.children || []).some(findInTree);
                       };
                       return !findInTree(prunedTree);
                     }).map(e => (
                       <EntityListItem
                        key={`${e.entity_code}__${(e as any).org_tree_id ?? 'null'}`}
                        entity={e}
                        questions={entityQuestionsMap[`${e.entity_code}__${(e as any).org_tree_id ?? 'null'}`] || []}
                      />
                     ))}
                   </div>
                </div>
              )}
            </div>

           
          </div>
        ) : null}
      </main>
    </div>
  );
}


