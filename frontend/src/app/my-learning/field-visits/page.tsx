"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { myLearningApi } from "@/lib/api";
import { ArrowRight, Check, MapPin, RefreshCw, Search } from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";

interface MyFieldVisit {
  assignment_id: number;
  status: "assigned" | "completed";
  assigned_at: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  field_visit_id: number;
  title: string;
  location_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export default function MyFieldVisitsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<MyFieldVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Record<number, boolean>>({});

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
    const res = await myLearningApi.myFieldVisits(accessToken);
    if (res.success && res.data) {
      const d = res.data as any;
      // Normalize backend field `assignment_status` to `status` expected by UI
      const visits = (d.field_visits || []).map((v: any) => ({
        ...v,
        status: v.status ?? v.assignment_status ?? null,
      }));
      setItems(visits);
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
    return items.filter(v =>
      v.title.toLowerCase().includes(query) ||
      v.location_name?.toLowerCase().includes(query) ||
      v.address?.toLowerCase().includes(query) ||
      v.notes?.toLowerCase().includes(query)
    );
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
            <MapPin size={20} className="text-secondary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Field Visits</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track and complete your assigned field visits</p>
          </div>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all shadow-sm active:scale-95"
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
              placeholder="Search field visits..."
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
          <MapPin size={40} className="mx-auto text-gray-600 mb-4 opacity-20" />
          <p className="text-gray-400 font-medium">No field visits assigned.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center">
          <MapPin size={36} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">No matching visits</p>
          <p className="text-gray-400 text-sm">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden lg:block glass rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500">Visit Info</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500">Location</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500 text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500">Schedule</th>
                  <th className="px-6 py-4 text-[10px] font-black tracking-widest text-gray-500 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginated.map((v) => (
                  <tr key={v.assignment_id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-white tracking-tight">{v.title}</p>
                      {v.notes && <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{v.notes}</p>}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-secondary-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-300 font-medium truncate">{v.location_name || "—"}</p>
                          <p className="text-[10px] text-gray-500 truncate">{v.address || "No address provided"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider border ${v.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                        {v.status ? (v.status.charAt(0).toUpperCase() + v.status.slice(1)) : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-[10px] text-gray-300 font-bold">Starts: {v.start_date ? new Date(v.start_date).toLocaleDateString() : "—"}</p>
                      <p className="text-[10px] text-gray-500 mt-1 font-medium italic">Ends: {v.end_date ? new Date(v.end_date).toLocaleDateString() : "—"}</p>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={async () => {
                          if (!accessToken) return;
                          setCompleting((p) => ({ ...p, [v.assignment_id]: true }));
                          try {
                            await myLearningApi.completeFieldVisit(accessToken, v.assignment_id);
                            await load();
                          } finally {
                            setCompleting((p) => { const np = { ...p }; delete np[v.assignment_id]; return np; });
                          }
                        }}
                        disabled={v.status === "completed" || !!completing[v.assignment_id]}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-wider bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg active:translate-y-0.5"
                      >
                        {v.status === "completed" ? "Completed" : (completing[v.assignment_id] ? "Completing..." : "Complete")} <Check size={14} strokeWidth={3} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {paginated.map((v) => (
              <div key={v.assignment_id} className="glass rounded-2xl p-5 border border-white/10 active:scale-[0.98] transition-all">
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white tracking-tight truncate">{v.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin size={10} className="text-secondary-400" />
                      <p className="text-[10px] text-gray-500 font-bold tracking-wider truncate">{v.location_name}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-black tracking-widest px-2 py-1 rounded-full border ${v.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                    {v.status ? (v.status.charAt(0).toUpperCase() + v.status.slice(1)) : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5 mb-4">
                  <div>
                    <p className="text-[9px] text-gray-600 font-black tracking-wider mb-1">Start Date</p>
                    <p className="text-xs text-gray-300 font-bold">{v.start_date ? new Date(v.start_date).toLocaleDateString() : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-600 font-black tracking-wider mb-1">End Date</p>
                    <p className="text-xs text-gray-300 font-bold">{v.end_date ? new Date(v.end_date).toLocaleDateString() : "—"}</p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!accessToken) return;
                    setCompleting((p) => ({ ...p, [v.assignment_id]: true }));
                    try {
                      await myLearningApi.completeFieldVisit(accessToken, v.assignment_id);
                      await load();
                    } finally {
                      setCompleting((p) => { const np = { ...p }; delete np[v.assignment_id]; return np; });
                    }
                  }}
                  disabled={v.status === "completed" || !!completing[v.assignment_id]}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary-500 text-primary-950 font-black text-xs tracking-wider shadow-xl shadow-secondary-500/20 active:translate-y-0.5 disabled:opacity-30"
                >
                  {v.status === "completed" ? "Visit Completed" : (completing[v.assignment_id] ? "Completing..." : "Mark as Completed")} <Check size={16} strokeWidth={3} />
                </button>
              </div>
            ))}
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
