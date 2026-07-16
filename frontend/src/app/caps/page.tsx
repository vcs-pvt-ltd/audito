"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditApi, capApi, usersApi } from "@/lib/api";
import {
  AlertCircle,
  ClipboardList,
  Calendar,
  ChevronRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  RefreshCw,
  Building2,
  Search,
} from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Table, THead, Th } from "@/components/ui";

interface CapSummary {
  cap_id: string;
  audit_id: string;
  audit_code: string;
  audit_title: string;
  title: string;
  description: string | null;
  status: "plan" | "in_progress" | "completed";
  created_by: string;
  created_at: string;
  updated_at: string;
  total_questions: number;
  completed_questions: number;
  entity_name?: string | null;
}

interface AssignedUserMini {
  first_name: string;
  last_name: string;
  user_code: string;
}

interface AuditMini {
  audit_id: string;
  audit_type: "internal" | "external";
  assigned_auditor_id: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  plan: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  plan: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatusIcon({ status }: { status: string }) {
  if (status === "in_progress") return <TrendingUp size={16} className="text-blue-400" />;
  if (status === "completed") return <CheckCircle2 size={16} className="text-emerald-400" />;
  return <Clock size={16} className="text-gray-400" />;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  plan: <Clock size={12} />,
  in_progress: <TrendingUp size={12} />,
  completed: <CheckCircle2 size={12} />,
};

export default function CapsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [caps, setCaps] = useState<CapSummary[]>([]);
  const [auditorByCapId, setAuditorByCapId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [auditFilter, setAuditFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [auditorFilter, setAuditorFilter] = useState<string>("all");
  const [progressFilter, setProgressFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const loadCaps = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    const res = await capApi.list(accessToken, { includeSubCaps: true });
    setLoading(false);
    if (res.success && res.data) {
      const list = (res.data as { caps: CapSummary[] }).caps || [];
      setCaps(list);

      // Resolve assigned auditor names (best-effort, internal audits only)
      setAuditorByCapId({});
      const uniqueAuditIds = Array.from(new Set(list.map((c) => c.audit_id).filter(Boolean)));
      if (uniqueAuditIds.length > 0) {
        const auditResults = await Promise.allSettled(
          uniqueAuditIds.map(async (auditId) => {
            const aRes = await auditApi.get(accessToken, auditId);
            if (!aRes.success || !aRes.data) throw new Error(aRes.message || "Failed to load audit");
            const ad = aRes.data as { audit: AuditMini };
            return ad.audit;
          })
        );

        const auditById: Record<string, AuditMini> = {};
        for (const r of auditResults) {
          if (r.status === "fulfilled" && r.value) auditById[r.value.audit_id] = r.value;
        }

        const auditorCodes = Array.from(
          new Set(
            Object.values(auditById)
              .filter((a) => a.audit_type === "internal")
              .map((a) => a.assigned_auditor_id)
              .filter((c): c is string => Boolean(c))
          )
        );

        const userByCode: Record<string, AssignedUserMini> = {};
        if (auditorCodes.length > 0) {
          const userResults = await Promise.allSettled(
            auditorCodes.map(async (code) => {
              const uRes = await usersApi.get(accessToken, code);
              if (!uRes.success || !uRes.data) throw new Error(uRes.message || "Failed to load user");
              const ud = uRes.data as { user: AssignedUserMini };
              return ud.user;
            })
          );
          for (const r of userResults) {
            if (r.status === "fulfilled" && r.value?.user_code) {
              userByCode[String(r.value.user_code)] = r.value;
            }
          }
        }

        const map: Record<string, string> = {};
        for (const c of list) {
          const a = auditById[c.audit_id];
          if (!a) continue;
          if (a.audit_type !== "internal") {
            map[c.cap_id] = "—";
            continue;
          }
          if (!a.assigned_auditor_id) {
            map[c.cap_id] = "—";
            continue;
          }
          const u = userByCode[String(a.assigned_auditor_id)];
          map[c.cap_id] = u ? `${u.first_name} ${u.last_name}` : "—";
        }
        setAuditorByCapId(map);
      }
    } else {
      setError(res.message || "Failed to load CAP.");
    }
  }, [accessToken]);

  useEffect(() => { loadCaps(); }, [loadCaps]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? caps : caps.filter(c => c.status === filter);
    const query = q.trim().toLowerCase();
    return base.filter((c) => {
      if (auditFilter !== "all" && c.audit_id !== auditFilter) return false;
      if (entityFilter !== "all" && (c.entity_name || "") !== entityFilter) return false;
      if (auditorFilter !== "all" && (auditorByCapId[c.cap_id] || "") !== auditorFilter) return false;
      const progress = c.total_questions > 0 ? Math.round((c.completed_questions / c.total_questions) * 100) : 0;
      if (progressFilter === "not_started" && progress !== 0) return false;
      if (progressFilter === "in_progress" && (progress <= 0 || progress >= 100)) return false;
      if (progressFilter === "completed" && progress < 100) return false;
      if (!query) return true;
      const hay = `${c.title || ""} ${c.audit_title || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [caps, filter, q, auditFilter, entityFilter, auditorFilter, auditorByCapId, progressFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, q, auditFilter, entityFilter, auditorFilter, progressFilter, sortBy]);

  const auditOptions = useMemo(() => Array.from(new Map(caps.map((c) => [c.audit_id, c.audit_title || c.audit_id])).entries()), [caps]);
  const entityOptions = useMemo(() => Array.from(new Set(caps.map((c) => c.entity_name).filter((name): name is string => Boolean(name)))).sort(), [caps]);
  const auditorOptions = useMemo(() => Array.from(new Set(Object.values(auditorByCapId).filter((name) => name && name !== "â€”"))).sort(), [auditorByCapId]);
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
    if (sortBy === "progress_desc") return (b.total_questions ? b.completed_questions / b.total_questions : 0) - (a.total_questions ? a.completed_questions / a.total_questions : 0);
    if (sortBy === "progress_asc") return (a.total_questions ? a.completed_questions / a.total_questions : 0) - (b.total_questions ? b.completed_questions / b.total_questions : 0);
    if (sortBy === "oldest") return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  }), [filtered, sortBy]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const counts: Record<string, number> = {
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
              Corrective Action Plans
            </h1>
            <p className="text-sm text-gray-400 mt-1 ml-[46px]">
              Manage and track CAP created from audit findings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadCaps}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Search and advanced filters */}
        {!loading && caps.length > 0 && (
          <div className="mb-6 max-w-lg">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-white/[0.06]">
              <Search size={14} className="text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search CAP title or audit…"
                className="bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 w-full"
              />
            </div>
          </div>
        )}

        {!loading && caps.length > 0 && (
          <div className="mb-5 grid gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
            <label className="grid gap-1 text-[11px] font-medium text-gray-400">Linked audit<select value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-gray-200"><option value="all">All linked audits</option>{auditOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
            <label className="grid gap-1 text-[11px] font-medium text-gray-400">Entity<select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-gray-200"><option value="all">All entities</option>{entityOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="grid gap-1 text-[11px] font-medium text-gray-400">Auditor<select value={auditorFilter} onChange={(e) => setAuditorFilter(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-gray-200"><option value="all">All auditors</option>{auditorOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label className="grid gap-1 text-[11px] font-medium text-gray-400">Status<select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-gray-200"><option value="all">All statuses</option><option value="plan">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
            <label className="grid gap-1 text-[11px] font-medium text-gray-400">Completion<select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-gray-200"><option value="all">Any progress</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
            <label className="grid gap-1 text-[11px] font-medium text-gray-400">Sort by<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-gray-200"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="progress_desc">Most progress</option><option value="progress_asc">Least progress</option><option value="title">Title A-Z</option></select></label>
            <button type="button" onClick={() => { setAuditFilter("all"); setEntityFilter("all"); setAuditorFilter("all"); setProgressFilter("all"); setSortBy("newest"); setFilter("all"); setQ(""); }} className="mt-5 h-10 rounded-lg border border-white/10 text-xs font-semibold text-gray-300 transition hover:bg-white/[0.06]">Reset filters</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="glass rounded-xl p-8 text-center">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-red-400">{error}</p>
          </div>
        ) : caps.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No CAP Yet"
            message="CAP are created from corrective actions after completing an audit."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={`No ${STATUS_LABEL[filter] || filter} CAPs`}
            message="Try selecting a different filter."
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <Th className="w-10">#</Th>
                  <Th>CAP</Th>
                  <Th>Organization</Th>
                  <Th>Auditor</Th>
                  <Th>Status</Th>
                  <Th>Progress</Th>
                  <Th>
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      Created
                    </span>
                  </Th>
                  <Th align="right">Action</Th>
                </THead>
                <tbody className="divide-y divide-white/[0.06]">
                  {paginated.map((cap, index) => {
                    const pct = cap.total_questions > 0
                      ? Math.round((cap.completed_questions / cap.total_questions) * 100)
                      : 0;
                    const displayStatus = cap.status;
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;

                    return (
                      <tr
                        key={cap.cap_id}
                        onClick={() => router.push(`/caps/details?id=${cap.cap_id}`)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3 text-gray-400">{itemIndex}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <p className="text-white font-medium truncate">{cap.title}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {cap.entity_name ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                              <Building2 size={12} className="text-gray-500 shrink-0" />
                              <span className="truncate max-w-[150px]">{cap.entity_name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-300">
                            {auditorByCapId[cap.cap_id] ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit border text-xs font-medium ${STATUS_BADGE[displayStatus] || STATUS_BADGE.plan}`}>
                            {STATUS_ICON[displayStatus] || STATUS_ICON.plan}
                            {STATUS_LABEL[displayStatus] || displayStatus}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden max-w-xs">
                              <div
                                className="h-full bg-gradient-to-r from-secondary-400 to-secondary-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 font-medium w-10 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {fmtDate(cap.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/caps/details?id=${cap.cap_id}`);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border bg-secondary-500/10 text-secondary-400 border-secondary-500/20 hover:bg-secondary-500/20 hover:border-secondary-500/40 whitespace-nowrap"
                            >
                              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            <div className="md:hidden space-y-3">
              {paginated.map((cap, index) => {
                const pct = cap.total_questions > 0
                  ? Math.round((cap.completed_questions / cap.total_questions) * 100)
                  : 0;
                const displayStatus = cap.status;
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div
                    key={cap.cap_id}
                    onClick={() => router.push(`/caps/details?id=${cap.cap_id}`)}
                    className="glass rounded-xl border border-white/10 p-4 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">#{itemIndex}</p>
                        <h3 className="text-sm font-semibold text-white truncate">{cap.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{cap.audit_title}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full w-fit border text-xs font-medium ${STATUS_BADGE[displayStatus] || STATUS_BADGE.plan}`}>
                        {STATUS_ICON[displayStatus] || STATUS_ICON.plan}
                        {STATUS_LABEL[displayStatus] || displayStatus}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Auditor</p>
                        <p className="text-gray-300 mt-0.5 truncate">{auditorByCapId[cap.cap_id] ?? "-"}</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Created</p>
                        <p className="text-gray-300 mt-0.5 truncate">{fmtDate(cap.created_at)}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{cap.completed_questions}/{cap.total_questions} completed</span>
                        <span className="text-gray-300">{pct}%</span>
                      </div>
                      <div className="mt-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-secondary-400 to-secondary-500" style={{ width: `${pct}%` }} />
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
          </>
        )}
      </main>
    </div>
  );
}
