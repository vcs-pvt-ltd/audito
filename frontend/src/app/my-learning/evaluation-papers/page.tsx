"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { myLearningApi } from "@/lib/api";
import { ArrowRight, ClipboardList, RefreshCw, Search } from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";

interface MyPaper {
  assignment_id: number;
  assignment_status: "assigned" | "submitted";
  assigned_at: string;
  due_date?: string | null;
  paper_id: number;
  title: string;
  description?: string | null;
  time_limit_minutes?: number | null;
  pass_marks?: number | null;
  question_count?: number;
  last_submitted_at?: string | null;
  last_score?: number | null;
  last_max_score?: number | null;
}

export default function MyEvaluationPapersPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<MyPaper[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await myLearningApi.myEvaluationPapers(accessToken);
    if (res.success && res.data) {
      const d = res.data as any;
      // Ensure `assignment_status` exists (backend may return `status`)
      const papers = (d.papers || []).map((p: any) => ({
        ...p,
        assignment_status: p.assignment_status ?? p.status ?? null,
      }));
      setItems(papers);
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
    if (!query) return items;
    return items.filter(p => p.title.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
  }, [items, searchQuery]);

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

  if (admin.role !== "auditor") {
    return (
      <div className="p-6 pt-20 lg:pt-8 text-gray-300">
        Only auditors can access this page.
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary-500/10 flex items-center justify-center border border-secondary-500/20">
            <ClipboardList size={20} className="text-secondary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Evaluation Papers</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage and attempt your assigned evaluation papers</p>
          </div>
        </div>
        <button 
          onClick={load}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Search Bar */}
      {!loading && items.length > 0 && (
        <div className="mb-6 max-w-lg">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-white/[0.06]">
            <Search size={14} className="text-gray-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evaluation papers..."
              className="bg-transparent outline-none text-sm text-gray-200 placeholder:text-gray-600 w-full"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center border border-white/5">
          <ClipboardList size={40} className="mx-auto text-gray-600 mb-4 opacity-20" />
          <p className="text-gray-400 font-medium">No evaluation papers assigned.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <ClipboardList size={36} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No matching papers</p>
          <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block glass rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500 w-[50%]">Paper Details</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500 text-center w-24">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500 text-center w-20">Questions</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500 text-center w-28">Result</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500 text-right w-32">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginated.map((p) => {
                  const hasScore = p.last_score !== null && p.last_score !== undefined;
                  return (
                    <tr key={p.assignment_id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-6 py-5">
                        <p className="text-sm font-bold text-white group-hover:text-secondary-400 transition-colors tracking-tight">{p.title}</p>
                        {p.due_date && (
                          <p className="text-[10px] text-gray-500 mt-1">Due: {new Date(p.due_date).toLocaleDateString()}</p>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider border ${
                          p.assignment_status === 'submitted' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {p.assignment_status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-sm font-mono text-gray-400">{p.question_count ?? 0}</span>
                      </td>
                      <td className="px-6 py-5 text-center">
                         {hasScore ? (
                           <div className="flex flex-col items-center">
                              {p.last_max_score ? (
                               <span className="text-sm font-black text-secondary-400">{Math.round(((p.last_score || 0) / (p.last_max_score || 1)) * 100)}%</span>
                             ) : (
                               <span className="text-sm font-black text-secondary-400">{Math.round((p.last_score || 0) * 100)}%</span>
                             )}
                               {p.pass_marks != null && p.last_max_score ? (
                               <span className={`text-[9px] font-bold mt-0.5 ${(Math.round((p.last_score || 0) / p.last_max_score * 100) >= Number(p.pass_marks) ? "text-emerald-500" : "text-red-500")}`}>
                                 {Math.round((p.last_score || 0) / p.last_max_score * 100) >= Number(p.pass_marks) ? "Passed" : "Failed"}
                               </span>
                             ) : null}
                           </div>
                         ) : (
                           <span className="text-[10px] text-gray-600 font-bold">N/A</span>
                         )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        {p.assignment_status === "submitted" ? (
                          <span className="text-xs font-bold text-gray-600 tracking-widest px-4 py-2">Completed</span>
                        ) : (
                          <button
                            onClick={() => router.push(`/my-learning/evaluation-papers/details?id=${p.paper_id}`)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wider bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all shadow-lg shadow-secondary-500/10 active:translate-y-0.5"
                          >
                            Start <ArrowRight size={14} strokeWidth={3} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {paginated.map((p) => {
              const hasScore = p.last_score !== null && p.last_score !== undefined;
              return (
                <div key={p.assignment_id} className="glass rounded-2xl p-5 border border-white/10 active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-white tracking-tight line-clamp-2">{p.title}</h3>
                      <p className="text-[10px] text-gray-500 mt-1 font-bold tracking-wider">
                        {p.question_count ?? 0} Questions • {p.time_limit_minutes ?? 'No'} Time Limit
                      </p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-black tracking-widest px-2 py-1 rounded-full border ${
                      p.assignment_status === 'submitted' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {p.assignment_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5 mb-4">
                    <div>
                      <p className="text-[9px] text-gray-600 font-black tracking-wider mb-1">Due Date</p>
                      <p className="text-xs text-gray-300 font-bold">{p.due_date ? new Date(p.due_date).toLocaleDateString() : "No Deadline"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-600 font-black tracking-wider mb-1">Last Score</p>
                      <p className="text-xs font-black">
                        {hasScore ? (
                              <span className="text-secondary-400">{p.last_max_score ? Math.round(((p.last_score || 0) / (p.last_max_score || 1)) * 100) + '%' : Math.round((p.last_score || 0) * 100) + '%'}</span>
                        ) : <span className="text-gray-600">N/A</span>}
                      </p>
                    </div>
                  </div>

                  {p.assignment_status === "submitted" ? (
                    <div className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-center text-xs font-black text-gray-500 tracking-widest">
                      Completed
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push(`/my-learning/evaluation-papers/details?id=${p.paper_id}`)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary-500 text-primary-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-secondary-500/20 active:translate-y-0.5"
                    >
                      Start Attempt <ArrowRight size={16} strokeWidth={3} />
                    </button>
                  )}
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
    </div>
  );
}
