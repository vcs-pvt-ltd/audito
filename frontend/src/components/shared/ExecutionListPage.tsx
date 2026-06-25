"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi, capApi } from "@/lib/api";
import { useExecution } from "@/context/ExecutionContext";

import {
  ClipboardCheck,
  ClipboardList,
  RefreshCw,
  Play,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronRight,
  Search,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Table, THead, Th, TBody, Tr, Td, Button, IconButton } from "@/components/ui";

interface ExecutionItem {
  id: number;
  code: string;
  title: string;
  checklist_name?: string;
  cap_plan_code?: string;
  audit_code?: string;
  type?: "internal" | "external";
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  progress_pct?: number;
  total_questions?: number;
  answered_questions?: number;
}

interface Counts {
  all: number;
  [key: string]: number;
}

const STATUS_BADGE: Record<string, string> = {
  plan: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  plan: <Clock size={12} />,
  in_progress: <Play size={12} />,
  completed: <CheckCircle2 size={12} />,
};

function normalizeExecutionStatus(status: string, workflowType: "audit" | "cap"): string {
  return workflowType === "audit" ? status : status;
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isStartable(startDate?: string) {
  if (!startDate) return true;
  const today = new Date().toISOString().split("T")[0];
  const start = new Date(startDate).toISOString().split("T")[0];
  return today >= start;
}

function daysUntil(startDate?: string) {
  if (!startDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysRemaining(endDate?: string) {
  if (!endDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

interface ExecutionListPageProps {
  basePath: string;
}

const CircularProgress = ({ pct, size = 45 }: { pct: number, size?: number }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="4"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
          strokeLinecap="round"
          className="text-secondary-500 transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
        {pct}%
      </div>
    </div>
  );
};

export default function ExecutionListPage({ basePath }: ExecutionListPageProps) {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const { workflowType, labels, apiConfig } = useExecution();

  const [items, setItems] = useState<ExecutionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
    if (!isLoading && admin && admin.role !== "auditor" && admin.role !== "entity_head") {
      router.push("/audits");
    }
  }, [isLoading, admin, router]);

  const fetchItems = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);

    try {
      let res: any;
      if (workflowType === "audit") {
        res = await auditExecutionApi.myAudits(accessToken);
      } else {
        res = await capApi.list(accessToken, { includeSubCaps: true });
      }

      if (res.success && res.data) {
        const raw = (workflowType === "audit" ? (res.data.audits || []) : (res.data.caps || [])) as any[];

        if (workflowType === "audit") {
          const data = raw
            .filter((item: any) => item.audit_mode !== "cap_verification")
            .map((a: any): ExecutionItem => {
              const total = Number(a.total_questions ?? 0);
              const answered = Number(a.answered_questions ?? 0);
              const pct = typeof a.progress_pct === "number"
                ? a.progress_pct
                : (total > 0 ? Math.round((answered / total) * 100) : 0);
              return {
                id: a.id,
                code: a.audit_code,
                title: a.title,
                checklist_name: a.checklist_name,
                audit_code: a.audit_code,
                type: a.audit_type,
                status: a.status,
                start_date: a.start_date,
                end_date: a.end_date,
                created_at: a.created_at,
                progress_pct: pct,
                total_questions: total,
                answered_questions: answered,
              };
            });
          setItems(data);
        } else {
          const data = raw.map((c: any): ExecutionItem => {
            const total = Number(c.total_questions ?? 0);
            const answered = Number(c.completed_questions ?? c.answered_questions ?? 0);
            const pct = typeof c.progress_pct === "number"
              ? c.progress_pct
              : (total > 0 ? Math.round((answered / total) * 100) : 0);
            return {
              id: c.id,
              code: c.cap_plan_code,
              title: c.title,
              cap_plan_code: c.cap_plan_code,
              audit_code: c.audit_code,
              status: c.status,
              created_at: c.created_at,
              progress_pct: pct,
              total_questions: total,
              answered_questions: answered,
            };
          });
          setItems(data);
        }
      }
    } catch (error) {
      console.error("Error fetching items:", error);
    }
    setLoading(false);
  }, [accessToken, workflowType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const statusOptions = workflowType === "audit"
    ? ["all", "plan", "in_progress", "completed"]
    : ["all", "plan", "in_progress", "completed"];

  const dateInRange = (value?: string) => {
    if (!value) return true;
    const day = value.slice(0, 10);
    if (startDateFilter && day < startDateFilter) return false;
    if (endDateFilter && day > endDateFilter) return false;
    return true;
  };

  const keyword = searchTerm.trim().toLowerCase();
  const baseFiltered = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !keyword ||
        item.title?.toLowerCase().includes(keyword) ||
        item.code?.toLowerCase().includes(keyword) ||
        item.audit_code?.toLowerCase().includes(keyword) ||
        item.cap_plan_code?.toLowerCase().includes(keyword);

      const matchesDate =
        workflowType === "audit"
          ? dateInRange(item.start_date || item.created_at)
          : dateInRange(item.created_at);

      return matchesSearch && matchesDate;
    });
  }, [items, keyword, workflowType, startDateFilter, endDateFilter]);

  const filtered = useMemo(() => {
    return filter === "all"
      ? baseFiltered
      : baseFiltered.filter((item) => normalizeExecutionStatus(item.status, workflowType) === filter);
  }, [baseFiltered, filter, workflowType]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm, startDateFilter, endDateFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const counts: Counts = useMemo(() => {
    const res: Counts = { all: baseFiltered.length };
    statusOptions.forEach((status) => {
      if (status !== "all") {
        res[status] = baseFiltered.filter((item) => normalizeExecutionStatus(item.status, workflowType) === status).length;
      }
    });
    return res;
  }, [baseFiltered, statusOptions, workflowType]);

  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin || (admin.role !== "auditor" && admin.role !== "entity_head")) return null;

  const Icon = workflowType === "audit" ? ClipboardCheck : ClipboardList;

  return (
    <div className="h-screen bg-transparent flex">
      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-secondary-500/20 flex items-center justify-center">
                <Icon size={20} className="text-secondary-400" />
              </div>
              {labels.title}
            </h1>
            <p className="hidden sm:block text-sm text-gray-400 mt-1 ml-[46px]">{labels.description}</p>
          </div>
          <IconButton bordered onClick={fetchItems} title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </IconButton>
        </div>

        {/* Search + Date Filters */}
        <div className="glass rounded-xl mb-4 sm:mb-5 overflow-hidden">

          {/* ── Mobile: search row + toggle button ── */}
          <div className="flex items-center gap-2 p-3 md:hidden">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${workflowType === "audit" ? "audits" : "caps"}...`}
                className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/10 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-secondary-500/50"
              />
            </div>
            {workflowType === "audit" && (
              <button
                type="button"
                onClick={() => setFiltersOpen(v => !v)}
                className={`flex items-center gap-1.5 h-10 px-3 rounded-lg border text-xs font-medium transition-all shrink-0 ${
                  filtersOpen || startDateFilter || endDateFilter
                    ? "bg-secondary-500/10 text-secondary-400 border-secondary-500/30"
                    : "text-gray-400 border-white/10 hover:text-white hover:border-white/20"
                }`}
              >
                <SlidersHorizontal size={13} />
                {(startDateFilter || endDateFilter) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary-400" />
                )}
                <ChevronDown size={12} className={`transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
              </button>
            )}
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setSearchTerm(""); setStartDateFilter(""); setEndDateFilter(""); setFilter("all"); }}
              className="h-10 shrink-0"
            >
              Reset
            </Button>
          </div>

          {/* Mobile collapsible date filters */}
          {workflowType === "audit" && filtersOpen && (
            <div className="md:hidden flex flex-col gap-2.5 px-3 pb-3 pt-1 border-t border-white/[0.06]">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Start Date</label>
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-3">
                  <Calendar size={13} className="text-gray-500 shrink-0" />
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full h-9 bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">End Date</label>
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-3">
                  <Calendar size={13} className="text-gray-500 shrink-0" />
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full h-9 bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Desktop: full grid (unchanged) ── */}
          <div className={`hidden md:grid p-3 sm:p-4 ${workflowType === "audit" ? "md:grid-cols-4" : "md:grid-cols-2"} gap-2.5 sm:gap-3`}>
            <div className="relative">
              <label className="block text-[11px] text-gray-400 mb-1">Search</label>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${workflowType === "audit" ? "audits" : "caps"}...`}
                className="w-full h-10 rounded-lg bg-white/[0.03] border border-white/10 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-secondary-500/50"
              />
            </div>

            {workflowType === "audit" && (
              <>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Start Date</label>
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-3">
                    <Calendar size={14} className="text-gray-500 shrink-0" />
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="w-full h-10 bg-transparent text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">End Date</label>
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-3">
                    <Calendar size={14} className="text-gray-500 shrink-0" />
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="w-full h-10 bg-transparent text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-end">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => { setSearchTerm(""); setStartDateFilter(""); setEndDateFilter(""); setFilter("all"); }}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-6 md:flex md:items-center md:gap-1 md:p-1 md:glass md:rounded-xl md:w-fit">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border md:border-0 ${
                  filter === status
                    ? "bg-secondary-500/20 text-secondary-400 shadow-sm border-secondary-500/30"
                    : "text-gray-400 hover:text-white hover:bg-white/[0.04] border-white/10"
                }`}
              >
                {status === "all" ? "All" : status.replace("_", " ")}
                <span
                  className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === status
                      ? "bg-secondary-500/30 text-secondary-300"
                      : "bg-white/[0.06] text-gray-500"
                  }`}
                >
                  {counts[status] || 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={`No ${labels.title.toLowerCase()} assigned yet`}
            message="Your admin will assign tasks to you when they're ready. Check back later."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Icon}
            title="No matching items"
            message="Try changing search text, dates, or status."
          />
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <THead>
                    <Th className="w-10">#</Th>
                    <Th>Title</Th>
                    <Th align="center">Status</Th>
                    <Th>Progress</Th>
                    {workflowType === "cap" && (
                      <Th>
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          Created
                        </span>
                      </Th>
                    )}
                    {workflowType === "audit" && (
                      <>
                        <Th>
                          <span className="flex items-center gap-1">
                            <Calendar size={13} />
                            Start
                          </span>
                        </Th>
                        <Th>
                          <span className="flex items-center gap-1">
                            <Calendar size={13} />
                            End
                          </span>
                        </Th>
                      </>
                    )}
                    <Th align="right">Action</Th>
                </THead>
                <TBody>
                  {paginated.map((item, index) => {
                    const displayStatus = normalizeExecutionStatus(item.status, workflowType);
                    const pct = item.progress_pct || Math.round(((item.answered_questions || 0) / (item.total_questions || 1)) * 100);
                    const remaining = daysRemaining(item.end_date);
                    const canStart = isStartable(item.start_date);
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;

                    return (
                      <Tr
                        key={item.id}
                        onClick={() => router.push(`${basePath}/details?id=${item.id}`)}
                        className="cursor-pointer group"
                      >
                        <Td className="text-gray-400">{itemIndex}</Td>
                        <Td>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-white font-medium">{item.title}</p>
                          </div>
                        </Td>
                        <Td>
                          <div className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full w-fit mx-auto border text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE[displayStatus] || STATUS_BADGE["plan"]}`}>
                            {STATUS_ICON[displayStatus]}
                            {displayStatus.replace("_", " ")}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden max-w-xs">
                              <div className="h-full bg-gradient-to-r from-secondary-400 to-secondary-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 font-medium w-8 text-right">{pct}%</span>
                          </div>
                        </Td>
                        {workflowType === "cap" && (
                          <Td className="text-gray-400">
                            {fmtDate(item.created_at || "")}
                          </Td>
                        )}
                        {workflowType === "audit" && (
                          <>
                            <Td className="text-gray-400">
                              {fmtDate(item.start_date || "")}
                              {item.start_date && !canStart && <p className="text-[10px] text-amber-400 mt-1 font-bold">{daysUntil(item.start_date)} DAYS LEFT</p>}
                            </Td>
                            <Td className="text-gray-400">
                              {fmtDate(item.end_date || "")}
                              {remaining < 7 && remaining >= 0 && <p className="text-[10px] text-red-500 mt-1 font-bold">{remaining} DAYS LEFT</p>}
                            </Td>
                          </>
                        )}
                        <Td align="right">
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`${basePath}/details?id=${item.id}`);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                                bg-secondary-500/10 text-secondary-400 border-secondary-500/20 hover:bg-secondary-500/20 hover:border-secondary-500/40 whitespace-nowrap"
                            >
                              {workflowType === "audit" ? (
                                item.status === "plan" ? (
                                  canStart ? <><Play size={12} /> Start</> : <><Clock size={12} /> Scheduled</>
                                ) : item.status === "in_progress" ? (
                                  <><Play size={12} /> Continue</>
                                ) : (
                                  <><CheckCircle2 size={12} /> Report</>
                                )
                              ) : (
                                displayStatus === "plan" || displayStatus === "in_progress" ? (
                                  <><Play size={12} /> Continue</>
                                ) : (
                                  <><CheckCircle2 size={12} /> View</>
                                )
                              )}
                              <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            {/* Mobile Card-Based Grid */}
            <div className="md:hidden space-y-4">
              {paginated.map((item, index) => {
                const displayStatus = normalizeExecutionStatus(item.status, workflowType);
                const pct = item.progress_pct || Math.round(((item.answered_questions || 0) / (item.total_questions || 1)) * 100);
                const remaining = daysRemaining(item.end_date);
                const canStart = isStartable(item.start_date);
                const itemIndex = (currentPage - 1) * pageSize + index + 1;

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`${basePath}/details?id=${item.id}`)}
                    className="glass rounded-2xl p-5 space-y-4 active:scale-[0.98] transition-all border border-white/10 relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 mb-1">#{itemIndex}</p>
                        <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight mb-2">{item.title}</h3>
                        <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider w-fit ${STATUS_BADGE[displayStatus] || STATUS_BADGE["plan"]}`}>
                          {STATUS_ICON[displayStatus]}
                          {displayStatus.replace("_", " ")}
                        </div>
                      </div>
                      <CircularProgress pct={pct} />
                    </div>

                    <div className="flex items-end justify-between gap-4 pt-2 border-t border-white/5">
                      <div className="space-y-3">
                        {workflowType === "audit" && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <p className="text-[11px] text-white flex items-center gap-1.5 font-bold">
                                <span className="text-gray-500 uppercase text-[9px] w-10 shrink-0">Start:</span>
                                {fmtDate(item.start_date || "")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <p className="text-[11px] text-white flex items-center gap-1.5 font-bold">
                                <span className="text-gray-500 uppercase text-[9px] w-10 shrink-0">End:</span>
                                {fmtDate(item.end_date || "")}
                              </p>
                            </div>
                          </div>
                        )}
                        {workflowType === "cap" && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              <p className="text-[11px] text-white flex items-center gap-1.5 font-bold">
                                <span className="text-gray-500 uppercase text-[9px] w-10 shrink-0">Date:</span>
                                {fmtDate(item.created_at || "")}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {workflowType === "audit" && remaining < 7 && remaining >= 0 ? (
                           <p className="text-[9px] text-red-500 font-extrabold uppercase tracking-widest bg-red-500/5 px-2 py-0.5 rounded border border-red-500/10 w-fit">
                            {remaining} {remaining === 1 ? "DAY" : "DAYS"} LEFT
                           </p>
                        ) : null}
                      </div>

                      <Button
                        className="pl-4 pr-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide shadow-xl shadow-secondary-500/20 active:translate-y-0.5"
                        rightIcon={<ChevronRight size={16} strokeWidth={3} />}
                      >
                        {workflowType === "audit" ? (
                          item.status === "plan" ? (canStart ? "Start" : "Wait") : "Resume"
                        ) : "Go"}
                      </Button>
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