"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { checklistApi } from "@/lib/api";

import {
  Plus,
  RefreshCw,
  ClipboardList,
  Search,
  Trash2,
  Pencil,
  Lock,
  ClipboardCheck,
  ChevronRight,
  Sparkles,
  Crown,
} from "lucide-react";
import LimitReachedModal from "@/components/modals/LimitReachedModal";
import { useOnboarding } from "@/context/OnboardingContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import TablePagination from "@/components/shared/TablePagination";

interface Checklist {
  id: number;
  name: string;
  description: string | null;
  checklist_type_id: number | null;
  checklist_type_name: string | null;
  time_period_value: number | null;
  time_period_unit: string | null;
  repeat_duration_value: number | null;
  repeat_duration_unit: string | null;
  budget: string | number | null;
  currency: string | null;
  num_workers: number | null;
  media_path: string | null;
  is_active: boolean;
  created_at: string;
  assigned_audit_count?: number | string | null;
}

export default function ChecklistsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm } = useUiFeedback();
  const router = useRouter();
  const { goNext } = useOnboarding();
  const isOnboarding = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("onboarding") === "1";

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const fetchChecklists = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await checklistApi.list(accessToken);
    if (res.success && res.data) {
      const data = res.data as { checklists: Checklist[] };
      setChecklists(data.checklists || []);
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of checklists) {
      if (c.checklist_type_name) set.add(c.checklist_type_name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [checklists]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return checklists.filter((c) => {
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      if (typeFilter !== "all" && (c.checklist_type_name || "") !== typeFilter) return false;
      if (!query) return true;
      const hay = `${c.name || ""} ${c.description || ""} ${c.checklist_type_name || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [checklists, q, typeFilter, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [q, typeFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleCreateClick = () => {
    const isOnboarding = new URLSearchParams(window.location.search).get("onboarding") === "1";
    if (admin?.plan_limits && checklists.length >= admin.plan_limits.checklists) {
      setLimitModalOpen(true);
    } else {
      router.push(`/checklists/create${isOnboarding ? "?onboarding=1" : ""}`);
    }
  };

  const isLimitExceeded = admin?.plan_limits && checklists.length >= admin.plan_limits.checklists;

  const detailsPath = (id: number) =>
    `/checklists/details?id=${id}${isOnboarding ? "&onboarding=1" : ""}`;

  const editPath = (id: number) =>
    `/checklists/create?id=${id}${isOnboarding ? "&onboarding=1" : ""}`;

  const assignedAuditCount = (checklist: Checklist) =>
    Number(checklist.assigned_audit_count || 0);

  const handleDelete = async (id: number, name: string) => {
    if (!accessToken) return;
    const ok = await confirm({
      title: "Delete Checklist",
      message: `Delete checklist "${name}"?`,
      confirmText: "Delete",
      variant: "warning",
    });
    if (!ok) return;
    setDeleting(id);
    await checklistApi.deactivate(accessToken, id);
    setDeleting(null);
    fetchChecklists();
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
        <LimitReachedModal
          isOpen={limitModalOpen}
          onClose={() => setLimitModalOpen(false)}
          title="Checklist Limit Reached"
          message="Your current plan has reached the maximum number of checklists allowed."
          limit={admin?.plan_limits?.checklists || 0}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardList size={22} className="text-secondary-400" />
              Checklists
            </h1>
            <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
              Manage audit checklists and their questions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchChecklists}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all shadow-lg shadow-secondary-500/10"
            >
              {isLimitExceeded ? <Crown size={16} /> : <Plus size={16} />}
              <span className="sm:hidden">{isLimitExceeded ? "Upgrade" : "Create"}</span>
              <span className="hidden sm:block">{isLimitExceeded ? "Upgrade" : "Create Checklist"}</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {!loading && checklists.length > 0 && (
          <div className="glass rounded-xl p-4 mb-5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name / description / type..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-secondary-500/40"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-secondary-500/40"
                >
                  <option value="all">All Types</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-secondary-500/40"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="all">All Status</option>
                </select>

                <div className="text-xs text-gray-500 px-3 py-2">
                  Showing <span className="text-gray-300 font-medium">{filtered.length}</span> / {checklists.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : checklists.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center">
            <ClipboardList size={40} className="text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No checklists yet</p>
            <p className="text-gray-400 text-sm mb-6">
              Create your first checklist to assign questions to entities in your org tree.
            </p>
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
            >
              {isLimitExceeded ? <Crown size={16} /> : <Plus size={16} />}
              {isLimitExceeded ? "Upgrade" : "Create Checklist"}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center">
            <ClipboardList size={36} className="text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No checklists match your filters</p>
            <p className="text-gray-400 text-sm">Try adjusting search/type/status.</p>
          </div>
        ) : (
          <>
            <div className="glass rounded-xl overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 text-gray-400 font-medium w-12">#</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Name</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Type</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Time Period</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Repeat</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Budget</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Workers</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Audits</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {paginated.map((cl, index) => {
                  const budget = cl.budget ? parseFloat(String(cl.budget)) : null;
                  const itemIndex = (currentPage - 1) * pageSize + index + 1;
                  const auditCount = assignedAuditCount(cl);
                  const isEditDisabled = auditCount > 0;
                  return (
                    <tr key={cl.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-sm">{itemIndex}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(detailsPath(cl.id))}
                          className="text-secondary-400 hover:text-secondary-300 font-medium hover:underline underline-offset-2 transition-colors text-left"
                          title="View checklist details"
                        >
                          {cl.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {cl.checklist_type_name ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-500/15 text-secondary-400 border border-secondary-500/20">
                            {cl.checklist_type_name}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {cl.time_period_value && cl.time_period_unit
                          ? `${cl.time_period_value} ${cl.time_period_unit}`
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {cl.repeat_duration_value && cl.repeat_duration_unit
                          ? `Every ${cl.repeat_duration_value} ${cl.repeat_duration_unit}`
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {budget !== null
                          ? `${cl.currency || "$"}${budget.toLocaleString()}`
                          : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {cl.num_workers ?? <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          auditCount > 0
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                            : "bg-white/[0.03] text-gray-500 border-white/10"
                        }`}>
                          {auditCount}
                        </span>
                      </td>
                  
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => {
                               const isOnboarding = new URLSearchParams(window.location.search).get("onboarding") === "1";
                               router.push(`/audits/assign/create?checklistId=${cl.id}${isOnboarding ? "&onboarding=1" : ""}`);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all whitespace-nowrap"
                            title="Assign Audit"
                          >
                            <ClipboardCheck size={12} />
                            Assign Audit
                          </button>
                          <button
                            onClick={() => {
                              if (!isEditDisabled) router.push(editPath(cl.id));
                            }}
                            disabled={isEditDisabled}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 border border-white/10 hover:border-secondary-500/20 transition-all disabled:opacity-40 disabled:hover:text-gray-400 disabled:hover:bg-transparent disabled:hover:border-white/10 disabled:cursor-not-allowed"
                            title={isEditDisabled ? `Assigned to ${auditCount} audit${auditCount === 1 ? "" : "s"}; editing is disabled` : "Edit"}
                          >
                            {isEditDisabled ? <Lock size={14} /> : <Pencil size={14} />}
                          </button>
                          <button
                            onClick={() => handleDelete(cl.id, cl.name)}
                            disabled={deleting === cl.id}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-all disabled:opacity-50"
                            title="Delete"
                          >
                            {deleting === cl.id ? (
                              <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <div className="md:hidden space-y-3">
              {paginated.map((cl, index) => {
                const budget = cl.budget ? parseFloat(String(cl.budget)) : null;
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                const auditCount = assignedAuditCount(cl);
                const isEditDisabled = auditCount > 0;
                return (
                  <div key={cl.id} className="glass rounded-xl border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">#{itemIndex}</p>
                        <button
                          onClick={() => router.push(detailsPath(cl.id))}
                          className="text-sm font-semibold text-secondary-400 hover:text-secondary-300 text-left truncate block"
                          title="View checklist details"
                        >
                          {cl.name}
                        </button>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{cl.checklist_type_name || "-"}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        cl.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {cl.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Time</p>
                        <p className="text-gray-300 mt-0.5 truncate">
                          {cl.time_period_value && cl.time_period_unit ? `${cl.time_period_value} ${cl.time_period_unit}` : "-"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Workers</p>
                        <p className="text-gray-300 mt-0.5 truncate">{cl.num_workers ?? "-"}</p>
                      </div>
                      <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Budget</p>
                        <p className="text-gray-300 mt-0.5 truncate">{budget !== null ? `${cl.currency || "$"}${budget.toLocaleString()}` : "-"}</p>
                      </div>
                      <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                        <p className="text-gray-500">Assigned Audits</p>
                        <p className="text-gray-300 mt-0.5 truncate">{auditCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/audits/assign/create?checklistId=${cl.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all"
                      >
                        <ClipboardCheck size={12} />
                        Assign
                      </button>
                      <button
                        onClick={() => {
                          if (!isEditDisabled) router.push(editPath(cl.id));
                        }}
                        disabled={isEditDisabled}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 border border-white/10 hover:border-secondary-500/20 transition-all disabled:opacity-40 disabled:hover:text-gray-400 disabled:hover:bg-transparent disabled:hover:border-white/10 disabled:cursor-not-allowed"
                        title={isEditDisabled ? `Assigned to ${auditCount} audit${auditCount === 1 ? "" : "s"}; editing is disabled` : "Edit"}
                      >
                        {isEditDisabled ? <Lock size={14} /> : <Pencil size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(cl.id, cl.name)}
                        disabled={deleting === cl.id}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-all disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === cl.id ? (
                          <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
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
