"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { capApi } from "@/lib/api";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  PlusCircle,
  Save,
  ExternalLink,
} from "lucide-react";

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  children: TreeNode[];
  [key: string]: unknown;
}

interface CapDetail {
  id: number;
  cap_plan_code: string;
  audit_id: number;
  title: string;
  status: string;
  parent_cap_id?: number | null;
}

interface CapRequiredItem {
  response_id: number;
  cap_id: number;
  entity_code: string;
  assigned_org_tree_id?: number | null;
  responsible_entity_head?: {
    user_code: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  question_id: number;
  answer_text: string | null;
  selected_option_ids: string | null;
  marks_obtained: string | number | null;
  remarks: string | null;
  cap_required: number;
  status: string;
  answered_by: string | null;
  answered_at: string | null;
  question_text: string;
  order_index: number;
  entity_type: string;
}

interface CorrectiveActionRow {
  id: number;
  audit_id: number;
  response_id: number;
  cap_response_id: number;
  entity_code: string;
  question_id: number;
  responsible_person_code: string | null;
  responsible_person_name: string | null;
  due_date: string | null;
}

interface SubCapSummary {
  id: number;
  cap_plan_code: string;
  title: string;
  status: string;
  parent_cap_id?: number | null;
  total_questions: number;
  completed_questions: number;
  created_at: string;
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  Customer: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Buying Office": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Supplier: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Company: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Cluster: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  Factory: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Unit: "bg-green-500/20 text-green-300 border-green-500/30",
  Department: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Section": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Audit Firm Company": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Branch: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

const CAP_STATUS_BADGE: Record<string, string> = {
  plan: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  draft: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  submitted: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  verified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  closed: "bg-green-500/15 text-green-400 border-green-500/30",
};

function pruneTreeByEntitiesWithItems(node: TreeNode, entityKeys: Set<string>): TreeNode | null {
  const prunedChildren: TreeNode[] = [];
  for (const child of node.children || []) {
    const pruned = pruneTreeByEntitiesWithItems(child, entityKeys);
    if (pruned) prunedChildren.push(pruned);
  }
  const nodeKey = `${node.code}__${(node as any).edge_id ?? "null"}`;
  if (entityKeys.has(nodeKey) || prunedChildren.length > 0) {
    return { ...node, children: prunedChildren };
  }
  return null;
}

function EntityNode({
  node,
  depth,
  itemsByEntity,
  assignments,
  onChange,
}: {
  node: TreeNode;
  depth: number;
  itemsByEntity: Record<string, CapRequiredItem[]>;
  assignments: Record<number, { due_date: string }>;
  onChange: (responseId: number, patch: Partial<{ due_date: string }>) => void;
}) {
  const entityKey = `${node.code}__${(node as any).edge_id ?? "null"}`;
  const entityItems = itemsByEntity[entityKey] || [];
  const [expanded, setExpanded] = useState(entityItems.length > 0);
  const typeColor = ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const hasChildren = (node.children ?? []).length > 0;
  const isLeaf = !hasChildren && entityItems.length === 0;

  return (
    <div className="relative">
      <div className="relative" style={{ paddingLeft: depth === 0 ? 0 : 28 }}>
        {/* Tree connector lines */}
        {depth > 0 && (
          <>
            <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.12] via-white/[0.06] to-transparent" />
            <div className="absolute left-[13px] top-[22px] w-[15px] h-px bg-gradient-to-r from-white/[0.12] to-white/[0.04]" />
            <div className="absolute left-[11px] top-[20px] w-1.5 h-1.5 rounded-full bg-white/[0.15] ring-1 ring-white/[0.06]" />
          </>
        )}

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border transition-all duration-200 text-left group ${
            entityItems.length > 0
              ? "bg-white/[0.04] border-white/[0.12] hover:bg-white/[0.06] hover:border-white/[0.22] shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
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
              entityItems.length > 0 ? "shadow-[0_0_12px_rgba(255,255,255,0.04)]" : ""
            }`}>
              <Building2 size={18} />
            </div>

            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${typeColor.split(' ')[1]} mb-0.5 block`}>
                {node.entity_type}
              </span>
              <span className={`text-sm font-semibold truncate block ${entityItems.length > 0 ? "text-white" : "text-gray-400"}`}>
                {node.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-5 sm:ml-0">
            {entityItems.length > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-secondary-400 bg-secondary-500/10 border border-secondary-500/20 px-2.5 py-1 rounded-lg">
                <HelpCircle size={10} className="shrink-0" />
                {entityItems.length} CAP Required
              </span>
            )}
          </div>
        </button>
      </div>

      {expanded && (
        <div className="mt-1 space-y-1">
          {entityItems.length > 0 && (
            <div className="space-y-3 py-2" style={{ paddingLeft: depth === 0 ? 56 : 84 }}>
              {entityItems.map((it, idx) => {
                const a = assignments[it.response_id] || { due_date: "" };
                const head = it.responsible_entity_head;
                return (
                  <div key={it.response_id} className="relative group/q">
                    {/* Subtle connector for questions */}
                    <div className="absolute -left-5 top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.06] to-transparent" />
                    <div className="absolute -left-5 top-6 w-4 h-px bg-white/[0.06]" />

                    <div className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-lg transition-all duration-200 hover:border-white/[0.18] bg-white/[0.02] backdrop-blur-sm">
                      {/* Card header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
                        <span className="shrink-0 w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 text-[11px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight text-amber-400">
                           <AlertCircle size={12} />
                           Question {it.order_index}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                           <span className="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500/5 border border-amber-500/10">CAP REQUIRED</span>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        <p className="text-sm text-gray-200 leading-relaxed font-medium">
                          {it.question_text}
                        </p>
                        
                        {it.remarks && (
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Remarks</p>
                            <p className="text-xs text-gray-400">{it.remarks}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Responsible (Auto)</p>
                            {head ? (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-secondary-500/10 flex items-center justify-center text-secondary-400 shrink-0">
                                  <Building2 size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium text-white truncate">{head.first_name} {head.last_name}</p>
                                  <p className="text-[10px] text-gray-500 font-mono truncate">{head.email}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-amber-500/60 p-1">
                                <AlertCircle size={14} />
                                <span className="text-xs font-medium">No entity head assigned</span>
                              </div>
                            )}
                          </div>

                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Due Date</p>
                            <div className="relative group/input">
                              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within/input:text-secondary-400 transition-colors" />
                              <input
                                type="date"
                                value={a.due_date}
                                onChange={(e) => onChange(it.response_id, { due_date: e.target.value })}
                                className="w-full pl-10 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-secondary-500/40 focus:ring-1 focus:ring-secondary-500/20 transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(node.children ?? []).map((child) => (
            <EntityNode
              key={child.code}
              node={child}
              depth={depth + 1}
              itemsByEntity={itemsByEntity}
              assignments={assignments}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CapCorrectiveActionsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const capId = searchParams.get("id") as string;

  const [cap, setCap] = useState<CapDetail | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [items, setItems] = useState<CapRequiredItem[]>([]);
  const [assignments, setAssignments] = useState<Record<number, { due_date: string }>>({});
  const [existingSubCap, setExistingSubCap] = useState<SubCapSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingSubCap, setCreatingSubCap] = useState(false);
  const [showCreateSubCapModal, setShowCreateSubCapModal] = useState(false);
  const [subCapTitle, setSubCapTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const itemsByEntity = useMemo(() => {
    const map: Record<string, CapRequiredItem[]> = {};
    for (const it of items) {
      const key = `${it.entity_code}__${it.assigned_org_tree_id ?? "null"}`;
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [items]);

  const load = useCallback(async () => {
    if (!accessToken || !capId) return;
    setLoading(true);
    setError("");

    try {
      const [detailRes, caRes, allCapsRes] = await Promise.all([
        capApi.get(accessToken, capId),
        capApi.getCorrectiveActions(accessToken, capId),
        capApi.list(accessToken, { includeSubCaps: true }),
      ]);

      if (detailRes.success && detailRes.data) {
        setCap((detailRes.data as { cap: CapDetail }).cap);
      }

      // Find existing sub-CAP for this parent
      if (allCapsRes.success && allCapsRes.data) {
        const capsData = allCapsRes.data as { caps: SubCapSummary[] };
        const sub = (capsData.caps || []).find((c: any) => c.parent_cap_id === parseInt(capId));
        setExistingSubCap(sub || null);
      }

      if (!caRes.success || !caRes.data) {
        setError(caRes.message || "Failed to load corrective actions.");
        setLoading(false);
        return;
      }

      const data = caRes.data as { items: CapRequiredItem[]; corrective_actions: CorrectiveActionRow[]; tree: TreeNode | null };
      const its = data.items || [];
      setItems(its);

      const byResponse: Record<number, { due_date: string }> = {};
      for (const row of data.corrective_actions || []) {
        byResponse[row.cap_response_id] = {
          due_date: row.due_date ? String(row.due_date).slice(0, 10) : "",
        };
      }
      for (const it of its) {
        if (!byResponse[it.response_id]) {
          byResponse[it.response_id] = { due_date: "" };
        }
      }
      setAssignments(byResponse);

      const hasSaved = (data.corrective_actions || []).length > 0;
      setSaved(hasSaved);

      const rawTree = data.tree;
      if (rawTree) {
        const entityKeysWithItems = new Set(
          its.map((i) => `${i.entity_code}__${i.assigned_org_tree_id ?? "null"}`)
        );
        const pruned = pruneTreeByEntitiesWithItems(rawTree, entityKeysWithItems);
        setTree(pruned);
      } else {
        setTree(null);
      }
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  }, [accessToken, capId]);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (responseId: number, patch: Partial<{ due_date: string }>) => {
    setAssignments((prev) => ({
      ...prev,
      [responseId]: {
        due_date: prev[responseId]?.due_date || "",
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    setError("");
    setToast("");

    const actions = items.map((it) => {
      const a = assignments[it.response_id] || { due_date: "" };
      return {
        response_id: it.response_id,
        entity_code: it.entity_code,
        question_id: it.question_id,
        assigned_org_tree_id: it.assigned_org_tree_id || null,
        due_date: a.due_date || null,
      };
    });

    const res = await capApi.saveCorrectiveActions(accessToken, capId, actions);
    setSaving(false);
    if (res.success) {
      setToast("Corrective actions saved successfully!");
      setSaved(true);
      setTimeout(() => setToast(""), 4000);
      await load();
    } else {
      setError(res.message || "Failed to save.");
    }
  };

  const handleCreateSubCap = async () => {
    if (!accessToken || !cap) return;
    const manualTitle = subCapTitle.trim();
    if (!manualTitle) {
      setError("Please enter a Sub-CAP title.");
      return;
    }
    setCreatingSubCap(true);
    setError("");

    const res = await capApi.create(accessToken, {
      audit_id: cap.audit_id,
      parent_cap_id: cap.id,
      title: manualTitle,
    });
    setCreatingSubCap(false);
    if (res.success && res.data) {
      setShowCreateSubCapModal(false);
      setSubCapTitle("");
      const data = res.data as { cap_id: number };
      router.push(`/my-caps/details?id=${data.cap_id}`);
    } else {
      setError(res.message || "Failed to create Sub-CAP plan.");
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push(`/my-caps/details?id=${capId}`)}
              className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              <ArrowLeft size={14} className="sm:w-4 sm:h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <ClipboardList size={18} className="text-secondary-400 sm:w-5 sm:h-5" />
                Corrective Actions
              </h1>
              {cap && (
                <p className="text-[11px] sm:text-sm text-gray-400 mt-0.5 font-mono truncate">
                  {cap.title}
                </p>
              )}
            </div>
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
        ) : (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Toast */}
            {toast && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <CheckCircle2 size={14} className="shrink-0 sm:w-4 sm:h-4" />
                <span className="text-[11px] sm:text-sm">{toast}</span>
              </div>
            )}

            {/* Existing Sub-CAP summary - Responsive */}
            {existingSubCap && (
              <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5 border border-secondary-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-secondary-500/15 flex items-center justify-center">
                      <ClipboardList size={14} className="text-secondary-400 sm:w-4.5 sm:h-4.5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-white">Sub-CAP Created</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-full border font-medium capitalize ${CAP_STATUS_BADGE[existingSubCap.status] || "bg-gray-500/15 text-gray-400 border-gray-500/30"}`}>
                        {existingSubCap.status.replace("_", " ")}
                      </span>
                      <span className="text-[9px] sm:text-xs text-gray-500 whitespace-nowrap">
                        {existingSubCap.completed_questions}/{existingSubCap.total_questions} done
                      </span>
                    </div>
                    <button
                      onClick={() => router.push(`/my-caps/details?id=${existingSubCap.id}`)}
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all w-full sm:w-auto"
                    >
                      <ExternalLink size={11} className="sm:w-3 sm:h-3" />
                      View Sub-CAP
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CAP Questions */}
            <div className="bg-white/5 backdrop-blur-sm rounded-lg sm:rounded-xl p-4 sm:p-5 space-y-3 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Building2 size={11} className="text-secondary-400 sm:w-3 sm:h-3" />
                  CAP Required Questions
                  <span className="text-gray-600 font-normal normal-case ml-1">({items.length})</span>
                </h3>

              </div>

              {!saved && items.length > 0 && (
                <div className="flex items-start sm:items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle size={12} className="text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <p className="text-[10px] sm:text-xs text-amber-300">Fill in due dates, then save to enable Sub-CAP Plan creation.</p>
                </div>
              )}

              {items.length === 0 ? (
                <p className="text-xs sm:text-sm text-gray-600 italic py-4">No CAP-required questions found.</p>
              ) : tree ? (
                <div className="rounded-lg sm:rounded-xl border border-white/[0.08] p-2 sm:p-3 space-y-2">
                  {(() => {
                    const root = tree;
                    return ENTITY_TYPE_COLORS[root.entity_type] ? (
                      <EntityNode node={root} depth={0} itemsByEntity={itemsByEntity} assignments={assignments} onChange={onChange} />
                    ) : (
                      (root.children ?? []).map((child) => (
                        <EntityNode key={child.code} node={child} depth={0} itemsByEntity={itemsByEntity} assignments={assignments} onChange={onChange} />
                      ))
                    );
                  })()}
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-gray-600 italic">Entity tree is not available for this CAP.</p>
              )}
            </div>

            {/* Footer Actions - Responsive */}
            {items.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-6 sm:pb-8">

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/[0.08] hover:border-white/20 transition-all disabled:opacity-50 w-full sm:w-auto"
                  >
                    {saving ? <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
                    Save Actions
                  </button>
                  {saved && !existingSubCap && cap && !cap.parent_cap_id && (
                    <button
                      onClick={() => {
                        setSubCapTitle(cap?.title ? `Sub-CAP: ${cap.title}` : "");
                        setShowCreateSubCapModal(true);
                      }}
                      disabled={creatingSubCap}
                      className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-60 w-full sm:w-auto"
                    >
                      {creatingSubCap ? <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <PlusCircle size={12} />}
                      Create Sub-CAP
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      {showCreateSubCapModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 glass shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">Create Sub-CAP</h3>
              <p className="text-xs text-gray-400 mt-1">Add a title before creating the Sub-CAP.</p>
            </div>
            <div className="px-5 py-4 space-y-2">
              <label className="text-xs text-gray-400">Sub-CAP Title</label>
              <input
                value={subCapTitle}
                onChange={(e) => setSubCapTitle(e.target.value)}
                placeholder="Enter Sub-CAP title"
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-white focus:outline-none focus:border-secondary-500/50"
              />
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (creatingSubCap) return;
                  setShowCreateSubCapModal(false);
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium text-gray-300 border border-white/10 hover:border-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSubCap}
                disabled={creatingSubCap}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-60"
              >
                {creatingSubCap ? "Creating..." : "Create Sub-CAP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
