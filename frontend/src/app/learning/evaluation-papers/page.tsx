"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditFirmLearningApi, usersApi } from "@/lib/api";
import { Plus, RefreshCw, Trash2, Users, X, Trophy, AlertTriangle, CheckCircle2, Clock, Calendar, BookOpen, ClipboardList, Search } from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";

interface Paper {
  id: number;
  title: string;
  description?: string | null;
  time_limit_minutes?: number | null;
  pass_marks?: number | null;
  available_from?: string | null;
  available_to?: string | null;
  is_active?: number | boolean;
  question_count?: number;
  assigned_count?: number;
}

interface Assignment {
  assignment_id: number;
  assigned_at: string;
  due_date: string | null;
  assignment_status: "assigned" | "submitted";
  paper_id: number;
  paper_title: string;
  pass_marks: number | null;
  auditor_user_code: string;
  auditor_first_name: string;
  auditor_last_name: string;
  auditor_email: string;
  score: number | null;
  max_score: number | null;
  passed: number | boolean | null;
  submitted_at: string | null;
}

interface Auditor {
  user_code: string;
  first_name: string;
  last_name: string;
  email: string;
}

const inputClass = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all";

function AssignModal({
  open, onClose, onAssign, auditors,
}: {
  open: boolean; onClose: () => void; onAssign: (codes: string[], dueDate: string) => Promise<void>; auditors: Auditor[];
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCodes = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  useEffect(() => {
    if (!open) { setSelected({}); setDueDate(""); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Assign Evaluation Paper</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Due Date *</label>
            <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
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
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all">Cancel</button>
            <button
              onClick={async () => { setLoading(true); await onAssign(selectedCodes, dueDate); setLoading(false); onClose(); }}
              disabled={loading || selectedCodes.length === 0 || !dueDate}
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
  open, onClose, assignments, title,
}: {
  open: boolean; onClose: () => void; assignments: Assignment[]; title: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative glass rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Submissions</h2>
            <p className="text-xs text-gray-500 mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-white/5">
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-gray-400 font-medium w-12 text-center">#</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Auditor</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Status</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-center">Score</th>
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assignments.map((a, idx) => {
                  const isSubmitted = a.assignment_status === "submitted";
                  const isPassedFlag = a.passed === 1 || a.passed === true;
                  const percent = a.max_score ? Math.round(((a.score || 0) / a.max_score) * 100) : Math.round((a.score || 0) * 100);
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
                        {isSubmitted ? (
                          <div className="flex flex-col items-center">
                            <p className={`text-xs font-bold ${isPassed ? "text-green-400" : "text-red-400"}`}>{percent}%</p>
                            <p className="text-[10px] text-gray-500 uppercase">{isPassed ? "Passed" : "Failed"}</p>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-[10px] text-gray-400">Due: {a.due_date ? new Date(a.due_date).toLocaleDateString() : "—"}</p>
                        {a.submitted_at && <p className="text-[10px] text-blue-400 font-medium">Sub: {new Date(a.submitted_at).toLocaleDateString()}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-5 border-t border-white/10 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 transition-all">Close</button>
        </div>
      </div>
    </div>
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
  const [assignPaperId, setAssignPaperId] = useState<number | null>(null);
  const [viewAssignmentsId, setViewAssignmentsId] = useState<number | null>(null);
  const [viewAssignmentsOpen, setViewAssignmentsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedPaper = papers.find(p => p.id === viewAssignmentsId);
  const filteredAssignments = assignments.filter(a => a.paper_id === viewAssignmentsId);

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

  const handleDelete = async (id: number) => {
    if (!accessToken) return;
    const ok = await confirm({ title: "Delete Evaluation Paper", message: "Delete this evaluation paper?", confirmText: "Delete", variant: "warning" });
    if (!ok) return;
    const res = await auditFirmLearningApi.deleteEvaluationPaper(accessToken, id);
    if (res.success) { toast("Evaluation paper deleted successfully.", "success"); await load(); }
    else toast(res.message || "Failed to delete evaluation paper.", "error");
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
          <button onClick={load} className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all" title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => router.push("/learning/evaluation-papers/create")}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 shadow-lg shadow-secondary-500/10 transition-all active:scale-95">
            <Plus size={18} />
            <span className="hidden sm:block">New Paper</span>
            <span className="sm:hidden">Add</span>
          </button>
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
        <div className="glass rounded-xl p-20 text-center border border-white/5 text-gray-400 text-sm">
          No evaluation papers found. Create your first paper to evaluate auditors.
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <ClipboardList size={36} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No matching papers</p>
          <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Desktop Table — text-left on table, explicit overrides for centered/right cols */}
          <div className="glass rounded-xl overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-gray-400 font-medium w-10 text-center">#</th>
                    <th className="px-4 py-3 text-gray-400 font-medium">Paper Name</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-center w-24">Questions</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-center w-24">Pass %</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-center w-24">Time</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-center w-20">Assigned</th>
                    <th className="px-4 py-3 text-gray-400 font-medium text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginated.map((p, index) => {
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
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
                            <button onClick={() => { setViewAssignmentsId(p.id); setViewAssignmentsOpen(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Submissions">
                              <Trophy size={15} />
                            </button>
                            <button onClick={() => { setAssignPaperId(p.id); setAssignOpen(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-all" title="Assign">
                              <Plus size={15} />
                            </button>
                            <button onClick={() => handleDelete(p.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((p, index) => {
              const itemIndex = (currentPage - 1) * pageSize + index + 1;
              return (
                <div key={p.id} className="glass rounded-xl border border-white/10 p-4">
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
                    <button onClick={() => { setViewAssignmentsId(p.id); setViewAssignmentsOpen(true); }} className="p-2 rounded-lg text-gray-400 hover:text-blue-400"><Trophy size={15} /></button>
                    <button onClick={() => { setAssignPaperId(p.id); setAssignOpen(true); }} className="p-2 rounded-lg text-gray-400 hover:text-green-400"><Plus size={15} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-400"><Trash2 size={15} /></button>
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
        onAssign={async (codes, dueDate) => {
          if (!accessToken || !assignPaperId) return;
          await auditFirmLearningApi.assignEvaluationPaper(accessToken, assignPaperId, codes, dueDate || undefined);
          await load();
        }}
      />

      <ViewAssignmentsModal
        open={viewAssignmentsOpen}
        onClose={() => setViewAssignmentsOpen(false)}
        assignments={filteredAssignments}
        title={selectedPaper?.title || ""}
      />
    </div>
  );
}