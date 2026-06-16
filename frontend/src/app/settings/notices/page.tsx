"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { settingsApi } from "@/lib/api";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import {
  Bell,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Mail,
  AlertCircle,
  X,
  Filter,
  Send,
  BookOpen,
} from "lucide-react";

interface AuditorOption {
  id: number;
  user_code: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface NoticeItem {
  id: number;
  title: string;
  message: string;
  notice_date: string;
  assign_to_all: boolean;
  assigned_count: number;
  assigned_auditor_codes: string[];
}

function AddNoticeModal({
  open,
  onClose,
  onSave,
  auditors,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; message: string; notice_date: string; assign_to_all: boolean; auditor_codes: string[] }) => Promise<void>;
  auditors: AuditorOption[];
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [noticeDate, setNoticeDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignToAll, setAssignToAll] = useState(true);
  const [selectedAuditors, setSelectedAuditors] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setMessage("");
      setNoticeDate(new Date().toISOString().slice(0, 10));
      setAssignToAll(true);
      setSelectedAuditors([]);
      setSearchTerm("");
    }
  }, [open]);

  if (!open) return null;

  const filteredAuditors = auditors.filter(auditor =>
    auditor.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auditor.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auditor.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleAuditor = (code: string) => {
    setSelectedAuditors(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass border border-white/10 rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-secondary-400" />
            <h2 className="text-lg font-semibold text-white">Create New Notice</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
           <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">Notice Title <span className="text-secondary-400">*</span></label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-secondary-500/50 outline-none transition-all font-sans"
                placeholder="Announcement Title"
              />
           </div>

           <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium">Message <span className="text-secondary-400">*</span></label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-secondary-500/50 outline-none transition-all font-sans resize-none"
                placeholder="Describe the notice context..."
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs text-gray-400 mb-2 font-medium">Release Date</label>
                 <input
                   type="date"
                   value={noticeDate}
                   onChange={(e) => setNoticeDate(e.target.value)}
                   className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-secondary-500/50 outline-none transition-all font-mono"
                 />
              </div>
              <div className="flex flex-col justify-end">
                 <label className="flex items-center gap-2 p-3.5 rounded-xl border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-all select-none">
                    <input
                      type="checkbox"
                      checked={assignToAll}
                      onChange={(e) => setAssignToAll(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10 bg-black/20 text-secondary-500 focus:ring-0"
                    />
                    <span className="text-xs font-medium text-gray-400">Assign to all auditors</span>
                 </label>
              </div>
           </div>

           {!assignToAll && (
              <div className="space-y-3">
                 <div className="relative">
                    <input
                      type="text"
                      placeholder="Search auditors..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none"
                    />
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                 </div>

                 <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-white/5 bg-white/5 p-2 pr-1">
                    {filteredAuditors.map(a => (
                       <label key={a.user_code} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/5 cursor-pointer transition-all group">
                          <div className="min-w-0">
                             <p className="text-xs font-medium text-white group-hover:text-secondary-400 transition-colors">{a.first_name} {a.last_name}</p>
                             <p className="text-[9px] text-gray-500 truncate">{a.email}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedAuditors.includes(a.user_code)}
                            onChange={() => toggleAuditor(a.user_code)}
                            className="w-4 h-4 rounded border-white/10 bg-black/20 text-secondary-500 focus:ring-0"
                          />
                       </label>
                    ))}
                    {filteredAuditors.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No matches found</p>}
                 </div>
              </div>
           )}
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            disabled={saving || !title.trim() || !message.trim() || (!assignToAll && selectedAuditors.length === 0)}
            onClick={async () => {
              setSaving(true);
              await onSave({ title, message, notice_date: noticeDate, assign_to_all: assignToAll, auditor_codes: selectedAuditors });
              setSaving(false);
              onClose();
            }}
            className="px-6 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50 transition-all shadow-lg shadow-secondary-500/10"
          >
            {saving ? "Publishing..." : "Publish Notice"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewNoticeAssignmentsModal({
  open,
  onClose,
  notice,
  allAuditors,
}: {
  open: boolean;
  onClose: () => void;
  notice: NoticeItem | null;
  allAuditors: AuditorOption[];
}) {
  if (!open || !notice) return null;

  const assigned = notice.assign_to_all 
    ? allAuditors 
    : allAuditors.filter(a => notice.assigned_auditor_codes.includes(a.user_code));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl glass border border-white/10 rounded-2xl p-6 shadow-2xl shadow-secondary-500/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-500/10 flex items-center justify-center border border-secondary-500/20">
              <Users size={20} className="text-secondary-400" />
            </div>
            <div>
              <h2 className="text-white font-bold uppercase tracking-tight">Active Recipients</h2>
              <p className="text-[10px] text-gray-500 mt-0.5 font-bold uppercase tracking-widest">{notice.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-hidden border border-white/5 rounded-xl">
          <div className="max-h-[50vh] overflow-auto">
            {assigned.length === 0 ? (
              <div className="py-16 text-center">
                 <Mail size={40} className="mx-auto text-gray-700 opacity-20 mb-3" />
                 <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No auditors assigned</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="bg-white/[0.03] sticky top-0 z-10 font-mono italic">
                  <tr className="border-b border-white/10 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    <th className="px-5 py-3 w-12 text-center">#</th>
                    <th className="px-5 py-3">Auditor Detail</th>
                    <th className="px-5 py-3 text-right">Identifier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {assigned.map((a, idx) => (
                    <tr key={a.user_code} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 text-gray-600 font-mono text-center">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <p className="text-white font-bold text-xs uppercase tracking-tight">{a.first_name} {a.last_name}</p>
                        <p className="text-[10px] text-gray-500 font-mono italic mt-0.5">{a.email}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-[10px] font-black text-secondary-500/60 font-mono tracking-tighter">{a.user_code}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
           <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 transition-all font-mono"
          >
            Collapse
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsNoticesPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();

  const [auditors, setAuditors] = useState<AuditorOption[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);

  const fetchData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [auditorsRes, noticesRes] = await Promise.all([
        settingsApi.listNoticeAuditors(accessToken),
        settingsApi.getNotices(accessToken),
      ]);
      if (auditorsRes.success && auditorsRes.data) {
        setAuditors((auditorsRes.data as { auditors: AuditorOption[] }).auditors || []);
      }
      if (noticesRes.success && noticesRes.data) {
        setNotices((noticesRes.data as { notices: NoticeItem[] }).notices || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
    if (!isLoading && admin && admin.role !== "admin") router.push("/dashboard");
  }, [isLoading, admin, router]);

  useEffect(() => {
    if (accessToken) fetchData();
  }, [accessToken]);

  const handleSave = async (data: any) => {
    if (!accessToken) return;
    const res = await settingsApi.createNotice(accessToken, data);
    if (res.success) {
      await fetchData();
    }
  };

  const handleDelete = async (id: number) => {
    if (!accessToken) return;
    const ok = await confirm({
      title: "Delete Notice",
      message: "Permanently delete this notice?",
      confirmText: "Delete",
      variant: "warning",
    });
    if (!ok) return;
    const res = await settingsApi.deleteNotice(accessToken, id);
    if (res.success) {
      toast("Notice deleted.", "success");
      await fetchData();
    } else {
      toast(res.message || "Failed to delete notice.", "error");
    }
  };

  const currentNotice = notices.find(n => n.id === viewId) || null;

  if (isLoading || !admin) return null;

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell size={24} className="text-secondary-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]" />
            Auditor Notices
          </h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-2">Broadcast announcements and updates to auditors</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all shadow-lg shadow-secondary-500/10"
          >
            <Plus size={16} />
            <span className="hidden sm:block">Publish Notice</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notices.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center border border-white/5">
             <div className="w-16 h-16 rounded-2xl bg-secondary-500/10 flex items-center justify-center mx-auto mb-4">
               <Bell size={32} className="text-gray-600" />
            </div>
            <p className="text-white font-semibold text-lg mb-2">No Active Notices</p>
            <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">Create and send announcements to your auditors.</p>
             <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
            >
              <Plus size={16} />
              Create Notice
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="glass rounded-xl overflow-hidden hidden md:block border border-white/10 shadow-2xl">
              <table className="w-full text-left font-sans text-sm">
                <thead className="bg-white/[0.03]">
                  <tr className="border-b border-white/10 text-gray-400 font-medium text-xs">
                    <th className="px-5 py-4 w-12 text-center">#</th>
                    <th className="px-5 py-4">Title</th>
                    <th className="px-5 py-4 text-center">Scope</th>
                    <th className="px-5 py-4 text-center">Released</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {notices.map((n, idx) => (
                    <tr key={n.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-5 py-5 text-gray-600 text-center font-mono text-[11px]">{n.id}</td>
                      <td className="px-5 py-5">
                        <div className="min-w-[250px]">
                           <h3 className="text-sm font-semibold text-white group-hover:text-secondary-400 transition-colors">{n.title}</h3>
                           <p className="text-xs text-gray-400 line-clamp-1 mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-center">
                         {n.assign_to_all ? (
                            <span className="text-xs font-medium text-indigo-300 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">All Auditors</span>
                         ) : (
                            <span className="text-xs font-medium text-amber-300 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20">Selective</span>
                         )}
                      </td>
                      <td className="px-5 py-5 text-center">
                         <span className="text-xs text-gray-400">{new Date(n.notice_date).toLocaleDateString()}</span>
                      </td>
                      <td className="px-5 py-5 text-right font-sans">
                        <div className="flex items-center gap-2 justify-end">
                           <button
                             onClick={() => setViewId(n.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary-300 hover:text-secondary-200 hover:bg-secondary-500/10 border border-secondary-500/20 transition-all"
                           >
                              {n.assign_to_all ? "Auditors" : `${n.assigned_count} Assigned`}
                           </button>
                           <button
                             onClick={() => handleDelete(n.id)}
                              className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all"
                            >
                              <Trash2 size={14} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
               {notices.map((n) => (
                  <div key={n.id} className="glass rounded-xl border border-white/10 p-4 space-y-4 shadow-xl relative overflow-hidden">
                     <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                           <p className="text-xs text-gray-500">{new Date(n.notice_date).toLocaleDateString()}</p>
                           <h3 className="text-sm font-semibold text-white mt-0.5 line-clamp-1">{n.title}</h3>
                        </div>
                        <div className={`text-xs font-medium px-2 py-1 rounded border ${n.assign_to_all ? 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
                           {n.assign_to_all ? 'All Auditors' : 'Selective'}
                        </div>
                     </div>

                     <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">{n.message}</p>

                     <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/5">
                        <button
                          onClick={() => setViewId(n.id)}
                          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-secondary-300 hover:text-secondary-200 hover:bg-secondary-500/10 border border-secondary-500/20 transition-all"
                        >
                           {n.assign_to_all ? "Auditors" : `${n.assigned_count} Assigned`}
                        </button>
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="p-2 rounded-lg text-gray-500 hover:text-red-400 transition-colors border border-white/10"
                        >
                           <Trash2 size={14} />
                        </button>
                     </div>
                  </div>
               ))}
            </div>
          </>
        )}
      </div>

      <AddNoticeModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleSave}
        auditors={auditors}
      />

      <ViewNoticeAssignmentsModal
        open={!!viewId}
        onClose={() => setViewId(null)}
        notice={currentNotice}
        allAuditors={auditors}
      />
    </div>
  );
}
