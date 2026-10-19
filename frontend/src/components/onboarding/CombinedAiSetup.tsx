"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Info, Save, Sparkles, X } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import Loading from "@/components/shared/Loading";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { checklistApi, organizationAiSetupApi, type OnboardingDraft, type OnboardingQuestion, type OrganizationAiDraftNode, type OrganizationAiSetupPayload } from "@/lib/api";
import { ONBOARDING_DOCUMENT_FORMAT_LABEL, isSupportedOnboardingDocument } from "@/utils/aiDocumentFiles";
import AssistantPanel from "./combined/AssistantPanel";
import ChecklistReview from "./combined/ChecklistReview";
import FinalReview from "./combined/FinalReview";
import OrganizationReview from "./combined/OrganizationReview";
import ProgressCard from "./combined/ProgressCard";
import UploadStep from "./combined/UploadStep";
import DepartmentUpgradeModal from "@/components/billing/DepartmentUpgradeModal";
import { ROOT_AREA, STEPS, branchOf, checklistDetailIssues, findNodeIssues, findQuestionIssues, preferredParentChoices, reachableTypes, type ChatMessage, type ProgressInfo } from "./combined/model";
import { Drawer, Stepper } from "./combined/ui";
import { notice, stepSwap } from "./motion";

type BusyMode = "reading" | "updating" | "saving";
type ReadPhase = "structure" | "questions";
function storageKey(id: string) { return `audito_combined_setup:${id}`; }
// Matches the backend STILL_READING message for a read that is still running.
const isStillReading = (message?: string) => Boolean(message?.startsWith("Audito is still reading"));
// The uploaded sheet is kept for a while only; after that it must be uploaded again.
const needsUploadAgain = (message?: string) => Boolean(message?.includes("Upload your audit sheet again"));
const newMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({ id: `${role}-${crypto.randomUUID()}`, role, content });
const fileKey = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The step a draft opens on: questions once read, organization once read, else upload. */
function stepFor(draft: OnboardingDraft | null | undefined) {
  if (draft?.questions_generated || (draft?.questions.length && !draft.structure_read)) return 2;
  return draft?.structure_read ? 1 : 0;
}

// How many areas and questions an AI correction changed.
function changesBetween(before: OrganizationAiSetupPayload, after: OrganizationAiSetupPayload) {
  const previousNodes = new Map(before.nodes.map(n => [n.id, n]));
  const nodes = after.nodes.filter(n => {
    const p = previousNodes.get(n.id);
    return !p || p.name !== n.name || (p.parent_id || null) !== (n.parent_id || null) || Boolean(p.is_removed) !== Boolean(n.is_removed);
  }).length;
  const previousQuestions = new Map((before.session.onboarding_draft?.questions || []).map(q => [q.id, q]));
  const questions = (after.session.onboarding_draft?.questions || []).filter(q => {
    const p = previousQuestions.get(q.id);
    return !p || p.question_text !== q.question_text || p.node_id !== q.node_id || p.answer_type !== q.answer_type || p.selected !== q.selected || JSON.stringify(p.options) !== JSON.stringify(q.options);
  }).length;
  return { nodes, questions };
}

export default function CombinedAiSetup() {
  const { accessToken, admin } = useAuth();
  const { refreshProgress } = useOnboarding();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();
  const [payload, setPayload] = useState<OrganizationAiSetupPayload | null>(null);
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [nodes, setNodes] = useState<OrganizationAiDraftNode[]>([]);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<BusyMode>("updating");
  const [readPhase, setReadPhase] = useState<ReadPhase>("structure");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dirty, setDirty] = useState(false);
  const [types, setTypes] = useState<{ checklist_type_id: string; name: string }[]>([]);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement | null>(null);
  const firstStep = useRef(true);
  const running = useRef(false);
  const mounted = useRef(true);
  // Set on every mount: React Strict Mode mounts, unmounts and mounts again in
  // development, and a flag left false would stop waiting for a running read.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const root = payload?.session.root_entity_type || admin?.entity_type || "Organization";
  const rootName = payload?.root_entity_name || "";
  const activeNodes = nodes.filter(n => !n.is_removed);
  const selected = draft?.questions.filter(q => q.selected) || [];
  const nodeIssues = findNodeIssues(nodes, root);
  const questionIssues = findQuestionIssues(draft?.questions || [], new Set([ROOT_AREA, ...activeNodes.map(n => n.id)]));
  const planIssue = payload?.plan_issue || "";
  const hasDraft = Boolean(draft?.structure_read || draft?.questions.length);
  const availableTypes = reachableTypes(root);
  // Existing entity records not yet in the draft, of types allowed here.
  const availableRecords = (payload?.entity_catalog || []).filter(entity => availableTypes.includes(entity.entity_type)
    && !activeNodes.some(n => n.source_entity_code === entity.code && n.entity_type === entity.entity_type));
  const canSave = Boolean(draft) && !checklistDetailIssues(draft!.checklist).length && selected.length > 0 && !nodeIssues.size && !questionIssues.size && !planIssue;

  function apply(data: OrganizationAiSetupPayload) {
    setPayload(data); setNodes(data.nodes); setDraft(data.session.onboarding_draft || null); setDirty(false);
    try { sessionStorage.removeItem(storageKey(data.session.organization_ai_setup_session_id)); } catch { /* storage can be unavailable */ }
  }
  async function initialize() {
    if (!accessToken) return;
    setLoading(true); setError("");
    // Guided setup runs once. When it is done, show the saved organization instead,
    // keeping the loading view (not the error view) while the page changes.
    let leaving = false;
    const showOrganization = () => {
      leaving = true;
      try { sessionStorage.removeItem(`audito_combined_session:${admin?.entity_code}`); } catch { /* no saved browser state */ }
      router.replace("/organization?onboarding=1");
    };
    try {
      const completion = await organizationAiSetupApi.completion(accessToken);
      if (completion.success && completion.data?.completed) { showOrganization(); return; }
      const result = await organizationAiSetupApi.create(accessToken, true);
      if (!result.success && result.message === "Your setup is already complete.") { showOrganization(); return; }
      if (!result.success || !result.data) throw new Error(result.message || "Could not open setup. Try again.");
      const data = result.data;
      try { sessionStorage.setItem(`audito_combined_session:${admin?.entity_code}`, data.session.organization_ai_setup_session_id); } catch { /* server draft remains available */ }
      let saved: { nodes: OrganizationAiDraftNode[]; draft: OnboardingDraft; updatedAt?: string; step?: number } | null = null;
      try { saved = JSON.parse(sessionStorage.getItem(storageKey(data.session.organization_ai_setup_session_id)) || "null"); } catch { /* use server draft */ }
      apply(data);
      setStep(data.session.status === "analyzing" ? 0 : stepFor(data.session.onboarding_draft));
      if (data.session.status === "analyzing") setProgress(data.analysis_progress || null);
      if (data.session.status === "failed" && data.session.error_message) setError(data.session.error_message);
      if (saved?.draft && saved.updatedAt === data.session.updated_at && data.session.status !== "analyzing") {
        setNodes(saved.nodes); setDraft(saved.draft); setDirty(true); setStep(Math.min(saved.step || 1, stepFor(saved.draft) === 2 ? 3 : 1));
      }
      const typeResult = await checklistApi.listTypes(accessToken);
      if (typeResult.success) setTypes((typeResult.data as { types?: { checklist_type_id: string; name: string }[] })?.types || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open setup."); }
    finally { if (!leaving) setLoading(false); }
  }
  async function waitForAnalysis(id: string) {
    if (!accessToken) return;
    let failures = 0;
    while (mounted.current) {
      await new Promise(resolve => window.setTimeout(resolve, 2000));
      const result = await organizationAiSetupApi.get(accessToken, id).catch(() => null);
      if (!result?.success || !result.data) {
        if (++failures >= 6) throw new Error("Lost connection while reading your sheet. Refresh the page to check progress.");
        continue;
      }
      failures = 0;
      const data = result.data;
      if (data.session.status === "analyzing") { setProgress(data.analysis_progress || null); continue; }
      setProgress(null);
      apply(data);
      if (data.session.status === "failed") { setStep(stepFor(data.session.onboarding_draft)); throw new Error(data.session.error_message || "Could not read the audit sheet. Try again."); }
      const summary = data.session.summary;
      if (summary) setMessages(current => [...current, newMessage("assistant", summary)]);
      setStep(stepFor(data.session.onboarding_draft));
      return;
    }
  }
  useEffect(() => { void initialize(); }, [accessToken]); // session is scoped to the signed-in organization
  // While the server is reading this draft, keep following it: after an upload,
  // after a refresh, or after a lost connection.
  const serverReading = payload?.session.status === "analyzing";
  const sessionId = payload?.session.organization_ai_setup_session_id || "";
  useEffect(() => {
    if (serverReading && !loading && !busy && sessionId) void run(() => waitForAnalysis(sessionId), "reading");
  }, [serverReading, loading, busy, sessionId]); // run and waitForAnalysis read the latest state on each call
  useEffect(() => {
    if (!dirty || !payload || !draft) return;
    try { sessionStorage.setItem(storageKey(payload.session.organization_ai_setup_session_id), JSON.stringify({ nodes, draft, step, updatedAt: payload.session.updated_at })); } catch { /* explicit save still works */ }
  }, [dirty, payload, nodes, draft, step]);
  // A new step starts at its heading, for both sight and screen readers.
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    regionRef.current?.closest("main")?.scrollTo({ top: 0 });
    regionRef.current?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  async function run(action: () => Promise<void>, mode: BusyMode = "updating") {
    if (running.current) return false;
    running.current = true; setBusy(true); setBusyMode(mode); setError("");
    try { await action(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong. Your saved draft is safe. Try again."); return false; }
    finally { running.current = false; setBusy(false); }
  }
  async function save() {
    if (!accessToken || !payload || !draft) throw new Error("Open your setup again.");
    if (nodes.some(n => !n.is_removed && !n.name.trim())) {
      setStep(1);
      throw new Error("Enter a name for every area, or remove the empty ones.");
    }
    // Removed new areas were never live, so there is nothing to keep for them.
    const keep = nodes.filter(n => !n.is_removed || n.source_edge_id);
    // Every question applies to an area; one without a live area applies to the whole organization.
    const areaIds = new Set([ROOT_AREA, ...keep.filter(n => !n.is_removed).map(n => n.id)]);
    const onboardingDraft = { ...draft, questions: draft.questions.map(q => (q.node_id && areaIds.has(q.node_id) ? q : { ...q, node_id: ROOT_AREA })) };
    const result = await organizationAiSetupApi.update(accessToken, payload.session.organization_ai_setup_session_id, { nodes: keep, onboarding_draft: onboardingDraft, review_token: payload.review_token });
    if (!result.success || !result.data) throw new Error(result.message || "Could not save your draft.");
    apply(result.data); return result.data;
  }
  function touch() { setDirty(true); }
  function changeDraft(next: OnboardingDraft) { setDraft(next); touch(); }
  // New areas go under the given parent when allowed; existing records keep their name.
  function addArea(type: string, parentId: string | null, record?: { code: string; name: string }) {
    const id = `TMP-${crypto.randomUUID().slice(0, 20)}`;
    let parent = parentId;
    const provisional: OrganizationAiDraftNode = { id, parent_id: parent, name: record?.name || "", entity_type: type, confidence: null, is_ai_generated: false };
    const preferred = preferredParentChoices([...activeNodes, provisional], provisional, root);
    if (preferred.length === 1) parent = preferred[0].id;
    setNodes(current => [...current, { id, parent_id: parent, name: record?.name || "", entity_type: type, confidence: null, is_ai_generated: false,
      ...(record ? { source_entity_code: record.code, baseline_name: record.name } : {}) }]);
    if (draft) setDraft({ ...draft, node_evidence: { ...draft.node_evidence, [id]: { origin: record ? "existing" : "manual", source_reference: "" } } });
    touch();
    return id;
  }
  function changeNode(id: string, fields: Partial<OrganizationAiDraftNode>) {
    setNodes(current => current.map(n => n.id === id ? { ...n, ...fields } : n)); touch();
  }
  function removeArea(id: string) {
    const ids = branchOf(nodes, id);
    const record = nodes.find(n => ids.has(n.id) && n.source_edge_id);
    if (record) { setError(`Move ${record.name} to another area before removing this branch.`); return; }
    setNodes(nodes.map(n => ids.has(n.id) ? { ...n, is_removed: true } : n));
    // Questions of a removed area move to the whole organization.
    if (draft) setDraft({ ...draft, questions: draft.questions.map(q => (q.node_id && ids.has(q.node_id) ? { ...q, node_id: ROOT_AREA } : q)) });
    touch();
  }
  function restoreArea(id: string) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const ids = new Set([id]);
    for (let parent = byId.get(id)?.parent_id; parent && !ids.has(parent); parent = byId.get(parent)?.parent_id) ids.add(parent);
    setNodes(nodes.map(n => ids.has(n.id) ? { ...n, is_removed: false } : n)); touch();
  }
  // Editing the wording makes the question yours; setting its answers or
  // points keeps the document source of the wording and labels the details.
  function withProvenance(q: OnboardingQuestion, fields: Partial<OnboardingQuestion>): OnboardingQuestion {
    const textChanged = "question_text" in fields;
    const detailsChanged = (["node_id", "answer_type", "options"] as const).some(key => key in fields);
    return { ...q, ...fields, ...(textChanged ? { origin: "manual", source_reference: "" } : {}), ...(detailsChanged ? { details_origin: "manual" } : {}) };
  }
  function changeQuestions(ids: Set<string>, fields: Partial<OnboardingQuestion>) {
    if (!draft || !ids.size) return;
    changeDraft({ ...draft, questions: draft.questions.map(q => ids.has(q.id) ? withProvenance(q, fields) : q) });
  }
  /** Adds an empty question to an area and returns its id. */
  function addQuestion(nodeId: string) {
    if (!draft) return null;
    const id = crypto.randomUUID();
    changeDraft({ ...draft, questions: [...draft.questions, { id, node_id: nodeId, section: "", question_text: "", answer_type: "", options: [], source_reference: "", origin: "manual", details_origin: "manual", selected: true }] });
    return id;
  }
  function chooseFiles(chosen: File[]) {
    const known = new Set(files.map(fileKey));
    const picked = chosen.filter((file, index) => !known.has(fileKey(file)) && chosen.findIndex(other => fileKey(other) === fileKey(file)) === index);
    if (!picked.length) return;
    const unsupported = picked.find(file => !isSupportedOnboardingDocument(file));
    const tooLarge = picked.find(file => file.size > 10 * 1024 * 1024);
    if (files.length + picked.length > 4) { setError("Choose up to 4 files."); return; }
    if (unsupported) { setError(`${unsupported.name} is not supported. Use ${ONBOARDING_DOCUMENT_FORMAT_LABEL}.`); return; }
    if (tooLarge) { setError(`${tooLarge.name} is larger than 10 MB.`); return; }
    setError("");
    setFiles([...files, ...picked]);
  }
  // Reads the chosen files, or the sheet already uploaded when none are chosen.
  function prepare() {
    setReadPhase("structure");
    void run(() => upload(files), "reading");
  }
  async function upload(files: File[]) {
    if (!accessToken || !payload) return;
    // Preserve review edits before reading an additional document.
    if (dirty) {
      try { await save(); }
      catch (e) {
        if (e instanceof Error && isStillReading(e.message)) { await waitForAnalysis(payload.session.organization_ai_setup_session_id); return; }
        throw e;
      }
    }
    setUploading(true);
    const result = await organizationAiSetupApi.analyze(accessToken, payload.session.organization_ai_setup_session_id, files).finally(() => setUploading(false));
    // A read already running for this draft (another tab, or a double click): follow it.
    if (!result.success && isStillReading(result.message)) { await waitForAnalysis(payload.session.organization_ai_setup_session_id); return; }
    if (!result.success || !result.data) throw new Error(result.message || "Could not read the audit sheet.");
    setFiles([]); setPayload(result.data); setProgress(result.data.analysis_progress || null);
    await waitForAnalysis(result.data.session.organization_ai_setup_session_id);
  }
  // Reads the questions onto the verified organization (saved first).
  async function readQuestions() {
    if (!accessToken || !payload) return;
    const saved = dirty ? await save() : payload;
    const result = await organizationAiSetupApi.generateQuestions(accessToken, saved.session.organization_ai_setup_session_id);
    if (!result.success && isStillReading(result.message)) { await waitForAnalysis(saved.session.organization_ai_setup_session_id); return; }
    if (!result.success || !result.data) {
      if (needsUploadAgain(result.message)) setStep(0);
      throw new Error(result.message || "Could not read the questions. Try again.");
    }
    setPayload(result.data); setProgress(result.data.analysis_progress || null);
    await waitForAnalysis(result.data.session.organization_ai_setup_session_id);
  }
  async function readQuestionsAgain() {
    const accepted = await confirm({ title: "Read questions again?", message: "Questions from your sheet are replaced. Questions you added stay.", confirmText: "Read again", cancelText: "Cancel" });
    if (!accepted) return;
    setReadPhase("questions");
    await run(readQuestions, "reading");
  }
  async function sendMessage(text: string) {
    if (running.current) return false;
    setMessages(current => [...current, newMessage("user", text)]);
    return run(async () => {
      if (!accessToken || !payload) return;
      const saved = dirty ? await save() : payload;
      const result = await organizationAiSetupApi.chat(accessToken, saved.session.organization_ai_setup_session_id, text, []);
      if (!result.success || !result.data) {
        if (needsUploadAgain(result.message)) setPayload({ ...saved, evidence_available: false });
        throw new Error(result.message || "Could not apply the change.");
      }
      apply(result.data);
      const changes = changesBetween(saved, result.data);
      const parts = [changes.nodes && plural(changes.nodes, "area"), changes.questions && plural(changes.questions, "question")].filter(Boolean);
      const reply = result.data.assistant_message || "Draft updated.";
      setMessages(current => [...current, newMessage("assistant", parts.length ? `${reply}\n\nUpdated ${parts.join(" and ")}.` : reply)]);
    });
  }
  async function submit() {
    if (!accessToken || !payload || !canSave) return;
    const accepted = await confirm({ title: "Save your setup?", message: `${plural(activeNodes.length, "area")} and ${plural(selected.length, "question")}.`, confirmText: "Save", cancelText: "Cancel" });
    if (!accepted) return;
    await run(async () => {
      const current = await organizationAiSetupApi.get(accessToken, payload.session.organization_ai_setup_session_id);
      if (!current.success || !current.data) throw new Error(current.message || "Could not check your setup. Try again.");
      const saved = current.data.session.status === "published" ? current.data : await save();
      const result = await organizationAiSetupApi.publish(accessToken, saved.session.organization_ai_setup_session_id, saved.review_token);
      if (!result.success) throw new Error(result.message || "Could not save setup. Try again.");
      try { sessionStorage.removeItem(`audito_combined_session:${admin?.entity_code}`); } catch { /* no saved browser state */ }
      setDirty(false); toast("Organization and checklist saved.", "success");
      // Next step: the checklist the setup just created.
      await refreshProgress(); router.push("/checklists?onboarding=1");
    }, "saving");
  }
  // Saves a new checklist type for this organization and returns its ID.
  async function createChecklistType(name: string) {
    if (!accessToken) return null;
    const result = await checklistApi.createType(accessToken, { name });
    const created = (result.data as { type?: { checklist_type_id: string; name: string } } | undefined)?.type;
    if (!result.success || !created) { toast(result.message || "Could not add the checklist type.", "error"); return null; }
    setTypes(current => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    toast(`Checklist type “${created.name}” added.`, "success");
    return created.checklist_type_id;
  }
  function goTo(next: number) {
    if (next === step) return;
    if (next < step || next === 0) { setStep(next); return; }
    // Questions are read once the organization is verified.
    const readFirst = next >= 2 && !draft?.questions_generated;
    if (readFirst) setReadPhase("questions");
    void run(async () => {
      if (step <= 1 && nodeIssues.size) throw new Error("Fix the areas marked in red first.");
      if (step === 2 && next > 2 && questionIssues.size) throw new Error("Fix the questions in the areas marked in red first.");
      if (readFirst) { await readQuestions(); return; }
      if (dirty) await save();
      setStep(next);
    }, readFirst ? "reading" : "updating");
  }

  if (loading) return <Loading className="min-h-[60vh]" />;
  if (!payload || !draft) return <div className="mx-auto max-w-lg px-4 py-16 text-center">
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-400/10 text-red-200" aria-hidden><AlertTriangle size={22} /></span>
    <h1 className="mt-4 text-xl font-semibold text-white">We could not open your setup</h1>
    <p role="alert" className="mt-2 text-sm text-gray-300">{error || "Check your connection and try again. Your saved draft is safe."}</p>
    <Button className="mt-6" onClick={() => void initialize()}>Try again</Button>
  </div>;

  const warnings = payload.session.warnings;
  // "Department plan limit reached: 0 existing + 13 in this draft exceeds your limit of 5."
  const departmentNeed = /(\d+) existing \+ (\d+) in this draft/i.exec(planIssue);
  const departmentLimitReached = /department/i.test(planIssue);
  const refreshAfterUpgrade = () => void run(async () => {
    if (!accessToken) return;
    const result = await organizationAiSetupApi.get(accessToken, payload.session.organization_ai_setup_session_id);
    if (result.success && result.data) setPayload(result.data);
  });
  const reading = (busy && busyMode === "reading") || serverReading;
  // After a refresh the phase is told by the server's progress stage.
  const questionPhase = readPhase === "questions" || /question/i.test(progress?.stage || "");
  const saveDraft = () => void run(async () => { await save(); toast("Draft saved.", "success"); });
  const viewKey = reading ? "reading" : `step-${step}`;
  const nextLabel = step === 1 && !draft.questions_generated ? "Read questions" : "Continue";

  return <div className="mx-auto w-full max-w-[1100px] space-y-6 px-4 pb-6 pt-6 sm:px-6 lg:px-8 lg:pt-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.16em] text-secondary-300"><Sparkles size={13} aria-hidden />AI setup</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">Set up from your audit sheet</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {step > 0 && <Button size="sm" variant="secondary" leftIcon={<Sparkles size={15} />} disabled={reading} onClick={() => setAssistantOpen(true)} className="min-h-10">Ask AI</Button>}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { if (dirty) await save(); router.push("/organization/setup-choice?onboarding=1"); })} className="min-h-10">Change method</Button>
      </div>
    </header>

    <Stepper step={step} reachable={!hasDraft || reading ? 0 : draft.questions_generated ? 3 : 1} onSelect={goTo} />

    <AnimatePresence initial={false}>
      {error && <motion.div key="error" variants={notice} initial="initial" animate="animate" exit="exit" className="overflow-hidden">
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100"><AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden /><span className="flex-1">{error}</span><button type="button" aria-label="Dismiss message" onClick={() => setError("")} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-red-200/80 hover:bg-red-400/10 hover:text-red-100"><X size={16} /></button></div>
      </motion.div>}
      {busy && !reading && <motion.div key="busy" variants={notice} initial="initial" animate="animate" exit="exit" className="overflow-hidden"><ProgressCard mode={busyMode} progress={progress} /></motion.div>}
    </AnimatePresence>
    {!reading && step > 0 && planIssue && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2.5 text-sm text-amber-100"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />{planIssue}</p>
      {departmentLimitReached && <Button size="sm" disabled={busy} onClick={() => setUpgradeOpen(true)} className="shrink-0">Add departments</Button>}
    </div>}
    {!reading && step > 0 && warnings.length > 0 && <button type="button" onClick={() => setNotesOpen(true)} className="flex min-h-9 items-center gap-2 rounded-full bg-white/[.05] px-3 py-1.5 text-xs text-gray-200 hover:bg-white/[.09]"><Info size={13} className="text-amber-300" aria-hidden />{plural(warnings.length, "note")} from your sheet</button>}

    <div ref={regionRef} tabIndex={-1} aria-label={reading ? "Reading your audit sheet" : STEPS[step].title} className="min-w-0 outline-none">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={viewKey} variants={stepSwap} initial="initial" animate="animate" exit="exit" className="min-w-0 space-y-5">
          {reading
            ? <section className="mx-auto max-w-2xl"><h2 className="mb-2 text-center text-2xl font-bold tracking-tight text-white">{questionPhase ? "Reading your questions" : "Reading your sheet"}</h2><p className="mb-6 text-center text-sm text-gray-300">Nothing is saved yet.</p><ProgressCard mode="reading" phase={questionPhase ? "questions" : "structure"} progress={progress} uploading={uploading} /></section>
            : step === 0
              ? <UploadStep files={files} busy={busy} hasDraft={hasDraft} storedSheet={Boolean(payload.evidence_available)} onFiles={chooseFiles}
                onRemove={index => setFiles(files.filter((_, i) => i !== index))} onPrepare={prepare} onReturn={() => setStep(stepFor(draft) || 1)} />
              : <>
                {step === 1 && <OrganizationReview root={root} rootName={rootName} nodes={nodes} nodeIssues={nodeIssues}
                  availableTypes={availableTypes} availableRecords={availableRecords} busy={busy} onChangeNode={changeNode} onAddArea={addArea} onRemove={removeArea} onRestore={restoreArea} />}
                {step === 2 && <ChecklistReview questions={draft.questions} areas={activeNodes} root={root} rootName={rootName} questionIssues={questionIssues} busy={busy} aiAvailable={Boolean(payload.evidence_available)}
                  onChange={(id, fields) => changeQuestions(new Set([id]), fields)} onBulk={(ids, fields) => { changeQuestions(ids, fields); if (!("selected" in fields)) toast(`Updated ${plural(ids.size, "question")}.`, "success"); }}
                  onAdd={addQuestion} onAskAi={text => { setAssistantOpen(true); void sendMessage(text); }} onReadAgain={() => void readQuestionsAgain()} />}
                {step === 3 && <FinalReview draft={draft} types={types} areaCount={activeNodes.length} questionCount={selected.length} planIssue="" busy={busy}
                  onChecklist={fields => changeDraft({ ...draft, checklist: { ...draft.checklist, ...fields } })} onCreateType={createChecklistType} />}
              </>}
        </motion.div>
      </AnimatePresence>
    </div>

    {/* Pinned to the bottom of the view so the next action is always in reach. */}
    {step > 0 && !reading && <div className="sticky bottom-3 z-20 flex items-center gap-2 rounded-2xl border border-white/[.08] bg-surface-dark/95 px-3 py-3 shadow-[0_-12px_32px_rgba(0,0,0,.25)] backdrop-blur sm:gap-3 sm:px-4">
      <Button variant="secondary" disabled={busy} aria-label="Back" leftIcon={<ArrowLeft size={15} />} onClick={() => goTo(step - 1)} className="min-h-11"><span className="hidden sm:inline">Back</span></Button>
      <span className="flex-1" aria-hidden />
      {dirty && <Button variant="ghost" disabled={busy} leftIcon={<Save size={15} />} onClick={saveDraft} className="min-h-11">Save draft</Button>}
      {step < 3
        ? <Button disabled={busy} rightIcon={<ArrowRight size={15} />} onClick={() => goTo(step + 1)} className="min-h-11">{nextLabel}</Button>
        : <Button disabled={busy || !canSave} leftIcon={<CheckCircle2 size={16} />} onClick={() => void submit()} className="min-h-11">Save</Button>}
    </div>}

    <Drawer open={assistantOpen} onClose={() => setAssistantOpen(false)} title="Ask Audito AI" description="Type or speak a correction. You review every change.">
      <AssistantPanel step={step} messages={messages} busy={busy} aiAvailable={Boolean(payload.evidence_available)} dirty={dirty}
        onSend={sendMessage} onSaveDraft={saveDraft} onUploadAgain={() => { setAssistantOpen(false); setStep(0); }} />
    </Drawer>
    <DepartmentUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onApplied={refreshAfterUpgrade}
      suggested={departmentNeed ? Number(departmentNeed[1]) + Number(departmentNeed[2]) : undefined} />
    <Modal open={notesOpen} onClose={() => setNotesOpen(false)} title="Notes from your sheet" size="lg">
      <ul className="space-y-2">{warnings.map((warning, index) => <li key={index} className="flex gap-3 rounded-xl bg-white/[.03] p-3 text-sm text-gray-200"><Info size={15} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />{warning}</li>)}</ul>
    </Modal>
  </div>;
}
