"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  GitCompareArrows,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { auditApi } from "@/lib/api";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Candidate = {
  audit_id: string;
  checklist_id: string;
  checklist_name: string;
  title: string;
  audit_type: "internal" | "external";
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
};

type Comparison = NonNullable<Awaited<ReturnType<typeof auditApi.compare>>["data"]>;

type EntityTreeNode = {
  code: string;
  name: string;
  entity_type: string;
  edge_id?: string | null;
  children?: EntityTreeNode[];
};

type EntityScore = {
  audit_id: string;
  available: boolean;
  marks_obtained?: number;
  total_marks?: number;
  percentage?: number;
  corrective_action_count?: number;
  open_corrective_action_count?: number;
};

type EntityOption = {
  key: string;
  name: string;
  entityType: string;
  hierarchyLabel: string;
  depth: number;
};

const AUDIT_COLORS = [
  "from-secondary-400 to-emerald-500",
  "from-blue-400 to-cyan-500",
  "from-violet-400 to-fuchsia-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
];

function dateLabel(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function scoreTone(value: number) {
  if (value >= 80) return "text-emerald-300";
  if (value >= 60) return "text-amber-300";
  return "text-red-300";
}

function entityKey(code: string, edgeId?: string | null) {
  return `${code}::${edgeId || "null"}`;
}

function EntityFilterDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: EntityOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.key === value);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <span className="mb-1.5 block text-[11px] font-semibold text-gray-400">Entity</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0b2118] px-3 text-left text-xs font-semibold text-white outline-none transition hover:border-white/20 focus:border-secondary-500/50"
      >
        <span className="truncate">{value === "all" ? "All Entities" : selected?.hierarchyLabel || "Select entity"}</span>
        <ChevronDown size={15} className={`shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#0a2925] py-1 shadow-2xl">
          <button type="button" onClick={() => { onChange("all"); setOpen(false); }} className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.06] ${value === "all" ? "bg-white/[0.05] text-secondary-300" : "text-gray-300"}`}>All Entities</button>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => { onChange(option.key); setOpen(false); }}
              className={`w-full py-2 pr-3 text-left text-xs transition-colors hover:bg-white/[0.06] ${value === option.key ? "bg-white/[0.05] text-secondary-300" : "text-gray-300"}`}
              style={{ paddingLeft: `${12 + option.depth * 12}px` }}
            >
              {option.hierarchyLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function findEntityTreeNode(node: EntityTreeNode | null, key: string): EntityTreeNode | null {
  if (!node) return null;
  if (entityKey(node.code, node.edge_id) === key) return node;
  for (const child of node.children || []) {
    const found = findEntityTreeNode(child, key);
    if (found) return found;
  }
  return null;
}

function aggregateEntityScores(node: EntityTreeNode, scoreMap: Map<string, EntityScore[]>, audits: Comparison["audits"]): EntityScore[] {
  const totals = new Map<string, { marks: number; total: number; actions: number; openActions: number; available: boolean }>();
  const add = (score: EntityScore) => {
    const current = totals.get(score.audit_id) || { marks: 0, total: 0, actions: 0, openActions: 0, available: false };
    totals.set(score.audit_id, {
      marks: current.marks + Number(score.marks_obtained || 0),
      total: current.total + Number(score.total_marks || 0),
      actions: current.actions + Number(score.corrective_action_count || 0),
      openActions: current.openActions + Number(score.open_corrective_action_count || 0),
      available: current.available || score.available,
    });
  };
  const visit = (current: EntityTreeNode) => {
    (scoreMap.get(entityKey(current.code, current.edge_id)) || []).forEach(add);
    (current.children || []).forEach(visit);
  };
  visit(node);
  return audits.map((audit) => {
    const score = totals.get(audit.audit_id);
    if (!score?.available) return { audit_id: audit.audit_id, available: false };
    return {
      audit_id: audit.audit_id,
      available: true,
      marks_obtained: score.marks,
      total_marks: score.total,
      percentage: score.total ? Number(((score.marks / score.total) * 100).toFixed(1)) : 0,
      corrective_action_count: score.actions,
      open_corrective_action_count: score.openActions,
    };
  });
}

function EntityComparisonNode({
  node,
  scoreMap,
  audits,
  depth = 0,
}: {
  node: EntityTreeNode;
  scoreMap: Map<string, EntityScore[]>;
  audits: Comparison["audits"];
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const nodeScores = scoreMap.get(entityKey(node.code, node.edge_id)) || [];
  const childNodes = node.children || [];

  const aggregateScores = (current: EntityTreeNode): EntityScore[] => {
    const own = scoreMap.get(entityKey(current.code, current.edge_id)) || [];
    const grouped = new Map<string, { marks: number; total: number; actions: number; openActions: number; available: boolean }>();
    own.forEach((item) => {
      grouped.set(item.audit_id, {
        marks: Number(item.marks_obtained || 0),
        total: Number(item.total_marks || 0),
        actions: Number(item.corrective_action_count || 0),
        openActions: Number(item.open_corrective_action_count || 0),
        available: item.available,
      });
    });
    (current.children || []).flatMap(aggregateScores).forEach((item) => {
      const previous = grouped.get(item.audit_id) || { marks: 0, total: 0, actions: 0, openActions: 0, available: false };
      grouped.set(item.audit_id, {
        marks: previous.marks + Number(item.marks_obtained || 0),
        total: previous.total + Number(item.total_marks || 0),
        actions: previous.actions + Number(item.corrective_action_count || 0),
        openActions: previous.openActions + Number(item.open_corrective_action_count || 0),
        available: previous.available || item.available,
      });
    });
    return audits.map((audit) => {
      const value = grouped.get(audit.audit_id);
      if (!value?.available) return { audit_id: audit.audit_id, available: false };
      const percentage = value.total > 0 ? Number(((value.marks / value.total) * 100).toFixed(1)) : 0;
      return { audit_id: audit.audit_id, available: true, marks_obtained: value.marks, total_marks: value.total, percentage, corrective_action_count: value.actions, open_corrective_action_count: value.openActions };
    });
  };

  const aggregated = aggregateScores(node);
  const hasScores = aggregated.some((item) => item.available);
  const visibleChildren = childNodes.filter((child) => aggregateScores(child).some((item) => item.available));
  if (!hasScores && visibleChildren.length === 0) return null;

  return (
    <div className={depth ? "ml-3 border-l border-white/[0.1] pl-3 sm:ml-5 sm:pl-4" : ""}>
      <article className={`overflow-hidden rounded-xl border ${nodeScores.length ? "border-secondary-500/25 bg-secondary-500/[0.045]" : "border-white/[0.08] bg-white/[0.02]"}`}>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-white/[0.03]">
          {visibleChildren.length > 0 ? (expanded ? <ChevronDown size={15} className="shrink-0 text-gray-500" /> : <ChevronRight size={15} className="shrink-0 text-gray-500" />) : <span className="w-[15px]" />}
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><Building2 size={13} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{node.name}</span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">{node.entity_type || "Organization entity"}</span>
          </span>
          <span className="hidden items-center gap-2 sm:flex">
            {aggregated.filter((item) => item.available).map((item, index) => (
              <span key={item.audit_id} className={`rounded-md bg-white/[0.05] px-2 py-1 text-xs font-bold ${scoreTone(item.percentage || 0)}`}>
                {item.percentage}%<span className="ml-1 text-[10px] text-gray-500">A{index + 1}</span>
              </span>
            ))}
          </span>
        </button>
        <div className="grid gap-2 border-t border-white/[0.07] p-3 sm:grid-cols-2 xl:grid-cols-3">
          {aggregated.map((score, index) => {
            const audit = audits.find((item) => item.audit_id === score.audit_id);
            if (!score.available) return <div key={score.audit_id} className="rounded-lg border border-dashed border-white/[0.08] px-3 py-2 text-xs text-gray-600">{audit?.title || "Audit"}: not audited</div>;
            return (
              <div key={score.audit_id} className="rounded-lg bg-black/[0.14] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-gray-300">{audit?.title || `Audit ${index + 1}`}</span><span className={`text-sm font-black ${scoreTone(score.percentage || 0)}`}>{score.percentage}%</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-gradient-to-r ${AUDIT_COLORS[index % AUDIT_COLORS.length]}`} style={{ width: `${Math.min(100, score.percentage || 0)}%` }} /></div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500"><span>{score.marks_obtained}/{score.total_marks} marks</span>{(score.open_corrective_action_count || 0) > 0 && <span className="inline-flex items-center gap-1 text-red-300"><AlertTriangle size={10} /> {score.open_corrective_action_count} open</span>}</div>
              </div>
            );
          })}
        </div>
      </article>
      {expanded && visibleChildren.length > 0 && <div className="mt-2 space-y-2">{visibleChildren.map((child) => <EntityComparisonNode key={entityKey(child.code, child.edge_id)} node={child} scoreMap={scoreMap} audits={audits} depth={depth + 1} />)}</div>}
    </div>
  );
}

function EntityComparisonTable({
  tree,
  scoreMap,
  audits,
  focusedEntityKey,
}: {
  tree: EntityTreeNode;
  scoreMap: Map<string, EntityScore[]>;
  audits: Comparison["audits"];
  focusedEntityKey?: string;
}) {
  const aggregate = (node: EntityTreeNode): EntityScore[] => {
    const totals = new Map<string, { marks: number; total: number; actions: number; openActions: number; available: boolean }>();
    const add = (score: EntityScore) => {
      const current = totals.get(score.audit_id) || { marks: 0, total: 0, actions: 0, openActions: 0, available: false };
      totals.set(score.audit_id, {
        marks: current.marks + Number(score.marks_obtained || 0),
        total: current.total + Number(score.total_marks || 0),
        actions: current.actions + Number(score.corrective_action_count || 0),
        openActions: current.openActions + Number(score.open_corrective_action_count || 0),
        available: current.available || score.available,
      });
    };
    (scoreMap.get(entityKey(node.code, node.edge_id)) || []).forEach(add);
    (node.children || []).flatMap(aggregate).forEach(add);
    return audits.map((audit) => {
      const value = totals.get(audit.audit_id);
      if (!value?.available) return { audit_id: audit.audit_id, available: false };
      return {
        audit_id: audit.audit_id,
        available: true,
        marks_obtained: value.marks,
        total_marks: value.total,
        percentage: value.total ? Number(((value.marks / value.total) * 100).toFixed(1)) : 0,
        corrective_action_count: value.actions,
        open_corrective_action_count: value.openActions,
      };
    });
  };

  const rows: Array<{ node: EntityTreeNode; depth: number; scores: EntityScore[] }> = [];
  const walk = (node: EntityTreeNode, depth: number) => {
    const scores = aggregate(node);
    const children = node.children || [];
    if (!scores.some((score) => score.available) && !children.some((child) => aggregate(child).some((score) => score.available))) return;
    rows.push({ node, depth, scores });
    children.forEach((child) => walk(child, depth + 1));
  };
  walk(tree, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="min-w-[780px] w-full border-collapse text-left">
        <thead className="bg-white/[0.045]">
          <tr>
            <th className="sticky left-0 z-10 min-w-[260px] border-b border-white/[0.08] bg-[#0a2118] px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">Organization hierarchy</th>
            {audits.map((audit, index) => (
              <th key={audit.audit_id} className="min-w-[165px] border-b border-l border-white/[0.08] px-4 py-3 align-top">
                <p className="truncate text-xs font-bold text-white">A{index + 1} · {audit.title}</p>
                <p className="mt-1 text-[10px] font-normal text-gray-500">{dateLabel(audit.completed_at || audit.end_date)}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, depth, scores }) => {
            const isFocused = focusedEntityKey === entityKey(node.code, node.edge_id);
            return (
            <tr key={entityKey(node.code, node.edge_id)} className={`group hover:bg-white/[0.025] ${isFocused ? "bg-secondary-500/[0.09]" : ""}`}>
              <td className={`sticky left-0 z-[1] border-b border-white/[0.06] px-4 py-3 group-hover:bg-[#0b2a20] ${isFocused ? "bg-[#10392a]" : "bg-[#08251a]"}`}>
                <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><Building2 size={12} /></span>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{node.name}</span><span className="block text-[10px] uppercase tracking-wide text-gray-500">{node.entity_type || "Entity"}</span></span>
                </div>
              </td>
              {scores.map((score) => (
                <td key={score.audit_id} className="border-b border-l border-white/[0.06] px-4 py-3">
                  {!score.available ? <span className="text-xs text-gray-600">Not audited</span> : (
                    <div>
                      <p className={`text-base font-black ${scoreTone(score.percentage || 0)}`}>{score.percentage}%</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">{score.marks_obtained}/{score.total_marks} marks</p>
                      {(score.open_corrective_action_count || 0) > 0 && <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-300"><AlertTriangle size={10} /> {score.open_corrective_action_count} open</p>}
                    </div>
                  )}
                </td>
              ))}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditComparisonPage() {
  const router = useRouter();
  const { admin, accessToken, isLoading } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState("");
  const [selectedAuditIds, setSelectedAuditIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [selectedEntityKey, setSelectedEntityKey] = useState("all");
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const isFirmAdmin = admin?.role === "admin" && ["Audit Firm", "Audit Firm Company"].includes(admin.account_type || "");

  const checklistGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; audits: Candidate[] }>();
    candidates.forEach((audit) => {
      if (!groups.has(audit.checklist_id)) {
        groups.set(audit.checklist_id, { id: audit.checklist_id, name: audit.checklist_name, audits: [] });
      }
      groups.get(audit.checklist_id)?.audits.push(audit);
    });
    return [...groups.values()].filter((group) => group.audits.length >= 2);
  }, [candidates]);

  const availableAudits = useMemo(
    () => checklistGroups.find((group) => group.id === selectedChecklistId)?.audits || [],
    [checklistGroups, selectedChecklistId]
  );

  const entityOptions = useMemo(() => {
    if (!comparison) return [];
    const options = new Map<string, EntityOption>();
    const activeEntityKeys = new Set(comparison.entities.map((entity) => entityKey(entity.entity_code, entity.org_tree_id)));
    const hasAuditedDescendant = (node: EntityTreeNode): boolean =>
      activeEntityKeys.has(entityKey(node.code, node.edge_id)) || (node.children || []).some(hasAuditedDescendant);
    const addTreeNode = (node: EntityTreeNode, depth = 0) => {
      if (!hasAuditedDescendant(node)) return;
      options.set(entityKey(node.code, node.edge_id), {
        key: entityKey(node.code, node.edge_id),
        name: node.name,
        entityType: node.entity_type || "Organization entity",
        hierarchyLabel: node.name,
        depth,
      });
      (node.children || []).forEach((child) => addTreeNode(child, depth + 1));
    };
    if (comparison.entity_tree) addTreeNode(comparison.entity_tree as EntityTreeNode);
    comparison.entities.forEach((entity) => {
      const key = entityKey(entity.entity_code, entity.org_tree_id);
      if (!options.has(key)) {
        options.set(key, { key, name: entity.entity_code, entityType: entity.entity_type || "Organization entity", hierarchyLabel: entity.entity_code, depth: 0 });
      }
    });
    return [...options.values()];
  }, [comparison]);

  const selectedEntity = useMemo(
    () => entityOptions.find((entity) => entity.key === selectedEntityKey) || null,
    [entityOptions, selectedEntityKey]
  );

  const chartAudits = useMemo(() => {
    if (!comparison) return [];
    const scoreMap = new Map(comparison.entities.map((entity) => [entityKey(entity.entity_code, entity.org_tree_id), entity.audits as EntityScore[]]));
    const selectedTreeNode = comparison.entity_tree
      ? findEntityTreeNode(comparison.entity_tree as EntityTreeNode, selectedEntityKey)
      : null;
    const entity = comparison.entities.find((item) => entityKey(item.entity_code, item.org_tree_id) === selectedEntityKey);
    const selectedScores = selectedTreeNode
      ? aggregateEntityScores(selectedTreeNode, scoreMap, comparison.audits)
      : entity?.audits;
    const hasSelectedEntity = selectedEntityKey !== "all";
    return comparison.audits.map((audit) => {
      const score = selectedScores?.find((item) => item.audit_id === audit.audit_id);
      return {
        ...audit,
        available: !hasSelectedEntity || Boolean(score?.available),
        marks_obtained: hasSelectedEntity ? Number(score?.marks_obtained || 0) : audit.marks_obtained,
        total_marks: hasSelectedEntity ? Number(score?.total_marks || 0) : audit.total_marks,
        percentage: hasSelectedEntity ? Number(score?.percentage || 0) : audit.percentage,
      };
    });
  }, [comparison, selectedEntityKey]);

  const comparisonChartData = useMemo(() => chartAudits.map((audit, index) => {
    return {
      name: `A${index + 1}`,
      audit: audit.title,
      completed: Number(audit.percentage || 0),
      remaining: Math.max(0, 100 - Number(audit.percentage || 0)),
    };
  }), [chartAudits]);

  const loadCandidates = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const result = await auditApi.comparisonCandidates(accessToken);
      if (!result.success || !result.data) {
        setError(result.message || "Unable to load completed audits.");
        return;
      }
      const audits = result.data.audits || [];
      setCandidates(audits);
      const firstGroup = (() => {
        const counts = new Map<string, number>();
        audits.forEach((audit) => counts.set(audit.checklist_id, (counts.get(audit.checklist_id) || 0) + 1));
        return audits.find((audit) => (counts.get(audit.checklist_id) || 0) >= 2)?.checklist_id || "";
      })();
      setSelectedChecklistId(firstGroup);
      setSelectedAuditIds([]);
    } catch {
      setError("Unable to load completed audits. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isLoading) return;
    if (!admin) router.replace("/login");
    else if (isFirmAdmin) router.replace("/audits");
  }, [admin, isFirmAdmin, isLoading, router]);

  useEffect(() => {
    if (accessToken && !isFirmAdmin) void loadCandidates();
  }, [accessToken, isFirmAdmin, loadCandidates]);

  const toggleAudit = (auditId: string) => {
    setError("");
    setComparison(null);
    setSelectedAuditIds((current) => {
      if (current.includes(auditId)) return current.filter((id) => id !== auditId);
      if (current.length >= 5) {
        setError("You can compare up to 5 audits at once.");
        return current;
      }
      return [...current, auditId];
    });
  };

  const runComparison = async () => {
    if (!accessToken || selectedAuditIds.length < 2) {
      setError("Select at least two completed audits.");
      return;
    }
    setComparing(true);
    setError("");
    try {
      const result = await auditApi.compare(accessToken, selectedAuditIds);
      if (result.success && result.data) {
        setComparison(result.data);
        setSelectedEntityKey("all");
      } else {
        setError(result.message || "Unable to compare these audits.");
      }
    } catch {
      setError("Unable to compare these audits. Please try again.");
    } finally {
      setComparing(false);
    }
  };

  if (isLoading || loading) return <Loading />;
  if (!admin) return null;

  const completedCount = candidates.length;
  const selectedChecklist = checklistGroups.find((group) => group.id === selectedChecklistId);

  return (
    <main className="min-h-screen bg-transparent px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => comparison ? setComparison(null) : router.push("/audits")}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-gray-400 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
              aria-label={comparison ? "Back to comparison setup" : "Back to audits"}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
                <GitCompareArrows size={23} className="text-secondary-400" /> Audit Comparison
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-400">
                Compare completed audits that use the same checklist to spot score changes, repeated findings, and corrective-action trends.
              </p>
            </div>
          </div>
          {comparison && (
            <Button variant="secondary" onClick={() => setComparison(null)} leftIcon={<GitCompareArrows size={16} />}>
              New comparison
            </Button>
          )}
        </div>

        {!comparison && (
          <section className="rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.06] to-white/[0.015] p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/[0.08] pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="mt-1 text-lg font-bold text-white">Choose completed audits for comparison</h2>
                <p className="mt-1 text-sm text-gray-500">Select 2–5 audits. Results are aggregated by each audited organization entity.</p>
              </div>
              <div className="rounded-xl border border-secondary-500/20 bg-secondary-500/10 px-4 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-300">Eligible audits</p>
                <p className="mt-0.5 text-lg font-black text-white">{completedCount}</p>
              </div>
            </div>

            {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

            {checklistGroups.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No comparable audits yet"
                message="Complete at least two audits using the same checklist to start a comparison."
              />
            ) : (
              <>
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold text-gray-400">Audit group</span>
                    <div className="relative">
                      <select
                        value={selectedChecklistId}
                        onChange={(event) => {
                          setSelectedChecklistId(event.target.value);
                          setSelectedAuditIds([]);
                          setComparison(null);
                        }}
                        className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-[#0b2118] px-4 pr-10 text-sm font-semibold text-white outline-none transition focus:border-secondary-500/50"
                      >
                        {checklistGroups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name} · {group.audits.length} completed</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </label>
                  <div className="hidden rounded-xl border border-white/[0.08] bg-black/10 px-4 py-3 [&>p]:hidden">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><GitCompareArrows size={16} /></span>
                      <div>
                        <p className="text-xs font-bold text-gray-200">Select 2–5 completed audits</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">Choose the audits you want to review side by side.</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Selection</p>
                    <p className="mt-1 text-sm text-gray-300"><span className="font-bold text-white">{selectedAuditIds.length}</span> selected · choose between 2 and 5 completed audits</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 xl:grid-cols-2">
                  {availableAudits.map((audit) => {
                    const selected = selectedAuditIds.includes(audit.audit_id);
                    return (
                      <button
                        key={audit.audit_id}
                        type="button"
                        onClick={() => toggleAudit(audit.audit_id)}
                        className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${selected ? "border-secondary-400/60 bg-secondary-500/[0.12] shadow-lg shadow-secondary-950/10" : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.18] hover:bg-white/[0.04]"}`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-secondary-400 bg-secondary-500 text-primary-950" : "border-gray-600 text-transparent"}`}>
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2"><span className="truncate font-bold text-white">{audit.title}</span></span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1"><Calendar size={12} /> {dateLabel(audit.completed_at || audit.end_date)}</span>
                            <span>{audit.audit_type === "external" ? "External" : "Internal"}</span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-500">{selectedChecklist ? `Comparing audit results from “${selectedChecklist.name}”.` : ""}</p>
                  <Button onClick={runComparison} loading={comparing} disabled={selectedAuditIds.length < 2} leftIcon={<GitCompareArrows size={17} />}>
                    Compare selected audits
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {comparison && (
          <div className="space-y-6">
          

            <section>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={17} className="text-secondary-400" />
                  <div>
                    <h2 className="text-base font-bold text-white">{selectedEntity ? `${selectedEntity.name} performance` : "Overall performance"}</h2>
                    <p className="mt-0.5 text-xs text-gray-500">{selectedEntity ? `${selectedEntity.entityType} results across the selected audits.` : "Results across the selected audits."}</p>
                  </div>
                </div>
                <EntityFilterDropdown value={selectedEntityKey} options={entityOptions} onChange={setSelectedEntityKey} />
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChartData} margin={{ left: -16, right: 4, top: 12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="comparisonScoreGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#047857" stopOpacity={0.78} />
                        </linearGradient>
                        <linearGradient id="comparisonScoreRemaining" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.82} />
                          <stop offset="100%" stopColor="#991b1b" stopOpacity={0.58} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.52)", fontSize: 11, fontWeight: 700 }} dy={5} />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.05)" }}
                        contentStyle={{ backgroundColor: "rgba(2, 47, 43, 0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", fontSize: "12px" }}
                        formatter={(value, name) => {
                          const numericValue = Number(value || 0);
                          return `${numericValue}%`;
                        }}
                        labelFormatter={(_, items) => {
                          const item = items?.[0]?.payload as { audit?: string } | undefined;
                          return item?.audit || "";
                        }}
                      />
                      <Bar dataKey="completed" name="Completed score" stackId="score" fill="url(#comparisonScoreGreen)" barSize={Math.max(24, Math.min(58, 190 / Math.max(comparisonChartData.length, 1)))}>
                        <LabelList dataKey="completed" position="center" fill="#ffffff" fontSize={11} fontWeight={800} formatter={(value) => Number(value) > 0 ? `${value}%` : ""} />
                      </Bar>
                      <Bar dataKey="remaining" name="Remaining" stackId="score" fill="url(#comparisonScoreRemaining)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Completed score</span>
                  <span className="inline-flex items-center gap-1.5 text-red-300"><span className="h-2 w-2 rounded-full bg-red-500" /> Remaining</span>
                </div>
                <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1">
                  {chartAudits.map((audit, index) => (
                    <div key={audit.audit_id} className="w-48 shrink-0 rounded-lg bg-black/[0.12] px-3 py-2 text-center">
                      <p className="text-xs font-bold leading-5 text-white">A{index + 1} · {audit.title}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hidden grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {comparison.audits.map((audit, index) => {
                  const previous = comparison.audits[index - 1];
                  const difference = previous ? Number((audit.percentage - previous.percentage).toFixed(1)) : null;
                  return (
                    <article key={audit.audit_id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{audit.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{dateLabel(audit.completed_at || audit.end_date)} · {audit.audit_type === "external" ? "External" : "Internal"}</p>
                        </div>
                        <p className={`text-2xl font-black ${scoreTone(audit.percentage)}`}>{audit.percentage}%</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs">
                        <span className="text-gray-500">{audit.marks_obtained}/{audit.total_marks} marks</span>
                        {difference !== null && (
                          <span className={`inline-flex items-center gap-1 font-bold ${difference >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                            {difference >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {difference >= 0 ? "+" : ""}{difference}% vs previous
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {false && ((comparison: Comparison) => (
              <>
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Section performance</h2>
                  <p className="mt-1 text-xs text-gray-500">Scores grouped by the entity type used in this checklist.</p>
                </div>
                <span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs text-gray-400">{comparison.sections.length} sections</span>
              </div>
              <div className="space-y-4">
                {comparison.sections.map((section) => (
                  <div key={section.entity_type} className="rounded-xl border border-white/[0.07] bg-black/[0.12] p-4">
                    <h3 className="mb-3 text-sm font-bold text-white">{section.entity_type}</h3>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {section.audits.map((entry, index) => {
                        const audit = comparison.audits.find((item) => item.audit_id === entry.audit_id);
                        return (
                          <div key={entry.audit_id} className="rounded-lg bg-white/[0.035] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-semibold text-gray-300">{audit?.title || "Audit"}</p>
                              <p className={`text-sm font-black ${scoreTone(entry.percentage)}`}>{entry.percentage}%</p>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-gradient-to-r ${AUDIT_COLORS[index % AUDIT_COLORS.length]}`} style={{ width: `${Math.min(100, entry.percentage)}%` }} /></div>
                            <p className="mt-2 text-[11px] text-gray-500">{entry.marks_obtained}/{entry.total_marks} · {entry.open_corrective_action_count} open actions</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Question comparison</h2>
                  <p className="mt-1 text-xs text-gray-500">Open a question to review score changes, answers, remarks, evidence, and corrective actions.</p>
                </div>
                <span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs text-gray-400">{comparison.questions.length} matched questions</span>
              </div>
              <div className="space-y-3">
                {comparison.questions.map((question, questionIndex) => {
                  const scores = question.audits.filter((item) => item.available && typeof item.percentage === "number").map((item) => item.percentage || 0);
                  const range = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
                  return (
                    <details key={`${question.entity_type}-${questionIndex}`} className="group rounded-xl border border-white/[0.08] bg-black/[0.1] open:border-secondary-500/30">
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                        <ChevronDown size={17} className="shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-secondary-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-300">{question.entity_type}</span>
                            {range >= 15 && <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">Score changed</span>}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-white">{question.question_text}</p>
                        </div>
                        <span className="hidden text-right sm:block">
                          <span className="block text-[10px] uppercase tracking-wide text-gray-500">Score range</span>
                          <span className={`text-sm font-black ${range >= 15 ? "text-amber-300" : "text-gray-300"}`}>{range.toFixed(1)}%</span>
                        </span>
                      </summary>
                      <div className="grid gap-3 border-t border-white/[0.07] p-4 md:grid-cols-2 xl:grid-cols-3">
                        {question.audits.map((entry, index) => {
                          const audit = comparison.audits.find((item) => item.audit_id === entry.audit_id);
                          if (!entry.available) {
                            return <div key={entry.audit_id} className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-gray-500">{audit?.title}: not available</div>;
                          }
                          return (
                            <article key={entry.audit_id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 truncate text-xs font-bold text-white">{audit?.title || "Audit"}</p>
                                <p className={`text-lg font-black ${scoreTone(entry.percentage || 0)}`}>{entry.percentage}%</p>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full bg-gradient-to-r ${AUDIT_COLORS[index % AUDIT_COLORS.length]}`} style={{ width: `${Math.min(100, entry.percentage || 0)}%` }} /></div>
                              <p className="mt-2 text-[11px] text-gray-500">{entry.marks_obtained}/{entry.total_marks} marks · {entry.status}</p>
                              {entry.answer_summary && <p className="mt-3 text-xs leading-relaxed text-gray-300"><span className="font-semibold text-gray-500">Answer: </span>{entry.answer_summary}</p>}
                              {entry.remarks_summary && <p className="mt-2 text-xs leading-relaxed text-gray-400"><span className="font-semibold text-gray-500">Remarks: </span>{entry.remarks_summary}</p>}
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                <span className="rounded-md bg-white/[0.05] px-2 py-1 text-gray-400">{entry.evidence_count || 0} evidence</span>
                                <span className={`rounded-md px-2 py-1 ${entry.open_corrective_action_count ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
                                  {entry.open_corrective_action_count || 0} open actions
                                </span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
              {comparison.questions.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-500"><FileWarning className="mx-auto mb-2 text-gray-600" size={24} />No answered questions were found in the selected audits.</div>
              )}
            </section>
              </>
            ))(comparison as Comparison)}
          </div>
        )}
      </div>
    </main>
  );
}
