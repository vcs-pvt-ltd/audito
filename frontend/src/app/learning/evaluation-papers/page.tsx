"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import LimitReachedModal from "@/components/modals/LimitReachedModal";
import { auditFirmLearningApi, usersApi } from "@/lib/api";
import { Plus, RefreshCw, Trash2, Trophy, Clock, ClipboardList, Search, Crown, Lock as LockIcon, Building2 } from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Button, IconButton, Modal, Table, THead, Th, Input } from "@/components/ui";

interface Paper {
  id: number;
  evaluation_paper_id: string;
  title: string;
  description?: string | null;
  time_limit_minutes?: number | null;
  pass_marks?: number | null;
  available_from?: string | null;
  available_to?: string | null;
  is_active?: number | boolean;
  question_count?: number;
  assigned_count?: number;
  entity_name?: string | null;
}

interface Assignment {
  assignment_id: string;
  assigned_at: string;
  due_date: string | null;
  assignment_status: "assigned" | "submitted";
  paper_id: string;
  paper_title: string;
  pass_marks: number | null;
  auditor_user_code: string;
  auditor_first_name: string;
  auditor_last_name: string;
  auditor_email: string;
  score: number | string | null;
  max_score: number | string | null;
  passed: number | boolean | string | null;
  submitted_at: string | null;
}

interface Auditor {
  user_code: string;
  first_name: string;
  last_name: string;
  email: string;
}

function AssignModal({
  open, onClose, onAssign, auditors,
}: {
  open: boolean; onClose: () => void; onAssign: (codes: string[], dueDate: string, sendEmail: boolean) => Promise<boolean>; auditors: Auditor[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dueDate, setDueDate] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const selectedCodes = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  useEffect(() => {
    if (!open) { setSelected({}); setDueDate(""); setSendEmail(true); }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} size="md" title="Assign Evaluation Paper">
      <div className="space-y-4">
        <Input label="Due Date" required type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Select Auditors</p>
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
            disabled={selectedCodes.length === 0 || !dueDate}
            onClick={async () => { setLoading(true); const assigned = await onAssign(selectedCodes, dueDate, sendEmail); setLoading(false); if (assigned) onClose(); }}
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
      size="xl"
      title="Submissions"
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
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Score</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Activity</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assignments.map((a, idx) => {
                  const isSubmitted = a.assignment_status === "submitted";
                  const isPassedFlag = a.passed === 1 || a.passed === true || a.passed === "1";
                  const scoreNum = a.score != null ? Number(a.score) : null;
                  const maxScoreNum = a.max_score != null ? Number(a.max_score) : null;
                  const percent = maxScoreNum && maxScoreNum > 0 && scoreNum != null ? Math.round((scoreNum / maxScoreNum) * 100) : 0;
                  const isPassed = a.pass_marks != null ? percent >= Number(a.pass_marks) : isPassedFlag;
                  return (
                    <tr key={a.assignment_id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-4 text-gray-500 text-center">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <p className="text-white font-medium">{a.auditor_first_name} {a.auditor_last_name}</p>
                        <p className="text-xs text-gray-500">{a.auditor_email}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${isSubmitted ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                          {isSubmitted ? "Submitted" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {isSubmitted && scoreNum != null && maxScoreNum && maxScoreNum > 0 ? (
                          <div className="flex flex-col items-center">
                            <p className={`text-xs font-bold ${isPassed ? "text-green-400" : "text-red-400"}`}>{percent}%</p>
                            <p className="text-[10px] text-gray-500">{isPassed ? "Passed" : "Failed"}</p>
                          </div>
                        ) : isSubmitted ? (
                          <span className="text-xs text-gray-500">—</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-[10px] text-gray-400">Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</p>
                        {a.submitted_at && <p className="text-[10px] text-blue-400 font-medium">Sub: {new Date(a.submitted_at).toLocaleDateString()}</p>}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isSubmitted ? <span className="text-[10px] text-gray-500">Locked</span> : (
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

export default function AuditFirmEvaluationPapersPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [assignPaperId, setAssignPaperId] = useState<string | null>(null);
  const [viewAssignmentsId, setViewAssignmentsId] = useState<string | null>(null);
  const [viewAssignmentsOpen, setViewAssignmentsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedPaper = papers.find(p => p.evaluation_paper_id === viewAssignmentsId);
  const filteredAssignments = assignments.filter(a => String(a.paper_id) === viewAssignmentsId);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    const [pRes, uRes] = await Promise.all([
      auditFirmLearningApi.listEvaluationPapers(accessToken),
      usersApi.list(accessToken, "Auditor"),
    ]);
    if (pRes.success && pRes.data) {
      const d = pRes.data as any;
      setPapers(d.papers || []);
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
    if (!query) return papers;
    return papers.filter(p => p.title.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
  }, [papers, searchQuery]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (isLoading || !admin) return null;

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    const ok = await confirm({ title: "Delete Evaluation Paper", message: "Delete this evaluation paper?", confirmText: "Delete", variant: "warning" });
    if (!ok) return;
    const res = await auditFirmLearningApi.deleteEvaluationPaper(accessToken, id);
    if (res.success) { toast("Evaluation paper deleted successfully.", "success"); await load(); }
    else toast(res.message || "Failed to delete evaluation paper.", "error");
  };

  const handleAssignmentDelete = async (assignment: Assignment) => {
    if (!accessToken || !viewAssignmentsId || assignment.assignment_status !== "assigned") return;
    const ok = await confirm({ title: "Remove Assignment", message: `Remove the pending evaluation paper assignment for ${assignment.auditor_first_name} ${assignment.auditor_last_name}?`, confirmText: "Remove", variant: "warning" });
    if (!ok) return;
    const res = await auditFirmLearningApi.deleteEvaluationAssignment(accessToken, viewAssignmentsId, assignment.assignment_id);
    if (res.success) { toast("Pending evaluation paper assignment removed.", "success"); await load(); }
    else toast(res.message || "Failed to remove evaluation paper assignment.", "error");
  };

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList size={22} className="text-secondary-400" />
            Evaluation Papers
          </h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-0.5">Manage assessments and track auditor knowledge scores.</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton bordered size="lg" onClick={load} title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </IconButton>
          <Button
            className="active:scale-95"
            leftIcon={admin?.plan_limits && !admin.plan_limits.auditor_eval ? <Crown size={18} /> : <Plus size={18} />}
            onClick={() => {
              if (admin?.plan_limits && !admin.plan_limits.auditor_eval) {
                setLimitModalOpen(true);
                return;
              }
              router.push("/learning/evaluation-papers/create");
            }}
          >
            <span className="hidden sm:block">{admin?.plan_limits && !admin.plan_limits.auditor_eval ? "Upgrade" : "New Paper"}</span>
            <span className="sm:hidden">{admin?.plan_limits && !admin.plan_limits.auditor_eval ? "Upgrade" : "Add"}</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      {!loading && papers.length > 0 && (
        <div className="mb-6 max-w-lg">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-white/[0.06]">
            <Search size={14} className="text-gray-500" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search papers..."
              className="bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 w-full" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : papers.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No evaluation papers yet"
          message="Create your first paper to assess auditors and track their knowledge scores."
          action={(
            <Button
              leftIcon={admin?.plan_limits && !admin.plan_limits.auditor_eval ? <Crown size={16} /> : <Plus size={16} />}
              onClick={() => {
                if (admin?.plan_limits && !admin.plan_limits.auditor_eval) { setLimitModalOpen(true); return; }
                router.push("/learning/evaluation-papers/create");
              }}
            >
              {admin?.plan_limits && !admin.plan_limits.auditor_eval ? "Upgrade" : "New Paper"}
            </Button>
          )}
        />
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <ClipboardList size={36} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No matching papers</p>
          <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Desktop Table — text-left on table, explicit overrides for centered/right cols */}
          <div className="hidden md:block">
            <Table className="text-left">
                <THead>
                  <Th align="center" className="w-10">#</Th>
                  <Th>Paper Name</Th>
                  <Th align="center" className="w-24">Questions</Th>
                  <Th align="center" className="w-24">Pass %</Th>
                  <Th align="center" className="w-24">Time</Th>
                  <Th align="center" className="w-20">Assigned</Th>
                  <Th align="right" className="w-28">Actions</Th>
                </THead>
                <tbody className="divide-y divide-white/5">
                  {paginated.map((p, index) => {
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr key={p.evaluation_paper_id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-4 py-4 text-gray-500 text-center">{itemIndex}</td>

                        {/* Paper Name — no wrapper div */}
                        <td className="px-4 py-4">
                          <p className="text-white font-medium">{p.title}</p>
                        </td>

                       

                        <td className="px-4 py-4 text-center text-gray-400">{p.question_count ?? 0}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-secondary-400 font-bold">{p.pass_marks ?? 0}%</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                            <Clock size={12} className="opacity-50" />
                            {p.time_limit_minutes ? `${p.time_limit_minutes}m` : "∞"}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-secondary-500/10 border border-secondary-500/10 text-[11px] text-secondary-500 font-medium">
                            {p.assigned_count ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setViewAssignmentsId(p.evaluation_paper_id); setViewAssignmentsOpen(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Submissions">
                              <Trophy size={15} />
                            </button>
                            <button onClick={() => { setAssignPaperId(p.evaluation_paper_id); setAssignOpen(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all" title="Assign">
                              <Plus size={15} />
                            </button>
                            {(p.assigned_count ?? 0) > 0 ? (
                              <button
                                onClick={() => toast(`This evaluation paper is assigned to ${p.assigned_count} auditor${p.assigned_count === 1 ? "" : "s"} and cannot be deleted. Remove those assignments first.`, "warning")}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                title={`Assigned to ${p.assigned_count} auditor${p.assigned_count === 1 ? "" : "s"}. Click for details.`}>
                                <LockIcon size={15} />
                              </button>
                            ) : (
                              <button onClick={() => handleDelete(p.evaluation_paper_id)}
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
            {paginated.map((p, index) => {
              const itemIndex = (currentPage - 1) * pageSize + index + 1;
              return (
                <div key={p.evaluation_paper_id} className="glass rounded-xl border border-white/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">#{itemIndex}</p>
                      <h3 className="text-sm font-semibold text-white truncate">{p.title}</h3>
                    </div>
                    <Trophy size={16} className="text-secondary-400 opacity-50 shrink-0" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2 py-1.5 text-center">
                      <p className="text-gray-500 text-[10px]">Pass Mark</p>
                      <p className="text-secondary-400 font-bold">{p.pass_marks ?? 0}%</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2 py-1.5 text-center">
                      <p className="text-gray-500 text-[10px]">Questions</p>
                      <p className="text-white">{p.question_count ?? 0}</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2 py-1.5 text-center">
                      <p className="text-gray-500 text-[10px]">Assigned</p>
                      <p className="text-blue-400">{p.assigned_count ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 pt-3 border-t border-white/5">
                    <button onClick={() => { setViewAssignmentsId(p.evaluation_paper_id); setViewAssignmentsOpen(true); }} className="p-2 rounded-lg text-gray-400 hover:text-blue-400"><Trophy size={15} /></button>
                    <button onClick={() => { setAssignPaperId(p.evaluation_paper_id); setAssignOpen(true); }} className="p-2 rounded-lg text-gray-400 hover:text-green-400"><Plus size={15} /></button>
                    {(p.assigned_count ?? 0) > 0 ? (
                      <button onClick={() => toast(`This evaluation paper is assigned to ${p.assigned_count} auditor${p.assigned_count === 1 ? "" : "s"} and cannot be deleted. Remove those assignments first.`, "warning")} className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title={`Assigned to ${p.assigned_count} auditor${p.assigned_count === 1 ? "" : "s"}. Tap for details.`}><LockIcon size={15} /></button>
                    ) : (
                      <button onClick={() => handleDelete(p.evaluation_paper_id)} className="p-2 rounded-lg text-gray-400 hover:text-red-400"><Trash2 size={15} /></button>
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
        onAssign={async (codes, dueDate, sendEmail) => {
          if (!accessToken || !assignPaperId) return false;
          const res = await auditFirmLearningApi.assignEvaluationPaper(accessToken, assignPaperId, codes, dueDate || undefined, sendEmail);
          if (!res.success) { toast(res.message || "Failed to assign evaluation paper.", "error"); return false; }
          toast(`Evaluation paper assigned to ${codes.length} auditor${codes.length === 1 ? "" : "s"}.`, "success");
          await load();
          return true;
        }}
      />

      <ViewAssignmentsModal
        open={viewAssignmentsOpen}
        onClose={() => setViewAssignmentsOpen(false)}
        assignments={filteredAssignments}
        title={selectedPaper?.title || ""}
        onDelete={handleAssignmentDelete}
      />

      <LimitReachedModal
        isOpen={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        title="Auditor Evaluation Disabled"
        message="Your current plan does not allow the Auditor Evaluation System. Upgrade your subscription to create evaluation papers."
        limit={0}
      />
    </div>
  );
}
