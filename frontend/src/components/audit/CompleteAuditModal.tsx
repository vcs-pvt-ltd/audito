"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { progressKey } from "@/utils/executionService";

import { auditExecutionApi } from "@/lib/api";

export interface EntityProgress {
  audit_id: number;
  entity_code: string;
  total_questions: number;
  answered_questions: number;
  total_marks: number;
  obtained_marks: number;
  status: string;
  completed_at: string | null;
}

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: number | string | null;
  children: TreeNode[];
  [key: string]: unknown;
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
  entity_code: string;
  options: QuestionOption[];
}

interface EntityQuestion {
  entity_code: string;
  questions: ChecklistQuestion[];
}

interface AuditResponse {
  id: number;
  question_id: number;
  entity_code: string;
  answer_text: string | null;
  selected_option_ids: string | null;
  marks_obtained: number;
  remarks: string | null;
  cap_required: number;
  status: string;
  evidence?: { id: number; file_path: string; file_name: string; file_type: string }[];
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
  audit_type: string;
  status: string;
  start_date: string;
  end_date: string;
  checklist_id: number | null;
  checklist_name: string | null;
  entities: AuditEntity[];
  entity_questions: EntityQuestion[];
}

function normalizeSelectedOptionIds(selected_option_ids: unknown): number[] {
  if (selected_option_ids == null) return [];
  if (Array.isArray(selected_option_ids)) {
    return selected_option_ids
      .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
      .filter((n) => Number.isFinite(n));
  }
  if (typeof selected_option_ids === "number") return [selected_option_ids];
  if (typeof selected_option_ids !== "string") return [];
  const raw = selected_option_ids.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
        .filter((n) => Number.isFinite(n));
    }
    if (typeof parsed === "number") return [parsed];
    if (typeof parsed === "string") {
      const n = parseInt(parsed, 10);
      return Number.isFinite(n) ? [n] : [];
    }
  } catch {
    // fallthrough
  }
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? [n] : [];
}

function getPathToNode(node: TreeNode, code: string, trail: TreeNode[] = []): TreeNode[] | null {
  if (node.code === code) return [...trail, node];
  for (const child of node.children ?? []) {
    const result = getPathToNode(child, code, [...trail, node]);
    if (result) return result;
  }
  return null;
}

export default function CompleteAuditModal({
  open,
  onClose,
  onConfirm,
  loading,
  progress,
  error,
  accessToken,
  auditId,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  progress: EntityProgress[];
  error: string;
  accessToken: string;
  auditId: number | string;
}) {
  const incomplete = useMemo(() => {
    return (progress || []).filter((p) => p.status !== "completed");
  }, [progress]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [responses, setResponses] = useState<Record<string, AuditResponse[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const progressMap = useMemo(() => {
    const m: Record<string, EntityProgress> = {};
    for (const p of progress || []) m[progressKey(p.entity_code, (p as any).org_tree_id ?? null)] = p;
    return m;
  }, [progress]);

  const auditEntityCodes = useMemo(() => {
    return new Set((audit?.entities || []).map((e) => `${(e as any).entity_code}__${((e as any).org_tree_id ?? (e as any).assigned_org_tree_id ?? 'null')}`));
  }, [audit?.entities]);

  const questionsMap = useMemo(() => {
    const m: Record<string, ChecklistQuestion[]> = {};
    for (const eq of audit?.entity_questions || []) {
      m[progressKey(eq.entity_code, (eq as any).org_tree_id ?? null)] = eq.questions;
    }
    return m;
  }, [audit?.entity_questions]);

  const loadReviewData = useCallback(async () => {
    if (!accessToken || !auditId) return;
    setDetailLoading(true);
    setDetailError("");

    try {
      const [detailRes, respRes, treeRes] = await Promise.all([
        auditExecutionApi.getDetail(accessToken, auditId),
        auditExecutionApi.getResponses(accessToken, auditId),
        auditExecutionApi.getEntityTree(accessToken, auditId),
      ]);

      if (detailRes.success && detailRes.data) {
        const data = detailRes.data as { audit: AuditDetail };
        setAudit(data.audit);
      } else {
        setAudit(null);
        setDetailError(detailRes.message || "Failed to load audit details.");
      }

      if (respRes.success && respRes.data) {
        const rd = respRes.data as { responses: AuditResponse[] };
        const grouped: Record<string, AuditResponse[]> = {};
        for (const r of rd.responses || []) {
          const k = progressKey(r.entity_code, (r as any).org_tree_id ?? null);
          if (!grouped[k]) grouped[k] = [];
          grouped[k].push(r);
        }
        setResponses(grouped);
      } else {
        setResponses({});
      }

      if (treeRes.success && treeRes.data) {
        const td = treeRes.data as { tree: TreeNode };
        setTree(td.tree || null);
      } else {
        setTree(null);
      }
    } catch {
      setDetailError("Failed to load audit review data.");
    }

    setDetailLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => {
    if (!open) return;
    void loadReviewData();
  }, [open, loadReviewData]);

  useEffect(() => {
    if (!open) return;
    // auto-expand path to incomplete entities (and expand first entity as fallback)
    const next: Record<string, boolean> = {};
    if (tree) {
      const targets = incomplete.length > 0
        ? incomplete.map((p) => p.entity_code)
        : (audit?.entities || []).map((e) => e.entity_code);
      for (const code of targets) {
        const path = getPathToNode(tree, code);
        for (const n of path || []) next[n.code] = true;
      }
      if (Object.keys(next).length === 0) next[tree.code] = true;
    }

    setExpanded((prev) => {
      // Merge while avoiding unnecessary state updates (prevents render loops)
      let changed = false;
      const merged: Record<string, boolean> = { ...prev };
      for (const [k, v] of Object.entries(next)) {
        if (merged[k] !== v) {
          merged[k] = v;
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
  }, [open, tree, incomplete, audit?.entities]);

  const renderResponse = (q: ChecklistQuestion, r?: AuditResponse) => {
    if (!r) return <span className="text-xs text-gray-600">No response</span>;

    const renderEvidence = () => {
      if (!r.evidence || r.evidence.length === 0) return null;
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {r.evidence.map((ev) => {
            const isImage = ev.file_type?.toLowerCase().includes('image') || 
                            ev.file_path?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
            const url = ev.file_path.startsWith('http') 
              ? ev.file_path 
              : `${process.env.NEXT_PUBLIC_MEDIA_URL || ''}${ev.file_path}`;

            return (
              <div 
                key={ev.id} 
                className="relative flex items-center justify-center overflow-hidden rounded-md bg-white/[0.03] border border-white/10"
                style={{ width: 80, height: 60 }}
              >
                {isImage ? (
                  <img src={url} alt={ev.file_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-gray-400">
                    <Paperclip size={16} />
                    <span className="text-[8px] truncate w-full text-center mt-1">{ev.file_name || 'Attached File'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    if (q.answer_type === "free_text") {
      return (
        <div className="space-y-1">
          <p className="text-xs text-gray-200 whitespace-pre-wrap">{r.answer_text || "—"}</p>
          {r.remarks && <p className="text-[11px] text-gray-500 whitespace-pre-wrap">Remarks: {r.remarks}</p>}
          {renderEvidence()}
        </div>
      );
    }

    const selIds = normalizeSelectedOptionIds(r.selected_option_ids);
    const selected = (q.options || []).filter((o) => selIds.includes(o.id));
    return (
      <div className="space-y-1">
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((o) => (
              <span key={o.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                {o.option_text}
                {typeof o.marks === "number" && <span className="text-gray-500"> ({o.marks})</span>}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600">No option selected</p>
        )}
        {r.remarks && <p className="text-[11px] text-gray-500 whitespace-pre-wrap">Remarks: {r.remarks}</p>}
        {renderEvidence()}
      </div>
    );
  };

  const TreeRow = ({ node, depth }: { node: TreeNode; depth: number }) => {
    const nodeKey = progressKey(node.code, (node as any).edge_id ?? null);
    const isAuditEntity = auditEntityCodes.has(nodeKey);
    const isExpanded = !!expanded[node.code];
    const hasChildren = (node.children || []).length > 0;

    const p = progressMap[nodeKey];
    const tQ = p?.total_questions || 0;
    const aQ = p?.answered_questions || 0;
    const pct = tQ > 0 ? Math.round((aQ / tQ) * 100) : 0;
    const entityResponses = responses[nodeKey] || [];
    const qs = questionsMap[nodeKey] || [];

    // Filter children to only show paths to audit entities
    const visibleChildren = (node.children || []).filter(c => {
      const check = (n: TreeNode): boolean => {
        if (auditEntityCodes.has(progressKey(n.code, (n as any).edge_id ?? null))) return true;
        return (n.children || []).some(check);
      };
      return check(c);
    });

    const hasVisibleChildren = visibleChildren.length > 0;

    if (!isAuditEntity && !hasVisibleChildren) return null;

    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((m) => ({ ...m, [node.code]: !isExpanded }))}
          className="w-full flex items-center gap-2 text-left px-3 py-3 sm:py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          style={{ paddingLeft: Math.min(12 + depth * 14, 64) }}
        >
          {hasVisibleChildren || isAuditEntity ? (
            isExpanded ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />
          ) : (
            <span className="w-[14px]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-medium truncate">{node.name || "Unknown Entity"}</p>
            <p className="text-[11px] text-gray-600 truncate">{node.entity_type}</p>
          </div>
          {p && (
            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
              p.status === "completed"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                : "bg-amber-500/15 text-amber-400 border-amber-500/25"
            }`}>
              {aQ}/{tQ} ({pct}%)
            </span>
          )}
        </button>

        {isExpanded && isAuditEntity && qs.length > 0 && (
          <div className="mt-2 mb-3 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" style={{ marginLeft: Math.min(12 + depth * 14, 64) }}>
            <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <p className="text-xs text-gray-400 font-medium">Questions & Responses</p>
            </div>
            <div className="divide-y divide-white/10">
              {qs
                .slice()
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((q, idx) => {
                  const r = entityResponses.find((x) => x.question_id === q.id);
                  return (
                    <div key={q.id} className="px-4 py-3">
                      <p className="text-xs text-gray-500 mb-1">Q{idx + 1}</p>
                      <p className="text-sm text-gray-200">{q.question_text}</p>
                      <div className="mt-2">
                        {renderResponse(q, r)}
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500">
                          Marks: {r ? (r.marks_obtained ?? 0) : 0}/{q.total_marks ?? 0}
                        </span>
                        {r && !!r.cap_required && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                            CAP Required
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {isExpanded && hasVisibleChildren && (
          <div className="mt-1 space-y-0.5">
            {visibleChildren.map((c) => (
              <TreeRow key={c.code} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end sm:items-center sm:justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-0.5 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <CheckCircle2 size={16} className="text-secondary-400" /> Complete Audit
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 space-y-3 sm:space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {detailError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-400 text-sm">
              {detailError}
            </div>
          )}

          {audit && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 sm:p-4">
              <div className="flex items-start flex-wrap justify-between gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Audit Details</p>
                  <h3 className="text-sm sm:text-base font-semibold text-white mt-1">{audit.title}</h3>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Period</p>
                  <p className="text-xs text-gray-300 mt-1">
                    {new Date(audit.start_date).toLocaleDateString()} – {new Date(audit.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}


          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <p className="text-xs text-gray-400 font-medium">Review (Tree • Questions • Responses)</p>
            </div>
            <div className="p-3">
              {detailLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">Loading review...</div>
              ) : !tree ? (
                <div className="py-8 text-center text-sm text-gray-500">No tree available.</div>
              ) : (
                <div className="space-y-0.5">
                  <TreeRow node={tree} depth={0} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 sm:px-5 sm:py-4 border-t border-white/10 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg text-xs text-gray-300 border border-white/10 hover:text-white hover:border-white/20 transition-all text-center"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || incomplete.length > 0}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-lg text-xs font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-50 text-center"
          >
            {loading ? "Completing..." : "Confirm Complete"}
          </button>
        </div>
      </div>
    </div>
  );
}
