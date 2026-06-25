"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi } from "@/lib/api";
import {
  ClipboardCheck,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Table, THead, Th } from "@/components/ui";

interface AuditAssignment {
  id: number;
  audit_code: string;
  title: string;
  checklist_name: string | null;
  audit_type: "internal" | "external";
  status: "plan" | "in_progress" | "completed";
  start_date: string;
  end_date: string;
  entity_count: number;
  progress_pct?: number;
  total_questions?: number;
  answered_questions?: number;
}

const STATUS_BADGE: Record<string, string> = {
  plan: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  plan: "Plan",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  plan: <Clock size={13} />,
  in_progress: <Play size={13} />,
  completed: <CheckCircle2 size={13} />,
};

const AUDIT_TYPE_BADGE: Record<string, string> = {
  internal: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  external: "bg-purple-500/15 text-purple-300 border-purple-500/20",
};

const AUDIT_TYPE_LABEL: Record<string, string> = {
  internal: "Internal",
  external: "Audit Firm",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function EntityHeadAuditsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [audits, setAudits] = useState<AuditAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "entity_head")) router.push("/login");
  }, [isLoading, admin, router]);

  const fetchAudits = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await auditExecutionApi.myAudits(accessToken);
    if (res.success && res.data) {
      const data = res.data as { audits: AuditAssignment[] };
      setAudits(data.audits || []);
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? audits : audits.filter(a => a.status === filter);
    const query = q.trim().toLowerCase();
    return base.filter((a) => {
      if (typeFilter !== "all" && a.audit_type !== typeFilter) return false;
      if (fromDate) {
        const aStart = String(a.start_date).slice(0, 10);
        if (aStart < fromDate) return false;
      }
      if (toDate) {
        const aEnd = String(a.end_date).slice(0, 10);
        if (aEnd > toDate) return false;
      }
      if (!query) return true;
      const hay = `${a.audit_code || ""} ${a.title || ""} ${a.checklist_name || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [audits, filter, q, typeFilter, fromDate, toDate]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, q, typeFilter, fromDate, toDate]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const counts = {
    all: audits.length,
    plan: audits.filter(a => a.status === "plan").length,
    in_progress: audits.filter(a => a.status === "in_progress").length,
    completed: audits.filter(a => a.status === "completed").length,
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="h-screen bg-transparent flex">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <ClipboardCheck size={20} className="text-amber-400" />
              </div>
              My Audits
            </h1>
            <p className="text-sm text-gray-400 mt-1 ml-[46px]">
              Audits assigned to your organization tree
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAudits}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        {!loading && audits.length > 0 && (
          <div className="flex items-center gap-1 mb-6 p-1 glass rounded-xl w-fit">
            {(["all", "plan", "in_progress", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${filter === f
                  ? "bg-secondary-500/20 text-secondary-400 shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
              >
                {f === "all" ? "All" : STATUS_LABEL[f]}
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${filter === f ? "bg-secondary-500/30 text-secondary-300" : "bg-white/[0.06] text-gray-500"
                  }`}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search audits..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-secondary-500/50 transition-all"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-secondary-500/50 transition-all cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="internal">Internal</option>
            <option value="external">Audit Firm</option>
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-secondary-500/50 transition-all cursor-pointer"
            title="From Date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-secondary-500/50 transition-all cursor-pointer"
            title="To Date"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : audits.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No audits found"
            message="There are no audits assigned to your organization tree at this time."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No matching audits"
            message="Try adjusting your filters or search query."
          />
        ) : (
          <div className="space-y-4">
            <div className="hidden md:block">
              <Table className="text-left">
                <THead>
                  <Th align="center" className="w-12">#</Th>
                  <Th>Audit</Th>
                  <Th>Type</Th>
                  <Th>Start Date</Th>
                  <Th>End Date</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                </THead>
                <tbody className="divide-y divide-white/[0.06]">
                  {paginated.map((a, index) => {
                    const pct = a.progress_pct || 0;
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={a.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-4 py-3 text-gray-400 text-sm text-center">{itemIndex}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/entity-head/audits/preview?id=${a.id}`)}
                            className="text-secondary-400 hover:text-secondary-300 font-medium hover:underline underline-offset-2 transition-colors text-left"
                          >
                            {a.title}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${AUDIT_TYPE_BADGE[a.audit_type] || "bg-white/5 text-gray-300 border-white/10"}`}>
                            {AUDIT_TYPE_LABEL[a.audit_type] || a.audit_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {fmtDate(a.start_date)}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {fmtDate(a.end_date)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[a.status] || ""}`}>
                            {STATUS_ICON[a.status]}
                            {STATUS_LABEL[a.status] || a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden max-w-[100px]">
                              <div
                                className="h-full bg-gradient-to-r from-secondary-400 to-secondary-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 font-medium w-10 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {paginated.map((a, index) => {
                const pct = a.progress_pct || 0;
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div
                    key={a.id}
                    onClick={() => router.push(`/entity-head/audits/preview?id=${a.id}`)}
                    className="glass rounded-xl p-4 space-y-3 cursor-pointer hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 mb-1">#{itemIndex}</p>
                        <h3 className="text-white font-medium truncate pr-2">{a.title}</h3>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_BADGE[a.status] || ""}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-500 uppercase tracking-wider text-[10px]">Type</div>
                      <div className="text-gray-300">{AUDIT_TYPE_LABEL[a.audit_type] || a.audit_type}</div>
                      <div className="text-gray-500 uppercase tracking-wider text-[10px]">Timeline</div>
                      <div className="text-gray-300">{fmtDate(a.start_date)} — {fmtDate(a.end_date)}</div>
                    </div>
                    <div className="pt-2">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}

      </main>
    </div>
  );
}
