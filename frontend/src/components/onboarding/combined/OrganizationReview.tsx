"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, LockKeyhole, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import type { OrganizationAiDraftNode } from "@/lib/api";
import { ENTITY_TYPE_COLORS } from "@/utils/executionFormatters";
import { PARENTS, ROOT_AREA, childTypesOf, isUnplacedRecord, preferredParentChoices } from "./model";
import { SectionHeader, inputClass } from "./ui";

type EntityRecord = { code: string; name: string; entity_type: string };
const typeBadge = (type: string) => ENTITY_TYPE_COLORS[type] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";

/** Areas in tree order, each with its depth below the registered organization. */
export function orderedAreas(nodes: OrganizationAiDraftNode[]) {
  const ids = new Set(nodes.map(n => n.id));
  const children = new Map<string, OrganizationAiDraftNode[]>();
  for (const node of nodes) {
    const parent = node.parent_id && ids.has(node.parent_id) ? node.parent_id : ROOT_AREA;
    children.set(parent, [...(children.get(parent) || []), node]);
  }
  const ordered: { node: OrganizationAiDraftNode; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (parent: string, depth: number) => {
    for (const node of children.get(parent) || []) {
      if (seen.has(node.id)) continue;
      seen.add(node.id); ordered.push({ node, depth }); visit(node.id, depth + 1);
    }
  };
  visit(ROOT_AREA, 1);
  return ordered;
}

/** The organization as a tree: the registered organization with its areas below. */
export type AreaTreeNode = { id: string; type: string; name: string; children: AreaTreeNode[] };
export function buildAreaTree(root: string, rootName: string, nodes: OrganizationAiDraftNode[]): AreaTreeNode {
  const ids = new Set(nodes.map(n => n.id));
  const children = new Map<string, OrganizationAiDraftNode[]>();
  for (const node of nodes) {
    const parent = node.parent_id && ids.has(node.parent_id) ? node.parent_id : ROOT_AREA;
    children.set(parent, [...(children.get(parent) || []), node]);
  }
  const seen = new Set<string>();
  const build = (node: OrganizationAiDraftNode): AreaTreeNode => {
    seen.add(node.id);
    return { id: node.id, type: node.entity_type, name: node.name.trim(), children: (children.get(node.id) || []).filter(child => !seen.has(child.id)).map(build) };
  };
  return { id: ROOT_AREA, type: root, name: rootName || root, children: (children.get(ROOT_AREA) || []).map(build) };
}
/** Ids of every area in the tree that has areas below it. */
export function parentIds(node: AreaTreeNode, ids: string[] = []) {
  if (node.children.length) { ids.push(node.id); node.children.forEach(child => parentIds(child, ids)); }
  return ids;
}

/**
 * Collapsible organization list, like the list view of the organization page:
 * the arrow shows or hides the areas below, the row itself is selected. An
 * optional panel (for example the area's questions) opens under its row.
 */
export function AreaTree({ node, depth = 0, collapsed, onToggle, onSelect, issueOf, trailingOf, openOf, panelOf }: {
  node: AreaTreeNode; depth?: number;
  /** Areas whose children are hidden. */
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  issueOf?: (id: string) => boolean;
  trailingOf?: (id: string) => ReactNode;
  /** Whether the row's panel is open (the row then shows as open). */
  openOf?: (id: string) => boolean;
  panelOf?: (id: string) => ReactNode;
}) {
  const open = !collapsed.has(node.id);
  const issue = issueOf?.(node.id);
  const selected = openOf?.(node.id);
  return <li>
    <div className={`flex items-center gap-1.5 rounded-xl border px-1.5 py-1.5 transition-colors ${issue ? "border-red-400/40 bg-red-400/[.06]" : selected ? "border-secondary-400/40 bg-secondary-500/10" : depth === 0 ? "border-secondary-400/15 bg-secondary-500/[.06]" : "border-white/[.06] bg-white/[.02] hover:bg-white/[.04]"}`}>
      <button type="button" disabled={!node.children.length} onClick={() => onToggle(node.id)} aria-expanded={node.children.length ? open : undefined}
        aria-label={node.children.length ? `${open ? "Hide" : "Show"} ${node.children.length} area${node.children.length === 1 ? "" : "s"} under ${node.name || node.type}` : undefined}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 enabled:hover:bg-white/[.05] enabled:hover:text-white">
        {node.children.length ? (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : <span className="h-1.5 w-1.5 rounded-full bg-gray-600" aria-hidden />}
      </button>
      <button type="button" onClick={() => onSelect(node.id)} aria-expanded={openOf ? Boolean(selected) : undefined} className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-lg text-left">
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none ${typeBadge(node.type)}`}>{node.type}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${depth === 0 ? "font-bold text-secondary-100" : node.name ? "font-medium text-gray-100" : "italic text-red-200"}`}>{node.name || "Enter a name"}</span>
        {issue && <AlertTriangle size={14} className="shrink-0 text-red-300" aria-label="Needs attention" />}
        {trailingOf?.(node.id)}
      </button>
    </div>
    {panelOf?.(node.id)}
    {node.children.length > 0 && open && <ul className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-2 sm:ml-5 sm:pl-3">
      {node.children.map(child => <AreaTree key={child.id} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} issueOf={issueOf} trailingOf={trailingOf} openOf={openOf} panelOf={panelOf} />)}
    </ul>}
  </li>;
}

/** Shows or hides the areas below an area. */
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return { collapsed, setCollapsed, toggle };
}

export default function OrganizationReview({ root, rootName, nodes, nodeIssues, availableTypes, availableRecords, busy, onChangeNode, onAddArea, onRemove, onRestore }: {
  root: string; rootName: string; nodes: OrganizationAiDraftNode[]; nodeIssues: Map<string, string>;
  availableTypes: string[]; availableRecords: EntityRecord[]; busy: boolean;
  onChangeNode: (id: string, fields: Partial<OrganizationAiDraftNode>) => void;
  onAddArea: (type: string, parentId: string | null, record?: EntityRecord) => string;
  onRemove: (id: string) => void; onRestore: (id: string) => void;
}) {
  // The area open in the edit dialog (ROOT_AREA for the organization); null when closed.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = useMemo(() => nodes.filter(n => !n.is_removed), [nodes]);
  const removed = nodes.filter(n => n.is_removed);
  const tree = useMemo(() => buildAreaTree(root, rootName, active), [root, rootName, active]);
  const { collapsed, setCollapsed, toggle } = useCollapsed();
  const selected = !selectedId || selectedId === ROOT_AREA ? null : active.find(n => n.id === selectedId) || null;
  // Close the dialog when its area is removed from the draft.
  useEffect(() => { if (selectedId && selectedId !== ROOT_AREA && !active.some(n => n.id === selectedId)) setSelectedId(null); }, [active, selectedId]);

  const close = () => setSelectedId(null);
  const addHere = (type: string, record?: EntityRecord) => {
    const parentId = selected && PARENTS[type]?.includes(selected.entity_type) ? selected.id : null;
    setSelectedId(onAddArea(type, parentId, record));
  };
  const preferredParents = selected && !selected.source_edge_id ? preferredParentChoices(active, selected, root) : [];
  const parentChoices = selected ? active.filter(n => n.id !== selected.id && PARENTS[selected.entity_type]?.includes(n.entity_type)
    && (!preferredParents.length || preferredParents.some(parent => parent.id === n.id))) : [];
  const childChoices = (selected ? childTypesOf(selected.entity_type) : childTypesOf(root)).filter(type => availableTypes.includes(type));
  const recordChoices = availableRecords.filter(record => childChoices.includes(record.entity_type));
  const branchHasRecord = selected ? nodes.some(n => n.source_edge_id && n.id !== selected.id && isBelow(nodes, n, selected.id)) : false;
  const issueCount = active.filter(n => nodeIssues.has(n.id)).length;

  return <section className="space-y-4">
    <SectionHeader title="Check your organization" description="Tap an area to change it. Use the arrows to show or hide the areas below."
      actions={<>
        <Button size="sm" variant="ghost" onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(parentIds(tree)))}>{collapsed.size ? "Expand all" : "Collapse all"}</Button>
        <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} disabled={busy} onClick={() => setSelectedId(ROOT_AREA)}>Add area</Button>
      </>} />
    {issueCount > 0 && <p role="status" className="flex items-center gap-2 text-sm font-semibold text-red-200"><AlertTriangle size={15} aria-hidden />Fix {issueCount} area{issueCount === 1 ? "" : "s"} marked in red.</p>}

    <ul className="space-y-1">
      <AreaTree node={tree} collapsed={collapsed} onToggle={toggle} onSelect={setSelectedId} issueOf={id => nodeIssues.has(id)} />
    </ul>
    {!active.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-400">No areas found. Use Add area.</p>}

    {removed.length > 0 && <details className="rounded-xl bg-white/[.03] px-4 py-3 text-sm text-gray-400">
      <summary className="cursor-pointer text-xs font-semibold">Removed ({removed.length})</summary>
      <ul className="mt-2 space-y-1">{removed.map(node => <li key={node.id} className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{node.entity_type} · {node.name || "Unnamed"}</span><button type="button" disabled={busy} className="flex items-center gap-1 text-secondary-300" onClick={() => onRestore(node.id)}><RotateCcw size={12} />Restore</button></li>)}</ul>
    </details>}

    <Modal open={selectedId !== null} onClose={close} size="md"
      title={selected ? selected.name.trim() || `New ${selected.entity_type.toLowerCase()}` : rootName || root}
      description={selected ? selected.entity_type : root}
      footer={<>
        {selected && <Button variant="ghost" leftIcon={<Trash2 size={14} />} disabled={busy || selected.is_locked || Boolean(selected.source_edge_id) || branchHasRecord}
          title={selected.source_edge_id ? "Existing areas can be removed in Organization Mapping" : branchHasRecord ? "Move existing areas out of this branch first" : undefined}
          onClick={() => { onRemove(selected.id); close(); }} className="sm:mr-auto">Remove</Button>}
        <Button onClick={close}>Done</Button>
      </>}>
      {selected && <div className="space-y-4">
        {nodeIssues.has(selected.id) && <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-400/10 p-2.5 text-xs text-red-200"><AlertTriangle size={14} />{nodeIssues.get(selected.id)}</p>}
        {selected.is_locked && <p className="flex items-start gap-2 rounded-xl bg-amber-400/[.08] p-2.5 text-xs text-amber-100"><LockKeyhole size={14} className="mt-0.5 shrink-0" />In use. It cannot be changed here.</p>}
        <label className="block text-sm text-gray-300">Name
          <input className={`${inputClass} mt-1`} value={selected.name} autoFocus placeholder="Area name" aria-invalid={!selected.name.trim()}
            disabled={busy || selected.is_locked || isUnplacedRecord(selected)} onChange={event => onChangeNode(selected.id, { name: event.target.value })}
            onKeyDown={event => { if (event.key === "Enter" && selected.name.trim()) close(); }} />
        </label>
        <label className="block text-sm text-gray-300">Belongs to
          <select className={`${inputClass} mt-1`} disabled={busy || selected.is_locked} value={selected.parent_id || ""} onChange={event => onChangeNode(selected.id, { parent_id: event.target.value || null })}>
            <option value="" disabled={!PARENTS[selected.entity_type]?.includes(root) || preferredParents.length > 0}>{rootName || root}</option>
            {parentChoices.map(parent => <option key={parent.id} value={parent.id}>{parent.entity_type} · {parent.name || "Unnamed"}</option>)}
          </select>
        </label>
      </div>}

      {(childChoices.length > 0 || recordChoices.length > 0) && <div className={`space-y-3 ${selected ? "mt-5 border-t border-white/10 pt-4" : ""}`}>
        <p className="text-sm font-semibold text-white">Add below {selected ? selected.name.trim() || "this area" : rootName || root}</p>
        {childChoices.length > 0 && <div className="flex flex-wrap gap-2">{childChoices.map(type => <Button key={type} size="sm" variant="secondary" leftIcon={<Plus size={13} />} disabled={busy} onClick={() => addHere(type)}>{type}</Button>)}</div>}
        {recordChoices.length > 0 && <select aria-label="Add one of your existing entities" className={inputClass} value="" disabled={busy} onChange={event => { const record = recordChoices.find(r => `${r.entity_type}|${r.code}` === event.target.value); if (record) addHere(record.entity_type, record); }}>
          <option value="">Or add an existing one…</option>
          {recordChoices.map(record => <option key={`${record.entity_type}|${record.code}`} value={`${record.entity_type}|${record.code}`}>{record.entity_type} · {record.name}</option>)}
        </select>}
      </div>}
    </Modal>
  </section>;
}

function isBelow(nodes: OrganizationAiDraftNode[], node: OrganizationAiDraftNode, ancestorId: string) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const seen = new Set<string>();
  for (let parent = node.parent_id; parent && !seen.has(parent); parent = byId.get(parent)?.parent_id || null) {
    if (parent === ancestorId) return true;
    seen.add(parent);
  }
  return false;
}
