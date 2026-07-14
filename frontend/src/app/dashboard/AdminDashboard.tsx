"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users, ListChecks, LucideIcon,
  Globe, MapPin, Briefcase, ChevronDown,
  LayoutGrid, User,
  Maximize2, Minimize2, Layers, GitBranch, Building2,
  PlusCircle, ClipboardCheck, FileCheck, Settings, ArrowRight, UserPlus, Search,
  Clock, AlertCircle, CheckCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import type { DashboardFilters } from "@/lib/api";

/* ─── Types & Interfaces ────────────────────────────────────────── */

type AuditStatus = "plan" | "in_progress" | "completed";

interface DashboardAudit {
  audit_id: string;
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
  org_tree_id?: number | null;
}

export interface DashboardOverview {
  scope: {
    role: string;
    account_type: string | null;
    entity_type: string | null;
    entity_code: string | null;
    label: string;
  };
  summaries: {
    audits: Record<string, number>;
    caps: Record<string, number>;
    people: { auditors: number; entity_heads: number; checklists: number;[key: string]: number | undefined } | null;
    overdue: number;
    average_progress: number;
    average_score: number;
  };
  charts: {
    status: ChartItem[];
    audit_type: ChartItem[];
    monthly: ChartItem[];
    progress_buckets: ChartItem[];
    entity_performance: ChartItem[];
    assignment_entities?: any[];
  };
  notices: any[];
  lists: {
    recent_audits: DashboardAudit[];
    upcoming_audits: DashboardAudit[];
    overdue_audits: DashboardAudit[];
  };
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

/* ─── Helpers ────────────────────────────────────────────────────── */

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

function MiniCard({ icon: Icon, title, value, accent, onClick }: { icon: LucideIcon; title: string; value: string | number; accent: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1a] transition-all text-left min-w-0"
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${accent} bg-opacity-15 shrink-0`}>
        <Icon size={15} className="text-white/80" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-white/50 truncate leading-tight">{title}</div>
        <div className="text-sm font-bold text-white leading-tight">{value}</div>
      </div>
      <ArrowRight size={10} className="text-white/20 ml-auto shrink-0" />
    </button>
  );
}

function StatusRow({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${bg} border border-[#ffffff0d]`}>
      <span className={`text-[11px] font-medium ${color}`}>{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

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

function PerformanceChart({ data, isFullScreen }: { data: ChartItem[]; isFullScreen?: boolean }) {
  const totalAuditCount = data.reduce((sum, item) => sum + Number(item.audit_count || 0), 0);

  if (data.length === 0 || totalAuditCount === 0) {
    return (
      <div className={`w-full ${isFullScreen ? 'h-[75vh]' : 'h-[440px]'} flex flex-col items-center justify-center text-center p-4 select-none`}>
        <div className="p-4 rounded-full bg-emerald-500/5 border border-emerald-500/10 mb-3 text-emerald-400">
          <ClipboardCheck size={28} className="opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-white/85">No Completed Audits</h3>
        <p className="text-[11px] text-white/45 mt-1 max-w-[280px]">
          There are no completed audits matching the selected filters and date range.
        </p>
      </div>
    );
  }

  const chartData = data.map(item => ({
    name: item.entity_name,
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

/* ─── Main Admin Dashboard Component ────────────────────────────── */

export default function AdminDashboard({ overview, admin, orgTree, filters, onFiltersChange }: {
  overview: DashboardOverview;
  admin: any;
  orgTree: any;
  filters: DashboardFilters;
  onFiltersChange: (f: DashboardFilters) => void;
}) {
  const router = useRouter();
  const summaries = overview.summaries;
  const charts = overview.charts;
  const accountType = admin.account_type;
  const isAuditFirm = accountType === 'Audit Firm' || accountType === 'Audit Firm Company';

  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState<any>(new Date());
  const selectedAuditCode = filters.audit_code || "all";

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
        map[dateStr].push(a);
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
            {dayAudits.slice(0, 3).map((audit, idx) => (
              <span
                key={`${audit.audit_id ?? 'audit'}-${idx}`}
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

  const treeEntities = useMemo(() => {
    if (!orgTree?.tree) return [];
    return flattenTree(orgTree.tree);
  }, [orgTree]);

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

  const entityFilterOptions = useMemo(() => {
    const opts: { value: string; label: string; depth?: number; uniqueKey: string }[] = [
      { value: "all", label: "All Entities", uniqueKey: "__all__" },
    ];

    for (const e of treeEntities) {
      const node = findNodeByCode(orgTree.tree, e.code);
      if (hasActiveDescendant(node, activeCodes)) {
        opts.push({ value: e.code, label: e.name, depth: e.depth, uniqueKey: e.uniqueKey });
      }
    }
    return opts;
  }, [treeEntities, activeCodes, orgTree]);

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

  const getDescendantEdgeIds = (node: OrgTreeNode | null): string[] => {
    if (!node) return [];
    const list: string[] = [];
    const edgeId = String(node.edge_id ?? node.id ?? "");
    if (edgeId) list.push(edgeId);
    for (const child of node.children || []) {
      list.push(...getDescendantEdgeIds(child));
    }
    return list;
  };

  const aggregateScores = (codes: string[], rawPerf: any[], edgeIds: string[] = []) => {
    let totalMarks = 0;
    let obtainedMarks = 0;
    let auditCount = 0;
    let hasData = false;
    const edgeSet = new Set(edgeIds);

    for (const item of rawPerf) {
      const itemEdgeId = String((item as any).org_tree_id || "");
      const matchesNode = edgeSet.size > 0 && itemEdgeId
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

    if (!filters.entity_code || filters.entity_code === "all") {
      const rootNode = orgTree.tree;
      const rootCode = getNodeCode(rootNode);
      const rootName = getNodeName(rootNode);
      const rootType = rootNode.entity_type || "Main Entity";

      const descendantCodes = getDescendantCodes(rootNode);
      const descendantEdgeIds = getDescendantEdgeIds(rootNode);
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

    const selectedNode = findNodeByCode(orgTree.tree, filters.entity_code);
    if (!selectedNode) return [];

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
  }, [orgTree, filters.entity_code, charts.entity_performance, selectedAuditCode, activeCodes]);

  const updateFilter = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetAllFilters = () => {
    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);
    onFiltersChange({
      from: from.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      status: "all",
      audit_type: "all",
      entity_code: "all",
      audit_code: "all",
    });
  };

  const people = summaries.people;

  const getEntityCards = () => {
    if (!people) return [];

    // Only show structure cards that sit BELOW the admin's own level — mirrors the
    // sidebar/onboarding rule: a card shows when orgLevel > level, and the admin
    // isn't that entity itself (excludeEntityTypes covers shared-level cases like Supplier).
    const orgLevel = admin.org_level ?? Infinity;
    const entityType = admin.entity_type || "";

    type StructureCard = {
      icon: LucideIcon; title: string; value: number; accent: string; href: string;
      level: number; excludeEntityTypes?: string[];
    };
    let structureCards: StructureCard[] = [];

    if (accountType === 'Corporate' || accountType === 'Company') {
      structureCards = [
        { icon: Layers, title: "Clusters", value: people.clusters || 0, accent: "bg-cyan-500", href: "/structure", level: 4 },
        { icon: Building2, title: "Factories", value: people.factories || 0, accent: "bg-blue-500", href: "/structure", level: 3 },
        { icon: MapPin, title: "Units", value: people.units || 0, accent: "bg-amber-500", href: "/structure", level: 2 },
        { icon: GitBranch, title: "Departments", value: people.departments || 0, accent: "bg-purple-500", href: "/structure", level: 1 },
        { icon: Layers, title: "Sections", value: people.sections || 0, accent: "bg-pink-500", href: "/structure", level: 0 },
      ];
    } else if (accountType === 'Audit Firm' || accountType === 'Audit Firm Company') {
      structureCards = [
        { icon: MapPin, title: "Branches", value: people.branches || 0, accent: "bg-blue-500", href: "/structure", level: 3 },
        { icon: Building2, title: "Departments", value: people.departments || 0, accent: "bg-amber-500", href: "/structure", level: 1 },
      ];
    } else if (accountType === 'Customer') {
      structureCards = [
        { icon: Globe, title: "Buying Offices", value: people.buying_offices || 0, accent: "bg-blue-500", href: "/structure", level: 7 },
        { icon: MapPin, title: "Suppliers", value: people.suppliers || 0, accent: "bg-amber-500", href: "/structure", level: 6, excludeEntityTypes: ["Supplier"] },
      ];
    }

    const base: { icon: LucideIcon; title: string; value: number; accent: string; href: string }[] =
      structureCards
        .filter((c) => orgLevel > c.level && !c.excludeEntityTypes?.includes(entityType))
        .map(({ level: _level, excludeEntityTypes: _exclude, ...card }) => card);

    // Supplier ↔ Company link: surface the linked company's structure (view-only).
    // Backend only includes `people.companies` when a company is actually linked.
    if (accountType === 'Customer' && people.companies) {
      base.push(
        { icon: Building2, title: "Company", value: people.companies || 0, accent: "bg-cyan-500", href: "/structure/list?type=company" },
        { icon: Layers, title: "Clusters", value: people.clusters || 0, accent: "bg-blue-500", href: "/structure/list?type=cluster" },
        { icon: Building2, title: "Factories", value: people.factories || 0, accent: "bg-indigo-500", href: "/structure/list?type=factory" },
        { icon: MapPin, title: "Units", value: people.units || 0, accent: "bg-amber-500", href: "/structure/list?type=unit" },
        { icon: GitBranch, title: "Departments", value: people.departments || 0, accent: "bg-purple-500", href: "/structure/list?type=department" },
        { icon: Layers, title: "Sections", value: people.sections || 0, accent: "bg-pink-500", href: "/structure/list?type=section" },
      );
    }

    base.push(
      { icon: Briefcase, title: "Auditors", value: people.auditors || 0, accent: "bg-violet-500", href: "/users/list?type=auditor" },
      { icon: Users, title: "Entity Heads", value: people.entity_heads || 0, accent: "bg-orange-500", href: "/users/list?type=entity-head" },
    );

    if (!isAuditFirm) {
      base.push({ icon: ListChecks, title: "Checklists", value: people.checklists || 0, accent: "bg-pink-500", href: "/checklists" });
    }

    return base;
  };

  const cards = getEntityCards();

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

  const quickActions = isAuditFirm ? [
    { icon: FileCheck, label: "Audits", href: "/audits" },
    { icon: UserPlus, label: "Add Auditor", href: "/users/list?type=auditor" },
    { icon: Users, label: "Auditors", href: "/users/list?type=auditor" },
    { icon: GitBranch, label: "Branches", href: "/structure" },
    { icon: Search, label: "Search Audits", href: "/audits" },
    { icon: Settings, label: "Settings", href: "/settings/organization" },
  ] : [
    { icon: PlusCircle, label: "New Audit", href: "/audits" },
    { icon: ClipboardCheck, label: "Checklists", href: "/checklists" },
    { icon: FileCheck, label: "CAPs", href: "/caps" },
    { icon: Users, label: "Users", href: "/users/list?type=auditor" },
    { icon: Building2, label: "Structure", href: "/structure" },
    { icon: Settings, label: "Settings", href: "/settings/organization" },
  ];

  return (
    <div className="flex flex-col xl:h-[calc(100vh-3rem)] gap-3 xl:overflow-hidden">

      {/* ── Main Row: Left Panel + Right Chart ── */}
      <div className="flex flex-col xl:flex-row gap-3 flex-1 min-h-0">

        {/* Left Column: Org Overview + Status Rows + Quick Actions */}
        <div className="flex flex-col gap-3 w-full xl:w-[460px] xl:shrink-0 xl:min-h-0 xl:overflow-y-auto pr-1 select-none scrollbar-none pb-4">
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

          {/* Organization Overview */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide px-0.5">Organization Overview</h2>
            <div className="grid grid-cols-3 gap-2">
              {cards.map((c, i) => (
                <MiniCard key={`${c.title}-${c.href}-${i}`} icon={c.icon} title={c.title} value={c.value} accent={c.accent} onClick={() => router.push(c.href)} />
              ))}
            </div>
          </div>

          {!isAuditFirm && (
            <>
              {/* Audit Status - 3 cols grid layout */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide">Audit Status</h2>
                  <span className="text-[10px] text-white/40">Total: {summaries.audits.total || 0}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {auditStatusData.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => router.push(`/audits?status=${s.status}`)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl ${s.bg} border border-[#ffffff0d] hover:border-white/20 hover:bg-white/[0.08] transition-all`}
                    >
                      <span className="text-[10px] font-semibold text-white/40 mb-0.5">{s.label}</span>
                      <span className={`text-base font-extrabold ${s.color}`}>{s.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CAP Status - 3 cols grid layout */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide">CAP Status</h2>
                  <span className="text-[10px] text-white/40">Total: {summaries.caps.total || 0}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {capStatusData.map(s => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => router.push(`/caps?status=${s.status}`)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl ${s.bg} border border-[#ffffff0d] hover:border-white/20 hover:bg-white/[0.08] transition-all`}
                    >
                      <span className="text-[10px] font-semibold text-white/40 mb-0.5">{s.label}</span>
                      <span className={`text-base font-extrabold ${s.color}`}>{s.value}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* React Calendar widget showing Audit dates */}
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
            <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide px-0.5">Audit Calendar</h2>
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
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedDateAudits.map((a) => (
                    <div
                      key={a.audit_id}
                      onClick={() => router.push(`/my-audits/preview?id=${a.audit_id}`)}
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

        {/* Right Column: Audit Performance Chart + Quick Actions */}
        <div className="xl:flex-1 flex flex-col min-h-0 min-w-0 xl:max-w-[calc(100%-480px)] gap-3">
          <div className="xl:flex-1 flex flex-col min-h-0 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-[#ffffffe6] tracking-wide">
                {isAuditFirm ? "Audit Activity" : "Audit Performance"}
              </h2>
              {!isAuditFirm && (
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ffffff0d] rounded-xl border border-[#ffffff1a] text-[11px] font-medium text-white hover:bg-white/10 transition-colors"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  {isFullScreen ? "Exit" : "Full Screen"}
                </button>
              )}
            </div>

            <section
              ref={containerRef}
              className={`${isFullScreen
                ? 'bg-[#022f2b] p-8 overflow-y-auto w-full h-full'
                : 'relative flex-1 min-h-0 rounded-2xl overflow-hidden border border-[#ffffff1a] shadow-[0px_8px_32px_#0000004c] bg-[linear-gradient(117deg,rgba(2,47,43,0.8)_0%,rgba(6,78,70,0.6)_100%)] p-4 flex flex-col'
                }`}
            >
              <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-emerald-500 rounded-full blur-[80px] opacity-5" />

              {isAuditFirm ? (
                <div className="flex flex-col h-full gap-4 relative z-10">
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Active Audits Count */}
                      <button type="button" onClick={() => router.push("/audits?status=in_progress")} className="text-left p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition-colors group">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                               <Clock size={14} />
                            </div>
                            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Active</div>
                         </div>
                         <div className="text-3xl font-extrabold text-amber-400">{summaries.audits.in_progress || 0}</div>
                         <p className="text-[10px] text-white/30 mt-2">Current audit execution.</p>
                      </button>
                      {/* Incoming Audits Count */}
                      <button type="button" onClick={() => router.push("/audits?status=plan")} className="text-left p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition-colors">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-secondary-500/10 text-secondary-400">
                               <PlusCircle size={14} />
                            </div>
                            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Inbound</div>
                         </div>
                         <div className="text-3xl font-extrabold text-secondary-400">{summaries.audits.plan || 0}</div>
                         <p className="text-[10px] text-white/30 mt-2">Awaiting assignment.</p>
                      </button>
                      {/* Overdue Count */}
                      <button type="button" onClick={() => router.push("/audits?status=overdue")} className="text-left p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition-colors">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                               <AlertCircle size={14} />
                            </div>
                            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Overdue</div>
                         </div>
                         <div className="text-3xl font-extrabold text-red-400">{summaries.overdue || 0}</div>
                         <p className="text-[10px] text-white/30 mt-2">Past deadline audits.</p>
                      </button>
                      {/* Average Progress */}
                      <button type="button" onClick={() => router.push("/audits?status=completed")} className="text-left p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition-colors">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                               <CheckCircle size={14} />
                            </div>
                            <div className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Efficiency</div>
                         </div>
                         <div className="text-3xl font-extrabold text-emerald-400">{Math.round(summaries.average_progress || 0)}%</div>
                         <p className="text-[10px] text-white/30 mt-2">Avg. audit progress.</p>
                      </button>
                   </div>

                   <div className="flex-1 flex flex-col min-h-0">
                      <h3 className="text-xs font-bold text-white/60 mb-3 px-1 uppercase tracking-widest">Recent Audit Lifecycle</h3>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {[...(overview.lists.upcoming_audits || []), ...(overview.lists.recent_audits || [])].slice(0, 10).map((a) => (
                            <div key={a.audit_id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all">
                               <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-white truncate">{a.title}</div>
                                  <div className="flex items-center gap-3 mt-1">
                                     <span className="text-[10px] text-emerald-400/60 font-medium">{a.audit_type}</span>
                                  </div>
                               </div>
                               <button 
                                 onClick={() => router.push(`/audits/assign?id=${a.audit_id}`)}
                                className="px-3 py-1.5 rounded-lg bg-secondary-500/10 text-secondary-400 text-[10px] font-bold border border-secondary-500/20 hover:bg-secondary-500 hover:text-primary-950 transition-all"
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
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 relative z-10">
                    <FilterDropdown
                      label="Audit"
                      value={selectedAuditCode}
                      options={auditFilterOptions}
                      onChange={(v) => updateFilter("audit_code", v)}
                    />
                    <FilterDropdown
                      label="Entity"
                      value={filters.entity_code || "all"}
                      options={entityFilterOptions}
                      onChange={(v) => updateFilter("entity_code", v)}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-wider text-[#ffffff60] font-medium px-0.5">Start Date</span>
                      <input
                        type="date"
                        value={filters.from || ""}
                        onChange={(e) => updateFilter("from", e.target.value)}
                        className="h-8 px-2.5 bg-black/30 rounded-xl border border-white/10 text-[11px] text-white/90 hover:border-white/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase tracking-wider text-[#ffffff60] font-medium px-0.5">End Date</span>
                      <input
                        type="date"
                        value={filters.to || ""}
                        onChange={(e) => updateFilter("to", e.target.value)}
                        className="h-8 px-2.5 bg-black/30 rounded-xl border border-white/10 text-[11px] text-white/90 hover:border-white/20 transition-all [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex flex-col gap-1 justify-end col-span-2 lg:col-span-1">
                      <button
                        onClick={resetAllFilters}
                        className="h-8 px-3 rounded-xl border border-red-500/35 bg-red-500/10 hover:bg-red-500/20 text-red-200 text-[11px] font-bold tracking-wider hover:border-red-500/50 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)] transition-all flex items-center justify-center gap-1.5"
                      >
                        <span>Reset Filters</span>
                      </button>
                    </div>
                  </div>

                  <PerformanceChart data={filteredPerformanceData} isFullScreen={isFullScreen} />
                </>
              )}
            </section>
          </div>

          {/* Quick Actions at the bottom of the right panel, reducing chart height and fitting nicely */}
          {!isFullScreen && (
            <div className="flex flex-col gap-1.5 mt-1 shrink-0">
              <h2 className="text-xs font-semibold text-[#ffffffe6] tracking-wider px-0.5">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {quickActions.map(a => (
                  <button
                    key={a.label}
                    onClick={() => router.push(a.href)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#ffffff06] border border-[#ffffff0d] hover:bg-[#ffffff10] hover:border-[#ffffff1a] transition-all group"
                  >
                    <a.icon size={14} className="text-white/50 group-hover:text-emerald-400 transition-colors shrink-0" />
                    <span className="text-[11px] text-white/70 group-hover:text-white/90 transition-colors truncate">{a.label}</span>
                    <ArrowRight size={10} className="text-white/20 group-hover:text-white/40 transition-colors ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
