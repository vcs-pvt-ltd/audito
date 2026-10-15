"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlignLeft,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  List,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import Loading from "@/components/shared/Loading";
import { AI_DOCUMENT_ACCEPT, AI_DOCUMENT_FORMAT_LABEL, aiDocumentExtension, isSupportedAiDocument } from "@/utils/aiDocumentFiles";
import { Button, IconButton } from "@/components/ui";
import { checklistApi, orgTreeApi, type AiChecklistQuestionSuggestion, type QuestionPayload } from "@/lib/api";
import {
  CHECKLIST_AI_CONTEXT_KEY,
  CHECKLIST_AI_RESULT_KEY,
  type ChecklistAiQuestionDraft,
  type ChecklistAiWorkspaceContext,
  type ChecklistAiWorkspaceResult,
  readSessionJson,
  writeSessionJson,
} from "@/lib/checklistAiWorkspace";

interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: string;
  children: TreeNode[];
}

interface ReviewDraft extends ChecklistAiQuestionDraft {
  ai_checklist_suggestion_id: string;
  ai_checklist_job_id: string;
  source_reference?: string;
  rationale?: string;
  selected: boolean;
}

interface CoverageSummary {
  requirements_identified: number;
  questions_generated: number;
  coverage_notes: string[];
  has_more: boolean;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ENTITY_TYPE_COLORS: Record<string, string> = {
  Customer: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  "Buying Office": "bg-violet-500/15 text-violet-300 border-violet-500/25",
  Supplier: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Company: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  Cluster: "bg-teal-500/15 text-teal-300 border-teal-500/25",
  Factory: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  Unit: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  Department: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  Section: "bg-green-500/15 text-green-300 border-green-500/25",
  "Audit Firm": "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "Audit Firm Company": "bg-rose-500/15 text-rose-300 border-rose-500/25",
  Branch: "bg-pink-500/15 text-pink-300 border-pink-500/25",
  "Audit Firm Department": "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25",
};

const ANSWER_META = {
  free_text: { label: "Free text", icon: AlignLeft, color: "text-blue-300" },
  single_option: { label: "Single option", icon: ToggleLeft, color: "text-emerald-300" },
  multiple_options: { label: "Multiple options", icon: CheckSquare, color: "text-purple-300" },
  dropdown: { label: "Dropdown", icon: List, color: "text-orange-300" },
};

function nodeKey(code: string, edgeId?: string | null): string {
  return `${code}__${edgeId || "null"}`;
}

function flattenTree(node: TreeNode, result: TreeNode[] = []): TreeNode[] {
  result.push(node);
  for (const child of node.children || []) flattenTree(child, result);
  return result;
}

function validateSelectedQuestions(questions: ReviewDraft[]): string | null {
  if (!questions.length) return "Select at least one question to continue.";
  for (let index = 0; index < questions.length; index += 1) {
    const question = questions[index];
    if (!question.question_text.trim()) return `Question ${index + 1} needs question text.`;
    if (!question.entity_code) return `Question ${index + 1} needs an organization entity.`;
    if (question.answer_type !== "free_text") {
      if (question.options.length < 2) return `Question ${index + 1} needs at least two answer options.`;
      const marks = question.options.reduce((sum, option) => sum + (Number.parseFloat(option.marks) || 0), 0);
      if (Math.abs(marks - 10) > 0.01) return `Question ${index + 1} option marks must total 10.`;
      if (question.options.some(option => !option.text.trim())) return `Question ${index + 1} has an empty answer option.`;
    }
  }
  return null;
}

function ScopeTree({ root, scopeKey, onSelect }: {
  root: TreeNode;
  scopeKey: string;
  onSelect: (node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([nodeKey(root.code, root.edge_id)]));

  const renderNode = (node: TreeNode, depth = 0): React.ReactNode => {
    const key = nodeKey(node.code, node.edge_id);
    const hasChildren = Boolean(node.children?.length);
    const open = expanded.has(key);
    const selected = key === scopeKey;
    const color = ENTITY_TYPE_COLORS[node.entity_type] || "bg-gray-500/15 text-gray-300 border-gray-500/25";
    return (
      <div key={key}>
        <div className="flex items-center gap-1" style={{ marginLeft: `${depth * 14}px` }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(previous => {
                const next = new Set(previous);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              })}
              className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white/[0.05] hover:text-gray-300"
              aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="w-7 shrink-0" />}
          <button
            type="button"
            onClick={() => onSelect(node)}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${selected ? "border-secondary-500/35 bg-secondary-500/[0.12]" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.025]"}`}
          >
            <Building2 size={13} className={selected ? "text-secondary-300" : "text-gray-500"} />
            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${color}`}>{node.entity_type}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-200">{node.name}</span>
            {selected && <CheckCircle2 size={14} className="shrink-0 text-secondary-300" />}
          </button>
        </div>
        {hasChildren && open && <div>{node.children.map(child => renderNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return <div className="h-[min(300px,45dvh)] min-h-56 space-y-0.5 overflow-y-auto overscroll-contain p-2 pr-2.5 sm:h-[300px]">{renderNode(root)}</div>;
}

interface ReviewHierarchyItem {
  node: TreeNode;
  questions: ReviewDraft[];
  children: ReviewHierarchyItem[];
}

function buildReviewHierarchy(node: TreeNode, questionsByEntity: Map<string, ReviewDraft[]>): ReviewHierarchyItem | null {
  const children = (node.children || [])
    .map(child => buildReviewHierarchy(child, questionsByEntity))
    .filter((child): child is ReviewHierarchyItem => Boolean(child));
  const questions = questionsByEntity.get(nodeKey(node.code, node.edge_id)) || [];
  if (!questions.length && !children.length) return null;
  return { node, questions, children };
}

function hierarchyQuestionCount(item: ReviewHierarchyItem): number {
  return item.questions.length + item.children.reduce((total, child) => total + hierarchyQuestionCount(child), 0);
}

function hierarchySelectedCount(item: ReviewHierarchyItem): number {
  return item.questions.filter(question => question.selected).length
    + item.children.reduce((total, child) => total + hierarchySelectedCount(child), 0);
}

function ReviewQuestionCard({ question, index, onToggle, onTextChange }: {
  question: ReviewDraft;
  index: number;
  onToggle: (id: string) => void;
  onTextChange: (id: string, value: string) => void;
}) {
  const meta = ANSWER_META[question.answer_type];
  const AnswerIcon = meta.icon;
  return (
    <article className={`rounded-xl border p-3 transition ${question.selected ? "border-secondary-500/20 bg-secondary-500/[0.045]" : "border-white/[0.06] bg-black/[0.08] opacity-55"}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={question.selected} onChange={() => onToggle(question.id)} className="mt-2 h-4 w-4 shrink-0 accent-emerald-500" aria-label={`Select question ${index + 1}`} />
        <div className="min-w-0 flex-1">
          <textarea
            value={question.question_text}
            onChange={event => onTextChange(question.id, event.target.value)}
            disabled={!question.selected}
            rows={2}
            className="w-full resize-y rounded-lg border border-white/[0.09] bg-black/15 px-3 py-2 text-sm leading-relaxed text-gray-100 outline-none transition focus:border-secondary-500/40 focus:ring-1 focus:ring-secondary-500/15 disabled:cursor-not-allowed"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] font-medium ${meta.color}`}><AnswerIcon size={11} />{meta.label}</span>
            {question.options.length > 0 && <span className="text-[10px] leading-relaxed text-gray-500">{question.options.map(option => `${option.text} (${option.marks})`).join(" · ")}</span>}
          </div>
          {(question.source_reference || question.rationale) && (
            <details className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer text-[10px] font-medium text-gray-400">Source and reasoning</summary>
              <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-gray-500">
                {question.source_reference && <p><span className="text-gray-400">Source:</span> {question.source_reference}</p>}
                {question.rationale && <p><span className="text-gray-400">Reason:</span> {question.rationale}</p>}
              </div>
            </details>
          )}
        </div>
      </div>
    </article>
  );
}

function ReviewHierarchyNode({ item, depth = 0, onToggle, onTextChange }: {
  item: ReviewHierarchyItem;
  depth?: number;
  onToggle: (id: string) => void;
  onTextChange: (id: string, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = hierarchyQuestionCount(item);
  const selected = hierarchySelectedCount(item);
  const typeColor = ENTITY_TYPE_COLORS[item.node.entity_type] || "bg-gray-500/15 text-gray-300 border-gray-500/25";
  const hasContent = Boolean(item.questions.length || item.children.length);

  return (
    <div className={depth === 0 ? "" : "ml-2 border-l border-white/[0.09] pl-2 sm:ml-3 sm:pl-3"}>
      <section className={`overflow-hidden rounded-2xl border transition ${depth === 0 ? "border-white/[0.1] bg-white/[0.025]" : "border-white/[0.07] bg-black/[0.08]"}`}>
        <button type="button" onClick={() => hasContent && setOpen(value => !value)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-white/[0.025] sm:px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
            {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-500" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${typeColor}`}>{item.node.entity_type}</span>
              <h3 className="min-w-0 truncate text-sm font-semibold text-white">{item.node.name}</h3>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{item.questions.length ? `${item.questions.length} directly assigned · ` : ""}{selected} of {total} selected in this branch</p>
          </div>
          <span className="shrink-0 rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2 py-1 text-[10px] font-semibold text-secondary-300">{total}Q</span>
        </button>

        {open && (
          <div className="space-y-3 border-t border-white/[0.06] p-3 sm:p-4">
            {item.questions.length > 0 && (
              <div className="space-y-2">
                {item.questions.map((question, index) => <ReviewQuestionCard key={question.id} question={question} index={index} onToggle={onToggle} onTextChange={onTextChange} />)}
              </div>
            )}
            {item.children.length > 0 && (
              <div className="space-y-3">
                {item.children.map(child => <ReviewHierarchyNode key={nodeKey(child.node.code, child.node.edge_id)} item={child} depth={depth + 1} onToggle={onToggle} onTextChange={onTextChange} />)}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AiChecklistQuestionsPage() {
  const { admin, accessToken, isLoading, subscription } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialScopeKeyRef = useRef("");
  const [workspaceContext, setWorkspaceContext] = useState<ChecklistAiWorkspaceContext>({
    returnUrl: "/checklists/create",
    checklistName: "",
    checklistType: "",
    existingQuestions: [],
  });
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focus, setFocus] = useState("");
  const [scopeCode, setScopeCode] = useState("");
  const [scopeTreeId, setScopeTreeId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [coverage, setCoverage] = useState<CoverageSummary | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [finishing, setFinishing] = useState(false);

  const planEligible = !subscription || subscription.is_active;
  const selectedDrafts = useMemo(() => drafts.filter(draft => draft.selected), [drafts]);
  const validationError = useMemo(() => validateSelectedQuestions(selectedDrafts), [selectedDrafts]);
  const scopeChanged = Boolean(initialScopeKeyRef.current) && nodeKey(scopeCode, scopeTreeId) !== initialScopeKeyRef.current;
  const hasUnsavedAiWork = Boolean(file || focus.trim() || drafts.length || generating || scopeChanged);

  useEffect(() => {
    if (!isLoading && !admin) router.replace("/login");
  }, [admin, isLoading, router]);

  useEffect(() => {
    if (!generating) return;
    setProgress(7);
    const timer = window.setInterval(() => {
      setProgress(current => current >= 93 ? current : Math.min(93, current + (current < 35 ? 7 : current < 72 ? 4 : 2)));
    }, 900);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    const savedContext = readSessionJson<ChecklistAiWorkspaceContext>(CHECKLIST_AI_CONTEXT_KEY);
    if (savedContext) setWorkspaceContext(savedContext);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!accessToken) return;
      setLoadingData(true);
      const response = await orgTreeApi.getTree(accessToken);
      if (response.success && response.data) {
        const data = response.data as { tree: TreeNode };
        if (data.tree) {
          setTreeRoot(data.tree);
          setTreeNodes(flattenTree(data.tree));
          setScopeCode(data.tree.code);
          setScopeTreeId(data.tree.edge_id ?? null);
          initialScopeKeyRef.current = nodeKey(data.tree.code, data.tree.edge_id ?? null);
        }
      } else {
        setError(response.message || "Unable to load the organization hierarchy.");
      }
      setLoadingData(false);
    };
    load();
  }, [accessToken]);

  useEffect(() => {
    if (!hasUnsavedAiWork) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedAiWork]);

  const acceptFile = useCallback((nextFile: File | null) => {
    if (!nextFile) return;
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("The reference document must be 2 MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!isSupportedAiDocument(nextFile)) {
      setFile(null);
      setError(`Choose a supported file: ${AI_DOCUMENT_FORMAT_LABEL}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(nextFile);
    setError("");
  }, []);

  const finalizeReviews = useCallback(async (acceptedDrafts: ReviewDraft[]) => {
    if (!accessToken || !jobIds.length) return true;
    let allRecorded = true;
    for (const currentJobId of jobIds) {
      const acceptedIds = acceptedDrafts
        .filter(draft => draft.ai_checklist_job_id === currentJobId)
        .map(draft => draft.ai_checklist_suggestion_id);
      const result = await checklistApi.finalizeAiSuggestions(accessToken, currentJobId, acceptedIds);
      if (!result.success) allRecorded = false;
    }
    if (!allRecorded) toast("Your questions are safe, but part of the AI review status could not be recorded.", "warning");
    return allRecorded;
  }, [accessToken, jobIds, toast]);

  const handleBack = async () => {
    if (generating || finishing) return;
    if (hasUnsavedAiWork) {
      const discard = await confirm({
        title: drafts.length ? "Leave AI question review?" : "Leave AI question setup?",
        message: drafts.length
          ? "Generated suggestions that have not been added to the checklist will be discarded."
          : "Your selected document and generation settings will be discarded.",
        confirmText: "Discard and leave",
        cancelText: "Continue reviewing",
        variant: "warning",
      });
      if (!discard) return;
      await finalizeReviews([]);
    }
    window.sessionStorage.removeItem(CHECKLIST_AI_RESULT_KEY);
    router.push(workspaceContext.returnUrl || "/checklists/create");
  };

  const requestGeneration = async (isContinuation: boolean) => {
    if (!accessToken || !file || !treeRoot) return;
    if (!planEligible) {
      router.push("/settings/billing");
      return;
    }
    setGenerating(true);
    setError("");
    if (!isContinuation) {
      setCoverage(null);
      setIssues([]);
    }
    try {
      const response = await checklistApi.generateAiQuestions(accessToken, file, {
        focus: focus.trim(),
        checklistType: workspaceContext.checklistType,
        scopeEntityCode: scopeCode || treeRoot.code,
        scopeOrgTreeId: scopeTreeId,
        existingQuestions: isContinuation
          ? [...workspaceContext.existingQuestions, ...drafts.map(draft => draft.question_text.trim()).filter(Boolean)]
          : workspaceContext.existingQuestions,
        continueGeneration: isContinuation,
      });
      if (!response.success || !response.data) throw new Error(response.message || "Unable to generate checklist questions.");
      const payload = response.data as { job_id: string; items: AiChecklistQuestionSuggestion[]; issues?: string[]; coverage?: CoverageSummary };
      const batchJobId = payload.job_id || "";
      const generatedDrafts: ReviewDraft[] = (payload.items || []).map((item, index) => ({
        id: `ai-review-${item.ai_checklist_suggestion_id || index}`,
        ai_checklist_suggestion_id: item.ai_checklist_suggestion_id,
        ai_checklist_job_id: batchJobId,
        entity_code: item.entity_code,
        org_tree_id: item.org_tree_id ?? null,
        entity_type: item.entity_type,
        entity_name: item.entity_name,
        question_text: item.question_text,
        answer_type: item.answer_type,
        options: (item.options || []).map(option => ({ text: option.option_text, marks: String(option.marks) })),
        source_reference: item.source_reference,
        rationale: item.rationale,
        selected: true,
      }));
      if (batchJobId) setJobIds(previous => [...new Set([...previous, batchJobId])]);
      const existingText = new Set((isContinuation ? drafts : []).map(draft => draft.question_text.trim().toLowerCase()).filter(Boolean));
      const uniqueDrafts = generatedDrafts.filter(draft => {
        const normalized = draft.question_text.trim().toLowerCase();
        if (!normalized || existingText.has(normalized)) return false;
        existingText.add(normalized);
        return true;
      });
      if (!uniqueDrafts.length) {
        if (!isContinuation) throw new Error("No valid questions were generated. Try a clearer source document or a more specific focus.");
        setCoverage(previous => previous ? { ...previous, has_more: false } : null);
        toast("All identified document requirements are already covered.", "success");
        setProgress(100);
        return;
      }
      const totalQuestions = isContinuation ? drafts.length + uniqueDrafts.length : uniqueDrafts.length;
      setDrafts(previous => isContinuation ? [...previous, ...uniqueDrafts] : uniqueDrafts);
      setCoverage(previous => ({
        requirements_identified: Math.max(previous?.requirements_identified || 0, payload.coverage?.requirements_identified || 0),
        questions_generated: totalQuestions,
        coverage_notes: [...new Set([...(previous?.coverage_notes || []), ...(payload.coverage?.coverage_notes || [])])],
        has_more: Boolean(payload.coverage?.has_more),
      }));
      setIssues(previous => isContinuation
        ? [...new Set([...previous, ...(payload.issues || [])])]
        : (payload.issues || []));
      setProgress(100);
      setSearch("");
      if (isContinuation) toast(`${uniqueDrafts.length} additional question${uniqueDrafts.length === 1 ? "" : "s"} added to this review.`, "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate checklist questions.");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (drafts.length) {
      const regenerate = await confirm({
        title: "Generate a new review?",
        message: "The current AI suggestions will be discarded and replaced with a new analysis.",
        confirmText: "Generate again",
        cancelText: "Keep current review",
        variant: "warning",
      });
      if (!regenerate) return;
      await finalizeReviews([]);
    }
    setJobIds([]);
    setDrafts([]);
    await requestGeneration(false);
  };

  const handleGenerateMore = async () => {
    if (!coverage?.has_more || generating || finishing) return;
    await requestGeneration(true);
  };

  const handleAddToChecklist = async () => {
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    setFinishing(true);
    const resolvedQuestions: ChecklistAiQuestionDraft[] = selectedDrafts.map((draft, index) => {
      const exactNode = treeNodes.find(node => node.code === draft.entity_code && (node.edge_id ?? null) === (draft.org_tree_id ?? null));
      const matchingNode = exactNode || treeNodes.find(node => node.code === draft.entity_code);
      return {
        id: `ai-${Date.now()}-${index}`,
        entity_code: draft.entity_code,
        org_tree_id: matchingNode?.edge_id ?? draft.org_tree_id ?? null,
        entity_type: matchingNode?.entity_type || draft.entity_type,
        entity_name: matchingNode?.name || draft.entity_name,
        question_text: draft.question_text.trim(),
        answer_type: draft.answer_type,
        options: draft.options,
      };
    });
    await finalizeReviews(selectedDrafts);
    const result: ChecklistAiWorkspaceResult = {
      returnUrl: workspaceContext.returnUrl || "/checklists/create",
      questions: resolvedQuestions,
      createdAt: Date.now(),
    };
    writeSessionJson(CHECKLIST_AI_RESULT_KEY, result);
    toast(`${resolvedQuestions.length} question${resolvedQuestions.length === 1 ? "" : "s"} ready for checklist review.`, "success");
    router.push(result.returnUrl);
  };

  const reviewHierarchy = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = normalizedSearch
      ? drafts.filter(draft => [draft.question_text, draft.entity_name, draft.source_reference, draft.rationale].some(value => value?.toLowerCase().includes(normalizedSearch)))
      : drafts;
    const byEntity = new Map<string, ReviewDraft[]>();
    for (const draft of filtered) {
      const exactNode = treeNodes.find(node => node.code === draft.entity_code && (node.edge_id ?? null) === (draft.org_tree_id ?? null));
      const resolvedNode = exactNode || treeNodes.find(node => node.code === draft.entity_code);
      const key = resolvedNode ? nodeKey(resolvedNode.code, resolvedNode.edge_id) : nodeKey(draft.entity_code, draft.org_tree_id);
      byEntity.set(key, [...(byEntity.get(key) || []), draft]);
    }
    const root = treeRoot ? buildReviewHierarchy(treeRoot, byEntity) : null;
    const representedKeys = new Set<string>();
    if (root) {
      const collect = (item: ReviewHierarchyItem) => {
        representedKeys.add(nodeKey(item.node.code, item.node.edge_id));
        item.children.forEach(collect);
      };
      collect(root);
    }
    const extras: ReviewHierarchyItem[] = [];
    for (const [key, questions] of byEntity) {
      if (!representedKeys.has(key) && questions.length) {
        const first = questions[0];
        extras.push({
          node: { code: first.entity_code, edge_id: first.org_tree_id ?? undefined, entity_type: first.entity_type, name: first.entity_name, children: [] },
          questions,
          children: [],
        });
      }
    }
    return { root, extras, visibleQuestionCount: filtered.length };
  }, [drafts, search, treeNodes, treeRoot]);

  if (isLoading || loadingData) return <Loading className="h-screen" />;
  if (!admin) return null;

  const activeStep = drafts.length ? 2 : 1;
  const progressLabel = drafts.length
    ? (progress < 55 ? "Finding uncovered document requirements" : progress < 88 ? "Preparing the next review batch" : "Adding questions to your review")
    : (progress < 34 ? "Preparing the source document" : progress < 68 ? "Identifying auditable requirements" : progress < 88 ? "Mapping questions to organization entities" : "Preparing your review workspace");

  return (
    <main className="min-h-full overflow-x-hidden px-3 pb-12 pt-20 text-white sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <IconButton bordered onClick={handleBack} disabled={generating || finishing} title="Back to checklist"><ArrowLeft size={18} /></IconButton>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Generate Checklist Questions</h1>
                <span className="rounded-full border border-secondary-400/25 bg-secondary-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-200">AI assisted</span>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-400">Turn a policy, procedure, SOP, or standard into organization-aware draft questions, then review every suggestion before adding it.</p>
              {workspaceContext.checklistName && <p className="mt-1 text-xs text-gray-500">Checklist: <span className="text-gray-300">{workspaceContext.checklistName}</span>{workspaceContext.checklistType ? ` · ${workspaceContext.checklistType}` : ""}</p>}
            </div>
          </div>
          <div className="flex w-full items-center gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-2 sm:w-auto sm:gap-2">
            {[{ number: 1, label: "Source & scope" }, { number: 2, label: "Review questions" }].map((item, index) => (
              <div key={item.number} className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none sm:gap-2">
                {index > 0 && <ChevronRight size={14} className="text-gray-700" />}
                <div className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 sm:flex-none sm:justify-start sm:px-3 ${activeStep === item.number ? "bg-secondary-500/15 text-secondary-200" : activeStep > item.number ? "text-emerald-300" : "text-gray-600"}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${activeStep > item.number ? "bg-emerald-500/15" : activeStep === item.number ? "bg-secondary-500/20" : "bg-white/[0.04]"}`}>{activeStep > item.number ? <Check size={13} /> : item.number}</span>
                  <span className="hidden text-xs font-semibold sm:inline">{item.label}</span>
                </div>
              </div>
            ))}
          </div>
        </header>

        {!planEligible && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-amber-200">AI checklist generation is available once your workspace package is active.</p><p className="mt-1 text-xs text-amber-100/60">Your current checklist remains unchanged.</p></div>
            <Button onClick={() => router.push("/settings/billing")}>View package</Button>
          </div>
        )}

        {generating && (
          <section className="mb-5 overflow-hidden rounded-2xl border border-secondary-500/25 bg-gradient-to-r from-secondary-500/[0.13] via-emerald-500/[0.07] to-transparent p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
              <div className="flex min-w-0 items-start gap-3 sm:items-center"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-500/15"><Loader2 size={19} className="animate-spin text-secondary-300" /></span><div className="min-w-0"><p className="text-sm font-semibold">{progressLabel}</p><p className="mt-0.5 text-xs text-gray-400">You can review the source settings while the analysis runs. Keep this page open.</p></div></div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-secondary-300">{progress}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-emerald-400 transition-[width] duration-700" style={{ width: `${progress}%` }} /></div>
          </section>
        )}

        {error && <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span><button type="button" onClick={() => setError("")} className="ml-auto text-red-300/60 hover:text-red-200"><X size={15} /></button></div>}

        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4 self-start">
            <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.025]">
              <div className="border-b border-white/[0.07] p-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-500/15 text-secondary-300"><FileText size={14} /></span><h2 className="text-sm font-semibold">Reference document</h2></div><p className="mt-2 text-xs leading-relaxed text-gray-500">The AI derives question coverage from distinct requirements in this file.</p></div>
              <div className="p-4">
                <input ref={fileInputRef} type="file" accept={AI_DOCUMENT_ACCEPT} className="hidden" onChange={event => acceptFile(event.target.files?.[0] || null)} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={event => { event.preventDefault(); setDragging(true); }}
                  onDragOver={event => event.preventDefault()}
                  onDragLeave={event => { event.preventDefault(); setDragging(false); }}
                  onDrop={event => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0] || null); }}
                  disabled={generating}
                  className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center transition ${dragging ? "border-secondary-400 bg-secondary-500/[0.1]" : file ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/[0.16] bg-black/[0.08] hover:border-secondary-500/40 hover:bg-secondary-500/[0.04]"}`}
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${file ? "bg-emerald-500/15 text-emerald-300" : "bg-secondary-500/15 text-secondary-300"}`}>{file ? <CheckCircle2 size={20} /> : <Upload size={19} />}</span>
                  <span className="mt-3 max-w-full truncate text-sm font-semibold text-white">{file?.name || "Drop a document here"}</span>
                  <span className="mt-1 text-[11px] text-gray-500">{file ? `${(file.size / 1024).toFixed(0)} KB · ${aiDocumentExtension(file.name).toUpperCase()} · Click to replace` : "or click to browse · PDF, Word, text, CSV, Excel · 2 MB max"}</span>
                </button>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.025]">
              <div className="border-b border-white/[0.07] p-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300"><Building2 size={14} /></span><h2 className="text-sm font-semibold">Organization scope</h2></div><p className="mt-2 text-xs leading-relaxed text-gray-500">Select the highest entity the document applies to. Children remain available for question assignment.</p></div>
              {treeRoot ? <ScopeTree root={treeRoot} scopeKey={nodeKey(scopeCode, scopeTreeId)} onSelect={node => { setScopeCode(node.code); setScopeTreeId(node.edge_id ?? null); }} /> : <div className="p-6 text-center text-xs text-gray-500">Set up your organization structure before using AI generation.</div>}
            </section>

            <section className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-4">
              <label htmlFor="ai-focus" className="text-sm font-semibold">Focus areas <span className="font-normal text-gray-600">(optional)</span></label>
              <textarea id="ai-focus" value={focus} onChange={event => setFocus(event.target.value)} maxLength={300} rows={3} placeholder="Example: machine guarding, emergency procedures, and training records" disabled={generating} className="mt-3 w-full resize-y rounded-xl border border-white/[0.09] bg-black/15 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-secondary-500/40 focus:ring-1 focus:ring-secondary-500/15" />
              <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-gray-500"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-secondary-300" /><span>The source is processed for this request and is not saved as checklist media.</span></div>
              <Button className="mt-4 w-full" disabled={!planEligible || generating || !file || !treeRoot} loading={generating} leftIcon={generating ? undefined : <Sparkles size={15} />} onClick={handleGenerate}>{drafts.length ? "Generate again" : "Generate questions"}</Button>
            </section>
          </aside>

          <section className="min-w-0">
            {!drafts.length ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.025] to-transparent px-4 py-10 text-center sm:min-h-[520px] sm:rounded-3xl sm:px-6 sm:py-14 xl:min-h-[620px]">
                <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-secondary-500/20 bg-secondary-500/[0.09] text-secondary-300"><Sparkles size={30} /><span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#07150f] bg-emerald-400" /></span>
                <h2 className="mt-6 text-xl font-bold">Prepare a document-driven checklist</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-400">Add a reference document and select its organization scope. The AI will identify auditable requirements, decide the necessary coverage, and organize suggestions by the entities you already use.</p>
                <div className="mt-7 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
                  {[{ n: "01", t: "Upload", d: "Policy, SOP, procedure, or standard" }, { n: "02", t: "Analyze", d: "Requirements mapped to your hierarchy" }, { n: "03", t: "Review", d: "Edit and approve before adding" }].map(item => <div key={item.n} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left"><span className="text-[10px] font-black tracking-wider text-secondary-400">{item.n}</span><p className="mt-2 text-sm font-semibold">{item.t}</p><p className="mt-1 text-xs leading-relaxed text-gray-500">{item.d}</p></div>)}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/[0.09] bg-white/[0.025] p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div><div className="flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-300" /><h2 className="text-base font-bold">Review generated questions</h2></div><p className="mt-1 text-xs leading-relaxed text-gray-500">Edit wording and exclude suggestions you do not need. Nothing is added until you confirm.</p></div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setDrafts(previous => previous.map(draft => ({ ...draft, selected: true })))} className="rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/[0.04]">Select all</button>
                      <button type="button" onClick={() => setDrafts(previous => previous.map(draft => ({ ...draft, selected: false })))} className="rounded-lg border border-white/[0.09] px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/[0.04]">Clear selection</button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.07] bg-black/[0.1] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Requirements found</p><p className="mt-1 text-xl font-bold">{coverage?.requirements_identified ?? "—"}</p></div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/[0.1] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Questions prepared</p><p className="mt-1 text-xl font-bold text-secondary-300">{coverage?.questions_generated ?? drafts.length}</p></div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/[0.1] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Selected</p><p className="mt-1 text-xl font-bold text-emerald-300">{selectedDrafts.length}</p></div>
                  </div>
                  {coverage?.has_more && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-secondary-500/20 bg-secondary-500/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-secondary-200">More document requirements are available</p><p className="mt-1 text-[11px] leading-relaxed text-gray-500">Generate the next review batch. Existing questions stay in place and are sent as coverage context to prevent duplicates.</p></div><Button variant="secondary" disabled={generating || finishing} loading={generating} onClick={handleGenerateMore}>Generate next batch</Button></div>}
                  <div className="relative mt-4"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search questions, entities, or source references" className="w-full rounded-xl border border-white/[0.09] bg-black/15 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-secondary-500/40" /></div>
                </div>

                {coverage?.coverage_notes?.length ? <details className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.055] p-4"><summary className="cursor-pointer text-xs font-semibold text-blue-300">Coverage notes ({coverage.coverage_notes.length})</summary><ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-blue-100/65">{coverage.coverage_notes.map((note, index) => <li key={index}>• {note}</li>)}</ul></details> : null}
                {issues.length ? <details className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.055] p-4"><summary className="cursor-pointer text-xs font-semibold text-amber-300">Items requiring attention ({issues.length})</summary><ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-amber-100/65">{issues.map((issue, index) => <li key={index}>• {issue}</li>)}</ul></details> : null}
                {validationError && selectedDrafts.length > 0 && <div className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-xs text-red-300">{validationError}</div>}

                <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.018] sm:rounded-3xl">
                  <div className="flex flex-col gap-2 border-b border-white/[0.07] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Organization question hierarchy</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">Expand each reporting branch to review its directly assigned questions and child entities.</p>
                    </div>
                    <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium text-gray-400">{reviewHierarchy.visibleQuestionCount} visible</span>
                  </div>
                  <div className="space-y-3 p-3 sm:p-4">
                    {reviewHierarchy.root && <ReviewHierarchyNode item={reviewHierarchy.root} onToggle={id => setDrafts(previous => previous.map(draft => draft.id === id ? { ...draft, selected: !draft.selected } : draft))} onTextChange={(id, value) => setDrafts(previous => previous.map(draft => draft.id === id ? { ...draft, question_text: value } : draft))} />}
                    {reviewHierarchy.extras.map(item => <ReviewHierarchyNode key={nodeKey(item.node.code, item.node.edge_id)} item={item} onToggle={id => setDrafts(previous => previous.map(draft => draft.id === id ? { ...draft, selected: !draft.selected } : draft))} onTextChange={(id, value) => setDrafts(previous => previous.map(draft => draft.id === id ? { ...draft, question_text: value } : draft))} />)}
                    {!reviewHierarchy.root && !reviewHierarchy.extras.length && <div className="p-10 text-center text-sm text-gray-500">No questions match your search.</div>}
                  </div>
                </div>

                <div className="sticky bottom-2 z-30 rounded-2xl border border-secondary-500/20 bg-[#0a1c14]/95 p-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:bottom-4 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{selectedDrafts.length} question{selectedDrafts.length === 1 ? "" : "s"} selected</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">Return the selected questions to the checklist for final scoring and saving.</p>
                    </div>
                    <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto">
                      <Button variant="secondary" disabled={finishing} onClick={handleBack}>Discard</Button>
                      <Button loading={finishing} disabled={finishing || Boolean(validationError)} leftIcon={finishing ? undefined : <Check size={15} />} onClick={handleAddToChecklist}>Add to checklist</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
