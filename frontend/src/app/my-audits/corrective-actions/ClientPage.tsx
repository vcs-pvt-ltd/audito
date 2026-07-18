"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditExecutionApi, capApi } from "@/lib/api";
import { Button, IconButton, Modal, Input } from "@/components/ui";
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

interface AuditEntity {
  entity_code: string;
  entity_type: string;
  entity_name: string;
}

interface AuditDetail {
  audit_id: string;
  audit_code: string;
  title: string;
  audit_type: "internal" | "external";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  start_date: string;
  end_date: string;
  checklist_id: number | null;
  entities: AuditEntity[];
}

interface CapRequiredItem {
  response_id: string;
  audit_id: number;
  entity_code: string;
  assigned_org_tree_id?: string | null;
  responsible_entity_head?: {
    user_code: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  question_id: string;
  answer_text: string | null;
  selected_option_ids: string | null;
  marks_obtained: string | number | null;
  remarks: string | null;
  cap_required: number;
  status: string;
  answered_by: string | null;
  answered_at: string | null;
  question_text: string;
  answer_type: string;
  total_marks: string | number;
  order_index: number;
  entity_type: string;
}

interface CorrectiveActionRow {
  id: string;
  audit_id: string;
  audit_response_id: string;
  entity_code: string;
  checklist_question_id: string;
  responsible_entity_head_id: string | null;
  responsible_person_name: string | null;
  due_date: string | null;
}

interface CapSummary {
  cap_id: string;
  title: string;
  status: string;
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
  Section: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Audit Firm Company": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Branch: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

const CAP_STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  submitted: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  verified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
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

// ─── Entity Node ──────────────────────────────────────────────────

function EntityNode({
  node, depth, itemsByEntity, assignments, onChange, showDueDateErrors,
}: {
  node: TreeNode; depth: number;
  itemsByEntity: Record<string, CapRequiredItem[]>;
  assignments: Record<string, { due_date: string }>;
  onChange: (responseId: string, patch: Partial<{ due_date: string }>) => void;
  showDueDateErrors: boolean;
}) {
  const entityKey = `${node.code}__${(node as any).edge_id ?? "null"}`;
  const entityItems = itemsByEntity[entityKey] || [];
  const [expanded, setExpanded] = useState(entityItems.length > 0);
  const typeColor = ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const hasChildren = (node.children ?? []).length > 0;
  const isLeaf = !hasChildren && entityItems.length === 0;
  const indent = Math.min(depth, 2) * 24;
  const questionIndent = indent + 48;

  return (
    <div className="relative">
      <div className="relative" style={{ paddingLeft: indent }}>
        {depth > 0 && (
          <>
            <div className="absolute top-0 bottom-0 w-px bg-white/[0.06]" style={{ left: indent - 11 }} />
            <div className="absolute top-[22px] h-px w-3 bg-white/[0.06]" style={{ left: indent - 11 }} />
            <div className="absolute top-[20px] w-1.5 h-1.5 rounded-full bg-white/[0.18]" style={{ left: indent - 13 }} />
          </>
        )}

        <button
          type="button"
          onClick={() => setExpanded(p => !p)}
          className={`w-full flex items-center gap-3 py-3 px-3 sm:px-4 rounded-xl border transition-all text-left group ${
            entityItems.length > 0
              ? "bg-white/[0.04] border-white/[0.10] hover:bg-white/[0.06] hover:border-white/[0.18]"
              : "bg-transparent border-transparent hover:bg-white/[0.02]"
          }`}
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {!isLeaf ? (
              <div className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                expanded ? "bg-white/[0.08] text-gray-300" : "bg-white/[0.04] text-gray-600 group-hover:text-gray-400"
              }`}>
                {expanded ? <ChevronDown size={11} strokeWidth={2.5} /> : <ChevronRight size={11} strokeWidth={2.5} />}
              </div>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${typeColor}`}>
              <Building2 size={15} />
            </div>

            <div className="flex-1 min-w-0">
              <span className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${typeColor.split(" ")[1]}`}>
                {node.entity_type}
              </span>
              <span className={`text-sm font-semibold truncate block ${entityItems.length > 0 ? "text-white" : "text-gray-400"}`}>
                {node.name}
              </span>
            </div>
          </div>

          {entityItems.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg shrink-0">
              <HelpCircle size={10} />
              {entityItems.length}
            </span>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-1 space-y-1">
          {entityItems.length > 0 && (
            <div className="space-y-3 pt-1 pb-2" style={{ paddingLeft: questionIndent, paddingRight: 4 }}>
              {entityItems.map((it, idx) => {
                const a = assignments[it.response_id] || { due_date: "" };
                const head = it.responsible_entity_head;
                const dueDateMissing = showDueDateErrors && !a.due_date;
                return (
                  <div key={it.response_id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-500/[0.04] border-b border-amber-500/[0.08]">
                      <span className="shrink-0 w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-400 text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/70 flex items-center gap-1">
                       
                      </span>
                                            <p className="text-sm text-gray-200 leading-relaxed">{it.question_text}</p>

                      <span className="ml-auto text-[9px] font-bold text-amber-500/50 uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/5 border border-amber-500/10">
                        CAP Required
                      </span>
                    </div>

                    <div className="p-3 sm:p-4 space-y-3">

                      {it.remarks && (
                        <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">Auditor Remarks</p>
                          <p className="text-xs text-gray-400">{it.remarks}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">Responsible</p>
                          {head ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0">
                                <Building2 size={12} className="text-secondary-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate">{head.first_name} {head.last_name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{head.email}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-500/60">
                              <AlertCircle size={12} />
                              <span className="text-xs">No entity head assigned</span>
                            </div>
                          )}
                        </div>

                        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-2">Due Date</p>
                          <div className="relative">
                            <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <input
                              type="date"
                              value={a.due_date}
                              onChange={e => onChange(it.response_id, { due_date: e.target.value })}
                              aria-invalid={dueDateMissing}
                              className={`w-full rounded-lg border bg-white/[0.05] py-2 pl-8 pr-3 text-xs text-white transition-all focus:outline-none focus:ring-1 ${dueDateMissing ? "border-red-500/60 focus:border-red-400 focus:ring-red-500/20" : "border-white/10 focus:border-secondary-500/40 focus:ring-secondary-500/20"}`}
                            />
                          </div>
                          {dueDateMissing && <p className="mt-1.5 text-[11px] font-medium text-red-400">Due date is required.</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(node.children ?? []).map(child => (
            <EntityNode
              key={`${child.code}__${(child as any).edge_id ?? "null"}`}
              node={child} depth={depth + 1}
              itemsByEntity={itemsByEntity} assignments={assignments} onChange={onChange} showDueDateErrors={showDueDateErrors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function CorrectiveActionsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id") as string;

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [items, setItems] = useState<CapRequiredItem[]>([]);
  const [assignments, setAssignments] = useState<Record<string, { due_date: string }>>({});
  const [existingCap, setExistingCap] = useState<CapSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCap, setCreatingCap] = useState(false);
  const [showCreateCapModal, setShowCreateCapModal] = useState(false);
  const [capTitle, setCapTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [showDueDateErrors, setShowDueDateErrors] = useState(false);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
    if (!isLoading && admin && admin.role !== "auditor") router.push("/audits");
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

  const missingDueDateCount = useMemo(
    () => items.filter((item) => !assignments[item.response_id]?.due_date).length,
    [assignments, items]
  );

  const load = useCallback(async () => {
    if (!accessToken || !auditId) return;
    setLoading(true);
    setError("");
    try {
      const [auditRes, caRes, capsRes] = await Promise.all([
        auditExecutionApi.getDetail(accessToken, auditId),
        auditExecutionApi.getCorrectiveActions(accessToken, auditId),
        capApi.listByAudit(accessToken, auditId),
      ]);

      if (auditRes.success && auditRes.data) {
        setAudit((auditRes.data as { audit: AuditDetail }).audit);
      }

      if (capsRes.success && capsRes.data) {
        const capsData = capsRes.data as { caps: CapSummary[]; root_caps?: CapSummary[] };
        const roots = capsData.root_caps?.length
          ? capsData.root_caps
          : (capsData.caps || []).filter((c: CapSummary & { parent_cap_id?: number | null }) => !c.parent_cap_id);
        setExistingCap(roots[0] || null);
      }

      if (!caRes.success || !caRes.data) {
        setError(caRes.message || "Failed to load corrective actions.");
        setLoading(false);
        return;
      }

      const data = caRes.data as { items: CapRequiredItem[]; corrective_actions: CorrectiveActionRow[]; tree: TreeNode | null };
      const its = data.items || [];
      setItems(its);

      const byResponse: Record<string, { due_date: string }> = {};
      for (const row of data.corrective_actions || []) {
        byResponse[row.audit_response_id] = { due_date: row.due_date ? String(row.due_date).slice(0, 10) : "" };
      }
      for (const it of its) {
        if (!byResponse[it.response_id]) byResponse[it.response_id] = { due_date: "" };
      }
      setAssignments(byResponse);
      setSaved((data.corrective_actions || []).length > 0);

      if (data.tree) {
        const entityKeysWithItems = new Set(its.map(i => `${i.entity_code}__${i.assigned_org_tree_id ?? "null"}`));
        setTree(pruneTreeByEntitiesWithItems(data.tree, entityKeysWithItems));
      } else {
        setTree(null);
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => { load(); }, [load]);

  const onChange = (responseId: string, patch: Partial<{ due_date: string }>) => {
    setValidationError("");
    setAssignments(prev => ({ ...prev, [responseId]: { due_date: prev[responseId]?.due_date || "", ...patch } }));
  };

  const handleSave = async () => {
    if (!accessToken) return;
    if (missingDueDateCount > 0) {
      setShowDueDateErrors(true);
      setValidationError("Due date is required for every corrective action.");
      return;
    }
    setSaving(true);
    setError("");
    setValidationError("");
    const actions = items.map(it => ({
      response_id: String(it.response_id),
      entity_code: it.entity_code,
      question_id: String(it.question_id),
      assigned_org_tree_id: it.assigned_org_tree_id ? String(it.assigned_org_tree_id) : null,
      due_date: assignments[it.response_id]?.due_date || null,
    }));
    const res = await auditExecutionApi.saveCorrectiveActions(accessToken, auditId, actions);
    setSaving(false);
    if (res.success) {
      setShowDueDateErrors(false);
      toast("Corrective actions saved.", "success");
      setSaved(true);
      await load();
    } else {
      setError(res.message || "Failed to save.");
      toast(res.message || "Failed to save corrective actions.", "error");
    }
  };

  const handleCreateCap = async () => {
    if (!accessToken || !audit) return;
    if (!capTitle.trim()) { toast("Please enter a CAP title.", "error"); return; }
    setCreatingCap(true);
    setError("");
    const res = await capApi.create(accessToken, { audit_id: audit.audit_id, title: capTitle.trim() });
    setCreatingCap(false);
    if (res.success && res.data) {
      setShowCreateCapModal(false);
      setCapTitle("");
      toast("CAP created successfully.", "success");
      router.push(`/my-caps/details?id=${(res.data as { cap_id: number }).cap_id}`);
    } else {
      setError(res.message || "Failed to create CAP.");
      toast(res.message || "Failed to create CAP.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-transparent flex items-center justify-center px-4">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin || admin.role !== "auditor") return null;

  return (
    <div className="h-full min-h-full bg-transparent flex">
      <div className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">

        {/* Top bar */}
        <div className="shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-transparent/80 backdrop-blur-sm border-b border-white/[0.05]">
          <div className="flex items-center gap-3 min-w-0">
            <IconButton bordered onClick={() => router.push(`/my-audits/details?id=${auditId}`)}>
              <ArrowLeft size={14} />
            </IconButton>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardList size={15} className="text-amber-400 shrink-0" />
                Corrective Actions
              </h1>
              {audit && <p className="text-[11px] text-gray-500 truncate mt-0.5">{audit.title}</p>}
            </div>
          </div>

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
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
            <div className="max-w-4xl mx-auto space-y-3">

              {/* Existing CAP banner */}
              {existingCap && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-secondary-500/20 bg-secondary-500/[0.05] px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ClipboardList size={14} className="text-secondary-400 shrink-0" />
                    <span className="text-sm font-semibold text-white">CAP Created</span>
                   
                  </div>
                  <Button size="sm" leftIcon={<ExternalLink size={11}/>} onClick={() => router.push(`/my-caps/details?id=${existingCap.cap_id}`)}>View CAP</Button>
                </div>
              )}

              {validationError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {validationError}
                </div>
              )}

              {/* Unsaved notice */}
              {!saved && items.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle size={13} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300">Fill in due dates and save to enable CAP creation.</p>
                </div>
              )}

              {/* Tree / empty */}
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <ClipboardList size={32} className="text-gray-700 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 italic">No CAP-required questions found for this audit.</p>
                </div>
              ) : tree ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.01] p-3 sm:p-4 space-y-1">
                  {ENTITY_TYPE_COLORS[tree.entity_type] ? (
                    <EntityNode node={tree} depth={0} itemsByEntity={itemsByEntity} assignments={assignments} onChange={onChange} showDueDateErrors={showDueDateErrors} />
                  ) : (
                    (tree.children ?? []).map((child, idx) => (
                      <EntityNode key={`${child.code}-${idx}`} node={child} depth={0} itemsByEntity={itemsByEntity} assignments={assignments} onChange={onChange} showDueDateErrors={showDueDateErrors} />
                    ))
                  )}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-600 italic">Entity tree not available. Please reload.</p>
                </div>
              )}

              {/* Actions */}
              {items.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-4 pb-4 sm:flex-row sm:items-center sm:justify-end">
                  <Button variant="secondary" fullWidth className="sm:w-auto" leftIcon={<Save size={14}/>} loading={saving} disabled={saving} onClick={handleSave}>Save Actions</Button>
                  {saved && !existingCap && (
                    <Button fullWidth className="sm:w-auto" leftIcon={<PlusCircle size={14}/>} onClick={() => { setCapTitle(audit?.title ? `CAP: ${audit.title}` : ""); setShowCreateCapModal(true); }} disabled={creatingCap}>Create CAP</Button>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      <Modal
        open={showCreateCapModal}
        onClose={() => { if (!creatingCap) setShowCreateCapModal(false); }}
        title="Create CAP"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { if (!creatingCap) setShowCreateCapModal(false); }}>Cancel</Button>
            <Button loading={creatingCap} onClick={handleCreateCap}>Create CAP</Button>
          </>
        }
      >
        <Input
          label="CAP Title"
          value={capTitle}
          onChange={e => setCapTitle(e.target.value)}
          placeholder="Enter CAP title"
        />
      </Modal>

    </div>
  );
}
