"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { capApi } from "@/lib/api";
import {
  ClipboardList,
  RefreshCw,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play
} from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";

interface CapPlan {
  id: number;
  cap_plan_code: string;
  audit_code: string;
  audit_title: string;
  title: string;
  status: "plan" | "in_progress" | "completed";
  parent_cap_id?: number | null;
  created_at: string;
  total_questions?: number;
  completed_questions?: number;
  answered_questions?: number;
  progress_pct?: number;
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

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function EntityHeadCapsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [caps, setCaps] = useState<CapPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "entity_head")) router.push("/login");
  }, [isLoading, admin, router]);

  const fetchCaps = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await capApi.list(accessToken, { includeSubCaps: true });
    if (res.success && res.data) {
      const data = res.data as { caps: CapPlan[] };
      setCaps(data.caps || []);
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { fetchCaps(); }, [fetchCaps]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? caps : caps.filter(c => c.status === filter);
    const query = q.trim().toLowerCase();
    return base.filter((c) => {
      if (fromDate) {
        const cDate = String(c.created_at).slice(0, 10);
        if (cDate < fromDate) return false;
      }
      if (toDate) {
        const cDate = String(c.created_at).slice(0, 10);
        if (cDate > toDate) return false;
      }
      if (!query) return true;
      const hay = `${c.cap_plan_code || ""} ${c.title || ""} ${c.audit_title || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [caps, filter, q, fromDate, toDate]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, q, fromDate, toDate]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const counts = {
    all: caps.length,
    plan: caps.filter(c => c.status === "plan").length,
    in_progress: caps.filter(c => c.status === "in_progress").length,
    completed: caps.filter(c => c.status === "completed").length,
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
              <div className="w-9 h-9 rounded-lg bg-secondary-500/20 flex items-center justify-center">
                <ClipboardList size={20} className="text-secondary-400" />
              </div>
              My CAP Plans
            </h1>
            <p className="text-sm text-gray-400 mt-1 ml-[46px]">
              Corrective action plans for your organization tree
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCaps}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        {!loading && caps.length > 0 && (
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search plans..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-secondary-500/50 transition-all"
            />
          </div>
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
        ) : caps.length === 0 ? (
          <div className="glass rounded-xl p-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary-500/10 flex items-center justify-center mx-auto mb-5">
              <ClipboardList size={32} className="text-gray-600" />
            </div>
            <p className="text-white font-semibold text-lg mb-2">No CAP plans found</p>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              There are no corrective action plans assigned to your organization tree at this time.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center">
            <AlertTriangle size={36} className="text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No matching plans</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass rounded-xl overflow-hidden hidden md:block">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-gray-400 font-medium w-12 text-center">#</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">CAP Detail</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Source Audit</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-center">Status</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Created At</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {paginated.map((c, index) => {
                    const total = c.total_questions || 0;
                    const done = c.completed_questions ?? c.answered_questions ?? 0;
                    const pct = typeof c.progress_pct === "number"
                      ? c.progress_pct
                      : (total > 0 ? Math.round((done / total) * 100) : 0);
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-4 py-3 text-gray-400 text-sm text-center">{itemIndex}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/entity-head/caps/preview?id=${c.id}`)}
                            className="text-secondary-400 hover:text-secondary-300 font-medium hover:underline underline-offset-2 transition-colors text-left"
                          >
                            {c.title}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">
                          {c.audit_title}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[c.status] || ""}`}>
                            {STATUS_ICON[c.status]}
                            {STATUS_LABEL[c.status] || c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {fmtDate(c.created_at)}
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
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4">
              {paginated.map((c, index) => {
                const total = c.total_questions || 0;
                const done = c.completed_questions ?? c.answered_questions ?? 0;
                const pct = typeof c.progress_pct === "number"
                  ? c.progress_pct
                  : (total > 0 ? Math.round((done / total) * 100) : 0);
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div
                    key={c.id}
                    onClick={() => router.push(`/entity-head/caps/preview?id=${c.id}`)}
                    className="glass rounded-xl p-4 space-y-3 cursor-pointer hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 mb-1">#{itemIndex}</p>
                        <h3 className="text-white font-medium truncate pr-2">{c.title}</h3>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_BADGE[c.status] || ""}`}>
                        {STATUS_LABEL[c.status] || c.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-500 uppercase tracking-wider text-[10px]">Source</div>
                      <div className="text-gray-300 truncate">{c.audit_title}</div>
                      <div className="text-gray-500 uppercase tracking-wider text-[10px]">Created</div>
                      <div className="text-gray-300">{fmtDate(c.created_at)}</div>
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
