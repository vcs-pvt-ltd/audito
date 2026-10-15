"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Bot, Check, CheckCircle2, ChevronDown, ChevronRight,
  FileSpreadsheet, FileText, GitBranch, GripVertical, Layers3, Loader2, LockKeyhole, Mic, Pencil, Plus,
  RotateCcw, Search, Send, Sparkles, Square, Trash2, UploadCloud, UserRound, X,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import Loading from "@/components/shared/Loading";
import CombinedAiSetup from "@/components/onboarding/CombinedAiSetup";
import { AI_DOCUMENT_ACCEPT, AI_DOCUMENT_FORMAT_LABEL, isSupportedAiDocument } from "@/utils/aiDocumentFiles";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import {
  organizationAiSetupApi, orgTreeApi, structureApi, OrganizationAiChatMessage, OrganizationAiDraftNode,
  OrganizationAiSetupPayload,
} from "@/lib/api";

const ORGANIZATION_CHAINS: Record<string, string[]> = {
  Customer: ["Customer", "Buying Office", "Supplier"],
  Company: ["Company", "Cluster", "Factory", "Unit", "Department", "Section"],
  "Audit Firm": ["Audit Firm Company", "Branch", "Audit Firm Department"],
};

const STRUCTURE_ENTITY_CONFIG: Record<string, { slug: string; codeField: string }> = {
  "Buying Office": { slug: "buying-office", codeField: "cbo_code" },
  Supplier: { slug: "supplier", codeField: "csup_code" },
  Cluster: { slug: "cluster", codeField: "comp_clus_code" },
  Factory: { slug: "factory", codeField: "comp_fact_code" },
  Unit: { slug: "unit", codeField: "comp_unit_code" },
  Department: { slug: "department", codeField: "comp_dept_code" },
  Section: { slug: "section", codeField: "comp_section_code" },
  Branch: { slug: "branch", codeField: "afc_branch_code" },
  "Audit Firm Department": { slug: "audit-firm-department", codeField: "afc_dept_code" },
};

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const STARTER_PROMPTS = [
  "Create a simple structure for one location",
  "Add departments from my audit sheet",
  "Help me describe my reporting structure",
];

type SetupChatMessage = OrganizationAiChatMessage & { id: string };
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechCapture = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: SpeechResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechCapture; webkitSpeechRecognition?: new () => SpeechCapture };
type AiProgressMode = "document" | "description" | "update";
type StructureEntity = {
  code: string;
  name: string;
  entity_type: string;
  in_tree: boolean;
};

const AI_PROGRESS_STAGES: Record<AiProgressMode, string[]> = {
  document: [
    "Preparing documents",
    "Reading organization details",
    "Identifying entities",
    "Building reporting relationships",
    "Checking the proposed hierarchy",
  ],
  description: [
    "Preparing your request",
    "Understanding organization details",
    "Identifying entities",
    "Building reporting relationships",
    "Checking the proposed hierarchy",
  ],
  update: [
    "Reviewing the current hierarchy",
    "Understanding your requested changes",
    "Updating entities and relationships",
    "Checking protected dependencies",
    "Finalizing the revised hierarchy",
  ],
};

function AiProcessingProgress({ mode, progress }: {
  mode: AiProgressMode;
  progress: number;
}) {
  const stages = AI_PROGRESS_STAGES[mode];
  const activeIndex = Math.min(stages.length - 1, Math.floor((Math.min(progress, 99) / 100) * stages.length));
  const contextLabel = mode === "document"
    ? "Analyzing uploaded information"
    : mode === "update"
      ? "Preparing organization changes"
      : "Creating your organization structure";

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-secondary-500/25 bg-gradient-to-r from-secondary-500/[0.13] via-emerald-500/[0.07] to-transparent p-4 sm:p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-500/15">
            <Loader2 size={19} className="animate-spin text-secondary-300" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{stages[activeIndex]}</p>
            <p className="mt-0.5 text-xs text-gray-400">{contextLabel}. Keep this page open while the analysis runs.</p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-secondary-300">{progress}%</span>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]"
        role="progressbar"
        aria-label={contextLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-emerald-400 transition-[width] duration-700" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}

const reviewStorageKey = (sessionId: string) => `audito_ai_setup_review:${sessionId}`;

function storeReviewNodes(sessionId: string, nodes: OrganizationAiDraftNode[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(reviewStorageKey(sessionId), JSON.stringify(nodes));
}

function restoreReviewNodes(sessionId: string): OrganizationAiDraftNode[] | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(reviewStorageKey(sessionId));
    if (!value) return null;
    const nodes = JSON.parse(value);
    return Array.isArray(nodes) ? nodes : null;
  } catch {
    window.sessionStorage.removeItem(reviewStorageKey(sessionId));
    return null;
  }
}

function entityTypesFor(accountType: string, rootEntityType: string) {
  const chain = ORGANIZATION_CHAINS[accountType] || [];
  const root = rootEntityType === "Audit Firm" ? "Audit Firm Company" : rootEntityType;
  const index = chain.indexOf(root);
  return index >= 0 ? chain.slice(index + 1) : [];
}

function compactNodeId() {
  return `OSN-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function changeLabel(node: OrganizationAiDraftNode) {
  if (node.is_removed || node.change_type === "removed") return { text: "Remove", className: "border-red-400/20 bg-red-400/10 text-red-200" };
  if (node.change_type === "updated") return { text: "Changed", className: "border-amber-400/20 bg-amber-400/10 text-amber-200" };
  if (node.change_type === "unchanged") return { text: "Existing", className: "border-white/10 bg-white/[.04] text-gray-400" };
  return { text: "New", className: "border-secondary-400/20 bg-secondary-400/10 text-secondary-200" };
}

function DraftRow({ node, nodes, expanded, selectedId, visibleIds, draggedNodeId, onSelect, onToggle, canDropOn, onDropEntity, depth = 0 }: {
  node: OrganizationAiDraftNode;
  nodes: OrganizationAiDraftNode[];
  expanded: Record<string, boolean>;
  selectedId: string | null;
  visibleIds: Set<string> | null;
  draggedNodeId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  canDropOn: (parentId: string | null) => boolean;
  onDropEntity: (parentId: string | null) => void;
  depth?: number;
}) {
  if (visibleIds && !visibleIds.has(node.id)) return null;
  const children = nodes.filter((child) => child.parent_id === node.id);
  const open = expanded[node.id] !== false;
  const badge = changeLabel(node);
  return (
    <div className={depth ? "ml-2 border-l border-white/[.08] pl-2 sm:ml-4 sm:pl-3" : ""}>
      <div
        onDragOver={(event) => { if (canDropOn(node.id)) event.preventDefault(); }}
        onDrop={(event) => { if (!canDropOn(node.id)) return; event.preventDefault(); event.stopPropagation(); onDropEntity(node.id); }}
        className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2.5 transition-colors ${draggedNodeId && canDropOn(node.id) ? "border-dashed border-secondary-400/45 bg-secondary-500/[.08]" : node.is_removed ? "border-red-400/10 bg-red-400/[.035] opacity-75" : selectedId === node.id ? "border-secondary-400/25 bg-secondary-500/10" : "border-transparent hover:border-white/[.08] hover:bg-white/[.03]"}`}
      >
        <button type="button" className="grid h-6 w-6 shrink-0 place-items-center text-gray-500" onClick={() => children.length && onToggle(node.id)} aria-label={open ? "Collapse branch" : "Expand branch"}>
          {children.length ? (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />}
        </button>
        <button type="button" onClick={() => onSelect(node.id)} className="min-w-0 flex-1 text-left">
          <span className={`block truncate text-sm font-semibold text-gray-100 ${node.is_removed ? "line-through" : ""}`}>{node.name}</span>
          <span className="block truncate text-[11px] text-gray-500">{node.entity_type}</span>
        </button>
        {node.is_locked && <span title="This entity is used by another Audito function" className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-amber-400/15 bg-amber-400/[.07] text-amber-300"><LockKeyhole size={12} /></span>}
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
      </div>
      {open && children.map((child) => (
        <DraftRow key={child.id} node={child} nodes={nodes} expanded={expanded} selectedId={selectedId} visibleIds={visibleIds} draggedNodeId={draggedNodeId} onSelect={onSelect} onToggle={onToggle} canDropOn={canDropOn} onDropEntity={onDropEntity} depth={depth + 1} />
      ))}
    </div>
  );
}

function FinalReviewRow({ node, nodes, expandedIds, onToggle, depth = 0 }: {
  node: OrganizationAiDraftNode;
  nodes: OrganizationAiDraftNode[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  depth?: number;
}) {
  const children = nodes.filter((child) => child.parent_id === node.id);
  const badge = changeLabel(node);
  const hasChildren = children.length > 0;
  const open = expandedIds.has(node.id);
  return (
    <div className={depth ? "ml-2 border-l border-white/[.08] pl-2 sm:ml-5 sm:pl-4" : ""}>
      <div className={`flex items-center gap-2 rounded-xl border px-2.5 py-2.5 transition-colors sm:gap-3 sm:px-3 ${node.is_removed ? "border-red-400/10 bg-red-400/[.035] opacity-75" : open ? "border-secondary-400/15 bg-secondary-500/[.055]" : "border-white/[.07] bg-white/[.025] hover:bg-white/[.04]"}`}>
        <button type="button" disabled={!hasChildren} onClick={() => hasChildren && onToggle(node.id)} aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`} aria-expanded={hasChildren ? open : undefined} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-white/[.06] hover:text-gray-200 disabled:hover:bg-transparent">
          {hasChildren ? (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : <span className={`h-2 w-2 rounded-full ${node.is_removed ? "bg-red-300" : node.change_type === "updated" ? "bg-amber-300" : node.change_type === "added" ? "bg-secondary-300" : "bg-gray-600"}`} />}
        </button>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold text-gray-100 ${node.is_removed ? "line-through" : ""}`}>{node.name}</span>
          <span className="block text-[11px] text-gray-500">{node.entity_type}</span>
        </span>
        {node.is_locked && <LockKeyhole size={13} className="shrink-0 text-amber-300" />}
        {node.change_type !== "unchanged" && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>}
      </div>
      {hasChildren && open && <div className="mt-1.5 space-y-1.5">{children.map((child) => <FinalReviewRow key={child.id} node={child} nodes={nodes} expandedIds={expandedIds} onToggle={onToggle} depth={depth + 1} />)}</div>}
    </div>
  );
}

function SetupSteps({ stage }: { stage: 1 | 2 | 3 }) {
  const items = [
    [1, "Add information", "Upload or describe"],
    [2, "Review structure", "Correct changes"],
    [3, "Apply changes", "Final confirmation"],
  ] as const;
  return (
    <ol className="grid overflow-hidden rounded-2xl border border-white/10 bg-white/[.025] sm:grid-cols-3">
      {items.map(([number, title, description], index) => {
        const complete = number < stage;
        const active = number === stage;
        return (
          <li key={number} className={`flex items-center gap-3 px-4 py-3.5 ${index ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""} ${active ? "bg-secondary-500/[.08]" : ""}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold ${complete ? "border-secondary-400 bg-secondary-400 text-primary-950" : active ? "border-secondary-400/50 bg-secondary-400/10 text-secondary-200" : "border-white/10 text-gray-500"}`}>{complete ? <Check size={15} /> : number}</span>
            <span><span className={`block text-sm font-semibold ${active || complete ? "text-white" : "text-gray-500"}`}>{title}</span><span className="block text-[11px] text-gray-500">{description}</span></span>
          </li>
        );
      })}
    </ol>
  );
}

export default function AiOrganizationSetupPage() {
  const searchParams = useSearchParams();
  const { admin } = useAuth();
  if (!admin) return <Loading />;
  return searchParams.get("onboarding") === "1" && admin.account_type !== "Audit Firm"
    ? <CombinedAiSetup /> : <OrganizationEditor />;
}

function OrganizationEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, accessToken } = useAuth();
  const { isActive: onboardingActive } = useOnboarding();
  const { toast, confirm, decision } = useUiFeedback();
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [payload, setPayload] = useState<OrganizationAiSetupPayload | null>(null);
  const [messages, setMessages] = useState<SetupChatMessage[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechCapture | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [finalExpandedIds, setFinalExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiProgressMode, setAiProgressMode] = useState<AiProgressMode>("description");
  const [saving, setSaving] = useState(false);
  const [hasExistingOrganization, setHasExistingOrganization] = useState(false);
  const [organizationChecked, setOrganizationChecked] = useState(false);
  const [inputMode, setInputMode] = useState<"document" | "description">("document");
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [draggedExistingEntity, setDraggedExistingEntity] = useState<StructureEntity | null>(null);
  const [existingEntities, setExistingEntities] = useState<StructureEntity[]>([]);
  const [allowedChildrenMap, setAllowedChildrenMap] = useState<Record<string, string[]>>({});
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [entityCategory, setEntityCategory] = useState("All");
  const [reuseParentId, setReuseParentId] = useState("");
  const [hasUnsavedReview, setHasUnsavedReview] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const unsavedReviewRef = useRef(false);
  const allowPageExitRef = useRef(false);
  const leaveDecisionOpenRef = useRef(false);
  const reviewNodesRef = useRef<OrganizationAiDraftNode[]>([]);

  useEffect(() => {
    const speech = window as SpeechWindow;
    setVoiceAvailable(Boolean(speech.SpeechRecognition || speech.webkitSpeechRecognition));
    return () => recognitionRef.current?.abort();
  }, []);

  function startVoice() {
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) return;
    const capture = new Speech();
    recognitionRef.current = capture;
    capture.lang = navigator.language || "en-US";
    capture.interimResults = false;
    capture.continuous = false;
    capture.onresult = event => {
      setChatInput(current => `${current} ${Array.from(event.results).map(result => result[0].transcript).join(" ")}`.trim().slice(0, 2000));
      setVoiceTranscript(true);
    };
    capture.onerror = () => { setListening(false); setVoiceError("Voice input is unavailable. Check microphone permission or type your change."); };
    capture.onend = () => setListening(false);
    setVoiceError("");
    try { capture.start(); setListening(true); }
    catch { setVoiceError("Could not start the microphone. Type your change instead."); }
  }

  const onboardingFinished = Boolean(admin?.onboarding_completed || admin?.onboarding_skipped);
  const onboardingMode = !onboardingFinished && onboardingActive && searchParams.get("onboarding") === "1";
  const accountType = payload?.session.account_type || admin?.account_type || "";
  const rootLabel = payload?.session.root_entity_type || admin?.entity_type || "Organization";
  // The registered organization is the tree's root, shown by its registered name.
  const rootDisplay = payload?.root_entity_name ? `${payload.root_entity_name} (${rootLabel})` : rootLabel;
  const hierarchyRootType = rootLabel === "Audit Firm" ? "Audit Firm Company" : rootLabel;
  const entityTypes = entityTypesFor(accountType, rootLabel);
  const entityTypesKey = entityTypes.join("|");
  const nodes = payload?.nodes || [];
  const selected = nodes.find((node) => node.id === selectedId) || null;
  const roots = nodes.filter((node) => !node.parent_id);
  const isUpdate = payload?.session.setup_mode === "update" || hasExistingOrganization;
  const changeCounts = useMemo(() => ({
    added: nodes.filter((node) => !node.is_removed && (node.change_type === "added" || !node.source_entity_code)).length,
    updated: nodes.filter((node) => !node.is_removed && node.change_type === "updated").length,
    removed: nodes.filter((node) => node.is_removed || node.change_type === "removed").length,
    unchanged: nodes.filter((node) => node.change_type === "unchanged").length,
  }), [nodes]);
  const identifiedEntities = useMemo(() => {
    const unique = new Map<string, OrganizationAiDraftNode>();
    for (const node of nodes) {
      if (node.is_removed || node.reuse_source_node_id || node.source_entity_code) continue;
      const key = `${node.entity_type}|${node.name.trim().toLowerCase()}`;
      if (!unique.has(key)) unique.set(key, node);
    }
    return [...unique.values()];
  }, [nodes]);

  useEffect(() => { unsavedReviewRef.current = hasUnsavedReview; }, [hasUnsavedReview]);
  useEffect(() => { reviewNodesRef.current = nodes; }, [nodes]);

  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const updateProgress = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);

      let estimated = 8;
      if (elapsed < 2) estimated = 8 + elapsed * 7;
      else if (elapsed < 6) estimated = 22 + (elapsed - 2) * 7;
      else if (elapsed < 12) estimated = 50 + (elapsed - 6) * 4;
      else if (elapsed < 24) estimated = 74 + (elapsed - 12) * 1.25;
      else estimated = Math.min(97, 89 + (elapsed - 24) * 0.25);

      setAiProgress((current) => Math.max(current, Math.round(estimated)));
    };

    updateProgress();
    const timer = window.setInterval(updateProgress, 500);
    return () => window.clearInterval(timer);
  }, [busy]);

  const visibleIds = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return null;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const result = new Set<string>();
    for (const node of nodes) {
      if (!node.name.toLowerCase().includes(term) && !node.entity_type.toLowerCase().includes(term)) continue;
      result.add(node.id);
      let parent = node.parent_id ? byId.get(node.parent_id) : null;
      while (parent) { result.add(parent.id); parent = parent.parent_id ? byId.get(parent.parent_id) : null; }
    }
    return result;
  }, [nodes, search]);

  useEffect(() => {
    if (!visibleIds) return;
    setExpanded((current) => {
      const next = { ...current };
      visibleIds.forEach((id) => { next[id] = true; });
      return next;
    });
  }, [visibleIds]);

  useEffect(() => { setReuseParentId(""); }, [selectedId]);

  useEffect(() => {
    if (!accessToken || !entityTypes.length) {
      setExistingEntities([]);
      return;
    }
    let cancelled = false;
    setLoadingEntities(true);
    Promise.all(entityTypes.map(async (entityType) => {
      const config = STRUCTURE_ENTITY_CONFIG[entityType];
      if (!config) return [] as StructureEntity[];
      const result = await structureApi.listByType(accessToken, config.slug);
      if (!result.success || !result.data) return [] as StructureEntity[];
      const items = ((result.data as { items?: Array<Record<string, unknown>> }).items || []);
      return items
        .filter((item) => !item.is_linked)
        .map((item) => ({
          code: String(item[config.codeField] || ""),
          name: String(item.name || "Unnamed entity"),
          entity_type: entityType,
          in_tree: Boolean(item.in_tree),
        }))
        .filter((item) => item.code);
    })).then((groups) => {
      if (!cancelled) setExistingEntities(groups.flat());
    }).finally(() => {
      if (!cancelled) setLoadingEntities(false);
    });
    return () => { cancelled = true; };
  }, [accessToken, entityTypesKey]);

  useEffect(() => {
    if (entityCategory !== "All" && !entityTypes.includes(entityCategory)) setEntityCategory("All");
  }, [entityCategory, entityTypesKey]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    orgTreeApi.getTree(accessToken).then((result) => {
      if (cancelled || !result.success || !result.data) return;
      const treeData = result.data as { tree?: { children?: unknown[] }; allowedChildren?: Record<string, string[]> };
      const tree = treeData.tree;
      setAllowedChildrenMap(treeData.allowedChildren || {});
      setHasExistingOrganization(Boolean(tree?.children?.length));
    }).finally(() => { if (!cancelled) setOrganizationChecked(true); });
    return () => { cancelled = true; };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoadingDraft(true);
    organizationAiSetupApi.current(accessToken).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        if (result.data.session.onboarding_draft) {
          router.replace("/organization/ai-setup?onboarding=1");
          return;
        }
        const sessionId = result.data.session.organization_ai_setup_session_id;
        const savedKey = `audito_ai_setup_saved:${sessionId}`;
        const refreshDecisionKey = `audito_ai_setup_refresh_decision:${sessionId}`;
        const wasSavedHere = typeof window !== "undefined" && window.sessionStorage.getItem(savedKey) === "1";
        const needsRefreshDecision = typeof window !== "undefined" && window.sessionStorage.getItem(refreshDecisionKey) === "1";
        const restoredNodes = needsRefreshDecision ? restoreReviewNodes(sessionId) : null;
        const restoredPayload = restoredNodes ? { ...result.data, nodes: restoredNodes } : result.data;
        if (typeof window !== "undefined") window.sessionStorage.removeItem(refreshDecisionKey);
        setPayload(restoredPayload);
        setSelectedId(restoredPayload.nodes.find((node) => !node.is_removed)?.id || restoredPayload.nodes[0]?.id || null);
        setExpanded(Object.fromEntries(restoredPayload.nodes.map((node) => [node.id, true])));
        setHasUnsavedReview(needsRefreshDecision || (result.data.session.status === "ready" && !wasSavedHere));
        if (needsRefreshDecision) setPendingNavigation("__resume_review__");
        setStage(2);
      }
      setLoadingDraft(false);
    });
    return () => { cancelled = true; };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !organizationChecked || loadingDraft || loadingEntities || payload || (!hasExistingOrganization && !existingEntities.length)) return;
    let cancelled = false;
    setStartingSession(true);
    organizationAiSetupApi.create(accessToken).then((result) => {
      if (cancelled || !result.success || !result.data) return;
      setPayload(result.data);
      setSelectedId(result.data.nodes[0]?.id || null);
      setExpanded(Object.fromEntries(result.data.nodes.map((node) => [node.id, true])));
      setStage(2);
    }).finally(() => { if (!cancelled) setStartingSession(false); });
    return () => { cancelled = true; };
  }, [accessToken, organizationChecked, hasExistingOrganization, loadingDraft, loadingEntities, existingEntities.length, payload]);

  useEffect(() => {
    if (!hasUnsavedReview) return;
    const sessionId = payload?.session.organization_ai_setup_session_id;
    const handlePageHide = () => {
      if (!allowPageExitRef.current && unsavedReviewRef.current && sessionId) {
        storeReviewNodes(sessionId, reviewNodesRef.current);
        window.sessionStorage.setItem(`audito_ai_setup_refresh_decision:${sessionId}`, "1");
      }
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (allowPageExitRef.current || !unsavedReviewRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.href === window.location.href || url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation(url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href);
    };
    const handleReloadKey = (event: KeyboardEvent) => {
      if (event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")) {
        event.preventDefault();
        setPendingNavigation("__reload__");
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("keydown", handleReloadKey);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("keydown", handleReloadKey);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [hasUnsavedReview, payload?.session.organization_ai_setup_session_id]);

  const ensureSession = async () => {
    if (!accessToken) return null;
    if (payload) return payload;
    const result = await organizationAiSetupApi.create(accessToken);
    if (!result.success || !result.data) {
      toast(result.message || "Unable to start organization setup.", "error");
      return null;
    }
    setPayload(result.data);
    return result.data;
  };

  const acceptFiles = (incoming: File[]) => {
    const supported = incoming.filter((file) => {
      if (!isSupportedAiDocument(file)) {
        toast(`${file.name} is not supported. Use ${AI_DOCUMENT_FORMAT_LABEL}.`, "warning");
        return false;
      }
      if (file.size > MAX_DOCUMENT_SIZE) {
        toast(`${file.name} must be 10 MB or smaller.`, "warning");
        return false;
      }
      return true;
    });
    const next = supported.slice(0, 4);
    if (supported.length > 4) toast("You can analyze up to four files at once.", "warning");
    setFiles(next);
  };

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };
  const dropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files || []));
  };

  const applyResponse = (data: OrganizationAiSetupPayload, assistantMessage: string, userMessage?: string) => {
    setPayload(data);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`audito_ai_setup_saved:${data.session.organization_ai_setup_session_id}`);
      storeReviewNodes(data.session.organization_ai_setup_session_id, data.nodes);
    }
    setHasUnsavedReview(true);
    setSelectedId((current) => data.nodes.some((node) => node.id === current) ? current : data.nodes[0]?.id || null);
    setExpanded(Object.fromEntries(data.nodes.map((node) => [node.id, true])));
    setMessages((current) => [
      ...current,
      ...(userMessage ? [{ id: `user-${crypto.randomUUID()}`, role: "user" as const, content: userMessage }] : []),
      { id: `assistant-${crypto.randomUUID()}`, role: "assistant", content: assistantMessage },
    ]);
    setFiles([]);
    setChatInput("");
    setVoiceTranscript(false);
    setStage(2);
  };

  const submitToAi = async (event?: FormEvent) => {
    event?.preventDefault();
    const message = chatInput.trim();
    if (!accessToken || busy || (!message && !files.length)) return;
    const progressMode: AiProgressMode = files.length ? "document" : stage === 2 ? "update" : "description";
    setAiProgressMode(progressMode);
    setAiProgress(4);
    setBusy(true);
    try {
      const current = await ensureSession();
      if (!current) return;
      const history = messages.map(({ role, content }) => ({ role, content }));
      const result = files.length
        ? await organizationAiSetupApi.analyze(accessToken, current.session.organization_ai_setup_session_id, files)
        : await organizationAiSetupApi.chat(accessToken, current.session.organization_ai_setup_session_id, message, history);
      if (!result.success || !result.data) {
        toast(result.message || "AI could not prepare the organization structure.", "error");
        return;
      }
      setAiProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      applyResponse(
        result.data,
        result.data.assistant_message || "I prepared the organization structure. Review every highlighted change before applying it.",
        message || (files.length ? `Analyze ${files.length} attached document${files.length === 1 ? "" : "s"}` : undefined),
      );
    } catch (error) {
      console.error("AI organization setup failed", error);
      toast("AI could not prepare the organization structure. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  const setNodes = (next: OrganizationAiDraftNode[]) => {
    setPayload((current) => current ? { ...current, nodes: next } : current);
    if (payload && typeof window !== "undefined") {
      window.sessionStorage.removeItem(`audito_ai_setup_saved:${payload.session.organization_ai_setup_session_id}`);
      storeReviewNodes(payload.session.organization_ai_setup_session_id, next);
    }
    setHasUnsavedReview(true);
  };
  const updateNode = (id: string, change: Partial<OrganizationAiDraftNode>) => {
    setNodes(nodes.map((node) => {
      if (node.id !== id) return node;
      if (node.is_locked && (change.name !== undefined || change.parent_id !== undefined || change.entity_type !== undefined || change.is_removed !== undefined)) {
        toast(`${node.name} is already used by Audito and cannot be changed.`, "warning");
        return node;
      }
      const next = { ...node, ...change };
      if (change.entity_type && change.entity_type !== node.entity_type) {
        const currentParentId = node.parent_id || null;
        if (canPlaceEntityType(change.entity_type, currentParentId)) {
          next.parent_id = currentParentId;
        } else if (canPlaceEntityType(change.entity_type, null)) {
          next.parent_id = null;
        } else {
          toast(`${change.entity_type} cannot be placed at this location. Choose a valid parent first.`, "warning");
          return node;
        }
      }
      next.change_type = next.is_removed ? "removed" : next.source_entity_code && next.name === next.baseline_name && (next.parent_id || null) === (next.baseline_parent_id || null) ? "unchanged" : next.source_entity_code ? "updated" : "added";
      return next;
    }));
  };
  const addNode = (parentId: string | null = null) => {
    const parent = parentId ? nodes.find((node) => node.id === parentId) : null;
    const childTypes = allowedChildrenMap[parent?.entity_type || hierarchyRootType] || [];
    const type = childTypes[0];
    if (!type) {
      toast("This entity cannot contain another organization entity.", "info");
      return;
    }
    const node: OrganizationAiDraftNode = { id: compactNodeId(), parent_id: parentId, name: "New entity", entity_type: type, confidence: null, is_ai_generated: false, is_removed: false, change_type: "added", source_entity_code: null, source_edge_id: null, baseline_name: null, baseline_parent_id: null };
    setNodes([...nodes, node]);
    setSelectedId(node.id);
    if (parentId) setExpanded((current) => ({ ...current, [parentId]: true }));
  };
  const branchIds = (id: string) => {
    const result = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes) if (node.parent_id && result.has(node.parent_id) && !result.has(node.id)) { result.add(node.id); changed = true; }
    }
    return result;
  };
  function canPlaceEntityType(entityType: string, parentId: string | null) {
    const parent = parentId ? nodes.find((node) => node.id === parentId) : null;
    if (parent?.is_removed) return false;
    const parentType = parent?.entity_type || hierarchyRootType;
    return (allowedChildrenMap[parentType] || []).includes(entityType);
  }
  const canPlaceUnder = (sourceId: string | null, parentId: string | null) => {
    const source = nodes.find((node) => node.id === sourceId);
    if (!source || source.is_removed || source.is_locked || !canPlaceEntityType(source.entity_type, parentId)) return false;
    if (!source.source_entity_code && !source.reuse_source_node_id && parentId && branchIds(source.id).has(parentId)) return false;
    return true;
  };
  const placeIdentifiedEntity = (sourceId: string, parentId: string | null) => {
    const source = nodes.find((node) => node.id === sourceId);
    if (!source || !canPlaceUnder(sourceId, parentId)) {
      toast("Drop this entity on one of its valid parents.", "warning");
      return;
    }
    const canonicalId = source.reuse_source_node_id || source.id;
    const duplicate = nodes.some((node) => !node.is_removed
      && (node.source_entity_code
        ? node.source_entity_code === source.source_entity_code
        : (node.id === canonicalId || node.reuse_source_node_id === canonicalId))
      && (node.parent_id || null) === parentId);
    if (duplicate) {
      toast(`${source.name} is already placed under that parent.`, "warning");
      return;
    }
    const placement: OrganizationAiDraftNode = {
      ...source,
      id: compactNodeId(),
      parent_id: parentId,
      source_edge_id: null,
      reuse_source_node_id: source.source_entity_code ? null : canonicalId,
      baseline_parent_id: null,
      confidence: null,
      is_ai_generated: false,
      is_removed: false,
      change_type: "added",
    };
    setNodes([...nodes, placement]);
    setSelectedId(placement.id);
    if (parentId) setExpanded((current) => ({ ...current, [parentId]: true }));
    setReuseParentId("");
    toast(`${source.name} added under another parent.`, "success");
  };
  const dropIdentifiedEntity = (parentId: string | null) => {
    if (!draggedNodeId) return;
    placeIdentifiedEntity(draggedNodeId, parentId);
    setDraggedNodeId(null);
  };
  const placeExistingEntity = (entity: StructureEntity, parentId: string | null) => {
    if (nodes.some((node) => node.source_entity_code === entity.code && node.is_locked)) {
      toast(`${entity.name} is already used by Audito and its hierarchy placements cannot be changed.`, "warning");
      return;
    }
    if (!canPlaceEntityType(entity.entity_type, parentId)) {
      toast(`${entity.name} cannot be placed under that entity type.`, "warning");
      return;
    }
    const duplicate = nodes.some((node) => !node.is_removed
      && node.source_entity_code === entity.code
      && (node.parent_id || null) === parentId);
    if (duplicate) {
      toast(`${entity.name} is already placed under that parent.`, "warning");
      return;
    }
    const placement: OrganizationAiDraftNode = {
      id: compactNodeId(),
      parent_id: parentId,
      name: entity.name,
      entity_type: entity.entity_type,
      confidence: null,
      is_ai_generated: false,
      is_removed: false,
      change_type: "added",
      source_entity_code: entity.code,
      source_edge_id: null,
      reuse_source_node_id: null,
      baseline_name: entity.name,
      baseline_parent_id: null,
    };
    setNodes([...nodes, placement]);
    setSelectedId(placement.id);
    if (parentId) setExpanded((current) => ({ ...current, [parentId]: true }));
    toast(`${entity.name} placed in the organization structure.`, "success");
  };
  const canDropCatalogEntity = (parentId: string | null) => draggedExistingEntity
    ? !nodes.some((node) => node.source_entity_code === draggedExistingEntity.code && node.is_locked)
      && canPlaceEntityType(draggedExistingEntity.entity_type, parentId)
    : canPlaceUnder(draggedNodeId, parentId);
  const dropCatalogEntity = (parentId: string | null) => {
    if (draggedExistingEntity) placeExistingEntity(draggedExistingEntity, parentId);
    else dropIdentifiedEntity(parentId);
    setDraggedExistingEntity(null);
    setDraggedNodeId(null);
  };
  const removeNode = async (id: string) => {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    if (node.is_locked) {
      toast(`${node.name} is already used by Audito and cannot be removed or moved.`, "warning");
      return;
    }
    const ids = branchIds(id);
    if (!node.source_entity_code && !node.reuse_source_node_id) {
      for (const placement of nodes.filter((item) => item.reuse_source_node_id === node.id)) {
        branchIds(placement.id).forEach((branchId) => ids.add(branchId));
      }
    }
    if (!node.source_entity_code && nodes.some((item) => ids.has(item.id) && item.source_entity_code)) {
      toast("Move or remove the existing items inside this suggested branch first.", "warning");
      return;
    }
    const accepted = await confirm({
      title: node.source_edge_id ? "Remove this branch from the hierarchy?" : "Remove this suggested placement?",
      message: node.source_edge_id
        ? `${ids.size} item${ids.size === 1 ? "" : "s"} will stay visible as pending removals and can be restored before applying. Audito will block the change if the branch is in use.`
        : `${ids.size} new item${ids.size === 1 ? "" : "s"} will be removed from this review.`,
      confirmText: node.source_edge_id ? "Mark for removal" : "Remove placement",
      cancelText: "Keep branch",
      variant: "warning",
    });
    if (!accepted) return;
    if (node.source_edge_id) {
      setNodes(nodes.map((item) => ids.has(item.id) ? { ...item, is_removed: true, change_type: "removed" as const } : item));
    } else {
      setNodes(nodes.filter((item) => !ids.has(item.id)));
      setSelectedId(null);
    }
  };

  const restoreNode = (id: string) => {
    const ids = branchIds(id);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    let parent = byId.get(id)?.parent_id ? byId.get(byId.get(id)!.parent_id!) : null;
    while (parent) { ids.add(parent.id); parent = parent.parent_id ? byId.get(parent.parent_id) : null; }
    setNodes(nodes.map((item) => {
      if (!ids.has(item.id)) return item;
      const change_type = item.source_entity_code && item.name === item.baseline_name && (item.parent_id || null) === (item.baseline_parent_id || null) ? "unchanged" as const : item.source_entity_code ? "updated" as const : "added" as const;
      return { ...item, is_removed: false, change_type };
    }));
  };

  const parentOptions = useMemo(() => {
    if (!selected) return [];
    return nodes.filter((node) => !node.is_removed
      && node.id !== selected.id
      && (allowedChildrenMap[node.entity_type] || []).includes(selected.entity_type));
  }, [selected, nodes, allowedChildrenMap]);
  const rootAllowedForSelected = selected
    ? (allowedChildrenMap[hierarchyRootType] || []).includes(selected.entity_type)
    : false;

  const prepareForReview = async () => {
    if (!payload || !accessToken) return false;
    setSaving(true);
    const result = await organizationAiSetupApi.update(accessToken, payload.session.organization_ai_setup_session_id, { nodes, summary: payload.session.summary || "", warnings: payload.session.warnings || [] });
    setSaving(false);
    if (!result.success || !result.data) {
      toast(result.message || "Correct the highlighted hierarchy before continuing.", "error");
      return false;
    }
    setPayload(result.data);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`audito_ai_setup_saved:${result.data.session.organization_ai_setup_session_id}`, "1");
      window.sessionStorage.removeItem(reviewStorageKey(result.data.session.organization_ai_setup_session_id));
      window.sessionStorage.removeItem(`audito_ai_setup_refresh_decision:${result.data.session.organization_ai_setup_session_id}`);
    }
    unsavedReviewRef.current = false;
    setHasUnsavedReview(false);
    return true;
  };

  const requestNavigation = (href: string) => {
    if (hasUnsavedReview) {
      setPendingNavigation(href);
      return;
    }
    router.push(href);
  };

  const completePendingNavigation = (target: string) => {
    if (target === "__resume_review__") {
      allowPageExitRef.current = false;
      return;
    }
    allowPageExitRef.current = true;
    if (target === "__reload__") {
      window.location.reload();
      return;
    }
    const url = new URL(target, window.location.href);
    if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);
    else window.location.assign(url.href);
  };

  const saveAndLeave = async () => {
    if (!pendingNavigation) return;
    if (!(await prepareForReview())) {
      setPendingNavigation(null);
      return;
    }
    const target = pendingNavigation;
    setPendingNavigation(null);
    completePendingNavigation(target);
  };

  const discardAndLeave = async () => {
    if (!pendingNavigation || !payload || !accessToken) return;
    setSaving(true);
    const result = await organizationAiSetupApi.discard(accessToken, payload.session.organization_ai_setup_session_id);
    setSaving(false);
    if (!result.success) {
      toast(result.message || "Unable to discard these suggestions. Nothing was removed.", "error");
      setPendingNavigation(null);
      return;
    }
    const target = pendingNavigation;
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`audito_ai_setup_saved:${payload.session.organization_ai_setup_session_id}`);
      window.sessionStorage.removeItem(reviewStorageKey(payload.session.organization_ai_setup_session_id));
      window.sessionStorage.removeItem(`audito_ai_setup_refresh_decision:${payload.session.organization_ai_setup_session_id}`);
    }
    unsavedReviewRef.current = false;
    setHasUnsavedReview(false);
    setPendingNavigation(null);
    setPayload(null);
    setMessages([]);
    if (target === "__resume_review__") {
      allowPageExitRef.current = false;
      setStage(1);
    } else completePendingNavigation(target);
  };

  useEffect(() => {
    if (!pendingNavigation || leaveDecisionOpenRef.current) return;
    leaveDecisionOpenRef.current = true;
    const fromRefresh = pendingNavigation === "__resume_review__";
    void decision({
      title: "Keep these organization suggestions?",
      message: fromRefresh
        ? "This page was refreshed with an unsaved review. Save these suggestions to continue later, or discard them permanently."
        : "You have changes that have not been reviewed or saved. Save them to continue later, or discard them permanently before leaving.",
      primaryText: fromRefresh ? "Save review" : "Save and leave",
      secondaryText: "Discard",
      cancelText: "Continue editing",
      variant: "warning",
    }).then((choice) => {
      leaveDecisionOpenRef.current = false;
      if (choice === "primary") void saveAndLeave();
      else if (choice === "secondary") void discardAndLeave();
      else setPendingNavigation(null);
    });
  }, [pendingNavigation, decision]);

  const continueToConfirm = async () => {
    if (await prepareForReview()) {
      setFinalExpandedIds(new Set(roots.map((node) => node.id)));
      setStage(3);
    }
  };

  const toggleFinalReviewNode = (id: string) => {
    setFinalExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const publish = async () => {
    if (!payload || !accessToken) return;
    const accepted = await confirm({
      title: isUpdate ? "Apply reviewed organization changes?" : "Create this organization structure?",
      message: "Audito will save the organization hierarchy exactly as shown in the final review. Protected entities will remain unchanged.",
      confirmText: isUpdate ? "Apply changes" : "Create structure",
      cancelText: "Return to review",
      variant: "warning",
    });
    if (!accepted) return;
    setSaving(true);
    const result = await organizationAiSetupApi.publish(accessToken, payload.session.organization_ai_setup_session_id);
    setSaving(false);
    if (!result.success) {
      toast(result.message || "No changes were applied. Review the structure and try again.", "error");
      return;
    }
    allowPageExitRef.current = true;
    unsavedReviewRef.current = false;
    setHasUnsavedReview(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(`audito_ai_setup_saved:${payload.session.organization_ai_setup_session_id}`);
      window.sessionStorage.removeItem(reviewStorageKey(payload.session.organization_ai_setup_session_id));
      window.sessionStorage.removeItem(`audito_ai_setup_refresh_decision:${payload.session.organization_ai_setup_session_id}`);
    }
    toast("Organization hierarchy saved successfully.", "success");
    router.push("/organization");
  };

  if (loadingDraft || !organizationChecked || startingSession || (entityTypes.length > 0 && loadingEntities)) {
    return <Loading className="min-h-[60vh]" />;
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-5 overflow-x-hidden p-4 pb-28 pt-20 sm:p-6 sm:pb-28 lg:p-8 lg:pb-10 lg:pt-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-secondary-300"><Sparkles size={14} /> {onboardingMode ? "Organization onboarding" : "Organization assistant"}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">{isUpdate ? "Update your organization with AI" : "Build your organization with AI"}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Upload what you already use or explain the structure in plain language. Audito prepares suggested changes; you stay in control of every change.</p>
        </div>
        <Button className="w-full sm:w-auto" variant="secondary" disabled={busy || saving} leftIcon={<ArrowLeft size={15} />} onClick={() => requestNavigation(onboardingMode ? "/organization/setup-choice" : "/organization")}>{onboardingMode ? "Change setup method" : "Back to mapping"}</Button>
      </header>

      <SetupSteps stage={stage} />

      {stage === 1 && (
        <section className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b2118] sm:rounded-3xl">
          <div className="border-b border-white/10 p-4 text-center sm:p-6">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-secondary-500/10 text-secondary-300"><Sparkles size={21} /></span>
            <h2 className="mt-3 text-xl font-bold text-white">How should Audito prepare the structure?</h2>
            <p className="mt-1 text-sm text-gray-400">Choose one method. You can add more information after the first result is ready.</p>
            <div className="mx-auto mt-5 grid max-w-xl grid-cols-1 rounded-2xl border border-white/10 bg-black/[.15] p-1.5 min-[420px]:grid-cols-2">
              <button type="button" disabled={busy} onClick={() => setInputMode("document")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${inputMode === "document" ? "bg-secondary-400 text-primary-950" : "text-gray-400 hover:text-white"}`}><UploadCloud size={16} /> Upload a document</button>
              <button type="button" disabled={busy} onClick={() => setInputMode("description")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${inputMode === "description" ? "bg-secondary-400 text-primary-950" : "text-gray-400 hover:text-white"}`}><Bot size={16} /> Describe it</button>
            </div>
          </div>

          <div className="p-4 sm:p-7">
            {inputMode === "document" ? (
              <>
                <div onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { if (busy) { event.preventDefault(); return; } dropFiles(event); }} className={`rounded-2xl border border-dashed p-5 text-center transition-colors sm:p-7 ${busy ? "cursor-not-allowed opacity-60" : ""} ${dragging ? "border-secondary-400 bg-secondary-500/10" : "border-white/15 bg-black/[.12]"}`}>
                  <FileSpreadsheet className="mx-auto text-secondary-300" size={30} />
                  <p className="mt-3 text-sm font-semibold text-white">Drop an org chart, audit sheet, checklist, or policy document</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">PDF, Word, text, CSV, or Excel, including macro and binary workbooks. Up to 4 files, 10 MB each.</p>
                  <label className={`mt-4 inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/[.06] px-4 py-2.5 text-sm font-semibold text-white ${busy ? "cursor-not-allowed" : "cursor-pointer hover:bg-white/[.1]"}`}>Choose files<input className="hidden" type="file" multiple accept={AI_DOCUMENT_ACCEPT} disabled={busy} onChange={chooseFiles} /></label>
                </div>
                {files.length > 0 && <div className="mt-4 space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-2.5"><FileText size={16} className="text-secondary-300" /><span className="min-w-0 flex-1 truncate text-sm text-gray-200">{file.name}</span><span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" disabled={busy} onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))} className="text-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Remove ${file.name}`}><X size={16} /></button></div>)}</div>}
                <Button className="mt-5" fullWidth disabled={!files.length || busy || loadingDraft} leftIcon={busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} onClick={() => void submitToAi()}>{busy ? "Analyzing documents..." : isUpdate ? "Compare and prepare changes" : "Generate organization structure"}</Button>
                {busy && <AiProcessingProgress mode={aiProgressMode} progress={aiProgress} />}
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-secondary-400/10 bg-secondary-500/[.05] p-3 text-xs leading-5 text-gray-400"><LockKeyhole size={14} className="mt-0.5 shrink-0 text-secondary-300" /><span>Files are used for this analysis only. Audito does not store the upload, extracted text, filename, or OpenAI file ID.</span></div>
              </>
            ) : (
              <form onSubmit={submitToAi}>
                <label className="mb-2 block text-sm font-semibold text-white">Describe locations, teams, and reporting lines</label>
                <textarea value={chatInput} disabled={busy} onChange={(event) => setChatInput(event.target.value)} rows={7} maxLength={2000} placeholder="Example: We have two factories. Colombo Factory has Cutting, Sewing, Quality, and Packing departments..." className="w-full resize-none rounded-2xl border border-white/10 bg-black/[.15] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-gray-600 focus:border-secondary-400/40 disabled:cursor-not-allowed disabled:opacity-60" />
                <div className="mt-3 flex flex-wrap gap-2">{STARTER_PROMPTS.map((prompt) => <button key={prompt} type="button" disabled={busy} onClick={() => setChatInput(prompt)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:border-secondary-400/25 hover:text-secondary-200 disabled:cursor-not-allowed disabled:opacity-50">{prompt}</button>)}</div>
                <Button className="mt-5" fullWidth type="submit" disabled={!chatInput.trim() || busy || loadingDraft} rightIcon={busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}>{busy ? "Preparing structure..." : "Create structure from description"}</Button>
                {busy && <AiProcessingProgress mode={aiProgressMode} progress={aiProgress} />}
              </form>
            )}
            {admin && !onboardingFinished && <div className="mt-6 border-t border-white/10 pt-4 text-center"><button type="button" disabled={busy} onClick={() => router.push("/structure?manual=1&onboarding=1")} className="text-sm font-semibold text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Prefer manual setup? Create entities first <ChevronRight className="inline" size={15} /></button></div>}
          </div>
        </section>
      )}

      {stage === 2 && payload && (
        <section className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-secondary-400/15 bg-gradient-to-br from-[#0d2a1f] to-[#091c15] shadow-[0_20px_80px_rgba(0,0,0,.22)] sm:rounded-3xl">
            <div className="flex flex-col gap-2 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary-400 text-primary-950"><Bot size={18} /></span><div><h2 className="font-semibold text-white">Ask Audito to correct it</h2><p className="text-xs text-gray-500">Describe a change or attach another document.</p></div></div></div>
              <p className="text-xs text-gray-500">Example: &quot;Move Quality under Factory A&quot;</p>
            </div>
            <div className="space-y-3 px-4 py-4 sm:px-5">
              {!messages.length && <div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-secondary-300"><Bot size={13} /></span><p className="max-w-2xl rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs leading-5 text-gray-300">Your current organization is ready. Ask me to rename, move, add, or remove entities, then review the result below.</p></div>}
              {messages.map((message) => <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}><span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full ${message.role === "user" ? "order-2 bg-secondary-400 text-primary-950" : "bg-white/10 text-secondary-300"}`}>{message.role === "user" ? <UserRound size={12} /> : <Bot size={12} />}</span><p className={`max-w-[84%] rounded-2xl px-3 py-2.5 text-xs leading-5 ${message.role === "user" ? "order-1 bg-secondary-400 text-primary-950" : "border border-white/10 bg-white/[.04] text-gray-300"}`}>{message.content}</p></div>)}
              {busy && <AiProcessingProgress mode={aiProgressMode} progress={aiProgress} />}
            </div>
            <form onSubmit={submitToAi} className="border-t border-white/10 p-4 sm:p-5">
              {voiceTranscript && <p className="mb-2 flex items-center gap-2 text-xs text-secondary-200"><Mic size={14} />Check the voice transcript below. Edit anything misheard before sending.</p>}
              <textarea aria-label={voiceTranscript ? "Voice transcript. Edit before sending" : "Organization change"} value={chatInput} disabled={busy} onChange={(event) => setChatInput(event.target.value)} rows={3} maxLength={2000} placeholder="Tell Audito what should change in the organization..." className="w-full resize-none rounded-2xl border border-white/10 bg-black/[.16] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-gray-600 focus:border-secondary-400/40" />
              {(listening || voiceError) && <p role="status" className={`mt-2 text-xs ${voiceError ? "text-red-200" : "text-secondary-200"}`}>{voiceError || "Listening. Stop when you finish speaking."}</p>}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"><label className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-semibold text-gray-400 ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-white/[.05] hover:text-white"}`}><Plus size={15} /> Attach document<input className="hidden" type="file" multiple accept={AI_DOCUMENT_ACCEPT} disabled={busy} onChange={chooseFiles} /></label>{voiceAvailable && <Button type="button" variant="secondary" aria-label={listening ? "Stop voice input" : "Start voice input"} aria-pressed={listening} disabled={busy} onClick={() => listening ? recognitionRef.current?.stop() : startVoice()}>{listening ? <Square size={15} /> : <Mic size={15} />}</Button>}{files.length > 0 && <p className="min-w-0 flex-1 truncate text-[11px] text-secondary-200">{files.map((file) => file.name).join(", ")}</p>}<Button type="submit" disabled={busy || listening || (!chatInput.trim() && !files.length)} rightIcon={busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}>{busy ? "Processing..." : files.length ? `Analyze ${files.length} file${files.length > 1 ? "s" : ""}` : "Update with AI"}</Button></div>
            </form>
          </div>

          {payload.session.warnings.length > 0 && <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[.06] px-4 py-3"><div className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="text-xs font-semibold text-amber-200">Please check {payload.session.warnings.length} item{payload.session.warnings.length > 1 ? "s" : ""}</p><ul className="mt-1 space-y-1 text-xs leading-5 text-amber-100/70">{payload.session.warnings.slice(0, 3).map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div></div>}

          <div className="rounded-2xl border border-white/10 bg-[#0b2118] p-4 sm:rounded-3xl sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><Layers3 size={17} className="text-secondary-300" /><h2 className="font-semibold text-white">Entity library</h2><span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[10px] font-semibold text-gray-400">{existingEntities.length + identifiedEntities.length}</span></div><p className="mt-1 text-xs text-gray-500">Use existing entities from Entity Setup or newly identified AI suggestions. Drag a card onto a highlighted parent below.</p></div><p className="flex items-center gap-1.5 text-[11px] text-gray-500"><GripVertical size={13} /> Drag to place</p></div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {["All", ...entityTypes].map((type) => {
                const count = type === "All" ? existingEntities.length + identifiedEntities.length : existingEntities.filter((entity) => entity.entity_type === type).length + identifiedEntities.filter((entity) => entity.entity_type === type).length;
                return <button key={type} type="button" onClick={() => setEntityCategory(type)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${entityCategory === type ? "border-secondary-400/35 bg-secondary-500/15 text-secondary-100" : "border-white/10 bg-white/[.025] text-gray-500 hover:text-gray-200"}`}>{type} <span className="ml-1 opacity-65">{count}</span></button>;
              })}
            </div>
            <div className="mt-2 space-y-4">
              {loadingEntities && <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-5 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" /> Loading existing entities...</p>}
              {!loadingEntities && (entityCategory === "All" ? entityTypes : [entityCategory]).map((type) => {
                const existingForType = existingEntities.filter((entity) => entity.entity_type === type);
                const suggestedForType = identifiedEntities.filter((entity) => entity.entity_type === type);
                if (!existingForType.length && !suggestedForType.length) return null;
                return <section key={type} className="rounded-2xl border border-white/[.07] bg-black/[.08] p-3">
                  <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-bold uppercase tracking-[.12em] text-gray-300">{type}</h3><p className="mt-0.5 text-[10px] text-gray-600">{existingForType.length} existing · {suggestedForType.length} AI suggested</p></div><span className="rounded-full bg-white/[.05] px-2 py-1 text-[10px] text-gray-500">Entity type</span></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {existingForType.map((entity) => {
                      const placements = nodes.filter((node) => !node.is_removed && node.source_entity_code === entity.code);
                      const mappedNode = placements[0];
                      return <button key={`existing-${entity.entity_type}-${entity.code}`} type="button" draggable={!busy} onDragStart={(event) => { setDraggedExistingEntity(entity); setDraggedNodeId(null); event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("text/plain", entity.code); }} onDragEnd={() => setDraggedExistingEntity(null)} onClick={() => mappedNode ? setSelectedId(mappedNode.id) : toast(`Drag ${entity.name} onto a highlighted parent to place it.`, "info")} className={`group flex min-w-0 items-center gap-2 rounded-xl border p-3 text-left transition-all sm:gap-3 ${draggedExistingEntity?.code === entity.code ? "border-sky-400/50 bg-sky-500/10 opacity-70" : "border-sky-400/10 bg-sky-500/[.035] hover:border-sky-400/25 hover:bg-sky-500/[.06]"}`}><GripVertical size={15} className="shrink-0 text-gray-600 group-hover:text-sky-300" /><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-xs font-bold text-sky-200">{entity.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-100">{entity.name}</span><span className="block truncate text-[10px] text-gray-500">{placements.length} hierarchy placement{placements.length === 1 ? "" : "s"}</span></span><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${placements.length ? "border-white/10 bg-white/[.04] text-gray-400" : "border-sky-400/20 bg-sky-400/10 text-sky-200"}`}>{placements.length ? "Mapped" : "Available"}</span></button>;
                    })}
                    {suggestedForType.map((entity) => {
                      const placementCount = nodes.filter((node) => !node.is_removed && (node.id === entity.id || node.reuse_source_node_id === entity.id)).length;
                      return <button key={`suggested-${entity.id}`} type="button" draggable={!busy} onDragStart={(event) => { setDraggedNodeId(entity.id); setDraggedExistingEntity(null); event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("text/plain", entity.id); }} onDragEnd={() => setDraggedNodeId(null)} onClick={() => setSelectedId(entity.id)} className={`group flex min-w-0 items-center gap-2 rounded-xl border p-3 text-left transition-all sm:gap-3 ${draggedNodeId === entity.id ? "border-secondary-400/50 bg-secondary-500/10 opacity-70" : "border-secondary-400/10 bg-secondary-500/[.035] hover:border-secondary-400/25 hover:bg-secondary-500/[.06]"}`}><GripVertical size={15} className="shrink-0 text-gray-600 group-hover:text-secondary-300" /><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary-500/10 text-xs font-bold text-secondary-200">{entity.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-100">{entity.name}</span><span className="block truncate text-[10px] text-gray-500">AI suggestion · {placementCount} placement{placementCount === 1 ? "" : "s"}</span></span><span className="shrink-0 rounded-full border border-secondary-400/20 bg-secondary-400/10 px-2 py-0.5 text-[9px] font-semibold text-secondary-200">Suggested</span></button>;
                    })}
                  </div>
                </section>;
              })}
              {!loadingEntities && !existingEntities.length && !identifiedEntities.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-gray-500">No entities are available yet. Ask Audito to identify them, or create them in Entity Setup.</p>}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b2118] sm:rounded-3xl">
            <div className="border-b border-white/10 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2"><GitBranch size={17} className="text-secondary-300" /><h2 className="font-semibold text-white">Review organization structure</h2><span className="rounded-full border border-secondary-400/20 bg-secondary-400/10 px-2 py-0.5 text-[10px] font-semibold text-secondary-200">{changeCounts.added} new</span><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">{changeCounts.updated} changed</span>{changeCounts.removed > 0 && <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-200">{changeCounts.removed} to remove</span>}</div><p className="mt-1 text-xs text-gray-500">Drop existing or AI-suggested entities into valid hierarchy levels, or select an item to edit it manually.</p></div>
            <div className="grid lg:grid-cols-[minmax(360px,1fr)_360px]">
              <div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r sm:p-5"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hierarchy" className="w-full rounded-xl border border-white/10 bg-black/[.12] py-2.5 pl-9 pr-3 text-sm text-white outline-none" /></div><div className="mt-3 max-h-[65dvh] overflow-y-auto overscroll-contain pr-1 xl:max-h-[620px]"><div onDragOver={(event) => { if (canDropCatalogEntity(null)) event.preventDefault(); }} onDrop={(event) => { if (!canDropCatalogEntity(null)) return; event.preventDefault(); dropCatalogEntity(null); }} className={`mb-2 flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 transition-colors ${(draggedNodeId || draggedExistingEntity) && canDropCatalogEntity(null) ? "border-dashed border-secondary-400/50 bg-secondary-500/10" : "border-secondary-400/15 bg-secondary-500/[.08]"}`}><GitBranch size={15} className="shrink-0 text-secondary-300" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-secondary-100">{rootDisplay}</span><span className="shrink-0 text-[10px] text-gray-500">Registered root</span></div>{roots.map((node) => <DraftRow key={node.id} node={node} nodes={nodes} expanded={expanded} selectedId={selectedId} visibleIds={visibleIds} draggedNodeId={draggedNodeId || draggedExistingEntity?.code || null} onSelect={setSelectedId} onToggle={(id) => setExpanded((current) => ({ ...current, [id]: current[id] === false }))} canDropOn={canDropCatalogEntity} onDropEntity={dropCatalogEntity} />)}{!nodes.length && <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">No entities found. Ask Audito to add one or drag an existing entity here.</div>}</div></div>
              <div className="p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-gray-500">Entity details</p>
                {selected ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${changeLabel(selected).className}`}>{changeLabel(selected).text}</span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        {selected.is_locked ? <><LockKeyhole size={11} /> Protected</> : selected.source_edge_id ? <><LockKeyhole size={11} /> Existing placement</> : selected.reuse_source_node_id || (selected.source_entity_code && !selected.source_edge_id) ? <><Layers3 size={11} /> Additional placement</> : "Suggested entity"}
                      </span>
                    </div>
                    {selected.is_locked && (
                      <div className="rounded-xl border border-amber-400/15 bg-amber-400/[.06] p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold text-amber-100"><LockKeyhole size={13} /> This entity is in use</p>
                        <p className="mt-1 text-[11px] leading-5 text-amber-100/65">It cannot be renamed, moved, removed, or remapped while used by {(selected.lock_reasons || []).join(", ") || "another Audito function"}.</p>
                      </div>
                    )}
                    {selected.is_removed && <div className="rounded-xl border border-red-400/15 bg-red-400/[.06] p-3"><p className="text-xs font-semibold text-red-100">This branch is marked for removal</p><p className="mt-1 text-[11px] leading-5 text-red-100/65">It remains visible so you can restore it before applying.</p></div>}
                    <Input label="Entity name" value={selected.name} disabled={selected.is_locked || selected.is_removed || Boolean(selected.reuse_source_node_id) || Boolean(selected.source_entity_code && !selected.source_edge_id)} onChange={(event) => updateNode(selected.id, { name: event.target.value })} />
                    <div>
                      <label className="mb-2 block text-sm text-gray-300">Level</label>
                      <select value={selected.entity_type} disabled={selected.is_locked || Boolean(selected.source_entity_code) || Boolean(selected.reuse_source_node_id) || selected.is_removed} onChange={(event) => updateNode(selected.id, { entity_type: event.target.value, parent_id: null })} className="h-11 w-full rounded-xl border border-white/10 bg-[#10281e] px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60">{entityTypes.map((type) => <option key={type}>{type}</option>)}</select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-gray-300">Reports to</label>
                      <select value={selected.parent_id || ""} disabled={selected.is_locked || selected.is_removed} onChange={(event) => updateNode(selected.id, { parent_id: event.target.value || null })} className="h-11 w-full rounded-xl border border-white/10 bg-[#10281e] px-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"><option value="" disabled={!rootAllowedForSelected}>{rootAllowedForSelected ? rootDisplay : "Select the required parent"}</option>{parentOptions.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select>
                    </div>
                    {!selected.is_locked && (
                      <div className="flex flex-wrap gap-2">
                        {selected.is_removed ? <Button size="sm" leftIcon={<RotateCcw size={13} />} onClick={() => restoreNode(selected.id)}>Restore branch</Button> : <><Button size="sm" leftIcon={<Plus size={13} />} disabled={entityTypes.indexOf(selected.entity_type) === entityTypes.length - 1} onClick={() => addNode(selected.id)}>Add child</Button><Button size="sm" variant="secondary" leftIcon={<Trash2 size={13} />} onClick={() => void removeNode(selected.id)}>{selected.source_edge_id ? "Mark for removal" : "Remove placement"}</Button></>}
                      </div>
                    )}
                    {!selected.is_locked && !selected.is_removed && (rootAllowedForSelected || parentOptions.length > 0) && <div className="rounded-2xl border border-secondary-400/15 bg-secondary-500/[.05] p-3"><p className="flex items-center gap-2 text-xs font-semibold text-secondary-100"><Layers3 size={14} /> Use this entity in another branch</p><p className="mt-1 text-[11px] leading-5 text-gray-500">This creates another hierarchy placement, not another entity record.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={reuseParentId} onChange={(event) => setReuseParentId(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#10281e] px-3 text-xs text-white"><option value="">Choose parent</option>{rootAllowedForSelected && <option value="__root__">{rootDisplay}</option>}{parentOptions.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select><Button className="w-full sm:w-auto" size="sm" disabled={!reuseParentId} onClick={() => placeIdentifiedEntity(selected.reuse_source_node_id || selected.id, reuseParentId === "__root__" ? null : reuseParentId)}>Add</Button></div></div>}
                    {selected.source_edge_id && !selected.is_locked && <p className="rounded-xl border border-white/[.08] bg-white/[.025] p-3 text-xs leading-5 text-gray-500">This placement can be changed because no Audito function currently depends on it.</p>}
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-center"><Pencil className="mx-auto text-gray-600" size={22} /><p className="mt-2 text-sm text-gray-500">Select an entity to edit it.</p><Button className="mt-4" size="sm" leftIcon={<Plus size={13} />} onClick={() => addNode()}>Add first entity</Button></div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 bg-black/[.08] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-gray-500">{nodes.length - changeCounts.removed} active and {changeCounts.removed} marked for removal</p><Button className="w-full sm:w-auto" disabled={saving || busy || !nodes.length} rightIcon={<ChevronRight size={15} />} onClick={() => void continueToConfirm()}>Review changes</Button></div>
          </div>
        </section>
      )}

      {stage === 3 && payload && (
        <section className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-[#0b2118] p-4 sm:rounded-3xl sm:p-8">
          <div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary-500/10 text-secondary-300"><CheckCircle2 size={24} /></span><h2 className="mt-4 text-xl font-bold text-white sm:text-2xl">Review what Audito will apply</h2><p className="mt-2 text-sm leading-6 text-gray-400">This is the final checkpoint. Your uploaded documents are not stored.</p></div>
          <div className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-black/[.12]">
            <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3"><GitBranch size={16} className="text-secondary-300" /><div><h3 className="text-sm font-semibold text-white">Organization hierarchy to save</h3><p className="mt-0.5 text-[11px] text-gray-500">Open each level and confirm its reporting relationship.</p></div></div>
              {nodes.length > 0 && <div className="flex items-center gap-2"><button type="button" onClick={() => setFinalExpandedIds(new Set(nodes.map((node) => node.id)))} className="rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 transition-colors hover:bg-white/[.06] hover:text-white">Expand all</button><button type="button" onClick={() => setFinalExpandedIds(new Set())} className="rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 transition-colors hover:bg-white/[.06] hover:text-white">Collapse all</button></div>}
            </div>
            <div className="max-h-[65dvh] overflow-y-auto overscroll-contain p-3 sm:p-4 xl:max-h-[560px]">
              <div className="mb-2 flex min-w-0 items-center gap-2 rounded-xl border border-secondary-400/15 bg-secondary-500/[.08] px-3 py-3 sm:gap-3"><GitBranch size={15} className="shrink-0 text-secondary-300" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-secondary-100">{rootDisplay}</span><span className="shrink-0 text-[10px] text-gray-500">Registered root</span></div>
              <div className="space-y-1.5">{roots.map((node) => <FinalReviewRow key={node.id} node={node} nodes={nodes} expandedIds={finalExpandedIds} onToggle={toggleFinalReviewNode} />)}</div>
              {!nodes.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">No organization entities will be saved.</p>}
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-secondary-400/15 bg-secondary-500/[.05] p-4"><p className="flex gap-2 text-xs leading-5 text-gray-300"><Check size={14} className="mt-0.5 shrink-0 text-secondary-300" />The hierarchy has been validated and will be applied in one transaction. Protected entities remain unchanged.</p></div>
          {payload.session.warnings.length > 0 && <div className="mt-4 flex gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[.06] p-4"><AlertTriangle size={18} className="shrink-0 text-amber-300" /><p className="text-xs leading-5 text-amber-100/75">Audito flagged details that may need your attention. Go back if any relationship is still uncertain.</p></div>}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button className="w-full sm:w-auto" variant="secondary" disabled={saving} onClick={() => setStage(2)}>Back to editing</Button><Button className="w-full sm:w-auto" disabled={saving || (!changeCounts.added && !changeCounts.updated && !changeCounts.removed)} leftIcon={saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} onClick={() => void publish()}>{saving ? "Applying changes..." : isUpdate ? "Apply organization changes" : "Create organization"}</Button></div>
        </section>
      )}

    </main>
  );
}
