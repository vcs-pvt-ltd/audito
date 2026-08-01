"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditExecutionApi, capApi } from "@/lib/api";
import { dateValueKey, localDateKey } from "@/lib/auditSchedule";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import { IconButton } from "@/components/ui";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  HelpCircle,
  Search,
  User,
} from "lucide-react";

type SourceType = "audit" | "cap";
type RequiredRole = "admin" | "organization_user";

interface TreeNode {
  code?: string;
  name?: string;
  entity_type?: string;
  edge_id?: string | number | null;
  children?: TreeNode[];
}

interface CorrectiveActionItem {
  response_id?: string;
  entity_code?: string;
  org_tree_id?: string | number | null;
  assigned_org_tree_id?: string | number | null;
  question_text?: string;
  answer_text?: string | null;
  remarks?: string | null;
  marks_obtained?: string | number | null;
  total_marks?: string | number | null;
  order_index?: number | null;
  responsible_organization_user?: {
    first_name?: string;
    last_name?: string;
  } | null;
}

interface CorrectiveAction {
  id?: string;
  corrective_action_id?: string;
  audit_response_id?: string | null;
  cap_response_id?: string | null;
  response_id?: string | null;
  entity_code?: string;
  org_tree_id?: string | number | null;
  description?: string | null;
  severity?: string | null;
  responsible_person_name?: string | null;
  due_date?: string | null;
  status?: string | null;
  resolution_notes?: string | null;
  created_at?: string | null;
}

interface CorrectiveActionsPayload {
  audit?: { audit_id: string; title?: string; status?: string };
  cap?: { cap_id: string; title?: string; status?: string };
  items?: CorrectiveActionItem[];
  corrective_actions?: CorrectiveAction[];
  tree?: TreeNode | null;
}

interface Props {
  sourceType: SourceType;
  requiredRole: RequiredRole;
  backPath: string;
  backIdParam: string;
}

const STATUS_STYLE: Record<string, string> = {
  open: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  in_progress: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  resolved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  verified: "border-teal-500/25 bg-teal-500/10 text-teal-300",
  closed: "border-gray-500/25 bg-gray-500/10 text-gray-300",
};

function label(value?: string | null) {
  return String(value || "open").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function fmtDate(value?: string | null) {
  const key = dateValueKey(value);
  if (!key) return "Not set";
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function responseId(action: CorrectiveAction) {
  return action.audit_response_id || action.cap_response_id || action.response_id || "";
}

interface ActionViewRow {
  action: CorrectiveAction;
  item?: CorrectiveActionItem;
  entityName: string;
  entityKey: string;
  status: string;
  overdue: boolean;
  responsible: string;
}

function CorrectiveActionCard({ row, index, showStatus, viewerRole }: { row: ActionViewRow; index: number; showStatus: boolean; viewerRole: RequiredRole }) {
  const { action, item, entityName, status, overdue, responsible } = row;
  const questionNumber = Number(item?.order_index ?? index) + 1;
  const obtainedMarks = Number(item?.marks_obtained ?? 0);
  const totalMarks = Number(item?.total_marks ?? 0);
  const hasMarks = item?.marks_obtained !== null && item?.marks_obtained !== undefined;
  const showEntity = viewerRole !== "admin" && viewerRole !== "organization_user";
  const showResponsible = viewerRole !== "organization_user";
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold leading-relaxed text-white sm:text-base">
            <span className="mr-2 text-secondary-400">{questionNumber}.</span>
            {item?.question_text || "Corrective action"}
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {hasMarks && (
            <span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-bold text-secondary-300">
              {obtainedMarks}{totalMarks > 0 ? ` / ${totalMarks}` : ""} marks
            </span>
          )}
          {showStatus && (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[status] || STATUS_STYLE.open}`}>
              {label(status)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/10 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Action details</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">
          {action.description || item?.remarks || "No additional action description was provided."}
        </p>
        {item?.answer_text && (
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Recorded response</p>
            <p className="mt-1 text-sm text-gray-300">{item.answer_text}</p>
          </div>
        )}
        {action.resolution_notes && (
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Resolution notes</p>
            <p className="mt-1 text-sm text-gray-300">{action.resolution_notes}</p>
          </div>
        )}
      </div>

      <div className={`mt-4 grid grid-cols-1 gap-3 ${showEntity && showResponsible ? "sm:grid-cols-3" : showEntity || showResponsible ? "sm:grid-cols-2" : ""}`}>
        {showEntity && (
          <div className="flex items-start gap-2 rounded-xl bg-white/[0.02] p-3">
            <Building2 size={15} className="mt-0.5 shrink-0 text-gray-500" />
            <div><p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Entity</p><p className="mt-1 text-xs font-semibold text-gray-300">{entityName}</p></div>
          </div>
        )}
        {showResponsible && (
          <div className="flex items-start gap-2 rounded-xl bg-white/[0.02] p-3">
            <User size={15} className="mt-0.5 shrink-0 text-gray-500" />
            <div><p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Responsible</p><p className="mt-1 text-xs font-semibold text-gray-300">{responsible}</p></div>
          </div>
        )}
        <div className={`flex items-start gap-2 rounded-xl p-3 ${overdue ? "bg-red-500/[0.07]" : "bg-white/[0.02]"}`}>
          {overdue ? <Clock3 size={15} className="mt-0.5 shrink-0 text-red-400" /> : <Calendar size={15} className="mt-0.5 shrink-0 text-gray-500" />}
          <div><p className={`text-[9px] font-bold uppercase tracking-wider ${overdue ? "text-red-400/70" : "text-gray-600"}`}>Due date</p><p className={`mt-1 text-xs font-semibold ${overdue ? "text-red-300" : "text-gray-300"}`}>{fmtDate(action.due_date)}{overdue ? " · Past due" : ""}</p></div>
        </div>
      </div>
    </article>
  );
}

function pruneActionTree(node: TreeNode, entityKeys: Set<string>): TreeNode | null {
  const children = (node.children || []).map((child) => pruneActionTree(child, entityKeys)).filter(Boolean) as TreeNode[];
  const key = `${node.code || ""}__${node.edge_id ?? "null"}`;
  return entityKeys.has(key) || children.length > 0 ? { ...node, children } : null;
}

function AuditActionTreeNode({ node, depth, rowsByEntity, viewerRole }: { node: TreeNode; depth: number; rowsByEntity: Map<string, ActionViewRow[]>; viewerRole: RequiredRole }) {
  const entityKey = `${node.code || ""}__${node.edge_id ?? "null"}`;
  const entityRows = rowsByEntity.get(entityKey) || [];
  const [expanded, setExpanded] = useState(entityRows.length > 0 || depth === 0);
  const hasContent = entityRows.length > 0 || (node.children || []).length > 0;
  const indent = Math.min(depth, 3) * 24;

  return (
    <div className="relative">
      <div className="relative" style={{ paddingLeft: indent }}>
        {depth > 0 && (
          <>
            <div className="absolute bottom-0 top-0 w-px bg-white/[0.06]" style={{ left: indent - 11 }} />
            <div className="absolute top-[22px] h-px w-3 bg-white/[0.06]" style={{ left: indent - 11 }} />
          </>
        )}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all sm:px-4 ${entityRows.length ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]" : "border-transparent hover:bg-white/[0.02]"}`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-gray-400">
            {hasContent ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null}
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-secondary-500/20 bg-secondary-500/10 text-secondary-400">
            <Building2 size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-500">{node.entity_type || "Entity"}</span>
            <span className="block truncate text-sm font-semibold text-white">{node.name || "Assigned entity"}</span>
          </span>
          {entityRows.length > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              <HelpCircle size={10} /> {entityRows.length}
            </span>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-3">
          {entityRows.length > 0 && (
            <div className="space-y-3" style={{ paddingLeft: Math.min(depth + 1, 4) * 24 }}>
              {entityRows.map((row, index) => (
                <CorrectiveActionCard key={row.action.id || row.action.corrective_action_id || `${responseId(row.action)}-${index}`} row={row} index={index} showStatus={false} viewerRole={viewerRole} />
              ))}
            </div>
          )}
          {(node.children || []).map((child) => (
            <AuditActionTreeNode key={`${child.code || ""}__${child.edge_id ?? "null"}`} node={child} depth={depth + 1} rowsByEntity={rowsByEntity} viewerRole={viewerRole} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CorrectiveActionsViewer({ sourceType, requiredRole, backPath, backIdParam }: Props) {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceId = searchParams.get("id") || "";

  const [payload, setPayload] = useState<CorrectiveActionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const backUrl = sourceId ? `${backPath}?${backIdParam}=${encodeURIComponent(sourceId)}` : backPath;

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== requiredRole)) router.replace("/login");
  }, [admin, isLoading, requiredRole, router]);

  useEffect(() => {
    if (!sourceId) {
      router.replace(backPath);
      return;
    }
    if (!accessToken) return;

    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = sourceType === "audit"
          ? await auditExecutionApi.getCorrectiveActions(accessToken, sourceId)
          : await capApi.getCorrectiveActions(accessToken, sourceId);
        if (!active) return;
        if (res.success && res.data) setPayload(res.data as CorrectiveActionsPayload);
        else setError(res.message || "Failed to load corrective actions.");
      } catch {
        if (active) setError("Unable to load corrective actions.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [accessToken, backPath, router, sourceId, sourceType]);

  const itemByResponse = useMemo(() => {
    const map = new Map<string, CorrectiveActionItem>();
    for (const item of payload?.items || []) {
      if (item.response_id) map.set(String(item.response_id), item);
    }
    return map;
  }, [payload]);

  const entityNames = useMemo(() => {
    const exact = new Map<string, string>();
    const byCode = new Map<string, Set<string>>();
    const keysByCode = new Map<string, Set<string>>();
    const walk = (node?: TreeNode | null) => {
      if (!node) return;
      if (node.code && node.name) {
        const key = `${node.code}__${node.edge_id ?? "null"}`;
        exact.set(key, node.name);
        if (!byCode.has(node.code)) byCode.set(node.code, new Set());
        byCode.get(node.code)?.add(node.name);
        if (!keysByCode.has(node.code)) keysByCode.set(node.code, new Set());
        keysByCode.get(node.code)?.add(key);
      }
      for (const child of node.children || []) walk(child);
    };
    walk(payload?.tree);
    return { exact, byCode, keysByCode };
  }, [payload]);

  const rows = useMemo(() => (payload?.corrective_actions || []).map((action) => {
    const item = itemByResponse.get(responseId(action));
    const code = action.entity_code || item?.entity_code || "";
    const edgeId = action.org_tree_id ?? item?.org_tree_id ?? item?.assigned_org_tree_id ?? null;
    const requestedEntityKey = `${code}__${edgeId ?? "null"}`;
    const codeKeys = entityNames.keysByCode.get(code);
    const entityKey = entityNames.exact.has(requestedEntityKey)
      ? requestedEntityKey
      : (codeKeys?.size === 1 ? [...codeKeys][0] : requestedEntityKey);
    const exactName = entityNames.exact.get(entityKey);
    const codeNames = entityNames.byCode.get(code);
    const entityName = exactName || (codeNames?.size === 1 ? [...codeNames][0] : "Assigned entity");
    const organizationUser = item?.responsible_organization_user;
    const fallbackResponsible = organizationUser
      ? `${organizationUser.first_name || ""} ${organizationUser.last_name || ""}`.trim()
      : "";
    const status = String(action.status || "open").toLowerCase();
    const dueDateKey = dateValueKey(action.due_date);
    const overdue = Boolean(dueDateKey)
      && dueDateKey < localDateKey()
      && (sourceType === "audit" || !["resolved", "verified", "closed"].includes(status));
    return {
      action,
      item,
      entityName,
      entityKey,
      status,
      overdue,
      responsible: action.responsible_person_name || fallbackResponsible || "Not assigned",
    };
  }), [entityNames, itemByResponse, payload, sourceType]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (sourceType === "cap" && statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = [
        row.item?.question_text,
        row.action.description,
        row.item?.remarks,
        row.entityName,
        row.responsible,
        sourceType === "cap" ? row.status : "",
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, rows, sourceType, statusFilter]);

  const source = sourceType === "audit" ? payload?.audit : payload?.cap;
  const openCount = rows.filter((row) => !["resolved", "verified", "closed"].includes(row.status)).length;
  const overdueCount = rows.filter((row) => row.overdue).length;
  const entityCount = new Set(rows.map((row) => row.entityKey)).size;
  const auditRowsByEntity = useMemo(() => {
    const map = new Map<string, ActionViewRow[]>();
    for (const row of filteredRows) {
      if (!map.has(row.entityKey)) map.set(row.entityKey, []);
      map.get(row.entityKey)?.push(row);
    }
    return map;
  }, [filteredRows]);
  const auditTree = useMemo(() => {
    if (sourceType !== "audit" || !payload?.tree) return null;
    return pruneActionTree(payload.tree, new Set(auditRowsByEntity.keys()));
  }, [auditRowsByEntity, payload, sourceType]);

  if (isLoading || loading) return <Loading />;
  if (!admin || admin.role !== requiredRole) return null;

  return (
    <div className="min-h-full px-4 pb-12 pt-20 text-white sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start gap-3">
          <IconButton bordered onClick={() => router.push(backUrl)} title="Back to details">
            <ArrowLeft size={17} />
          </IconButton>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <ClipboardCheck size={23} className="text-secondary-400" />
              Corrective Actions
            </h1>
            <p className="mt-1 truncate text-sm text-gray-400">
              {source?.title || `${sourceType === "audit" ? "Audit" : "CAP"} corrective-action details`}
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <AlertTriangle size={36} className="mx-auto mb-3 text-red-400" />
            <p className="font-semibold text-red-300">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No corrective actions"
            message={`This ${sourceType} does not have any corrective actions.`}
          />
        ) : (
          <>
          

            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search actions, entities, or responsible users..."
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/10 pl-10 pr-3 text-sm text-white outline-none focus:border-secondary-500/40"
                />
              </div>
              {sourceType === "cap" && (
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 rounded-xl border border-white/10 bg-[#0b261a] px-3 text-sm text-white outline-none focus:border-secondary-500/40"
                >
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="verified">Verified</option>
                  <option value="closed">Closed</option>
                </select>
              )}
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState icon={Search} title="No matching actions" message={sourceType === "audit" ? "Try another search." : "Try another search or status filter."} />
            ) : sourceType === "audit" && auditTree ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-5">
                <div className="mb-4 border-b border-white/[0.06] pb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">Organization hierarchy</p>
                  <p className="mt-1 text-xs text-gray-500">Expand an entity to review its corrective actions.</p>
                </div>
                <AuditActionTreeNode node={auditTree} depth={0} rowsByEntity={auditRowsByEntity} viewerRole={requiredRole} />
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRows.map(({ action, item, entityName, status, overdue, responsible }, index) => (
                  <article key={action.id || action.corrective_action_id || `${responseId(action)}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <h2 className="text-base font-bold leading-relaxed text-white">
                          <span className="mr-2 text-secondary-400">{Number(item?.order_index ?? index) + 1}.</span>
                          {item?.question_text || "Corrective action"}
                        </h2>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item?.marks_obtained !== null && item?.marks_obtained !== undefined && (
                          <span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-bold text-secondary-300">
                            {Number(item.marks_obtained || 0)}{Number(item.total_marks || 0) > 0 ? ` / ${Number(item.total_marks)}` : ""} marks
                          </span>
                        )}
                        {sourceType === "cap" && (
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${STATUS_STYLE[status] || STATUS_STYLE.open}`}>
                            {label(status)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/10 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Action details</p>
                      <p className="mt-2 text-sm leading-relaxed text-gray-300">
                        {action.description || item?.remarks || "No additional action description was provided."}
                      </p>
                      {item?.answer_text && (
                        <div className="mt-3 border-t border-white/[0.06] pt-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Recorded response</p>
                          <p className="mt-1 text-sm text-gray-300">{item.answer_text}</p>
                        </div>
                      )}
                      {action.resolution_notes && (
                        <div className="mt-3 border-t border-white/[0.06] pt-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Resolution notes</p>
                          <p className="mt-1 text-sm text-gray-300">{action.resolution_notes}</p>
                        </div>
                      )}
                    </div>

                    <div className={`mt-4 grid grid-cols-1 gap-3 ${requiredRole === "admin" ? "sm:grid-cols-2" : ""}`}>
                      {requiredRole !== "admin" && requiredRole !== "organization_user" && (
                        <div className="flex items-start gap-2 rounded-xl bg-white/[0.02] p-3">
                          <Building2 size={15} className="mt-0.5 shrink-0 text-gray-500" />
                          <div><p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Entity</p><p className="mt-1 text-xs font-semibold text-gray-300">{entityName}</p></div>
                        </div>
                      )}
                      {requiredRole !== "organization_user" && (
                        <div className="flex items-start gap-2 rounded-xl bg-white/[0.02] p-3">
                          <User size={15} className="mt-0.5 shrink-0 text-gray-500" />
                          <div><p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">Responsible</p><p className="mt-1 text-xs font-semibold text-gray-300">{responsible}</p></div>
                        </div>
                      )}
                      <div className={`flex items-start gap-2 rounded-xl p-3 ${overdue ? "bg-red-500/[0.07]" : "bg-white/[0.02]"}`}>
                        {overdue ? <Clock3 size={15} className="mt-0.5 shrink-0 text-red-400" /> : <Calendar size={15} className="mt-0.5 shrink-0 text-gray-500" />}
                        <div><p className={`text-[9px] font-bold uppercase tracking-wider ${overdue ? "text-red-400/70" : "text-gray-600"}`}>Due date</p><p className={`mt-1 text-xs font-semibold ${overdue ? "text-red-300" : "text-gray-300"}`}>{fmtDate(action.due_date)}{overdue ? " · Past due" : ""}</p></div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
