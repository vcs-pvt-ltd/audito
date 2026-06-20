"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditFirmLearningApi, usersApi } from "@/lib/api";
import { Plus, Trash2, Users, X, BookOpen, Clock, CheckCircle2, RefreshCw, Play, Search, Pencil, Lock as LockIcon } from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";

interface Training {
  id: number;
  title: string;
  platform?: string | null;
  video_url: string;
  description?: string | null;
  duration_minutes?: number | null;
  assigned_count?: number;
  created_at?: string;
}

interface Auditor {
  user_code: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Assignment {
  assignment_id: number;
  assigned_at: string;
  completed_at?: string | null;
  assignment_status: "assigned" | "completed";
  training_id: number;
  training_title: string;
  auditor_user_code: string;
  auditor_first_name: string;
  auditor_last_name: string;
  auditor_email: string;
}

const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all";

function AssignModal({
  open,
  onClose,
  onAssign,
  auditors,
}: {
  open: boolean;
  onClose: () => void;
  onAssign: (codes: string[]) => Promise<void>;
  auditors: Auditor[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const selectedCodes = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  useEffect(() => {
    if (!open) setSelected({});
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Assign to Auditors</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {auditors.map((a) => (
              <label
                key={a.user_code}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-all group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white group-hover:text-secondary-400 transition-colors">
                    {a.first_name} {a.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{a.email}</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!selected[a.user_code]}
                  onChange={(e) =>
                    setSelected((p) => ({ ...p, [a.user_code]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-white/10 bg-black/20 text-secondary-500 focus:ring-0 cursor-pointer"
                />
              </label>
            ))}
            {auditors.length === 0 && (
              <p className="text-gray-500 text-sm italic text-center py-4">No auditors found.</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                await onAssign(selectedCodes);
                setLoading(false);
                onClose();
              }}
              disabled={loading || selectedCodes.length === 0}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50 transition-all"
            >
              {loading ? "Assigning..." : `Assign (${selectedCodes.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewAssignmentsModal({
  open,
  onClose,
  assignments,
  title,
}: {
  open: boolean;
  onClose: () => void;
  assignments: Assignment[];
  title: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Assignments</h2>
            <p className="text-xs text-gray-500 mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-gray-400 font-medium w-12 text-center">#</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Auditor</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Status</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assignments.map((a, idx) => {
                  const isCompleted = a.assignment_status === "completed";
                  return (
                    <tr key={a.assignment_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-4 text-gray-500 text-center">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <p className="text-white font-medium">{a.auditor_first_name} {a.auditor_last_name}</p>
                        <p className="text-xs text-gray-500">{a.auditor_email}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isCompleted
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                          {isCompleted ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-xs text-gray-400">{a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : "—"}</p>
                      </td>
                    </tr>
                  );
                })}
                {assignments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-gray-500 italic">No assignments yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:border-white/20 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuditFirmTrainingsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTrainingId, setAssignTrainingId] = useState<number | null>(null);

  const [viewAssignmentsId, setViewAssignmentsId] = useState<number | null>(null);
  const [viewAssignmentsOpen, setViewAssignmentsOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedTraining = trainings.find(t => t.id === viewAssignmentsId);
  const filteredAssignments = assignments.filter(a => a.training_id === viewAssignmentsId);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    const [tRes, uRes] = await Promise.all([
      auditFirmLearningApi.listTrainings(accessToken),
      usersApi.list(accessToken, "Auditor"),
    ]);

    if (tRes.success && tRes.data) {
      const d = tRes.data as any;
      setTrainings(d.trainings || []);
      setAssignments(d.assignments || []);
    }
    if (uRes.success && uRes.data) {
      const d = uRes.data as any;
      setAuditors((d.users || []).map((x: any) => ({
        user_code: x.user_code,
        first_name: x.first_name,
        last_name: x.last_name,
        email: x.email,
      })));
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!accessToken) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return trainings;
    return trainings.filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.description?.toLowerCase().includes(query) ||
      t.platform?.toLowerCase().includes(query)
    );
  }, [trainings, searchQuery]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (isLoading || !admin) return null;

  const handleDelete = async (id: number) => {
    if (!accessToken) return;
    const ok = await confirm({
      title: "Delete Training",
      message: "Delete this training?",
      confirmText: "Delete",
      variant: "warning",
    });
    if (!ok) return;
    const res = await auditFirmLearningApi.deleteTraining(accessToken, id);
    if (res.success) {
      toast("Training deleted successfully.", "success");
      await load();
    } else {
      toast(res.message || "Failed to delete training.", "error");
    }
  };

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Play size={22} className="text-secondary-400" />
            Trainings
          </h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
            Create, assign and monitor training videos for your auditors.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all font-medium"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => router.push("/learning/trainings/create")}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 shadow-lg shadow-secondary-500/10 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span className="hidden sm:block">Create Training</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {!loading && trainings.length > 0 && (
        <div className="mb-6 max-w-lg">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-white/[0.06]">
            <Search size={14} className="text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trainings..."
              className="bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 w-full"
            />
          </div>
        </div>
      )}

      {/* Data Section */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : trainings.length === 0 ? (
        <div className="glass rounded-xl p-20 text-center border border-white/5">
          <p className="text-gray-400 text-sm">No trainings found. Create your first one to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <Play size={36} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No matching trainings</p>
          <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="glass rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-12 text-center">#</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-[50%]">Title</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-28">Platform</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium w-24">Duration</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium w-20">Assigned</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginated.map((t, index) => {
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-4 text-gray-400 text-center">{itemIndex}</td>
                        <td className="px-4 py-4">
                          <div className="min-w-[200px]">
                            <p className="text-white font-medium">{t.title}</p>
                            {t.description && (
                              <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{t.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-300">
                            {t.platform || "Video"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                           <div className="text-xs text-gray-400 flex items-center justify-center gap-1.5">
                              <Clock size={12} className="opacity-50" />
                              {t.duration_minutes ? `${t.duration_minutes}m` : "—"}
                           </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                           <span className="inline-flex px-2 py-0.5 rounded-full bg-secondary-500/10 border border-secondary-500/10 text-[11px] text-secondary-500 font-medium">
                              {t.assigned_count ?? 0}
                           </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a
                              href={t.video_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all font-medium text-xs"
                              title="Watch Link"
                            >
                               <Play size={15} />
                            </a>
                            <button
                              onClick={() => {
                                setViewAssignmentsId(t.id);
                                setViewAssignmentsOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                              title="View Assignments"
                            >
                              <Users size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setAssignTrainingId(t.id);
                                setAssignOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all"
                              title="Assign User"
                            >
                              <Plus size={15} />
                            </button>
                            {(t.assigned_count ?? 0) > 0 ? (
                              <button
                                onClick={() => toast(`This training is assigned to ${t.assigned_count} auditor${t.assigned_count === 1 ? "" : "s"} and cannot be deleted. Remove those assignments first.`, "warning")}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                title={`Assigned to ${t.assigned_count} auditor${t.assigned_count === 1 ? "" : "s"}. Click for details.`}
                              >
                                <LockIcon size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {paginated.map((t, index) => {
              const itemIndex = (currentPage - 1) * pageSize + index + 1;
              return (
                <div key={t.id} className="glass rounded-xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">#{itemIndex}</p>
                      <h3 className="text-sm font-semibold text-white truncate">{t.title}</h3>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-300">
                      {t.platform || "Video"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                      <p className="text-gray-500">Duration</p>
                      <p className="text-gray-300 mt-0.5 italic">{t.duration_minutes ? `${t.duration_minutes}m` : "-"}</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
                      <p className="text-gray-500">Assigned</p>
                      <p className="text-secondary-400 mt-0.5 font-bold">{t.assigned_count ?? 0}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1 pt-3 border-t border-white/5">
                      <a
                        href={t.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg text-gray-400 hover:text-secondary-400"
                      >
                        <Play size={15} />
                      </a>
                      <button
                        onClick={() => {
                          setViewAssignmentsId(t.id);
                          setViewAssignmentsOpen(true);
                        }}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10"
                      >
                        <Users size={15} />
                      </button>
                      <button
                        onClick={() => {
                          setAssignTrainingId(t.id);
                          setAssignOpen(true);
                        }}
                         className="p-2 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10"
                      >
                        <Plus size={15} />
                      </button>
                      {(t.assigned_count ?? 0) > 0 ? (
                        <button
                          onClick={() => toast(`This training is assigned to ${t.assigned_count} auditor${t.assigned_count === 1 ? "" : "s"} and cannot be deleted. Remove those assignments first.`, "warning")}
                          className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                          title={`Assigned to ${t.assigned_count} auditor${t.assigned_count === 1 ? "" : "s"}. Tap for details.`}
                        >
                          <LockIcon size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
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

      <AssignModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        auditors={auditors}
        onAssign={async (codes) => {
          if (!accessToken || !assignTrainingId) return;
          await auditFirmLearningApi.assignTraining(accessToken, assignTrainingId, codes);
          await load();
        }}
      />

      <ViewAssignmentsModal
        open={viewAssignmentsOpen}
        onClose={() => setViewAssignmentsOpen(false)}
        assignments={filteredAssignments}
        title={selectedTraining?.title || ""}
      />
    </div>
  );
}
