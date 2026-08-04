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
import EmptyState from "@/components/shared/EmptyState";
import { Table, THead, Th } from "@/components/ui";

interface CapPlan {
  cap_id: string;
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

export default function OrganizationUserCapsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [caps, setCaps] = useState<CapPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortBy, setSortBy] = useState("newest");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "organization_user")) router.push("/login");
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
      const hay = `${c.cap_id || ""} ${c.title || ""} ${c.audit_title || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [caps, filter, q, fromDate, toDate]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    const aTotal = a.total_questions || 0;
    const bTotal = b.total_questions || 0;
    const aProgress = typeof a.progress_pct === "number" ? a.progress_pct : (aTotal > 0 ? ((a.completed_questions ?? a.answered_questions ?? 0) / aTotal) * 100 : 0);
    const bProgress = typeof b.progress_pct === "number" ? b.progress_pct : (bTotal > 0 ? ((b.completed_questions ?? b.answered_questions ?? 0) / bTotal) * 100 : 0);
    if (sortBy === "progress_desc") return bProgress - aProgress;
    if (sortBy === "progress_asc") return aProgress - bProgress;
    const aCreated = new Date(a.created_at || 0).getTime();
    const bCreated = new Date(b.created_at || 0).getTime();
    return sortBy === "oldest" ? aCreated - bCreated : bCreated - aCreated;
  }), [filtered, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, q, fromDate, toDate, sortBy]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

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
  const isAuditFirmOrganizationUser = ["Branch", "Audit Firm Department"].includes((admin.assigned_entity_type || admin.entity_type || "") as string);
  const capDetailsPath = (capId: string) => isAuditFirmOrganizationUser
    ? `/organization-user/caps/details?cap_id=${capId}`
    : `/organization-user/caps/preview?cap_id=${capId}`;

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
              {isAuditFirmOrganizationUser ? "Progress for CAPs linked to your audit firm" : "Corrective action plans for your organization tree"}
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
        <div className="mb-6 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Search CAPs
            <span className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} /><input type="text" placeholder="CAP or source audit..." value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm text-white outline-none focus:border-secondary-500/50" /></span>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Created date from
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-secondary-500/50 [color-scheme:dark]" />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Created date to
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-secondary-500/50 [color-scheme:dark]" />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Sort by
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-secondary-500/50"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="progress_desc">Most progress</option><option value="progress_asc">Least progress</option><option value="title">Title A-Z</option></select>
          </label>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : caps.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No CAP plans found"
            message="There are no corrective action plans assigned to your organization tree at this time."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No matching plans"
            message="Try adjusting your filters or search query."
          />
        ) : (
          <div className="space-y-4">
            <div className="hidden md:block">
              <Table className="text-left">
                <THead>
                  <Th align="center" className="w-12">#</Th>
                  <Th>CAP Detail</Th>
                  <Th>Source Audit</Th>
                  <Th align="center">Status</Th>
                  <Th>Created At</Th>
                  <Th>Progress</Th>
                </THead>
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
                        key={c.cap_id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-4 py-3 text-gray-400 text-sm text-center">{itemIndex}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(capDetailsPath(c.cap_id))}
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
                          <span className="text-xs font-semibold text-gray-300">{pct}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
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
                    key={c.cap_id}
                    onClick={() => router.push(capDetailsPath(c.cap_id))}
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
                    <div className="flex justify-between pt-2 text-[10px] text-gray-500">
                        <span>Progress</span>
                        <span className="font-semibold text-gray-300">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={sorted.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}

      </main>
    </div>
  );
}
