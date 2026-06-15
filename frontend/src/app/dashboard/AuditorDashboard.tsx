"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileCheck, TrendingUp, CheckCircle2, ClipboardCheck, AlertTriangle,
  Clock, Bell, ArrowRight, Building2, ShieldCheck, Play, MapPin, BookOpen, LucideIcon
} from "lucide-react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { myLearningApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/* ─── Types & Interfaces ────────────────────────────────────────── */

type AuditStatus = "plan" | "in_progress" | "completed";

interface DashboardAudit {
  id: number;
  audit_code: string;
  title: string;
  audit_type: string;
  status: AuditStatus;
  start_date: string | null;
  end_date: string | null;
  checklist_name?: string | null;
  entity_count: number;
  progress_pct: number;
  score_pct: number;
}

interface Notice {
  id: number;
  title: string;
  message: string;
  notice_date: string;
}

export interface DashboardOverview {
  summaries: {
    audits: Record<string, number>;
    caps: Record<string, number>;
    overdue: number;
    average_progress: number;
    average_score: number;
  };
  lists: {
    recent_audits: DashboardAudit[];
    upcoming_audits: DashboardAudit[];
    overdue_audits: DashboardAudit[];
  };
  notices: Notice[];
  scope: {
    role: string;
    account_type: string | null;
    entity_type: string | null;
    entity_code: string | null;
    label: string;
  };
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function fmtDate(value: string | null | undefined) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function labelize(value?: string | null) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function percent(value: number) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function MiniCard({ icon: Icon, title, value, accent, onClick }: { icon: LucideIcon; title: string; value: string | number; accent: string; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1c] transition-all text-left min-w-0"
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${accent} bg-opacity-15 shrink-0`}>
        <Icon size={15} className="text-white/80" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-white/50 truncate leading-tight">{title}</div>
        <div className="text-sm font-bold text-white leading-tight mt-0.5">{value}</div>
      </div>
      <ArrowRight size={10} className="text-white/20 ml-auto shrink-0" />
    </button>
  );
}

function NoticeBoard({ notices }: { notices: Notice[] }) {
  return (
    <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex-1 min-h-0 select-none">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide flex items-center gap-1.5">
          <Bell size={14} className="text-secondary-400" />
          Notices & Announcements
        </h2>
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{notices.length} active</span>
      </div>
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
        {notices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center text-[11px] text-white/30 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
            <Bell size={20} className="mb-1 opacity-20" />
            No active notices.
          </div>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="group p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-secondary-500/20 transition-all duration-300">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold text-white group-hover:text-secondary-300 transition-colors truncate">{notice.title}</h3>
                <span className="text-[9px] text-gray-500 font-mono shrink-0">{fmtDate(notice.notice_date)}</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">{notice.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Main Auditor Dashboard Component ──────────────────────────── */

export default function AuditorDashboard({ overview, admin }: { overview: DashboardOverview; admin: any }) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const summaries = overview.summaries;

  // Learning resource counts
  const [trainingsCount, setTrainingsCount] = useState(0);
  const [fieldVisitsCount, setFieldVisitsCount] = useState(0);
  const [papersCount, setPapersCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    myLearningApi.myTrainings(accessToken).then((res) => {
      if (res.success && res.data) {
        setTrainingsCount((res.data as any).trainings?.length || 0);
      }
    });
    myLearningApi.myFieldVisits(accessToken).then((res) => {
      if (res.success && res.data) {
        setFieldVisitsCount((res.data as any).field_visits?.length || 0);
      }
    });
    myLearningApi.myEvaluationPapers(accessToken).then((res) => {
      if (res.success && res.data) {
        setPapersCount((res.data as any).papers?.length || 0);
      }
    });
  }, [accessToken]);

  // Calendar logic
  const [selectedDate, setSelectedDate] = useState<any>(new Date());

  const auditDatesMap = useMemo(() => {
    const map: Record<string, DashboardAudit[]> = {};
    const all = [
      ...(overview.lists.recent_audits || []),
      ...(overview.lists.upcoming_audits || []),
      ...(overview.lists.overdue_audits || []),
    ];
    for (const a of all) {
      if (a.start_date) {
        const dateStr = a.start_date.substring(0, 10);
        if (!map[dateStr]) map[dateStr] = [];
        if (!map[dateStr].some(exist => exist.id === a.id)) {
          map[dateStr].push(a);
        }
      }
    }
    return map;
  }, [overview.lists]);

  const getTileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      const dateStr = offsetDate.toISOString().substring(0, 10);
      if (auditDatesMap[dateStr]) {
        return "has-audit-tile";
      }
    }
    return "";
  };

  const getTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      const dateStr = offsetDate.toISOString().substring(0, 10);
      const dayAudits = auditDatesMap[dateStr];
      if (dayAudits && dayAudits.length > 0) {
        return (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 pointer-events-none">
            {dayAudits.slice(0, 3).map((audit) => (
              <span 
                key={audit.id} 
                className={`h-1.5 w-1.5 rounded-full ${
                  audit.status === "completed" 
                    ? "bg-emerald-400" 
                    : audit.status === "in_progress" 
                      ? "bg-amber-400" 
                      : "bg-slate-400"
                }`} 
              />
            ))}
          </div>
        );
      }
    }
    return null;
  };

  const selectedDateStr = useMemo(() => {
    if (!selectedDate) return "";
    const d = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    const offsetDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().substring(0, 10);
  }, [selectedDate]);

  const selectedDateAudits = useMemo(() => {
    if (!selectedDateStr) return [];
    return auditDatesMap[selectedDateStr] || [];
  }, [selectedDateStr, auditDatesMap]);

  const auditStatusData = [
    { label: "Plan", status: "plan", value: summaries.audits.plan || 0, color: "text-slate-300", bg: "bg-slate-400/10" },
    { label: "In Progress", status: "in_progress", value: summaries.audits.in_progress || 0, color: "text-amber-300", bg: "bg-amber-400/10" },
    { label: "Completed", status: "completed", value: summaries.audits.completed || 0, color: "text-emerald-300", bg: "bg-emerald-400/10" },
  ];

  const capStatusData = [
    { label: "Plan", status: "plan", value: summaries.caps.plan || 0, color: "text-slate-300", bg: "bg-slate-400/10" },
    { label: "In Progress", status: "in_progress", value: summaries.caps.in_progress || 0, color: "text-amber-300", bg: "bg-amber-400/10" },
    { label: "Completed", status: "completed", value: summaries.caps.completed || 0, color: "text-emerald-300", bg: "bg-emerald-400/10" },
  ];

  const currentActiveAudits = useMemo(() => {
    return [
      ...(overview.lists.recent_audits || []),
      ...(overview.lists.upcoming_audits || []),
    ].slice(0, 6);
  }, [overview.lists]);

  return (
    <div className="flex flex-col xl:h-[calc(100vh-6.5rem)] gap-3 xl:overflow-hidden">
      
      {/* CSS Styles for react-calendar embedded nicely */}
      <style>{`
        .react-calendar {
          background: rgba(255, 255, 255, 0.02) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          font-family: inherit !important;
          border-radius: 1.25rem !important;
          color: white !important;
          width: 100% !important;
          padding: 0.5rem !important;
        }
        .react-calendar__navigation button {
          color: white !important;
          min-width: 32px !important;
          background: none !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          border-radius: 0.5rem !important;
        }
        .react-calendar__navigation button:hover,
        .react-calendar__navigation button:enabled:focus {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .react-calendar__month-view__weekdays {
          text-transform: uppercase !important;
          font-size: 9px !important;
          font-weight: 800 !important;
          color: rgba(255, 255, 255, 0.4) !important;
          padding-bottom: 4px !important;
        }
        .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none !important;
        }
        .react-calendar__tile {
          font-size: 10px !important;
          padding: 8px 4px !important;
          border-radius: 0.5rem !important;
          color: rgba(255, 255, 255, 0.8) !important;
          transition: all 0.2s ease !important;
          position: relative !important;
        }
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: rgba(255, 255, 255, 0.05) !important;
          color: white !important;
        }
        .react-calendar__tile--now {
          background: rgba(255, 255, 255, 0.08) !important;
          color: #10b981 !important;
          font-weight: bold !important;
        }
        .react-calendar__tile--active {
          background: #10b981 !important;
          color: #022f2b !important;
          font-weight: 800 !important;
        }
        .react-calendar__tile--active:enabled:hover,
        .react-calendar__tile--active:enabled:focus {
          background: #059669 !important;
        }
        .react-calendar__month-view__days__day--neighboringMonth {
          color: rgba(255, 255, 255, 0.15) !important;
        }
        .has-audit-tile {
          border: 1px dashed rgba(16, 185, 129, 0.4) !important;
        }
      `}</style>

      {/* Main 16:9 Grid Layout */}
      <div className="flex flex-col xl:flex-row gap-3 flex-1 min-h-0">

        {/* Left Column: Learning Resources + Audit Status + CAP Status + Notice Board */}
        <div className="flex flex-col gap-3 w-full xl:w-[460px] xl:shrink-0 xl:min-h-0 xl:overflow-y-auto pr-1 select-none scrollbar-none pb-4">
          
          {/* Learning Resources (3 Cards) */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide px-0.5">My Learning Hub</h2>
            <div className="grid grid-cols-3 gap-2">
              <MiniCard 
                icon={Play} 
                title="Trainings" 
                value={`${trainingsCount} Video${trainingsCount !== 1 ? 's' : ''}`} 
                accent="bg-emerald-500" 
                onClick={() => router.push("/my-learning/trainings")}
              />
              <MiniCard 
                icon={MapPin} 
                title="Field Visits" 
                value={`${fieldVisitsCount} Visit${fieldVisitsCount !== 1 ? 's' : ''}`} 
                accent="bg-cyan-500" 
                onClick={() => router.push("/my-learning/field-visits")}
              />
              <MiniCard 
                icon={BookOpen} 
                title="Evaluation Papers" 
                value={`${papersCount} Paper${papersCount !== 1 ? 's' : ''}`} 
                accent="bg-violet-500" 
                onClick={() => router.push("/my-learning/evaluation-papers")}
              />
            </div>
          </div>

          {/* Audit Status */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide flex items-center gap-1.5">
                <FileCheck size={14} className="text-emerald-400" />
                Audit Status
              </h2>
              <span className="text-[10px] text-white/40">Total: {summaries.audits.total || 0}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {auditStatusData.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => router.push(`/my-audits?status=${s.status}`)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl ${s.bg} border border-[#ffffff0d] hover:border-white/20 hover:bg-white/[0.08] transition-all`}
                >
                  <span className="text-[10px] font-semibold text-white/45 mb-0.5">{s.label}</span>
                  <span className={`text-base font-extrabold ${s.color}`}>{s.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CAP Status */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide flex items-center gap-1.5">
                <ClipboardCheck size={14} className="text-cyan-400" />
                CAP Status
              </h2>
              <span className="text-[10px] text-white/40">Total: {summaries.caps.total || 0}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {capStatusData.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => router.push(`/my-caps?status=${s.status}`)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl ${s.bg} border border-[#ffffff0d] hover:border-white/20 hover:bg-white/[0.08] transition-all`}
                >
                  <span className="text-[10px] font-semibold text-white/45 mb-0.5">{s.label}</span>
                  <span className={`text-base font-extrabold ${s.color}`}>{s.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audit Calendar Widget */}
          <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
            <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide px-0.5">Audit Schedule Calendar</h2>
            <div className="relative">
              <Calendar 
                onChange={setSelectedDate} 
                value={selectedDate} 
                tileClassName={getTileClassName}
                tileContent={getTileContent}
                className="w-full"
              />
            </div>
            
            {/* Selected Date Audits Preview */}
            <div className="mt-2 space-y-2">
              <div className="text-[10px] text-white/40 font-bold px-0.5 uppercase tracking-wider flex justify-between">
                <span>Audits on {selectedDateStr}</span>
                <span className="text-emerald-400 font-bold">{selectedDateAudits.length} Scheduled</span>
              </div>
              
              {selectedDateAudits.length === 0 ? (
                <div className="text-center py-4 rounded-xl bg-white/[0.01] border border-white/[0.03] text-[10px] text-white/30">
                  No audits scheduled on this date.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {selectedDateAudits.map((a) => (
                    <div 
                      key={a.id} 
                      onClick={() => router.push(`/my-audits/details?id=${a.id}`)}
                      className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{a.title}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        a.status === "completed" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : a.status === "in_progress" 
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                            : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      }`}>
                        {a.status.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>

        {/* Right Column: Audit Calendar + Active Audits Preview List */}
        <div className="xl:flex-1 flex flex-col min-h-0 min-w-0 xl:max-w-[calc(100%-480px)] gap-3">
          
          <div className="xl:flex-1 flex flex-col xl:flex-row gap-3 min-h-0">
            
            {/* Notice Board */}
            <NoticeBoard notices={overview.notices || []} />

            {/* My Active Audits List */}
            <div className="w-full xl:w-[420px] flex flex-col gap-2 p-3.5 rounded-2xl bg-[#022f2b] border border-white/[0.08] min-h-0">
              <div className="flex items-center justify-between px-0.5">
                <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide flex items-center gap-1.5">
                  <FileCheck size={14} className="text-secondary-400" />
                  My Active Audits
                </h2>
                <span className="text-[10px] text-white/40">{currentActiveAudits.length} Audits</span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {currentActiveAudits.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 text-center text-[11px] text-white/30 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                    <FileCheck size={20} className="mb-1 opacity-20" />
                    No active audits found.
                  </div>
                ) : (
                  currentActiveAudits.map((a) => (
                    <button 
                      key={a.id} 
                      onClick={() => router.push(`/my-audits/details?id=${a.id}`)}
                      className="w-full p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-secondary-500/20 text-left transition-all group flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-white group-hover:text-secondary-300 transition-colors truncate mt-0.5">{a.title}</h3>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                          a.status === "completed" 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : a.status === "in_progress" 
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                              : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                        }`}>
                          {a.status.replace("_", " ")}
                        </span>
                      </div>
                      
                      <div className="w-full flex items-center justify-between text-[10px] text-white/40 font-medium">
                        <span>{percent(a.progress_pct)}% Progress</span>
                      </div>

                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-secondary-400 rounded-full transition-all duration-300" style={{ width: `${percent(a.progress_pct)}%` }} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Quick Navigation Footer */}
          <div className="flex flex-col gap-1.5 shrink-0 select-none">
            <h2 className="text-[10px] font-bold text-[#ffffff50] tracking-wider uppercase px-0.5">Quick Navigation</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => router.push("/my-audits")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1a] transition-all group"
              >
                <FileCheck size={13} className="text-white/50 group-hover:text-emerald-400 transition-colors shrink-0" />
                <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors truncate">My Audits</span>
                <ArrowRight size={10} className="text-white/20 group-hover:text-white/45 transition-colors ml-auto shrink-0" />
              </button>
              <button
                onClick={() => router.push("/my-caps")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1a] transition-all group"
              >
                <ClipboardCheck size={13} className="text-white/50 group-hover:text-cyan-400 transition-colors shrink-0" />
                <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors truncate">My CAPs</span>
                <ArrowRight size={10} className="text-white/20 group-hover:text-white/45 transition-colors ml-auto shrink-0" />
              </button>
              <button
                onClick={() => router.push("/my-learning/trainings")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1a] transition-all group"
              >
                <ShieldCheck size={13} className="text-white/50 group-hover:text-violet-400 transition-colors shrink-0" />
                <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors truncate">Learning Portal</span>
                <ArrowRight size={10} className="text-white/20 group-hover:text-white/45 transition-colors ml-auto shrink-0" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
