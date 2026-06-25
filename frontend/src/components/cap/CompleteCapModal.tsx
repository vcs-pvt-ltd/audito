"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, CheckCircle2, ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { capApi } from "@/lib/api";
import { progressKey } from "@/utils/executionService";
import { Button, IconButton } from "@/components/ui";

export interface CapProgress {
  id: number;
  cap_id: number;
  entity_code: string;
  org_tree_id: number | null;
  total_questions: number;
  answered_questions: number;
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

interface Cap {
  id: number;
  cap_plan_code: string;
  audit_id: number;
  audit_code: string;
  audit_title: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CapQuestion {
  id: number;
  cap_id: number;
  corrective_action_id: number;
  entity_code: string;
  org_tree_id: number | null;
  question_id: number;
  status: string;
  question_text: string;
  answer_type: string;
  total_marks: string | number;
  order_index: number;
  ca_description: string | null;
  responsible_person_code: string | null;
  responsible_person_name: string | null;
  due_date: string | null;
  severity: string;
  options: { id: number; option_text: string; marks: number }[];
}

interface CapResponse {
  id: number;
  cap_question_id: number;
  response_text: string | null;
  answer_text?: string | null;
  selected_option_ids?: string | null;
  remarks?: string | null;
  status: string;
  responded_by: string;
  evidence?: { id: number; file_path: string; file_name: string; file_type: string }[];
}

interface CompleteCapModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  progress: CapProgress[];
  error: string;
  accessToken: string;
  capId: number | string;
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

function getPathToNode(node: TreeNode, code: string, edgeId: number | string | null, trail: TreeNode[] = []): TreeNode[] | null {
  if (node.code === code && (edgeId === null || node.edge_id == edgeId)) return [...trail, node];
  for (const child of node.children ?? []) {
    const result = getPathToNode(child, code, edgeId, [...trail, node]);
    if (result) return result;
  }
  return null;
}

export default function CompleteCapModal({
  open,
  onClose,
  onConfirm,
  loading,
  progress,
  error,
  accessToken,
  capId,
}: CompleteCapModalProps) {
  const incomplete = useMemo(() => {
    return (progress || []).filter((p) => p.status !== "completed");
  }, [progress]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [cap, setCap] = useState<Cap | null>(null);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [questions, setQuestions] = useState<CapQuestion[]>([]);
  const [responses, setResponses] = useState<Record<number, CapResponse>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const progressMap = useMemo(() => {
    const m: Record<string, CapProgress> = {};
    for (const p of progress || []) m[progressKey(p.entity_code, p.org_tree_id ?? null)] = p;
    return m;
  }, [progress]);

  const capEntityCodes = useMemo(() => {
    return new Set((progress || []).map((p) => progressKey(p.entity_code, p.org_tree_id ?? null)));
  }, [progress]);

  const questionsMap = useMemo(() => {
    const m: Record<string, CapQuestion[]> = {};
    for (const q of questions || []) {
      const k = progressKey(q.entity_code, q.org_tree_id ?? null);
      if (!m[k]) m[k] = [];
      m[k].push(q);
    }
    return m;
  }, [questions]);

  const loadReviewData = useCallback(async () => {
    if (!accessToken || !capId) return;
    setDetailLoading(true);
    setDetailError("");

    try {
      const [detailRes, respRes] = await Promise.all([
        capApi.get(accessToken, capId),
        capApi.getResponses(accessToken, capId),
      ]);

      if (detailRes.success && detailRes.data) {
        const data = detailRes.data as {
          cap: Cap;
          questions: CapQuestion[];
          tree: TreeNode | null;
        };
        setCap(data.cap);
        setQuestions(data.questions || []);
        setTree(data.tree || null);
      } else {
        setCap(null);
        setDetailError(detailRes.message || "Failed to load CAP details.");
      }

      if (respRes.success && respRes.data) {
        const rd = respRes.data as { responses: CapResponse[] };
        const map: Record<number, CapResponse> = {};
        for (const r of rd.responses || []) {
          map[r.cap_question_id] = r;
        }
        setResponses(map);
      } else {
        setResponses({});
      }
    } catch {
      setDetailError("Failed to load CAP review data.");
    }

    setDetailLoading(false);
  }, [accessToken, capId]);

  useEffect(() => {
    if (!open) return;
    void loadReviewData();
  }, [open, loadReviewData]);

  useEffect(() => {
    if (!open) return;
    // auto-expand path to incomplete entities
    const next: Record<string, boolean> = {};
    if (tree) {
      const targets = incomplete.length > 0 ? incomplete : progress || [];
      for (const p of targets) {
        const path = getPathToNode(tree, p.entity_code, p.org_tree_id ?? null);
        for (const n of path || []) next[n.code] = true;
      }
      if (Object.keys(next).length === 0) next[tree.code] = true;
    }

    setExpanded((prev) => {
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
  }, [open, tree, incomplete, progress]);

  const renderResponse = (q: CapQuestion, r?: CapResponse) => {
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
      const text = r.response_text || r.answer_text || "";
      return (
        <div className="space-y-1">
          <p className="text-xs text-gray-200 whitespace-pre-wrap">{text || "—"}</p>
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
    const isCapEntity = capEntityCodes.has(nodeKey);
    const isExpanded = !!expanded[node.code];
    const p = progressMap[nodeKey];
    const tQ = p?.total_questions || 0;
    const aQ = p?.answered_questions || 0;
    const pct = tQ > 0 ? Math.round((aQ / tQ) * 100) : 0;
    const qs = questionsMap[nodeKey] || [];

    const visibleChildren = (node.children || []).filter(c => {
      const check = (n: TreeNode): boolean => {
        if (capEntityCodes.has(progressKey(n.code, (n as any).edge_id ?? null))) return true;
        return (n.children || []).some(check);
      };
      return check(c);
    });

    const hasVisibleChildren = visibleChildren.length > 0;

    if (!isCapEntity && !hasVisibleChildren) return null;

    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded((m) => ({ ...m, [node.code]: !isExpanded }))}
          className="w-full flex items-center gap-2 text-left px-3 py-3 sm:py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          style={{ paddingLeft: Math.min(12 + depth * 14, 64) }}
        >
          {hasVisibleChildren || isCapEntity ? (
            isExpanded ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />
          ) : (
            <span className="w-[14px]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-medium truncate">{node.name || node.code}</p>
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

        {isExpanded && isCapEntity && qs.length > 0 && (
          <div className="mt-2 mb-3 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" style={{ marginLeft: Math.min(12 + depth * 14, 64) }}>
            <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
              <p className="text-xs text-gray-400 font-medium">Corrective Actions & Responses</p>
            </div>
            <div className="divide-y divide-white/10">
              {qs
                .slice()
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((q, idx) => {
                  const r = responses[q.id];
                  return (
                    <div key={q.id} className="px-4 py-3">
                      <p className="text-xs text-gray-500 mb-1">Action {idx + 1}</p>
                      <p className="text-sm text-gray-200">{q.question_text}</p>
                      {q.ca_description && (
                        <p className="text-xs text-gray-400 mt-1 italic">Plan: {q.ca_description}</p>
                      )}
                      <div className="mt-2">
                        {renderResponse(q, r)}
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px] text-gray-500">
                        {q.due_date && (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                            Due: {new Date(q.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {q.responsible_person_name && (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                            Responsible: {q.responsible_person_name}
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
            <CheckCircle2 size={16} className="text-secondary-400" /> Complete CAP Plan
          </h2>
          <IconButton onClick={onClose} title="Close">
            <X size={18} />
          </IconButton>
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

          {cap && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 sm:p-4">
              <div className="flex items-start flex-wrap justify-between gap-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">CAP Details</p>
                  <h3 className="text-sm sm:text-base font-semibold text-white mt-1">{cap.title}</h3>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Source Audit</p>
                  <p className="text-xs text-gray-300 mt-1">{cap.audit_title}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <p className="text-xs text-gray-400 font-medium">Review (Tree • Actions • Responses)</p>
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
          <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">Cancel</Button>
          <Button onClick={onConfirm} loading={loading} disabled={incomplete.length > 0} className="flex-1 sm:flex-none">
            {loading ? "Completing..." : "Confirm Complete"}
          </Button>
        </div>
      </div>
    </div>
  );
}
