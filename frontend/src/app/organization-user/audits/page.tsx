"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi } from "@/lib/api";
import { isPastAuditEndDate } from "@/lib/auditSchedule";
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
  audit_id: string;
  audit_code: string;
  title: string;
  checklist_name: string | null;
  audit_type: "internal" | "external";
  status: "plan" | "in_progress" | "completed";
  start_date: string;
  end_date: string;
  created_at: string;
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
  external: "External",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function OrganizationUserAuditsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [audits, setAudits] = useState<AuditAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortBy, setSortBy] = useState("newest");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "organization_user")) router.push("/login");
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

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    if (sortBy === "start_soonest") return new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime();
    if (sortBy === "end_soonest") return new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime();
    if (sortBy === "progress_desc") return Number(b.progress_pct || 0) - Number(a.progress_pct || 0);
    if (sortBy === "progress_asc") return Number(a.progress_pct || 0) - Number(b.progress_pct || 0);
    const aCreated = new Date(a.created_at || 0).getTime();
    const bCreated = new Date(b.created_at || 0).getTime();
    return sortBy === "oldest" ? aCreated - bCreated : bCreated - aCreated;
  }), [filtered, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, q, typeFilter, fromDate, toDate, sortBy]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

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
  const isAuditFirmOrganizationUser = ["Branch", "Audit Firm Department"].includes((admin.assigned_entity_type || admin.entity_type || "") as string);
  const auditDetailsPath = (auditId: string) => isAuditFirmOrganizationUser
    ? `/organization-user/audits/details?audit_id=${auditId}`
    : `/organization-user/audits/preview?audit_id=${auditId}`;

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
              {isAuditFirmOrganizationUser ? "Progress for audits assigned to your audit firm" : "Audits assigned to your organization tree"}
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
        <div className="mb-6 grid gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Search audits
            <span className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} /><input type="text" placeholder="Title or checklist..." value={q} onChange={(e) => setQ(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm text-white outline-none focus:border-secondary-500/50" /></span>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Audit type
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-secondary-500/50"><option value="all">All types</option><option value="internal">Internal</option><option value="external">External</option></select>
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Start date from
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-secondary-500/50 [color-scheme:dark]" />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">End date to
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-secondary-500/50 [color-scheme:dark]" />
          </label>
          <label className="grid gap-1 text-[11px] font-medium text-gray-400">Sort by
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none focus:border-secondary-500/50"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="start_soonest">Start date</option><option value="end_soonest">End date</option><option value="progress_desc">Most progress</option><option value="progress_asc">Least progress</option><option value="title">Title A-Z</option></select>
          </label>
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
                    const isOverdue = ["plan", "in_progress"].includes(a.status) && isPastAuditEndDate(a.end_date);
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={a.audit_id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-4 py-3 text-gray-400 text-sm text-center">{itemIndex}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(auditDetailsPath(a.audit_id))}
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
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${isOverdue ? "bg-red-500/15 text-red-400 border-red-500/20" : STATUS_BADGE[a.status] || ""}`}>
                            {isOverdue ? <AlertTriangle size={13} /> : STATUS_ICON[a.status]}
                            {isOverdue ? "Overdue" : STATUS_LABEL[a.status] || a.status}
                          </span>
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
              {paginated.map((a, index) => {
                const pct = a.progress_pct || 0;
                const isOverdue = ["plan", "in_progress"].includes(a.status) && isPastAuditEndDate(a.end_date);
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div
                    key={a.audit_id}
                    onClick={() => router.push(auditDetailsPath(a.audit_id))}
                    className="glass rounded-xl p-4 space-y-3 cursor-pointer hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 mb-1">#{itemIndex}</p>
                        <h3 className="text-white font-medium truncate pr-2">{a.title}</h3>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${isOverdue ? "bg-red-500/15 text-red-400 border-red-500/20" : STATUS_BADGE[a.status] || ""}`}>
                        {isOverdue && <AlertTriangle size={11} />}
                        {isOverdue ? "Overdue" : STATUS_LABEL[a.status] || a.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-500 uppercase tracking-wider text-[10px]">Type</div>
                      <div className="text-gray-300">{AUDIT_TYPE_LABEL[a.audit_type] || a.audit_type}</div>
                      <div className="text-gray-500 uppercase tracking-wider text-[10px]">Timeline</div>
                      <div className="text-gray-300">{fmtDate(a.start_date)} — {fmtDate(a.end_date)}</div>
                      {isOverdue && <div className="col-span-2 text-right text-[10px] font-bold text-red-400">End date passed</div>}
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
