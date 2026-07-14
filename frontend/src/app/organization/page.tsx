"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { orgTreeApi } from "@/lib/api";

import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Building2,
  Plus,
  RefreshCw,
  Search,
  ArrowRight,
  Trash2,
  X,
  TreePine,
} from "lucide-react";
import LimitReachedModal from "@/components/modals/LimitReachedModal";
import { Button, IconButton } from "@/components/ui";

// ─── Config ──────────────────────────────────────────────────────

const PLURALS: Record<string, string> = {
  "Buying Office": "Buying Offices",
  "Audit Firm": "Audit Firms",
  Company: "Companies",
  Factory: "Factories",
  Section: "Sections",
};

function pluralize(type: string): string {
  return PLURALS[type] ?? `${type}s`;
}

/** Stable color per entity type for the avatar circle */
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Buying Office": { bg: "bg-violet-500/20", text: "text-violet-300", border: "border-violet-500/30" },
  "Audit Firm":   { bg: "bg-amber-500/20",  text: "text-amber-300",  border: "border-amber-500/30"  },
  Company:        { bg: "bg-sky-500/20",     text: "text-sky-300",    border: "border-sky-500/30"    },
  Factory:        { bg: "bg-emerald-500/20", text: "text-emerald-300",border: "border-emerald-500/30"},
  Section:        { bg: "bg-rose-500/20",    text: "text-rose-300",   border: "border-rose-500/30"   },
};
const DEFAULT_COLOR = { bg: "bg-secondary-500/20", text: "text-secondary-300", border: "border-secondary-500/30" };

function getTypeColor(type: string) {
  return TYPE_COLORS[type] ?? DEFAULT_COLOR;
}

/** Two-letter initials from a name */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Types ───────────────────────────────────────────────────────

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: string | number;
  parent_edge_id?: string | number | null;
  is_partner_root?: boolean;
  children: TreeNode[];
  [key: string]: unknown;
}

interface EntityOption {
  code: string;
  name: string;
  entity_type: string;
  [key: string]: unknown;
}

function nodeKey(node: Pick<TreeNode, "code" | "edge_id">): string {
  return `${node.code}__${node.edge_id ?? "null"}`;
}

// ─── Hierarchy Guide ─────────────────────────────────────────────

function HierarchyGuide({ paths }: { paths: string[] }) {
  const [open, setOpen] = useState(false);
  if (!paths || paths.length === 0) return null;

  return (
    <div className="glass rounded-xl mb-5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs text-gray-400">Organization Structure Levels</span>
        {open ? (
          <ChevronDown size={13} className="text-gray-500" />
        ) : (
          <ChevronRight size={13} className="text-gray-500" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {paths.map((level, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full border ${
                    i === 0
                      ? "bg-secondary-500/15 text-secondary-400 border-secondary-500/30 font-medium"
                      : "bg-white/5 text-gray-300 border-white/10"
                  }`}
                >
                  {level}
                </span>
                {i < paths.length - 1 && (
                  <ArrowRight size={11} className="text-gray-600" />
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Entity Panel ─────────────────────────────────────────────

function AddEntityPanel({
  childType,
  existingChildCodes,
  accessToken,
  onAdded,
  onClose,
}: {
  childType: string;
  existingChildCodes: Set<string>;
  accessToken: string;
  onAdded: (entities: EntityOption[]) => void;
  onClose: () => void;
}) {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    orgTreeApi
      .listEntities(accessToken, childType)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setEntities((res.data as { items: EntityOption[] }).items);
        } else {
          setError("Failed to load.");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Network error.");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [accessToken, childType]);

  const handleAddOne = (entity: EntityOption) => { onAdded([entity]); };

  const handleToggleSelected = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSelectAllFiltered = (codes: string[]) => {
    setSelected((prev) => { const next = new Set(prev); for (const c of codes) next.add(c); return next; });
  };

  const handleClearSelection = () => setSelected(new Set());

  const handleAdd = () => {
    const queue = entities.filter((e) => selected.has(e.code));
    if (queue.length === 0) return;
    onAdded(queue);
    setSelected(new Set());
  };

  const available = entities
    .filter((e) => !existingChildCodes.has(e.code))
    .filter(
      (e) =>
        !search ||
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.code.toLowerCase().includes(search.toLowerCase())
    );

  const availableCodes = available.map((e) => e.code);
  const selectedCount = availableCodes.reduce((acc, c) => acc + (selected.has(c) ? 1 : 0), 0);

  return (
    <div className="mt-1.5 bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <span className="text-xs text-gray-400 font-medium">Add {childType}</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-0.5">
          <X size={13} />
        </button>
      </div>
      <div className="p-2.5">
        <div className="relative mb-2">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder={`Search ${pluralize(childType).toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-secondary-500/50 placeholder:text-gray-600"
            autoFocus
          />
        </div>
        {error && <p className="text-red-400 text-xs px-1 mb-2">{error}</p>}
        {available.length > 0 && (
          <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
            <div className="text-[10px] text-gray-500">
              Selected: <span className="text-gray-400 font-medium">{selectedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <button type="button" onClick={() => handleSelectAllFiltered(availableCodes)} disabled={available.length === 0}
                className="text-[10px] px-2 py-1 rounded border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50">
                Select All
              </button>
              <button type="button" onClick={handleClearSelection} disabled={selected.size === 0}
                className="text-[10px] px-2 py-1 rounded border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50">
                Clear
              </button>
              <button type="button" onClick={handleAdd} disabled={selectedCount === 0}
                className="text-[10px] px-2 py-1 rounded border border-secondary-500/20 bg-secondary-500/10 text-secondary-300 hover:bg-secondary-500/15 transition-all disabled:opacity-50 shadow-[0_0_10px_rgba(var(--secondary-500),0.1)]">
                Add
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-3 px-1">
            <div className="w-3 h-3 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500">Loading...</span>
          </div>
        ) : available.length === 0 ? (
          <p className="text-gray-500 text-xs py-2 px-1">
            {entities.length === 0
              ? `No ${pluralize(childType).toLowerCase()} found. Create them in Setup Structure first.`
              : search
              ? "No matches found."
              : `All ${pluralize(childType).toLowerCase()} already added.`}
          </p>
        ) : (
          <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
            {available.map((entity) => (
              <div key={entity.code}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/5 text-left transition-all group/add">
                <button type="button" onClick={() => handleToggleSelected(entity.code)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                    selected.has(entity.code) ? "bg-secondary-500/20 border-secondary-500/40" : "bg-transparent border-white/15"
                  }`}>
                    {selected.has(entity.code) && <span className="block w-1.5 h-1.5 rounded-sm bg-secondary-300" />}
                  </span>
                  <Building2 size={12} className="text-gray-500 flex-shrink-0" />
                  <span className="text-xs text-white truncate">{entity.name}</span>
                </button>
                <button type="button" onClick={() => handleAddOne(entity)}
                  className="text-[10px] text-secondary-400 opacity-0 group-hover/add:opacity-100 flex-shrink-0 ml-2"
                  title="Queue only this">
                  + Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Visual Org Card ─────────────────────────────────────────────
// The card shown for each entity node, matching the screenshot style.

function OrgCard({
  node,
  isRoot,
  childCount,
  onRemove,
}: {
  node: TreeNode;
  isRoot: boolean;
  childCount: number;
  onRemove?: () => void;
}) {
  const color = getTypeColor(node.entity_type);
  const abbr = initials(node.name);

  return (
    <div className={`relative group/card flex flex-col items-center`}>
      {/* Card body */}
      <div className={`
        relative w-[140px] sm:w-[160px] rounded-2xl border transition-all duration-200
        bg-white/[0.04] backdrop-blur-sm hover:bg-white/[0.07]
        hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]
        ${isRoot
          ? "border-secondary-500/40 shadow-[0_0_20px_rgba(var(--secondary-500),0.15)]"
          : "border-white/10"
        }
        p-4 flex flex-col items-center gap-2 text-center
      `}>

        {/* Remove button */}
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 p-1 rounded-lg opacity-70 group-hover/card:opacity-100 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Remove"
          >
            <Trash2 size={11} />
          </button>
        )}



        {/* Name */}
        <div className="w-full">
          <p className={`text-xs font-semibold leading-tight truncate px-1 ${isRoot ? "text-white" : "text-gray-200"}`}>
            {node.name}
          </p>
          {/* Entity type */}
          <p className={`text-[10px] mt-0.5 ${color.text} opacity-80`}>
            {node.entity_type}
          </p>
        </div>
      </div>

      {/* Children count badge — shown at the bottom of the card, above the connector line */}
      {childCount > 0 && (
        <div className="mt-2 w-6 h-6 rounded-full bg-secondary-500 text-primary-950 text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(var(--secondary-500),0.5)] z-10">
          {childCount}
        </div>
      )}
    </div>
  );
}

// ─── Tree Node Builder ───────────────────────────────────────────
// Renders a node as a visual card with its children laid out horizontally below.

function TreeNodeBuilder({
  node,
  depth,
  isRoot,
  accessToken,
  expandedCodes,
  onToggleExpand,
  onExpandNode,
  onAddLocal,
  onRemoveLocal,
  findChildren,
  allowedChildrenMap,
  savingNodes,
}: {
  node: TreeNode;
  depth: number;
  isRoot: boolean;
  accessToken: string;
  expandedCodes: Set<string>;
  onToggleExpand: (nodeKey: string) => void;
  onExpandNode: (nodeKey: string) => void;
  onAddLocal: (parentCode: string, childType: string, children: EntityOption[], parentEdgeId: string | number | null) => void;
  onRemoveLocal: (edgeId: string | number, name: string) => void;
  findChildren: (parentCode: string, parentEdgeId: string | number | null) => Set<string>;
  allowedChildrenMap: Record<string, string[]>;
  savingNodes: Set<string>;
}) {
  const thisNodeKey = nodeKey(node);
  const expanded = expandedCodes.has(thisNodeKey);
  const addableChildTypes = allowedChildrenMap[node.entity_type] || [];
  const actualChildTypes = Array.from(new Set((node.children || []).map((child) => child.entity_type)));
  const childTypes = [
    ...addableChildTypes,
    ...actualChildTypes.filter((type) => !addableChildTypes.includes(type)),
  ];
  const addableChildTypeSet = new Set(addableChildTypes);
  const canHaveChildren = childTypes.length > 0;
  const hasChildren = node.children && node.children.length > 0;
  const thisEdgeId = node.edge_id ?? null;
  const totalChildren = node.children?.length ?? 0;
  const isSaving = savingNodes.has(node.code);

  const [openAddPanels, setOpenAddPanels] = useState<Set<string>>(new Set());

  const toggleAddPanel = (childType: string) => {
    setOpenAddPanels((prev) => {
      const next = new Set(prev);
      if (next.has(childType)) next.delete(childType);
      else next.add(childType);
      return next;
    });
  };
  const closeAddPanel = (childType: string) => {
    setOpenAddPanels((prev) => { const next = new Set(prev); next.delete(childType); return next; });
  };

  const childrenByType: Record<string, TreeNode[]> = {};
  for (const t of childTypes) childrenByType[t] = [];
  for (const child of node.children || []) {
    if (childrenByType[child.entity_type]) childrenByType[child.entity_type].push(child);
  }

  return (
    <div className="flex flex-col items-center">
      {/* The card for this node */}
      <OrgCard
        node={node}
        isRoot={isRoot}
        childCount={expanded ? 0 : totalChildren}
        onRemove={
          !isRoot && node.edge_id !== undefined && !node.is_partner_root
            ? () => onRemoveLocal(node.edge_id!, node.name)
            : undefined
        }
      />

      {/* Toggle expand button (only if can have children or already has them) */}
      {(canHaveChildren || hasChildren) && (
        <button
          onClick={() => onToggleExpand(thisNodeKey)}
          className={`mt-1 mb-1 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all
            ${expanded
              ? "border-white/20 text-gray-400 bg-white/5 hover:bg-white/10"
              : "border-secondary-500/30 text-secondary-400 bg-secondary-500/10 hover:bg-secondary-500/15"
            }`}
        >
          {isSaving ? (
            <><div className="w-2.5 h-2.5 border border-secondary-400 border-t-transparent rounded-full animate-spin" /> Saving...</>
          ) : expanded ? (
            <><ChevronDown size={10} /> Collapse</>
          ) : (
            <><ChevronRight size={10} /> {hasChildren ? `Show ${totalChildren}` : "Add"}</>
          )}
        </button>
      )}

      {/* Children section */}
      {expanded && canHaveChildren && (
        <div className="w-full">
          {childTypes.map((childType) => {
            const children = childrenByType[childType] || [];
            const canAddChildType = addableChildTypeSet.has(childType);
            const isAddOpen = openAddPanels.has(childType);
            const allChildren = children; // all children of this type

            return (
              <div key={childType} className="flex flex-col items-center w-full mb-4">
                {/* Vertical connector line from parent down */}
                <div className="w-px h-6 bg-white/[0.12]" />

                {/* Section label row */}
                <div className="flex items-center gap-2 mb-3 w-full max-w-lg px-2">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold whitespace-nowrap">
                    {pluralize(childType)}
                    {children.length > 0 && <span className="ml-1 text-gray-600">({children.length})</span>}
                  </span>
                  {canAddChildType && (
                    <button
                      onClick={() => toggleAddPanel(childType)}
                      className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-all ${
                        isAddOpen
                          ? "text-secondary-300 bg-secondary-500/10 border border-secondary-500/20"
                          : "text-gray-500 hover:text-secondary-400 border border-transparent hover:border-secondary-500/20 hover:bg-secondary-500/5"
                      }`}
                    >
                      {isAddOpen ? <X size={9} /> : <Plus size={9} />}
                      {isAddOpen ? "Cancel" : "Add"}
                    </button>
                  )}
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                {/* Add panel */}
                {canAddChildType && isAddOpen && (
                  <div className="w-full max-w-sm mb-3 animation-fade-in">
                    <AddEntityPanel
                      childType={childType}
                      existingChildCodes={findChildren(node.code, thisEdgeId)}
                      accessToken={accessToken}
                      onAdded={(entities) => {
                        onAddLocal(node.code, childType, entities, thisEdgeId);
                        onExpandNode(thisNodeKey);
                        closeAddPanel(childType);
                      }}
                      onClose={() => closeAddPanel(childType)}
                    />
                  </div>
                )}

                {/* Children cards in a horizontal row with connecting lines */}
                {allChildren.length > 0 && (
                  <div className="relative w-full overflow-x-auto pb-2">
                    {/* Horizontal connector bar — desktop only */}
                    {allChildren.length > 1 && typeof window !== "undefined" && window.innerWidth >= 640 && (
                      <div
                        className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-white/[0.12]"
                        style={{
                          width: `${Math.min(allChildren.length * 180, 100)}%`,
                          maxWidth: `${allChildren.length * 180}px`,
                        }}
                      />
                    )}

                    {/* Children cards row */}
                    <div
                      className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-4 pt-0"
                      style={{ minWidth: "0", maxWidth: "100%" }}
                    >
                      {allChildren.map((child) => (
                        <div key={child.edge_id ?? child.code} className="flex flex-col items-center w-full sm:w-auto">
                          {/* Vertical drop line to each child */}
                          <div className="w-px h-6 bg-white/[0.12]" />
                          <TreeNodeBuilder
                            node={child}
                            depth={depth + 1}
                            isRoot={false}
                            accessToken={accessToken}
                            expandedCodes={expandedCodes}
                            onToggleExpand={onToggleExpand}
                            onExpandNode={onExpandNode}
                            onAddLocal={onAddLocal}
                            onRemoveLocal={onRemoveLocal}
                            findChildren={findChildren}
                            allowedChildrenMap={allowedChildrenMap}
                            savingNodes={savingNodes}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {canAddChildType && allChildren.length === 0 && !isAddOpen && (
                  <button
                    onClick={() => toggleAddPanel(childType)}
                    className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-secondary-400 border border-dashed border-white/10 hover:border-secondary-500/30 rounded-xl px-4 py-2.5 transition-all"
                  >
                    <Plus size={10} /> Add first {childType}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function OrganizationPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();

  const [tree, setTree] = useState<TreeNode | null>(null);
  const [hierarchyChain, setHierarchyChain] = useState<string[]>([]);
  const [allowedChildrenMap, setAllowedChildrenMap] = useState<Record<string, string[]>>({});

  const [loading, setLoading] = useState(true);
  const [savingNodes, setSavingNodes] = useState<Set<string>>(new Set());

  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const treeLoaded = useRef(false);

  const [limitModal, setLimitModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    limit: number;
  }>({
    open: false,
    title: "",
    message: "",
    limit: 0
  });

  const getTreeDepth = useCallback((node: TreeNode): number => {
    if (!node.children || node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(getTreeDepth));
  }, []);

  const countDepartments = useCallback((node: TreeNode): number => {
    let count = node.entity_type === "Department" ? 1 : 0;
    if (node.children) {
      for (const child of node.children) {
        count += countDepartments(child);
      }
    }
    return count;
  }, []);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const fetchTree = useCallback(async (background = false) => {
    if (!accessToken) return;
    if (!background) setLoading(true);
    const res = await orgTreeApi.getTree(accessToken);
    if (res.success && res.data) {
      const payload = res.data as {
        tree: TreeNode;
        hierarchyChain: string[];
        allowedChildren: Record<string, string[]>;
      };
      const newTree = payload.tree;
      setTree(newTree);
      if (payload.hierarchyChain) setHierarchyChain(payload.hierarchyChain);
      if (payload.allowedChildren) setAllowedChildrenMap(payload.allowedChildren);

      if (!treeLoaded.current && newTree) {
        setExpandedCodes(new Set([nodeKey(newTree)]));
        treeLoaded.current = true;
      }
    }
    if (!background) setLoading(false);
  }, [accessToken]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandNode = useCallback((key: string) => {
    setExpandedCodes((prev) => new Set([...prev, key]));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedCodes(new Set());
  }, []);

  const expandAll = useCallback(() => {
    if (!tree) return;
    const keys = new Set<string>();
    function walk(node: TreeNode) {
      keys.add(nodeKey(node));
      for (const child of node.children || []) walk(child);
    }
    walk(tree);
    setExpandedCodes(keys);
  }, [tree]);

  const findChildCodes = useCallback(
    (parentCode: string, parentEdgeId: string | number | null): Set<string> => {
      const codes = new Set<string>();
      if (!tree) return codes;

      function findNode(node: TreeNode): TreeNode | null {
        const nodeEdgeId = node.edge_id ?? null;
        if (node.code === parentCode && String(nodeEdgeId) === String(parentEdgeId)) return node;
        for (const child of node.children || []) {
          const found = findNode(child);
          if (found) return found;
        }
        return null;
      }

      const targetNode = findNode(tree);

      if (targetNode) {
        for (const child of targetNode.children || []) codes.add(child.code);
      }
      return codes;
    },
    [tree]
  );

  const handleAddLocal = useCallback(
    async (parentCode: string, childType: string, children: EntityOption[], parentEdgeId: string | number | null) => {
      if (!accessToken || !tree) return;

      // ─── Plan Limits Enforcement ──────────────────────────────
      if (admin?.plan_limits) {
        // 1. Department Count Limit
        if (childType === "Department") {
          const currentDepts = countDepartments(tree);
          if (currentDepts + children.length > admin.plan_limits.department) {
            setLimitModal({
              open: true,
              title: "Department Limit Reached",
              message: "Your current plan has reached the maximum number of departments allowed in the organization tree.",
              limit: admin.plan_limits.department
            });
            return;
          }
        }

        // 2. Organization Levels (Depth) Limit
        const findDepthOfParent = (node: TreeNode, targetCode: string, targetEdgeId: string | number | null): number | null => {
          if (node.code === targetCode && String(node.edge_id ?? null) === String(targetEdgeId)) return 1;
          for (const child of node.children) {
            const d = findDepthOfParent(child, targetCode, targetEdgeId);
            if (d !== null) return d + 1;
          }
          return null;
        };

        const parentDepth = findDepthOfParent(tree, parentCode, parentEdgeId);
        if (parentDepth !== null && parentDepth + 1 > admin.plan_limits.company_level) {
          setLimitModal({
            open: true,
            title: "Level Limit Reached",
            message: `Your current plan only allows up to ${admin.plan_limits.company_level} levels in the organization hierarchy.`,
            limit: admin.plan_limits.company_level
          });
          return;
        }
      }

      // Immediately sync to backend
      const adds = children.map((c) => ({
        parent_code: parentCode,
        parent_edge_id: parentEdgeId !== null ? String(parentEdgeId) : null,
        child_type: childType,
        child_code: c.code,
      }));

      setSavingNodes(prev => new Set([...prev, parentCode]));
      try {
        const res = await orgTreeApi.syncTree(accessToken, { adds, removes: [] });
        if (res.success) {
          toast(`Added ${children.length} ${pluralize(childType).toLowerCase()}.`, "success");
          await fetchTree(true);
        } else {
          toast(res.message || "Failed to add entity.", "error");
        }
      } catch {
        toast("Failed to add entity.", "error");
      } finally {
        setSavingNodes(prev => { const next = new Set(prev); next.delete(parentCode); return next; });
      }
    },
    [accessToken, tree, toast, fetchTree, countDepartments]
  );

  const handleRemoveLocal = useCallback(
    async (edgeId: string | number, name: string) => {
      if (!accessToken) return;

      const ok = await confirm({
        title: "Remove from Structure",
        message: `Are you sure you want to remove "${name}" and its descendants from the organization tree? This will only succeed if these entities have no active users or checklists.`,
        confirmText: "Remove",
        variant: "warning",
      });
      if (!ok) return;

      const res = await orgTreeApi.syncTree(accessToken, { adds: [], removes: [String(edgeId)] });
      if (res.success) {
        const blocked = (res.data as { blockedRemovals?: string[] } | null)?.blockedRemovals;
        if (blocked && blocked.length > 0) {
          toast(res.message || "Some entities could not be removed because they are in use.", "warning");
        } else {
          toast(`"${name}" removed successfully.`, "success");
        }
        await fetchTree(true);
      } else {
        toast(res.message || "Failed to remove entity.", "error");
      }
    },
    [accessToken, confirm, toast, fetchTree]
  );

  const handleRefresh = useCallback(async () => {
    fetchTree(true);
  }, [fetchTree]);

  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center pt-14 lg:pt-0">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="min-h-full bg-transparent flex flex-col relative w-full">
      <LimitReachedModal
        isOpen={limitModal.open}
        onClose={() => setLimitModal(prev => ({ ...prev, open: false }))}
        title={limitModal.title}
        message={limitModal.message}
        limit={limitModal.limit}
      />
      <div className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <TreePine size={22} className="text-secondary-400" />
              Organization Mapping
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Connect your entities to define your organization's reporting hierarchy.
            </p>
          </div>
         
          
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={expandAll} disabled={!tree}>
              Expand
            </Button>
            <Button variant="secondary" size="sm" onClick={collapseAll}>
              Collapse
            </Button>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <IconButton bordered onClick={handleRefresh} title="Refresh Tree">
              <RefreshCw size={16} />
            </IconButton>
          </div>
        </div>

        {/* Hierarchy Guide */}
        <HierarchyGuide paths={hierarchyChain} />

       
        {/* Tree Builder — centered card tree */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tree ? (
          <div className="glass rounded-2xl p-3 sm:p-6 border border-white/10 shadow-2xl relative overflow-hidden min-h-[300px]">
            <div className="absolute top-10 left-10 w-96 h-96 bg-secondary-900/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center overflow-x-auto">
              <TreeNodeBuilder
                node={tree}
                depth={0}
                isRoot={true}
                accessToken={accessToken!}
                expandedCodes={expandedCodes}
                onToggleExpand={toggleExpand}
                onExpandNode={expandNode}
                onAddLocal={handleAddLocal}
                onRemoveLocal={handleRemoveLocal}
                findChildren={findChildCodes}
                allowedChildrenMap={allowedChildrenMap}
                savingNodes={savingNodes}
              />
            </div>
          </div>
        ) : (
          <div className="glass rounded-xl p-10 text-center border border-white/10">
            <FolderTree size={40} className="text-gray-600 mx-auto mb-3 opacity-50" />
            <p className="text-gray-400 text-sm">
              Could not load organization tree. Please try refreshing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}