"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, ClipboardList, ChevronDown, ChevronRight } from "lucide-react";

export interface CapItem {
  id: string;
  cap_id: string;
  audit_id: string;
  entity_code: string;
  entity_name?: string;
  question_id: string;
  question_text?: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "verified" | "closed";
  responsible_person_name: string | null;
  due_date: string | null;
}

const CAP_SEVERITY_BADGE: Record<string, string> = {
  low: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/15 text-red-400 border-red-500/20",
};

const CAP_STATUS_BADGE: Record<string, string> = {
  open: "bg-red-500/15 text-red-400 border-red-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  resolved: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  verified: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  closed: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function CAPModal({
  open,
  onClose,
  caps,
  loading,
  error,
  onRefresh,
}: {
  open: boolean;
  onClose: () => void;
  caps: CapItem[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const acc: Record<string, CapItem[]> = {};
    for (const c of caps) {
      const k = c.entity_code || "Unknown";
      if (!acc[k]) acc[k] = [];
      acc[k].push(c);
    }
    return acc;
  }, [caps]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative glass rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ClipboardList size={16} className="text-orange-400" /> Corrective Action Plan (CAP)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            Review CAP-required questions grouped by entity.
          </p>
          <button
            onClick={onRefresh}
            className="px-4 py-2 rounded-lg text-xs text-gray-400 border border-white/10 hover:text-white hover:border-white/20 transition-all"
          >
            Refresh
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm">
              {error}
            </div>
          ) : caps.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
              <p className="text-white font-medium mb-1">No CAPs for this audit</p>
              <p className="text-gray-500 text-sm">CAPs appear when questions are marked as corrective action required.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([entityCode, entityCaps]) => {
                const entityName = entityCaps[0]?.entity_name || entityCode;
                const isOpen = expanded[entityCode] ?? true;
                return (
                  <div key={entityCode} className="rounded-xl border border-white/[0.08] overflow-hidden">
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [entityCode]: !isOpen }))}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isOpen ? (
                          <ChevronDown size={14} className="text-gray-500 shrink-0" />
                        ) : (
                          <ChevronRight size={14} className="text-gray-500 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-white truncate">{entityName}</span>
                        <span className="text-[10px] text-gray-600 font-mono shrink-0">{entityCode}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {entityCaps.length} Question{entityCaps.length > 1 ? "s" : ""}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-white/[0.08] p-4 space-y-2">
                        {entityCaps.map((cap) => (
                          <div
                            key={cap.id}
                            className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono text-secondary-400 bg-secondary-500/10 px-2 py-0.5 rounded-full border border-secondary-500/20">
                                    {cap.cap_id}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${CAP_SEVERITY_BADGE[cap.severity] || ""}`}
                                  >
                                    {cap.severity}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${CAP_STATUS_BADGE[cap.status] || ""}`}
                                  >
                                    {cap.status.replace("_", " ")}
                                  </span>
                                </div>

                                <p className="text-sm text-gray-200 mt-2">
                                  {cap.question_text || `Question #${cap.question_id}`}
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <p className="text-gray-500">Responsible Person</p>
                                    <p className="text-gray-300">{cap.responsible_person_name || "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">Due Date</p>
                                    <p className="text-gray-300">{cap.due_date ? fmtDate(cap.due_date) : "—"}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2">
                                <button
                                  onClick={() => router.push(`/caps/details?id=${cap.id}`)}
                                  className="px-4 py-2 rounded-lg text-xs font-medium text-orange-400 border border-orange-500/20 hover:bg-orange-500/10 transition-all"
                                >
                                  Open
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-gray-300 border border-white/10 hover:text-white hover:border-white/20 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
