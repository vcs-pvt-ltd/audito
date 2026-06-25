"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PlusCircle, ClipboardCheck, FileCheck, Settings, ArrowRight, UserPlus, Search,
  Clock, AlertCircle, CheckCircle, Maximize2, Minimize2, ChevronDown
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { DashboardFilters, dashboardApi } from "@/lib/api";
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
  entity_count: number;
  progress_pct: number;
  score_pct: number;
}

interface ChartItem {
  name: string;
  label?: string;
  value?: number;
  count?: number;
  total?: number;
  color?: string;
  progress_pct?: number;
  score_pct?: number;
  audit_count?: number;
  entity_code?: string;
  entity_name?: string;
  entity_type?: string | null;
  month?: string;
  audit_code?: string;
  audit_title?: string;
}

interface OrgTreeNode {
  id?: number;
  code?: string;
  name?: string;
  entity_type?: string;
  edge_id?: number;
  children?: OrgTreeNode[];
  [key: string]: any;
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
  charts: {
    entity_performance: ChartItem[];
    assignment_entities?: any[];
    [key: string]: any;
  };
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

function flattenTree(
  node: OrgTreeNode | null,
  list: { code: string; name: string; entity_type: string; depth: number; uniqueKey: string }[] = [],
  depth = 0,
  parentPath = ""
): { code: string; name: string; entity_type: string; depth: number; uniqueKey: string }[] {
  if (!node) return list;
  const code = node.code || node.comp_code || node.cust_code || node.afc_code || "";
  const name = node.name || code;
  const entityType = node.entity_type || "";
  const edgeId = node.edge_id || node.id || 0;
  const uniqueKey = parentPath ? `${parentPath}/${code}-${edgeId}` : `${code}-${edgeId}`;
  if (code) list.push({ code, name, entity_type: entityType, depth, uniqueKey });
  if (node.children) {
    for (const child of node.children) flattenTree(child, list, depth + 1, uniqueKey);
  }
  return list;
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function FilterDropdown({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string; depth?: number; uniqueKey?: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || value;

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-[#ffffff60] font-medium px-0.5">{label}</span>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-2.5 h-8 bg-black/30 rounded-xl border border-white/10 text-[11px] text-white/90 hover:border-white/20 transition-all gap-1"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={12} className={`text-white/40 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a2925] border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.uniqueKey || opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-white/5 transition-colors ${opt.value === value ? 'text-emerald-400 bg-white/5' : 'text-white/70'}`}
              style={{ paddingLeft: opt.depth ? `${12 + opt.depth * 12}px` : undefined }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PerformanceChart({ data, isFullScreen, isLoading }: { data: ChartItem[]; isFullScreen?: boolean; isLoading?: boolean }) {
  const totalAuditCount = data.reduce((sum, item) => sum + Number(item.audit_count || 0), 0);

  if (isLoading) {
    return (
      <div className={`w-full ${isFullScreen ? 'h-[75vh]' : 'h-[440px]'} flex items-center justify-center`}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0 || totalAuditCount === 0) {
    return (
      <div className={`w-full ${isFullScreen ? 'h-[75vh]' : 'h-[440px]'} flex flex-col items-center justify-center text-center p-4 select-none`}>
        <div className="p-4 rounded-full bg-emerald-500/5 border border-emerald-500/10 mb-3 text-emerald-400">
          <ClipboardCheck size={28} className="opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-white/85">No Performance Data</h3>
        <p className="text-[11px] text-white/45 mt-1 max-w-[280px]">
          There are no completed audits to generate performance metrics for the selected filters.
        </p>
      </div>
    );
  }

  const chartData = data.map(item => ({
    name: item.entity_name || item.entity_code,
    completed: item.score_pct || 0,
    remaining: 100 - (item.score_pct || 0),
  }));

  const count = chartData.length;
  let barSize = 28;
  if (isFullScreen) {
    if (count <= 1) barSize = 140;
    else if (count <= 4) barSize = 90;
    else if (count <= 8) barSize = 60;
    else if (count <= 15) barSize = 40;
    else barSize = 25;
  } else {
    if (count <= 1) barSize = 65;
    else if (count <= 4) barSize = 45;
    else if (count <= 8) barSize = 30;
    else if (count <= 15) barSize = 20;
    else barSize = 12;
  }

  return (
    <div className={`w-full ${isFullScreen ? 'h-[75vh]' : 'h-[440px]'} transition-all`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: isFullScreen ? 20 : -20, right: 0, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#047857" stopOpacity={0.7} />
            </linearGradient>
            <linearGradient id="scoreRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: isFullScreen ? 15 : 10, fontWeight: isFullScreen ? 600 : 400 }}
            dy={5}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: isFullScreen ? 15 : 10 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ backgroundColor: 'rgba(2, 47, 43, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
            itemStyle={{ fontSize: isFullScreen ? '15px' : '11px' }}
          />
          <Bar dataKey="completed" stackId="a" fill="url(#scoreGreen)" barSize={barSize} radius={[0, 0, 0, 0]} />
          <Bar dataKey="remaining" stackId="a" fill="url(#scoreRed)" barSize={barSize} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className={`flex items-center justify-center ${isFullScreen ? 'gap-16 mt-6' : 'gap-4 mt-2'}`}>
        <div className="flex items-center gap-2">
          <div className={`${isFullScreen ? 'h-4 w-4' : 'h-2.5 w-2.5'} rounded-full bg-red-500`} />
          <span className={`${isFullScreen ? 'text-base' : 'text-[10px]'} font-bold text-red-500`}>Remaining</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`${isFullScreen ? 'h-4 w-4' : 'h-2.5 w-2.5'} rounded-full bg-emerald-500`} />
          <span className={`${isFullScreen ? 'text-base' : 'text-[10px]'} font-bold text-emerald-500`}>Completed Score</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Entity Head Dashboard Component ──────────────────────── */

export interface EntityHeadDashboardProps {
  overview: DashboardOverview;
  admin: any;
  orgTree: any;
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
}

export default function EntityHeadDashboard({ overview: initialOverview, admin, orgTree, filters: initialFilters }: EntityHeadDashboardProps) {
  const router = useRouter();
  const { accessToken } = useAuth();

  // Local state for chart data and filters
  const [chartFilters, setChartFilters] = useState<DashboardFilters>(initialFilters);
  const [chartOverview, setChartOverview] = useState<DashboardOverview>(initialOverview);
  const [isChartLoading, setIsChartLoading] = useState(false);

  const summaries = initialOverview.summaries; // Static summaries for sidebar
  const charts = chartOverview.charts; // Dynamic charts based on local filters

  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAuditFirm = admin.account_type === 'Audit Firm' || admin.account_type === 'Audit Firm Company';

  // Calendar logic (Always uses initialOverview to stay static)
  const [selectedDate, setSelectedDate] = useState<any>(new Date());

  const selectedAuditCode = chartFilters.audit_code || "all";

  const auditDatesMap = useMemo(() => {
    const map: Record<string, DashboardAudit[]> = {};
    const all = [
      ...(initialOverview.lists.recent_audits || []),
      ...(initialOverview.lists.upcoming_audits || []),
      ...(initialOverview.lists.overdue_audits || []),
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
  }, [initialOverview.lists]);

  // Effect to refetch chart data when local filters change
  useEffect(() => {
    if (!accessToken || !admin) return;

    let alive = true;
    setIsChartLoading(true);

    // entity_code is a frontend-only drill-down; never send it to the backend
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { entity_code: _ec, ...apiFilters } = chartFilters;
    dashboardApi.overview(accessToken, apiFilters).then((res) => {
      if (!alive) return;
      if (res.success && res.data) {
        setChartOverview(res.data as DashboardOverview);
      }
      setIsChartLoading(false);
    });

    return () => { alive = false; };
  }, [accessToken, admin, chartFilters]);

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
                className={`h-1.5 w-1.5 rounded-full ${audit.status === "completed"
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

  const loggedEntityCode = useMemo(
    () =>
      initialOverview.scope.entity_code ||
      admin.entityCode ||
      admin.entity_code ||
      "",
    [initialOverview.scope.entity_code, admin.entityCode, admin.entity_code]
  );

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

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  /* ─── Scoped Org Tree Logic ──────────────────────────────────── */

  const findNodeByCode = (node: OrgTreeNode | null, targetCode: string): OrgTreeNode | null => {
    if (!node) return null;
    const nodeCode = node.code || node.comp_code || node.cust_code || node.afc_code || "";
    if (nodeCode === targetCode) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeByCode(child, targetCode);
        if (found) return found;
      }
    }
    return null;
  };

  const findNodeByEdgeId = (node: OrgTreeNode | null, targetEdgeId: number): OrgTreeNode | null => {
    if (!node) return null;
    const edgeId = Number(node.edge_id ?? node.id ?? 0);
    if (edgeId === targetEdgeId) return node;
    for (const child of node.children || []) {
      const found = findNodeByEdgeId(child, targetEdgeId);
      if (found) return found;
    }
    return null;
  };

  const hasActiveDescendant = (node: OrgTreeNode | null, activeCodes: Set<string>): boolean => {
    if (!node) return false;
    const code = node.code || node.comp_code || node.cust_code || node.afc_code || "";
    if (code && activeCodes.has(code)) return true;
    if (node.children) {
      for (const child of node.children) {
        if (hasActiveDescendant(child, activeCodes)) return true;
      }
    }
    return false;
  };

  const activeCodes = useMemo(() => {
    const codes = new Set<string>();
    const rawAssignments = charts.assignment_entities || charts.entity_performance || [];

    for (const item of rawAssignments) {
      if (selectedAuditCode === "all" || item.audit_code === selectedAuditCode) {
        if (item.entity_code) codes.add(item.entity_code);
      }
    }

    return codes;
  }, [charts.assignment_entities, charts.entity_performance, selectedAuditCode]);

  const headRootNode = useMemo(() => {
    if (!orgTree?.tree) return null;
    if (!loggedEntityCode) return orgTree.tree;
    return findNodeByCode(orgTree.tree, loggedEntityCode) || orgTree.tree;
  }, [orgTree, loggedEntityCode]);

  const treeEntities = useMemo(() => {
    if (!headRootNode) return [];
    return flattenTree(headRootNode);
  }, [headRootNode]);

  const entityFilterOptions = useMemo(() => {
    const opts: { value: string; label: string; depth?: number; uniqueKey: string }[] = [
      { value: "all", label: "Entities", uniqueKey: "__all__" },
    ];

    if (!headRootNode) return opts;

    for (const e of treeEntities) {
      const node = findNodeByCode(headRootNode, e.code);
      if (!node) continue;
      if (hasActiveDescendant(node, activeCodes)) {
        opts.push({ value: e.code, label: e.name, depth: e.depth, uniqueKey: e.uniqueKey });
      }
    }

    // Guarantee logged-in root entity appears in the filter.
    const rootCode = headRootNode.code || headRootNode.comp_code || headRootNode.cust_code || headRootNode.afc_code || "";
    const rootName = headRootNode.name || rootCode;
    if (rootCode && !opts.some((o) => o.value === rootCode)) {
      opts.splice(1, 0, {
        value: rootCode,
        label: rootName,
        depth: 0,
        uniqueKey: `__root__${rootCode}`,
      });
    }

    return opts;
  }, [treeEntities, activeCodes, headRootNode]);

  const auditFilterOptions = useMemo(() => {
    const titles = new Set<string>();
    const opts: { value: string; label: string; uniqueKey: string }[] = [
      { value: "all", label: "All Completed Audits", uniqueKey: "__all_audits__" },
    ];
    const rawPerf = charts.entity_performance || [];
    for (const item of rawPerf) {
      if (item.audit_code && !titles.has(item.audit_code)) {
        titles.add(item.audit_code);
        opts.push({
          value: item.audit_code,
          label: `${item.audit_title || 'Audit'}`,
          uniqueKey: `audit-code-${item.audit_code}`
        });
      }
    }
    return opts;
  }, [charts.entity_performance]);

  const getNodeCode = (node: OrgTreeNode | null): string => {
    if (!node) return "";
    return node.code || node.comp_code || node.cust_code || node.afc_code || "";
  };

  const getNodeName = (node: OrgTreeNode | null): string => {
    if (!node) return "";
    return node.name || getNodeCode(node);
  };

  const getDescendantCodes = (node: OrgTreeNode | null): string[] => {
    if (!node) return [];
    const list: string[] = [];
    const code = getNodeCode(node);
    if (code) list.push(code);
    if (node.children) {
      for (const child of node.children) {
        list.push(...getDescendantCodes(child));
      }
    }
    return list;
  };

  const getDescendantEdgeIds = (node: OrgTreeNode | null): number[] => {
    if (!node) return [];
    const list: number[] = [];
    const edgeId = Number(node.edge_id ?? node.id ?? 0);
    if (edgeId > 0) list.push(edgeId);
    for (const child of node.children || []) {
      list.push(...getDescendantEdgeIds(child));
    }
    return list;
  };

  const aggregateScores = (codes: string[], rawPerf: any[], edgeIds: number[] = []) => {
    let totalMarks = 0;
    let obtainedMarks = 0;
    let auditCount = 0;
    let hasData = false;
    const edgeSet = new Set(edgeIds);

    for (const item of rawPerf) {
      const itemEdgeId = Number(item.org_tree_id || 0);
      const matchesNode = edgeSet.size > 0 && itemEdgeId > 0
        ? edgeSet.has(itemEdgeId)
        : codes.includes(item.entity_code);

      if (matchesNode) {
        if (selectedAuditCode !== "all" && item.audit_code !== selectedAuditCode) {
          continue;
        }
        totalMarks += Number(item.total_marks || 0);
        obtainedMarks += Number(item.obtained_marks || 0);
        auditCount += Number(item.audit_count || 0);
        hasData = true;
      }
    }

    return {
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      audit_count: auditCount,
      score_pct: totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0,
      hasData,
    };
  };

  const filteredPerformanceData = useMemo(() => {
    let rawPerf = charts.entity_performance || [];

    if (selectedAuditCode !== "all") {
      rawPerf = rawPerf.filter((item: any) => item.audit_code === selectedAuditCode);
    }

    if (!orgTree?.tree) {
      return rawPerf;
    }

    if (!chartFilters.entity_code || chartFilters.entity_code === "all") {
      if (!headRootNode) return rawPerf;

      const rootCode = getNodeCode(headRootNode);
      const rootName = getNodeName(headRootNode);
      const rootType = headRootNode.entity_type || "Entity";

      const descendantCodes = getDescendantCodes(headRootNode);
      const descendantEdgeIds = getDescendantEdgeIds(headRootNode);
      const stats = aggregateScores(descendantCodes, rawPerf, descendantEdgeIds);

      return [
        {
          entity_code: rootCode,
          entity_name: rootName,
          entity_type: rootType,
          audit_count: stats.audit_count,
          score_pct: stats.score_pct,
          total_marks: stats.total_marks,
          obtained_marks: stats.obtained_marks,
        }
      ];
    }

    const selectedNode = findNodeByCode(headRootNode, chartFilters.entity_code);
    if (!selectedNode) return rawPerf;

    const results: any[] = [];
    if (selectedNode.children) {
      for (const child of selectedNode.children) {
        if (!hasActiveDescendant(child, activeCodes)) {
          continue;
        }

        const childCode = getNodeCode(child);
        const childName = getNodeName(child);
        const childType = child.entity_type || null;

        const descendantCodes = getDescendantCodes(child);
        const descendantEdgeIds = getDescendantEdgeIds(child);
        const stats = aggregateScores(descendantCodes, rawPerf, descendantEdgeIds);

        results.push({
          entity_code: childCode,
          entity_name: childName,
          entity_type: childType,
          audit_count: stats.audit_count,
          score_pct: stats.score_pct,
          total_marks: stats.total_marks,
          obtained_marks: stats.obtained_marks,
        });
      }
    }

    if (results.length === 0) {
      const code = getNodeCode(selectedNode);
      const name = getNodeName(selectedNode);
      const type = selectedNode.entity_type || "Entity";
      const descendantCodes = getDescendantCodes(selectedNode);
      const descendantEdgeIds = getDescendantEdgeIds(selectedNode);
      const stats = aggregateScores(descendantCodes, rawPerf, descendantEdgeIds);

      return [
        {
          entity_code: code,
          entity_name: name,
          entity_type: type,
          audit_count: stats.audit_count,
          score_pct: stats.score_pct,
          total_marks: stats.total_marks,
          obtained_marks: stats.obtained_marks,
        }
      ];
    }

    return results;
  }, [orgTree, chartFilters.entity_code, charts.entity_performance, selectedAuditCode, activeCodes, headRootNode]);

  const updateChartFilter = (key: string, value: string) => {
    setChartFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetChartFilters = () => {
    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);
    setChartFilters({
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      status: "all",
      audit_type: "all",
      entity_code: "all",
      audit_code: "all",
    });
  };

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

        {/* Left Column: Audit Status + CAP Status + Calendar (Static) */}
        <div className="flex flex-col gap-3 w-full xl:w-[460px] xl:shrink-0 xl:min-h-0 xl:overflow-y-auto pr-1 select-none scrollbar-none pb-4">

          {!isAuditFirm && (
            <>
              {/* Audit Status Summary */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide flex items-center gap-1.5">
                    <FileCheck size={14} className="text-emerald-400" />
                    Audit Overview
                  </h2>
                  <span className="text-[10px] text-white/40">Total: {summaries.audits.total || 0}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {auditStatusData.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => router.push(`/entity-head/audits?status=${s.status}`)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl ${s.bg} border border-[#ffffff0d] hover:border-white/20 hover:bg-white/[0.08] transition-all`}
                    >
                      <span className="text-[10px] font-semibold text-white/45 mb-0.5">{s.label}</span>
                      <span className={`text-base font-extrabold ${s.color}`}>{s.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CAP Status Summary */}
              <div className="flex flex-col gap-1.5 mt-1">
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
                      onClick={() => router.push(`/entity-head/caps?status=${s.status}`)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl ${s.bg} border border-[#ffffff0d] hover:border-white/20 hover:bg-white/[0.08] transition-all`}
                    >
                      <span className="text-[10px] font-semibold text-white/45 mb-0.5">{s.label}</span>
                      <span className={`text-base font-extrabold ${s.color}`}>{s.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Audit Schedule Calendar Widget (Static schedule) */}
          <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] mt-1">
            <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide px-0.5">Audit Schedule</h2>
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
            <div className="mt-1 space-y-1.5">
              <div className="text-[10px] text-white/40 font-bold px-0.5 uppercase tracking-wider flex justify-between">
                <span>Audits on {selectedDateStr}</span>
                <span className="text-emerald-400 font-bold">{selectedDateAudits.length} Scheduled</span>
              </div>

              {selectedDateAudits.length === 0 ? (
                <div className="text-center py-3 rounded-xl bg-white/[0.01] border border-white/[0.03] text-[10px] text-white/30">
                  No audits scheduled on this date.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedDateAudits.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => router.push(`/entity-head/audits/preview?id=${a.id}`)}
                      className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{a.title}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${a.status === "completed"
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

        {/* Right Column: Entity Performance Chart + Quick Actions Below Chart */}
        <div className="xl:flex-1 flex flex-col min-h-0 min-w-0 xl:max-w-[calc(100%-480px)] gap-3">

          {/* Performance Chart Section */}
          <div className="xl:flex-1 flex flex-col min-h-0 min-w-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide">
                {admin.account_type === 'Audit Firm' || admin.account_type === 'Audit Firm Company' ? "Audit Activity" : "Performance Progress"}
              </h2>
              {!isAuditFirm && (
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ffffff0d] rounded-xl border border-[#ffffff1a] text-[11px] font-medium text-white hover:bg-white/10 transition-colors"
                >
                  {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              )}
            </div>

            <section
              ref={containerRef}
              className={`${isFullScreen
                ? 'bg-[#022f2b] p-8 overflow-y-auto w-full h-full'
                : 'relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-[#ffffff1a] shadow-[0px_8px_32px_#0000004c] bg-[linear-gradient(117deg,rgba(2,47,43,0.8)_0%,rgba(6,78,70,0.6)_100%)] p-4 flex flex-col pb-8'
                }`}
            >
              <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-emerald-500 rounded-full blur-[80px] opacity-5" />

              {admin.account_type === 'Audit Firm' || admin.account_type === 'Audit Firm Company' ? (
                <div className="flex flex-col h-full gap-4 relative z-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Active Audits Count */}
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                          <Clock size={14} />
                        </div>
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Active</div>
                      </div>
                      <div className="text-3xl font-extrabold text-amber-400">{summaries.audits.in_progress || 0}</div>
                      <p className="text-[10px] text-white/30 mt-2">Current audit execution.</p>
                    </div>
                    {/* Incoming Audits Count */}
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-secondary-500/10 text-secondary-400">
                          <PlusCircle size={14} />
                        </div>
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Inbound</div>
                      </div>
                      <div className="text-3xl font-extrabold text-secondary-400">{summaries.audits.plan || 0}</div>
                      <p className="text-[10px] text-white/30 mt-2">Awaiting assignment.</p>
                    </div>
                    {/* Overdue Count */}
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                          <AlertCircle size={14} />
                        </div>
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Overdue</div>
                      </div>
                      <div className="text-3xl font-extrabold text-red-400">{summaries.overdue || 0}</div>
                      <p className="text-[10px] text-white/30 mt-2">Past deadline audits.</p>
                    </div>
                    {/* Average Progress */}
                    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                          <CheckCircle size={14} />
                        </div>
                        <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Efficiency</div>
                      </div>
                      <div className="text-3xl font-extrabold text-emerald-400">{Math.round(summaries.average_progress || 0)}%</div>
                      <p className="text-[10px] text-white/30 mt-2">Avg. node progress.</p>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    <h3 className="text-xs font-bold text-white/60 mb-3 px-1 uppercase tracking-widest">Node Audit Activity</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {[...(initialOverview.lists.upcoming_audits || []), ...(initialOverview.lists.recent_audits || [])].slice(0, 10).map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-white truncate">{a.title}</div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-white/40">{a.audit_code}</span>
                              <span className="text-[10px] text-emerald-400/60 font-medium">{a.audit_type}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`/audits/assign?id=${a.id}`)}
                            className="px-3 py-1.5 rounded-lg bg-secondary-500/10 text-secondary-400 text-[10px] font-bold border border-secondary-500/20 hover:bg-secondary-500 hover:text-primary-950 transition-all transition-all"
                          >
                            {a.status === 'plan' ? 'Assign' : 'Manage'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {isFullScreen && (
                    <button
                      onClick={toggleFullscreen}
                      className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-white z-10"
                    >
                      <Minimize2 size={20} />
                    </button>
                  )}

                  {/* Filters: Audit, Entity, Start Date, End Date, Reset Button */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 relative z-10 mb-4">
                    <FilterDropdown
                      label="Audit"
                      value={selectedAuditCode}
                      options={auditFilterOptions}
                      onChange={(v) => updateChartFilter("audit_code", v)}
                    />
                    <FilterDropdown
                      label="Entity"
                      value={chartFilters.entity_code || "all"}
                      options={entityFilterOptions}
                      onChange={(v) => updateChartFilter("entity_code", v)}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-wider text-[#ffffff60] font-medium px-0.5">Start Date</span>
                      <input
                        type="date"
                        value={chartFilters.from}
                        onChange={(e) => updateChartFilter("from", e.target.value)}
                        className="h-8 px-2.5 bg-black/30 rounded-xl border border-white/10 text-[11px] text-white/90 hover:border-white/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-wider text-[#ffffff60] font-medium px-0.5">End Date</span>
                      <input
                        type="date"
                        value={chartFilters.to}
                        onChange={(e) => updateChartFilter("to", e.target.value)}
                        className="h-8 px-2.5 bg-black/30 rounded-xl border border-white/10 text-[11px] text-white/90 hover:border-white/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex flex-col gap-1 justify-end col-span-2 lg:col-span-1">
                      <button
                        onClick={resetChartFilters}
                        className="h-8 px-3 rounded-xl border border-red-500/35 bg-red-500/10 hover:bg-red-500/20 text-red-200 text-[11px] font-bold tracking-wider hover:border-red-500/50 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)] transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Reset Filters</span>
                      </button>
                    </div>
                  </div>

                  <PerformanceChart
                    data={filteredPerformanceData}
                    isFullScreen={isFullScreen}
                    isLoading={isChartLoading}
                  />
                </>
              )}
            </section>
          </div>

          {/* Quick Navigation Footer - Moved to below chart */}
          <div className="flex flex-col gap-1.5 shrink-0 select-none mt-1">
            <h2 className="text-[10px] font-bold text-[#ffffff50] tracking-wider uppercase px-0.5">Quick Navigation</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => router.push("/entity-head/audits")}
                className="flex items-center gap-2 px-3 py-3 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1a] transition-all group"
              >
                <FileCheck size={14} className="text-white/50 group-hover:text-emerald-400 transition-colors shrink-0" />
                <span className="text-xs text-white/70 group-hover:text-white/90 transition-colors font-medium">My Audits</span>
                <ArrowRight size={12} className="text-white/20 group-hover:text-white/45 transition-colors ml-auto shrink-0" />
              </button>
              <button
                onClick={() => router.push("/entity-head/caps")}
                className="flex items-center gap-2 px-3 py-3 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1a] transition-all group"
              >
                <ClipboardCheck size={14} className="text-white/50 group-hover:text-cyan-400 transition-colors shrink-0" />
                <span className="text-xs text-white/70 group-hover:text-white/90 transition-colors font-medium">My CAP Responses</span>
                <ArrowRight size={12} className="text-white/20 group-hover:text-white/45 transition-colors ml-auto shrink-0" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
