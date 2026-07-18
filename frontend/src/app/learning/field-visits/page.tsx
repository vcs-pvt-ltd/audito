"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditFirmLearningApi, usersApi } from "@/lib/api";
import { Plus, Trash2, Users, BookOpen, Clock, CheckCircle2, RefreshCw, MapPin, Calendar, Search, Lock as LockIcon, Building2 } from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Button, IconButton, Modal, Table, THead, Th } from "@/components/ui";

interface FieldVisit {
  id: number;
  field_visit_id: string;
  title: string;
  location_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  assigned_count?: number;
  entity_name?: string | null;
}

interface Auditor {
  user_code: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Assignment {
  assignment_id: string;
  assigned_at: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  assignment_status: "assigned" | "completed";
  field_visit_id: number;
  field_visit_title: string;
  location_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  auditor_user_code: string;
  auditor_first_name: string;
  auditor_last_name: string;
  auditor_email: string;
}

function AssignModal({
  open, onClose, onAssign, auditors,
}: {
  open: boolean; onClose: () => void; onAssign: (codes: string[], sendEmail: boolean) => Promise<boolean>; auditors: Auditor[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const selectedCodes = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  useEffect(() => { if (!open) { setSelected({}); setSendEmail(true); } }, [open]);

  return (
    <Modal open={open} onClose={onClose} size="md" title="Assign Visit">
      <div className="space-y-3">
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          {auditors.map((a) => (
            <label key={a.user_code} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-all group">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white group-hover:text-secondary-400 transition-colors">{a.first_name} {a.last_name}</p>
                <p className="text-xs text-gray-500 truncate">{a.email}</p>
              </div>
              <input type="checkbox" checked={!!selected[a.user_code]}
                onChange={(e) => setSelected((p) => ({ ...p, [a.user_code]: e.target.checked }))}
                className="h-4 w-4 rounded border-white/10 bg-black/20 text-secondary-500 focus:ring-0 cursor-pointer" />
            </label>
          ))}
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 cursor-pointer">
          <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-white/10 bg-black/20 text-secondary-500 focus:ring-0 cursor-pointer" />
          <span><span className="block text-sm font-medium text-white">Send assignment email</span><span className="block mt-0.5 text-xs text-gray-500">Auditors will always receive an in-app notification.</span></span>
        </label>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button
            fullWidth
            loading={loading}
            disabled={selectedCodes.length === 0}
            onClick={async () => { setLoading(true); const assigned = await onAssign(selectedCodes, sendEmail); setLoading(false); if (assigned) onClose(); }}
          >
            {loading ? "Assigning..." : `Assign (${selectedCodes.length})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ViewAssignmentsModal({
  open, onClose, assignments, title, onDelete,
}: {
  open: boolean; onClose: () => void; assignments: Assignment[]; title: string; onDelete: (assignment: Assignment) => Promise<void>;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Visit Reports"
      description={title}
      footer={<Button variant="secondary" className="ml-auto px-6" onClick={onClose}>Close</Button>}
    >
      <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-gray-400 font-medium w-12 text-center">#</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Auditor</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Status</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Activity</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Action</th>
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
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${isCompleted ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                          {isCompleted ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-[10px] text-gray-400">IN: {a.check_in_time ? new Date(a.check_in_time).toLocaleDateString() : "—"}</p>
                        {a.check_out_time && <p className="text-[10px] text-green-400">OUT: {new Date(a.check_out_time).toLocaleDateString()}</p>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isCompleted ? <span className="text-[10px] text-gray-500">Locked</span> : (
                          <button onClick={() => onDelete(a)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Remove pending assignment"><Trash2 size={15} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
    </Modal>
  );
}

export default function AuditFirmFieldVisitsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();

  const [visits, setVisits] = useState<FieldVisit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignVisitId, setAssignVisitId] = useState<string | null>(null);
  const [viewAssignmentsId, setViewAssignmentsId] = useState<string | null>(null);
  const [viewAssignmentsOpen, setViewAssignmentsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedVisit = visits.find(v => v.field_visit_id === viewAssignmentsId);
  const filteredAssignments = assignments.filter(a => String(a.field_visit_id) === viewAssignmentsId);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    const [vRes, uRes] = await Promise.all([
      auditFirmLearningApi.listFieldVisits(accessToken),
      usersApi.list(accessToken, "Auditor"),
    ]);
    if (vRes.success && vRes.data) {
      const d = vRes.data as any;
      setVisits(d.field_visits || []);
      setAssignments(d.assignments || []);
    }
    if (uRes.success && uRes.data) {
      const d = uRes.data as any;
      setAuditors((d.users || []).map((x: any) => ({
        user_code: x.user_code, first_name: x.first_name, last_name: x.last_name, email: x.email,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { if (!accessToken) return; load(); }, [accessToken]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return visits;
    return visits.filter(v =>
      v.title.toLowerCase().includes(query) ||
      v.location_name?.toLowerCase().includes(query) ||
      v.notes?.toLowerCase().includes(query)
    );
  }, [visits, searchQuery]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (isLoading || !admin) return null;

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    const ok = await confirm({ title: "Delete Field Visit", message: "Delete this field visit?", confirmText: "Delete", variant: "warning" });
    if (!ok) return;
    const res = await auditFirmLearningApi.deleteFieldVisit(accessToken, id);
    if (res.success) { toast("Field visit deleted successfully.", "success"); await load(); }
    else toast(res.message || "Failed to delete field visit.", "error");
  };

  const handleAssignmentDelete = async (assignment: Assignment) => {
    if (!accessToken || !viewAssignmentsId || assignment.assignment_status !== "assigned") return;
    const ok = await confirm({ title: "Remove Assignment", message: `Remove the pending field visit assignment for ${assignment.auditor_first_name} ${assignment.auditor_last_name}?`, confirmText: "Remove", variant: "warning" });
    if (!ok) return;
    const res = await auditFirmLearningApi.deleteFieldVisitAssignment(accessToken, viewAssignmentsId, assignment.assignment_id);
    if (res.success) { toast("Pending field visit assignment removed.", "success"); await load(); }
    else toast(res.message || "Failed to remove field visit assignment.", "error");
  };

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin size={22} className="text-secondary-400" />
            Field Visits
          </h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-0.5">Plan and monitor on-site visits for auditors.</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton bordered size="lg" onClick={load} title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </IconButton>
          <Button onClick={() => router.push("/learning/field-visits/create")} className="active:scale-95" leftIcon={<Plus size={18} />}>
            <span className="hidden sm:block">Plan Visit</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      {!loading && visits.length > 0 && (
        <div className="mb-6 max-w-lg">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-white/[0.06]">
            <Search size={14} className="text-gray-500" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search visits..."
              className="bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 w-full" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visits.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No field visits yet"
          message="Plan and monitor on-site visits for auditors."
          action={(
            <Button onClick={() => router.push("/learning/field-visits/create")} leftIcon={<Plus size={16} />}>
              Plan Visit
            </Button>
          )}
        />
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <MapPin size={36} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No matching visits</p>
          <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table className="text-left">
                <THead>
                  <Th align="center" className="w-10">#</Th>
                  <Th>Title</Th>
                  <Th>Location</Th>
                  <Th align="center">Schedule</Th>
                  <Th align="center">Assigned</Th>
                  <Th align="right">Actions</Th>
                </THead>
                <tbody className="divide-y divide-white/5">
                  {paginated.map((v, index) => {
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr key={v.field_visit_id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-4 text-gray-500 text-center text-sm">{itemIndex}</td>

                        {/* Title — no wrapper div */}
                        <td className="px-4 py-4">
                          <p className="text-white font-medium">{v.title}</p>
                          {v.notes && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{v.notes}</p>}
                        </td>

                        {/* Location — no wrapper div with min-w */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <MapPin size={12} className="text-gray-500 opacity-50 shrink-0" />
                            <p className="text-gray-300 truncate max-w-[180px]">{v.location_name || "—"}</p>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <div className="text-[10px] text-gray-400 space-y-0.5">
                            <p>ST: {v.start_date ? new Date(v.start_date).toLocaleDateString() : "—"}</p>
                            <p>EN: {v.end_date ? new Date(v.end_date).toLocaleDateString() : "—"}</p>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-secondary-500/10 border border-secondary-500/10 text-[11px] text-secondary-500 font-medium">
                            {v.assigned_count ?? 0}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setViewAssignmentsId(v.field_visit_id); setViewAssignmentsOpen(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all" title="Reports">
                              <Users size={15} />
                            </button>
                            <button onClick={() => { setAssignVisitId(v.field_visit_id); setAssignOpen(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all" title="Assign">
                              <Plus size={15} />
                            </button>
                            {(v.assigned_count ?? 0) > 0 ? (
                              <button
                                onClick={() => toast(`This field visit is assigned to ${v.assigned_count} auditor${v.assigned_count === 1 ? "" : "s"} and cannot be deleted. Remove those assignments first.`, "warning")}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                title={`Assigned to ${v.assigned_count} auditor${v.assigned_count === 1 ? "" : "s"}. Click for details.`}>
                                <LockIcon size={15} />
                              </button>
                            ) : (
                              <button onClick={() => handleDelete(v.field_visit_id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((v, index) => {
              const itemIndex = (currentPage - 1) * pageSize + index + 1;
              return (
                <div key={v.field_visit_id} className="glass rounded-xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">#{itemIndex}</p>
                      <h3 className="text-sm font-semibold text-white truncate">{v.title}</h3>
                    </div>
                    <div className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shrink-0">
                      Scheduled
                    </div>
                  </div>
                  <div className="mt-3 bg-white/5 border border-white/10 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <MapPin size={12} className="text-gray-500" />
                      <p className="text-xs text-gray-300 font-medium truncate">{v.location_name || "Unknown"}</p>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-500" />
                        <p className="text-[10px] text-gray-400">
                          {v.start_date ? new Date(v.start_date).toLocaleDateString() : "-"} — {v.end_date ? new Date(v.end_date).toLocaleDateString() : "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-gray-500" />
                        <p className="text-[10px] text-secondary-400 font-bold">{v.assigned_count ?? 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 pt-3 border-t border-white/5">
                    <button onClick={() => { setViewAssignmentsId(v.field_visit_id); setViewAssignmentsOpen(true); }} className="p-2 rounded-lg text-gray-400 hover:text-blue-400"><Users size={15} /></button>
                    <button onClick={() => { setAssignVisitId(v.field_visit_id); setAssignOpen(true); }} className="p-2 rounded-lg text-gray-400 hover:text-green-400"><Plus size={15} /></button>
                    {(v.assigned_count ?? 0) > 0 ? (
                      <button onClick={() => toast(`This field visit is assigned to ${v.assigned_count} auditor${v.assigned_count === 1 ? "" : "s"} and cannot be deleted. Remove those assignments first.`, "warning")} className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title={`Assigned to ${v.assigned_count} auditor${v.assigned_count === 1 ? "" : "s"}. Tap for details.`}><LockIcon size={15} /></button>
                    ) : (
                      <button onClick={() => handleDelete(v.field_visit_id)} className="p-2 rounded-lg text-gray-400 hover:text-red-400"><Trash2 size={15} /></button>
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
        onAssign={async (codes, sendEmail) => {
          if (!accessToken || !assignVisitId) return false;
          const res = await auditFirmLearningApi.assignFieldVisit(accessToken, assignVisitId, codes, sendEmail);
          if (!res.success) { toast(res.message || "Failed to assign field visit.", "error"); return false; }
          toast(`Field visit assigned to ${codes.length} auditor${codes.length === 1 ? "" : "s"}.`, "success");
          await load();
          return true;
        }}
      />

      <ViewAssignmentsModal
        open={viewAssignmentsOpen}
        onClose={() => setViewAssignmentsOpen(false)}
        assignments={filteredAssignments}
        title={selectedVisit?.title || ""}
        onDelete={handleAssignmentDelete}
      />
    </div>
  );
}
