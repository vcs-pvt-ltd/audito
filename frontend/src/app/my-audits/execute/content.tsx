"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditExecutionApi } from "@/lib/api";
import { useExecution } from "@/context/ExecutionContext";

// Shared utilities
import { findNode, pruneTree, getAggProgress, getRelevantChildren, findNodeByEdgeId, TreeNode as SharedTreeNode } from "@/utils/treeHelpers";
import { ENTITY_TYPE_COLORS, fmtDate } from "@/utils/executionFormatters";
import {
  fmtFileSize,
  fmtTime,
  getMediaOrigin,
  getEvidenceUrl,
  inferEvidenceKind,
  normalizeSelectedOptionIds,
  compressImage,
  progressKey,
  calculateProgress,
} from "@/utils/executionService";
import { CircularProgress } from "@/components/shared/CircularProgress";

import EvidenceModal from "@/components/audit/EvidenceModal";
import { Button, IconButton, Modal } from "@/components/ui";
import {
  ArrowLeft,
  ClipboardCheck,
  Building2,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  CheckSquare,
  List,
  AlignLeft,
  Upload,
  Camera,
  Mic,
  Video,
  Trash2,
  FileText,
  Save,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
} from "lucide-react";

interface QuestionCardHandle {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  saveOnly: () => Promise<boolean>;
  discard: () => void;
}

interface QuestionCardProps {
  question: ChecklistQuestion;
  response?: AuditResponse;
  auditId: number;
  entityCode: string;
  orgTreeId: number;
  accessToken: string;
  onSaved: () => Promise<void>;
  onDirtyChange?: (questionId: number, dirty: boolean) => void;
  isOpen?: boolean;
  onToggle?: (id: number) => void;
}

// ─── Types ────────────────────────────────────────────────────────

// TreeNode now imported from treeHelpers as SharedTreeNode - use shared type
type TreeNode = SharedTreeNode & { [key: string]: unknown };

interface QuestionOption {
  id: number;
  option_text: string;
  marks: number;
  order_index: number;
}

interface ChecklistQuestion {
  id: number;
  question_text: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  total_marks: number;
  order_index: number;
  entity_code: string;
  options: QuestionOption[];
}

interface EntityQuestion {
  entity_code: string;
  questions: ChecklistQuestion[];
}

interface Evidence {
  id: number;
  file_type: string;
  file_path: string;
  file_name: string;
  file_size: number;
}

interface AuditResponse {
  id: number;
  question_id: number;
  entity_code: string;
  answer_text: string | null;
  selected_option_ids: string | null;
  marks_obtained: number;
  remarks: string | null;
  cap_required: number;
  status: string;
  evidence: Evidence[];
}

interface EntityProgress {
  entity_code: string;
  org_tree_id?: number | null;
  total_questions: number;
  answered_questions: number;
  total_marks: number;
  obtained_marks: number;
  status: string;
}

interface AuditEntity {
  entity_code: string;
  entity_type: string;
  entity_name: string;
}

interface AuditDetail {
  id: number;
  audit_code: string;
  title: string;
  audit_type: string;
  status: string;
  start_date: string;
  end_date: string;
  checklist_id: number | null;
  checklist_name: string | null;
  entities: AuditEntity[];
  entity_questions: EntityQuestion[];
  entity_progress: EntityProgress[];
}

// ─── Constants ────────────────────────────────────────────────────

// ENTITY_TYPE_COLORS moved to utils/executionFormatters

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

// ─── Tree helpers ─────────────────────────────────────────────────

// Tree helpers moved to utils/treeHelpers

// ─── Tree navigation helpers ─────────────────────────────────────

// findNode, findNodeByEdgeId, getPathToNode, hasRelevantDesc, getRelevantChildren moved to utils/treeHelpers

// ─── Circular Progress Ring ──────────────────────────────────────

// CircularProgress moved to components/shared/CircularProgress.tsx

// ─── Entity Card ─────────────────────────────────────────────────

function EntityCard({
  node, index, auditEntityKeys, progressMap, onClick,
}: {
  node: TreeNode; index: number; auditEntityKeys: Set<string>;
  progressMap: Record<string, EntityProgress>;
  onClick: () => void;
}) {
  const { tQ, aQ } = getAggProgress(
    node,
    auditEntityKeys,
    progressMap,
    (code, n) => progressKey(code, n.edge_id ?? null)
  );
  const pct = tQ > 0 ? Math.round((aQ / tQ) * 100) : 0;
  const subsections = (node.children ?? []).length;  // Show all direct children, not filtered
  const status = pct >= 100 ? "Completed" : aQ > 0 ? "In Progress" : "Not Started";
  const statusCls = pct >= 100 ? "bg-emerald-500 text-white" : aQ > 0 ? "bg-blue-500 text-white" : "bg-gray-600 text-white";

  return (
    <div onClick={onClick}
      className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer transition-all hover:border-white/20 hover:shadow-lg hover:shadow-black/20 group">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-800 to-primary-800/60">
        <span className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-secondary-500/30">
          {index}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{node.name || node.code}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded inline-block mt-0.5 ${ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300"}`}>{node.entity_type}</span>
        </div>
        <ChevronRight size={18} className="text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
      {/* Body */}
      <div className="p-4">
        <div className="flex items-center gap-5">
          <CircularProgress percent={pct} />
          <div className="space-y-2 flex-1">
            {subsections > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Building2 size={13} className="text-gray-500" />
                <span>{subsections} Subsection{subsections !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span className="text-gray-400">{aQ} / {tQ} Answered</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-center">
          <span className={`text-[10px] font-semibold px-3 py-1 rounded-full ${statusCls}`}>{status}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Question Card ───────────────────────────────────────────────

const QuestionCard = forwardRef<QuestionCardHandle, QuestionCardProps>(function QuestionCard(
  {
    question,
    response,
    auditId,
    entityCode,
    orgTreeId,
    accessToken,
    onSaved,
    onDirtyChange,
    isOpen,
    onToggle,
  },
  ref
) {
  const baseline = useMemo(() => {
    return {
      answerText: response?.answer_text || "",
      selectedOptions: normalizeSelectedOptionIds(response?.selected_option_ids),
      freeTextMarks: response?.marks_obtained || 0,
      remarks: response?.remarks || "",
      capRequired: !!response?.cap_required,
    };
  }, [response?.answer_text, response?.selected_option_ids, response?.marks_obtained, response?.remarks, response?.cap_required]);

  const [answerText, setAnswerText] = useState(baseline.answerText);
  const [selectedOptions, setSelectedOptions] = useState<number[]>(baseline.selectedOptions);
  const [freeTextMarks, setFreeTextMarks] = useState(baseline.freeTextMarks);
  const [remarks, setRemarks] = useState(baseline.remarks);
  const [capRequired, setCapRequired] = useState(baseline.capRequired);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[]>(response?.evidence || []);
  const [showRemarks, setShowRemarks] = useState(!!response?.remarks);
  const [showEvidence, setShowEvidence] = useState(evidence.length > 0);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [viewEvidence, setViewEvidence] = useState<{
    url: string;
    kind: "image" | "video" | "audio";
    title?: string;
  } | null>(null);
  const [saveErr, setSaveErr] = useState("");
  const [evidenceErr, setEvidenceErr] = useState("");
  const [evidenceToast, setEvidenceToast] = useState("");
  const toastTimerRef = useRef<number | null>(null);

  const maxMarks = question.answer_type === "free_text"
    ? Math.max(question.total_marks, 10)
    : (question.total_marks > 0 ? question.total_marks : 10);

  // Calculate marks based on selection
  const computeMarks = useCallback((): number => {
    if (question.answer_type === "free_text") return freeTextMarks;
    if (question.answer_type === "single_option" || question.answer_type === "dropdown") {
      const opt = question.options.find(o => o.id === selectedOptions[0]);
      return opt ? Number(opt.marks) || 0 : 0;
    }
    // multiple_options — sum all selected
    return question.options
      .filter(o => selectedOptions.includes(o.id))
      .reduce((s, o) => s + (Number(o.marks) || 0), 0);
  }, [question, selectedOptions, freeTextMarks]);

  const marksObtained = computeMarks();
  const canToggleCap = marksObtained < maxMarks;

  const dirty = useMemo(() => {
    const selA = (selectedOptions || []).slice().sort((a, b) => a - b);
    const selB = (baseline.selectedOptions || []).slice().sort((a, b) => a - b);
    const sameSel = selA.length === selB.length && selA.every((v, i) => v === selB[i]);
    return (
      (answerText || "") !== (baseline.answerText || "") ||
      !sameSel ||
      (freeTextMarks || 0) !== (baseline.freeTextMarks || 0) ||
      (remarks || "") !== (baseline.remarks || "") ||
      !!capRequired !== !!baseline.capRequired
    );
  }, [answerText, selectedOptions, freeTextMarks, remarks, capRequired, baseline]);

  useEffect(() => {
    onDirtyChange?.(question.id, dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    // When response is refreshed from server, reset the local state baseline
    setAnswerText(baseline.answerText);
    setSelectedOptions(baseline.selectedOptions);
    setFreeTextMarks(baseline.freeTextMarks);
    setRemarks(baseline.remarks);
    setCapRequired(baseline.capRequired);
    setEvidence(response?.evidence || []);
    setShowRemarks(!!baseline.remarks);
    setShowEvidence((response?.evidence || []).length > 0);
  }, [baseline, response?.evidence]);

  useEffect(() => {
    if (marksObtained >= maxMarks) setCapRequired(false);
  }, [marksObtained, maxMarks]);

  const handleSave = async (): Promise<boolean> => {
    setSaveErr("");
    setSaving(true);
    const res = await auditExecutionApi.respond(accessToken, auditId, {
      org_tree_id: orgTreeId > 0 ? Number(orgTreeId) : null,
      entity_code: entityCode,
      question_id: question.id,
      answer_text: question.answer_type === "free_text" ? answerText : undefined,
      selected_option_ids: selectedOptions.length > 0 ? selectedOptions : undefined,
      marks_obtained: marksObtained,
      remarks: remarks || undefined,
      cap_required: canToggleCap ? capRequired : false,
    });
    setSaving(false);
    if (!res.success) return false;
    await onSaved();
    return true;
  };

  const handleSaveOnly = async (): Promise<boolean> => {
    setSaveErr("");
    setSaving(true);
    const res = await auditExecutionApi.respond(accessToken, auditId, {
      org_tree_id: orgTreeId > 0 ? Number(orgTreeId) : null,
      entity_code: entityCode,
      question_id: question.id,
      answer_text: question.answer_type === "free_text" ? answerText : undefined,
      selected_option_ids: selectedOptions.length > 0 ? selectedOptions : undefined,
      marks_obtained: marksObtained,
      remarks: remarks || undefined,
      cap_required: canToggleCap ? capRequired : false,
    });
    setSaving(false);
    return res.success;
  };

  const discard = () => {
    setAnswerText(baseline.answerText);
    setSelectedOptions(baseline.selectedOptions);
    setFreeTextMarks(baseline.freeTextMarks);
    setRemarks(baseline.remarks);
    setCapRequired(baseline.capRequired);
  };

  useImperativeHandle(ref, () => ({
    isDirty: () => dirty,
    save: handleSave,
    saveOnly: handleSaveOnly,
    discard,
  }), [dirty, handleSave, handleSaveOnly, discard]);

  const handleFileUpload = async (file: File): Promise<boolean> => {
    if (evidence.length >= 1) {
      setEvidenceErr("Only one evidence can be uploaded per question.");
      return false;
    }
    setEvidenceErr("");
    setSaveErr("");
    if (file.size > MAX_EVIDENCE_BYTES) {
      setEvidenceErr(`File size must be 2MB or less. Selected: ${fmtFileSize(file.size)}`);
      return false;
    }

    setUploading(true);
    setEvidenceToast("");

    let responseId = response?.id ?? null;

    // If there's no saved response yet, create one automatically so evidence can be attached
    if (!responseId) {
      const saveRes = await auditExecutionApi.respond(accessToken, auditId, {
        org_tree_id: orgTreeId > 0 ? Number(orgTreeId) : null,
        entity_code: entityCode,
        question_id: question.id,
        answer_text: question.answer_type === "free_text" ? answerText : undefined,
        selected_option_ids: selectedOptions.length > 0 ? selectedOptions : undefined,
        marks_obtained: marksObtained,
        remarks: remarks || undefined,
        cap_required: canToggleCap ? capRequired : false,
      });
      if (!saveRes.success) {
        setUploading(false);
        setEvidenceErr(saveRes.message || "Failed to save answer before uploading evidence.");
        return false;
      }
      // try to extract created response id from response
      responseId = (saveRes.data && ((saveRes.data as any).id ?? (saveRes.data as any).response_id ?? (saveRes.data as any).response?.id)) || null;
      // refresh parent state
      await onSaved();
      if (!responseId) {
        // if we still don't have id, we rely on onSaved to populate `response` prop; fall back to error
        setUploading(false);
        setEvidenceErr("Saved answer but could not determine response id for evidence upload.");
        return false;
      }
    }

    const fileType = file.type.startsWith("image/") ? "image" :
      file.type.startsWith("video/") ? "video" : "audio";

    const res = await auditExecutionApi.uploadEvidence(accessToken, auditId, Number(responseId), file, fileType);
    if (res && (res.success || res.data)) {
      // server sometimes returns raw object; normalize
      const newEvidence = (res.data && res.data) || (res as any);
      setEvidence(prev => [...prev, newEvidence as Evidence]);
      setEvidenceToast("Evidence uploaded");
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setEvidenceToast(""), 2200);
      setUploading(false);
      setEvidenceModalOpen(false);
      return true;
    }
    setUploading(false);
    setEvidenceErr((res && (res.message || "Upload failed")) || "Upload failed");
    return false;
  };

  const handleDeleteEvidence = async (evidenceId: number) => {
    await auditExecutionApi.deleteEvidence(accessToken, evidenceId);
    setEvidence(prev => prev.filter(e => e.id !== evidenceId));
  };

  const toggleOption = (optId: number) => {
    if (question.answer_type === "single_option" || question.answer_type === "dropdown") {
      setSelectedOptions([optId]);
    } else {
      setSelectedOptions(prev =>
        (Array.isArray(prev) ? prev : []).includes(optId)
          ? (Array.isArray(prev) ? prev : []).filter(id => id !== optId)
          : [...(Array.isArray(prev) ? prev : []), optId]
      );
    }
  };

  const isAnswered = response?.status === "answered";
  const answerTypeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    free_text: { label: "Free Text", icon: <AlignLeft size={11} /> },
    single_option: { label: "Single Choice", icon: <CheckSquare size={11} /> },
    multiple_options: { label: "Multiple Choice", icon: <List size={11} /> },
    dropdown: { label: "Dropdown", icon: <ChevronDown size={11} /> },
  };
  const atCfg = answerTypeConfig[question.answer_type] || answerTypeConfig.free_text;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isAnswered ? "border-emerald-500/20 bg-white/[0.03]" : "border-white/[0.06] bg-white/[0.02]"
    }`}>
      {/* Accordion header */}
      <button
        onClick={() => onToggle?.(question.id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-colors ${
          isAnswered ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-gray-500"
        }`}>
          {question.order_index + 1}
        </span>
        <p className={`text-sm flex-1 ${isOpen ? "text-white font-medium" : "text-gray-300 truncate"}`}>
          {question.question_text}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
            isAnswered ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-gray-500 bg-white/5"
          }`}>
            {marksObtained}/{maxMarks}
          </span>
          <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/[0.06]">
        {saveErr && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {saveErr}
          </div>
        )}
        {/* Answer type info */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-gray-500/20 text-gray-300 border-gray-500/30">
            {atCfg.icon} {atCfg.label}
          </span>
          <span className="text-[10px] text-gray-500">{maxMarks} marks</span>
          {isAnswered && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={10} /> Answered
            </span>
          )}
        </div>

        {/* Answer input */}
        <div className="space-y-2">
          {question.answer_type === "free_text" ? (
            <div className="space-y-3">
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your answer..."
                rows={3}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-secondary-500/40 transition-colors resize-none"
              />
              {/* Marks assignment for free text */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Assign Marks</p>
                <select
                  value={freeTextMarks}
                  onChange={(e) => setFreeTextMarks(Number(e.target.value))}
                  className="w-full sm:max-w-[200px] bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary-500/40 transition-colors"
                >
                  {Array.from({ length: maxMarks + 1 }, (_, i) => (
                    <option key={i} value={i} className="bg-primary-900 text-white">
                      {i} Mark{i !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : question.answer_type === "dropdown" ? (
            <select
              value={selectedOptions[0] || ""}
              onChange={(e) => setSelectedOptions(e.target.value ? [parseInt(e.target.value)] : [])}
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-secondary-500/40 transition-colors"
            >
              <option value="">Select an option...</option>
              {question.options.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-primary-900 text-white">
                  {opt.option_text} ({opt.marks} pts)
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {question.options.map(opt => {
                const isSelected = selectedOptions.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      isSelected
                        ? "bg-secondary-500/15 border-secondary-500/40 text-white"
                        : "bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-${question.answer_type === "single_option" ? "full" : "sm"} border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? "border-secondary-400 bg-secondary-500/30" : "border-gray-600"
                    }`}>
                      {isSelected && <div className={`w-1.5 h-1.5 rounded-${question.answer_type === "single_option" ? "full" : "sm"} bg-secondary-400`} />}
                    </div>
                    <span className="text-xs flex-1">{opt.option_text}</span>
                    <span className="text-[10px] text-gray-500 shrink-0">{opt.marks} pts</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CAP Required toggle */}
        {maxMarks > 0 && (
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
            canToggleCap
              ? capRequired
                ? "bg-orange-500/10 border-orange-500/20"
                : "bg-white/[0.02] border-white/10"
              : "bg-white/[0.01] border-white/5 opacity-50"
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className={capRequired ? "text-orange-400" : "text-gray-600"} />
              <span className="text-xs text-gray-300">Corrective Action Required</span>
              {!canToggleCap && (
                <span className="text-[10px] text-gray-600">(Full marks — N/A)</span>
              )}
            </div>
            <button
              disabled={!canToggleCap}
              onClick={() => setCapRequired(!capRequired)}
              className={`relative w-10 h-5 rounded-full transition-all ${
                capRequired ? "bg-orange-500" : "bg-white/10"
              } ${!canToggleCap ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                capRequired ? "left-5" : "left-0.5"
              }`} />
            </button>
          </div>
        )}

        {/* Toggle buttons for remarks & evidence */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRemarks(!showRemarks)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
              showRemarks ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "text-gray-500 border-white/10 hover:text-white"
            }`}
          >
            <FileText size={12} /> Remarks
          </button>
          <button
            onClick={() => {
              if (evidence.length >= 1) {
                setShowEvidence(true);
                return;
              }
              setShowEvidence(true);
              setEvidenceErr("");
              setViewEvidence(null);
              setEvidenceModalOpen(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
              showEvidence ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "text-gray-500 border-white/10 hover:text-white"
            } ${evidence.length >= 1 ? "opacity-70" : ""}`}
          >
            <Camera size={12} /> Evidence {evidence.length > 0 && `(${evidence.length})`}
          </button>
        </div>

        {/* Remarks */}
        {showRemarks && (
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add remarks or notes..."
            rows={2}
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/40 transition-colors resize-none"
          />
        )}

        {/* Evidence section */}
        {showEvidence && (
          <div className="space-y-3">
            {/* Existing evidence */}
            {evidence.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {evidence.map(ev => {
                  const kind = inferEvidenceKind(ev.file_type, ev.file_name, ev.file_path);
                  return (
                    <div key={ev.id} className="relative group rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col">
                      {/* Media Preview (16:9) */}
                      <div 
                        className="aspect-[16/9] bg-black/40 relative cursor-pointer overflow-hidden"
                        onClick={() => {
                          setViewEvidence({
                            url: getEvidenceUrl(ev.file_path),
                            kind: kind,
                            title: ev.file_name,
                          });
                          setEvidenceModalOpen(true);
                        }}
                      >
                        {kind === "image" ? (
                          <img
                            src={getEvidenceUrl(ev.file_path)}
                            alt={ev.file_name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : kind === "video" ? (
                          <div className="w-full h-full flex items-center justify-center">
                             <video src={getEvidenceUrl(ev.file_path)} className="w-full h-full object-cover" />
                             <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
                                <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                   <Video size={12} className="text-white fill-white" />
                                </div>
                             </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-900 to-primary-950">
                             <Mic size={24} className="text-emerald-500/40" />
                             <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-all">
                                <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                   <Mic size={12} className="text-white fill-white" />
                                </div>
                             </div>
                          </div>
                        )}
                        
                        {/* Status/Overlay */}
                        <div className="absolute top-1 right-1 flex gap-1 items-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteEvidence(ev.id); }}
                              className="p-1 rounded-md bg-red-500/80 text-white shadow-lg backdrop-blur-sm hover:bg-red-500 transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                        </div>
                      </div>

                      {/* Info Footer */}
                      <div className="px-2 py-1.5 bg-white/[0.01]">
                        <div className="flex items-center justify-between gap-1">
                           <div className="min-w-0">
                              <p className="text-[9px] font-semibold text-gray-300 truncate">{ev.file_name}</p>
                              <p className="text-[8px] text-gray-600 font-mono mt-0.5">{fmtFileSize(ev.file_size)}</p>
                           </div>
                           <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest shrink-0 ${
                              kind === "image" ? "bg-blue-500/10 text-blue-400" :
                              kind === "video" ? "bg-purple-500/10 text-purple-400" : "bg-emerald-500/10 text-emerald-400"
                           }`}>
                              {kind}
                           </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-gray-600">Max 2MB</span>
              {uploading && (
                <div className="flex items-center gap-1.5 text-xs text-secondary-400">
                  <div className="w-3 h-3 border border-secondary-400 border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </div>
              )}
              {evidenceToast && (
                <span className="text-[11px] text-emerald-400 font-medium">{evidenceToast}</span>
              )}
            </div>

            {evidenceErr && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300">
                <AlertCircle size={14} className="shrink-0" />
                <span className="text-xs">{evidenceErr}</span>
              </div>
            )}
          </div>
        )}

        <EvidenceModal
          open={evidenceModalOpen}
          onClose={() => {
            setEvidenceModalOpen(false);
            setViewEvidence(null);
          }}
          onUpload={handleFileUpload}
          uploading={uploading}
          error={evidenceErr}
          view={viewEvidence}
          onClearView={() => setViewEvidence(null)}
        />
      </div>}
    </div>
  );
});

// ─── Main Page ───────────────────────────────────────────────────

export default function MyAuditExecutePage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id") as string;

  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [prunedTree, setPrunedTree] = useState<TreeNode | null>(null);
  const [responses, setResponses] = useState<Record<string, AuditResponse[]>>({});
  const [stepHistory, setStepHistory] = useState<
    ({ mode: "cards"; parentCode: string | null } | { mode: "questions"; entityCode: string; orgTreeId: number })[]
  >([{ mode: "cards", parentCode: null }]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const questionCardRefs = useRef<Record<number, QuestionCardHandle | null>>({});
  const dirtyMapRef = useRef<Record<number, boolean>>({});
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [navModalOpen, setNavModalOpen] = useState(false);
  const pendingNavRef = useRef<null | (() => void)>(null);
  const [openQuestionId, setOpenQuestionId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const loadAudit = useCallback(async () => {
    if (!accessToken || !auditId) return;
    setLoading(true);
    setError("");
    try {
      const res = await auditExecutionApi.getDetail(accessToken, auditId);
      if (res.success && res.data) {
        const data = res.data as { audit: AuditDetail };
        const auditData = data.audit;
        setAudit(auditData);

        // Build entity tree from audit entities
        if (auditData.entities?.length > 0) {
          const treeRes = await auditExecutionApi.getEntityTree(accessToken, auditId);
          if (treeRes.success && treeRes.data) {
            const td = treeRes.data as { tree: TreeNode };
            if (td.tree) setPrunedTree(td.tree);
          }
        }

        // Load responses
        const respRes = await auditExecutionApi.getResponses(accessToken, auditId);
        if (respRes.success && respRes.data) {
          const respData = respRes.data as { responses: AuditResponse[] };
          const grouped: Record<string, AuditResponse[]> = {};
          for (const r of respData.responses || []) {
            const k = progressKey(r.entity_code, (r as any).org_tree_id ?? null);
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(r);
          }
          setResponses(grouped);
        }
      } else {
        setError(res.message || "Audit not found.");
      }
    } catch {
      setError("Network error.");
    }
    setLoading(false);
  }, [accessToken, auditId]);

  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [stepHistory]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  const handleDirtyChange = useCallback((questionId: number, dirty: boolean) => {
    dirtyMapRef.current[questionId] = dirty;
    const anyDirty = Object.values(dirtyMapRef.current).some(Boolean);
    setHasUnsaved(anyDirty);
  }, []);

  const discardAllDirty = useCallback(() => {
    for (const [qid, isDirty] of Object.entries(dirtyMapRef.current)) {
      if (!isDirty) continue;
      const n = parseInt(qid, 10);
      questionCardRefs.current[n]?.discard();
      dirtyMapRef.current[n] = false;
    }
    setHasUnsaved(false);
  }, []);

  const refreshResponses = useCallback(async () => {
    if (!accessToken || !auditId) return;
    const respRes = await auditExecutionApi.getResponses(accessToken, auditId);
    if (respRes.success && respRes.data) {
      const respData = respRes.data as { responses: AuditResponse[] };
      const grouped: Record<string, AuditResponse[]> = {};
      for (const r of respData.responses || []) {
        const k = progressKey(r.entity_code, (r as any).org_tree_id ?? null);
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(r);
      }
      setResponses(grouped);
    }
    // Also refresh audit for progress
    const res = await auditExecutionApi.getDetail(accessToken, auditId);
    if (res.success && res.data) {
      const data = res.data as { audit: AuditDetail };
      setAudit(data.audit);
    }
  }, [accessToken, auditId]);

  const requestNav = useCallback((fn: () => void) => {
    if (!hasUnsaved) {
      fn();
      return;
    }
    pendingNavRef.current = fn;
    setNavModalOpen(true);
  }, [hasUnsaved]);

  const saveAllDirty = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    for (const [qid, isDirty] of Object.entries(dirtyMapRef.current)) {
      if (!isDirty) continue;
      const n = parseInt(qid, 10);
      const ok = await (questionCardRefs.current[n]?.saveOnly() ?? Promise.resolve(false));
      if (!ok) {
        setIsSaving(false);
        return false;
      }
      dirtyMapRef.current[n] = false;
    }
    await refreshResponses();
    setHasUnsaved(false);
    setIsSaving(false);
    return true;
  }, [refreshResponses]);


  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin || !accessToken) return null;

  // Build helpers
  const questionsMap: Record<string, ChecklistQuestion[]> = {};
  for (const eq of audit?.entity_questions || []) {
    const k = progressKey(eq.entity_code, (eq as any).org_tree_id ?? null);
    questionsMap[k] = eq.questions;
    // Backwards-compat fallback: also expose by entity_code alone for callers
    // that couldn't resolve org_tree_id correctly yet.
    if (!questionsMap[eq.entity_code]) questionsMap[eq.entity_code] = eq.questions;
  }
  const progressMap: Record<string, EntityProgress> = {};
  for (const p of audit?.entity_progress || []) {
    progressMap[progressKey(p.entity_code, p.org_tree_id ?? null)] = p;
  }
  // Only instance keys (entity_code__org_tree_id) should participate in aggregation.
  // `questionsMap` also contains legacy keys by entity_code alone for backwards compat.
  const isInstanceKey = (k: string) => k.includes("__");
  const auditEntityKeys = new Set<string>([
    ...Object.keys(questionsMap).filter(isInstanceKey),
    ...Object.keys(progressMap).filter(isInstanceKey),
  ]);

  // Type assertion for prunedTree to work with shared utilities
  const sharedPrunedTree = prunedTree as unknown as SharedTreeNode | null;

  // Overall progress (align with cards by using progressMap; fallback to questions+responses if missing)
  const isAnswered = (r: AuditResponse | undefined | null): boolean => {
    if (!r) return false;
    const st = String((r as any).status || "").toLowerCase();
    if (st === "answered" || st === "completed") return true;
    return true;
  };
  const allKeys = Array.from(new Set<string>([
    ...Object.keys(questionsMap).filter(isInstanceKey),
    ...Object.keys(progressMap).filter(isInstanceKey),
  ]));

  const totalQ = allKeys.reduce((s, k) => {
    const p = progressMap[k];
    if (p && typeof p.total_questions === "number") return s + (p.total_questions || 0);
    return s + (questionsMap[k]?.length || 0);
  }, 0);

  const answeredQ = allKeys.reduce((s, k) => {
    const p = progressMap[k];
    if (p && typeof p.answered_questions === "number") return s + (p.answered_questions || 0);
    const qs = questionsMap[k] || [];
    const resp = responses[k] || [];
    let answered = 0;
    for (const q of qs) {
      const r = resp.find(rr => rr.question_id === q.id);
      if (isAnswered(r)) answered++;
    }
    return s + answered;
  }, 0);

  const overallPct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;
  const activeStep = stepHistory[stepHistory.length - 1];
  let activeEntityProgress: EntityProgress | null = null;
  if (activeStep?.mode === "questions") {
    if (activeStep.orgTreeId && activeStep.orgTreeId > 0) {
      activeEntityProgress = progressMap[progressKey(activeStep.entityCode, activeStep.orgTreeId)] || null;
    }
    if (!activeEntityProgress) {
      const fallbackKey = Object.keys(progressMap).find((k) => k.startsWith(`${activeStep.entityCode}__`));
      activeEntityProgress = fallbackKey ? progressMap[fallbackKey] : null;
    }
  }

  return (
    <div className="h-screen bg-transparent flex">

      <div className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">
        {/* Top bar */}
        <div className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 bg-transparent/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <IconButton bordered onClick={() => requestNav(() => router.push(`/my-audits/details?id=${auditId}`))}>
              <ArrowLeft size={14} />
            </IconButton>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate flex items-center gap-2">
                <ClipboardCheck size={16} className="text-amber-400 shrink-0" />
                {audit?.title || "Audit Execution"}
              </h1>
              
              
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-4 shrink-0">
            
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs text-gray-400">{answeredQ}/{totalQ} questions</span>
                <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-secondary-400 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
                </div>
              </div>
              <span className="text-sm font-bold text-white">{overallPct}%</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="glass rounded-xl p-8 text-center">
              <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        ) : audit ? (
          <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
            {(() => {
              const step = stepHistory[stepHistory.length - 1];
              const goBack = () => setStepHistory(h => h.length > 1 ? h.slice(0, -1) : h);
              const pushStep = (s: typeof step) => setStepHistory(h => [...h, s]);
              const navigateNode = (nd: TreeNode) => {
                const code = nd.code;
                const edgeId = nd.edge_id ?? null;
                const k = progressKey(code, edgeId);
                let hasQ = (questionsMap[k]?.length || 0) > 0;
                let resolvedTreeId = edgeId ? Number(edgeId) : 0;
                // When edge_id is absent, scan questionsMap for this entity's org_tree_id
                if (!resolvedTreeId) {
                  const matchKey = Object.keys(questionsMap)
                    .filter(mk => mk.includes('__'))
                    .find(mk => mk.split('__')[0] === code && (questionsMap[mk]?.length || 0) > 0);
                  if (matchKey) {
                    hasQ = true;
                    const idPart = matchKey.split('__')[1];
                    if (idPart && idPart !== 'null') resolvedTreeId = Number(idPart);
                  }
                }
                const hasKids = (nd.children ?? []).length > 0;
                if (!hasQ && hasKids) {
                  pushStep({ mode: "cards", parentCode: code });
                } else {
                  pushStep({ mode: "questions", entityCode: code, orgTreeId: resolvedTreeId });
                }
              };
              const navigate = (code: string) => {
                const nd = prunedTree ? findNode(prunedTree, code) : null;
                if (!nd) return;
                navigateNode(nd);
              };
              const isRoot = stepHistory.length <= 1 && step.mode === "cards" && step.parentCode === null;

              // Build breadcrumb from history
              const breadcrumbNodes: { label: string; goTo: () => void }[] = [];
              if (!isRoot) {
                const seenCodes = new Set<string>();
                for (let i = 0; i < stepHistory.length; i++) {
                  const s = stepHistory[i];
                  const code = s.mode === "questions" ? s.entityCode : s.parentCode;
                  if (code && !seenCodes.has(code)) {
                    seenCodes.add(code);
                    const nd = prunedTree ? findNode(prunedTree, code) : null;
                    const ent = audit.entities.find(e => e.entity_code === code);
                    const lbl = nd?.name || ent?.entity_name || code;
                    const idx = i;
                    breadcrumbNodes.push({ label: lbl, goTo: () => setStepHistory(h => h.slice(0, idx + 1)) });
                  }
                }
              }

              // === CARDS VIEW ===
              if (step.mode === "cards") {
                let cards: TreeNode[] = [];
                if (step.parentCode === null) {
                  // Root level: show the root entity if it's colored (has audit questions), else show all its direct children
                  if (prunedTree) {
                    cards = ENTITY_TYPE_COLORS[prunedTree.entity_type] ? [prunedTree] : (prunedTree.children ?? []);
                  }
                } else {
                  // Non-root: show all direct children of parent (don't filter by audit codes)
                  const parentNode = prunedTree ? findNode(prunedTree, step.parentCode) : null;
                  cards = parentNode ? (parentNode.children ?? []) : [];
                }

                // Hide cards that have no questions anywhere in their subtree
                cards = cards.filter((node) => {
                  const { tQ } = getAggProgress(
                    node,
                    auditEntityKeys,
                    progressMap,
                    (code, n) => progressKey(code, n.edge_id ?? null)
                  );
                  return tQ > 0;
                });

                // If we have the tree
                if (cards.length > 0) {
                  return (
                    <div className="max-w-4xl mx-auto">
                      {/* Breadcrumb */}
                      {!isRoot && (
                        <nav className="flex items-center gap-1.5 flex-wrap mb-5 text-xs">
                          <button onClick={() => setStepHistory([{ mode: "cards", parentCode: null }])}
                            className="flex items-center gap-1 text-gray-400 hover:text-secondary-400 transition-colors">
                            <ArrowLeft size={12} /> All Entities
                          </button>
                          {breadcrumbNodes.map((bc, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                              <ChevronRight size={12} className="text-gray-600" />
                              {i < breadcrumbNodes.length - 1 ? (
                                <button onClick={bc.goTo} className="text-gray-400 hover:text-secondary-400 transition-colors">{bc.label}</button>
                              ) : (
                                <span className="text-gray-300">{bc.label}</span>
                              )}
                            </span>
                          ))}
                          <span className="flex items-center gap-1.5">
                            <ChevronRight size={12} className="text-gray-600" />
                            <span className="text-white font-medium">Sub-Entities</span>
                          </span>
                        </nav>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {cards.map((node, i) => (
                          <EntityCard key={`${node.code}__${node.edge_id ?? "null"}`} node={node} index={i + 1}
                            auditEntityKeys={auditEntityKeys} progressMap={progressMap}
                            onClick={() => navigateNode(node)} />
                        ))}
                      </div>
                    </div>
                  );
                }

                // Flat fallback (no tree)
                return (
                  <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {audit.entities
                        .filter((e) => {
                          const k = progressKey(e.entity_code, (e as any).org_tree_id ?? null);
                          const prog = progressMap[k];
                          const tQ = prog?.total_questions || 0;
                          return tQ > 0;
                        })
                        .map((e, i) => {
                        const k = progressKey(e.entity_code, (e as any).org_tree_id ?? null);
                        const prog = progressMap[k];
                        const tQ = prog?.total_questions || 0;
                        const aQ = prog?.answered_questions || 0;
                        const pct = tQ > 0 ? Math.round((aQ / tQ) * 100) : 0;
                        const status = pct >= 100 ? "Completed" : aQ > 0 ? "In Progress" : "Not Started";
                        const statusCls = pct >= 100 ? "bg-emerald-500 text-white" : aQ > 0 ? "bg-blue-500 text-white" : "bg-gray-600 text-white";
                        return (
                          <div
                            key={k}
                            onClick={() => pushStep({ mode: "questions", entityCode: e.entity_code, orgTreeId: Number((e as any).org_tree_id ?? 0) })}
                            className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer transition-all hover:border-white/20 hover:shadow-lg group">
                            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-800 to-primary-800/60">
                              <span className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center text-sm font-bold text-white">{i + 1}</span>
                              <span className="text-sm font-semibold text-white flex-1 truncate">{e.entity_name || e.entity_code}</span>
                              <ChevronRight size={18} className="text-white/60 group-hover:text-white transition-all" />
                            </div>
                            <div className="p-4 flex items-center gap-5">
                              <CircularProgress percent={pct} />
                              <div className="flex items-center gap-2 text-xs">
                                <CheckCircle2 size={13} className="text-emerald-500" />
                                <span className="text-gray-400">{aQ} / {tQ} Answered</span>
                              </div>
                            </div>
                            <div className="pb-4 flex justify-center">
                              <span className={`text-[10px] font-semibold px-3 py-1 rounded-full ${statusCls}`}>{status}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // === QUESTIONS VIEW ===
              const entityCode = step.entityCode;
              // Use edge_id lookup if available and positive, otherwise lookup by entity code
              const currentNode = prunedTree
                ? (step.orgTreeId && step.orgTreeId > 0 ? findNodeByEdgeId(prunedTree, step.orgTreeId) : findNode(prunedTree, entityCode))
                : null;
              const stepOrgTreeId = step.orgTreeId && step.orgTreeId > 0 ? step.orgTreeId : null;
              // Prefer an explicit node edge id (currentNode) or the step's orgTreeId.
              // When resolving audit entity entries, match by both `entity_code` and
              // `org_tree_id` (or `assigned_org_tree_id`) so duplicate codes at
              // different tree edges are not collapsed.
              const explicitEdgeId = (currentNode?.edge_id && currentNode.edge_id > 0) ? currentNode.edge_id : null;
              const auditEntities = audit?.entities || [];
              let auditOrgTreeId: number | null = null;
              if (step.orgTreeId && step.orgTreeId > 0) auditOrgTreeId = step.orgTreeId;
              else if (explicitEdgeId) auditOrgTreeId = explicitEdgeId;
              else {
                // If caller didn't provide an edge, try to find a unique matching entry
                const matches = auditEntities.filter(e => e.entity_code === entityCode).map(e => (e as any).org_tree_id ?? (e as any).assigned_org_tree_id ?? null);
                if (matches.length === 1) auditOrgTreeId = matches[0];
                else auditOrgTreeId = null;
              }

              const orgTreeIdForKey = auditOrgTreeId ?? null;
              const currentKey = progressKey(entityCode, orgTreeIdForKey);
              const orgTreeIdNum = orgTreeIdForKey ? Number(orgTreeIdForKey) : 0;
              const questions = questionsMap[currentKey] || [];
              const entityResponses = responses[currentKey] || [];
              const children = currentNode ? (currentNode.children ?? []) : [];  // Show all children without filtering
              const hasChildren = children.length > 0;
              const hasNextQuestionEntities = children.some((child) => {
                const { tQ } = getAggProgress(
                  child,
                  auditEntityKeys,
                  progressMap,
                  (code, n) => progressKey(code, n.edge_id ?? null)
                );
                return tQ > 0;
              });
              const isAudit = auditEntityKeys.has(currentKey);
              const progress = progressMap[currentKey] || null;
              return (
                <div className="max-w-4xl mx-auto">
                  {/* Breadcrumb + Progress */}
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <nav className="flex items-center gap-1.5 flex-wrap text-xs">
                      <button onClick={() => setStepHistory([{ mode: "cards", parentCode: null }])}
                        className="flex items-center gap-1 text-gray-400 hover:text-secondary-400 transition-colors">
                        <ArrowLeft size={12} /> All Entities
                      </button>
                      {breadcrumbNodes.map((bc, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          <ChevronRight size={12} className="text-gray-600" />
                          {i < breadcrumbNodes.length - 1 ? (
                            <button onClick={bc.goTo} className="text-gray-400 hover:text-secondary-400 transition-colors">{bc.label}</button>
                          ) : (
                            <span className="text-white font-medium">{bc.label}</span>
                          )}
                        </span>
                      ))}
                    </nav>
                  </div>

                  {/* Questions */}
                  {isAudit && questions.length > 0 && (
                    <div className="space-y-2 mb-6">
                      {hasUnsaved && (
                        <div className="flex justify-end">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Unsaved changes
                          </span>
                        </div>
                      )}
                      {questions.map((q) => {
                        const resp = entityResponses.find(r => r.question_id === q.id);
                        return (
                          <QuestionCard
                            key={q.id}
                            ref={(r) => { questionCardRefs.current[q.id] = r; }}
                            question={q}
                            response={resp}
                            auditId={audit.id}
                            entityCode={entityCode}
                            orgTreeId={orgTreeIdNum}
                            accessToken={accessToken!}
                            onSaved={refreshResponses}
                            onDirtyChange={handleDirtyChange}
                            isOpen={openQuestionId === q.id}
                            onToggle={(id) => setOpenQuestionId(prev => prev === id ? null : id)}
                          />
                        );
                      })}
                    </div>
                  )}

                  {isAudit && questions.length === 0 && !hasChildren && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center mb-6">
                      <HelpCircle size={28} className="text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No questions for this entity.</p>
                    </div>
                  )}

                  {/* Back / Next */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.06]">
                    <button onClick={() => goBack()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all">
                      <ArrowLeft size={14} /> Back
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const ok = await saveAllDirty();
                          if (!ok) {
                            toast("Failed to save response.", "error");
                            return;
                          }
                          toast("All changes saved.", "success");
                          const isFullyAnswered = questions.every(q => {
                            const r = (responses[currentKey] || []).find(rr => rr.question_id === q.id);
                            const st = String((r as any)?.status || "").toLowerCase();
                            return st === "answered" || st === "completed";
                          });
                          if (isFullyAnswered) {
                            goBack();
                          }
                        }}
                        disabled={!hasUnsaved || isSaving}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                          !hasUnsaved || isSaving
                            ? "bg-white/5 text-gray-600 border-white/10 cursor-not-allowed"
                            : "bg-secondary-500/15 text-secondary-300 border-secondary-500/30 hover:bg-secondary-500/25"
                        }`}
                      >
                        {isSaving ? (
                          <div className="w-3.5 h-3.5 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                        {isSaving ? "Saving..." : "Save"}
                      </button>

                      {hasNextQuestionEntities && (
                        <button
                          onClick={() => {
                            if (hasChildren) pushStep({ mode: "cards", parentCode: entityCode });
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-secondary-500/20 bg-secondary-500 text-white hover:bg-secondary-600"
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>

      {/* Unsaved changes modal */}
      <Modal
        open={navModalOpen}
        onClose={() => { setNavModalOpen(false); pendingNavRef.current = null; }}
        title="Unsaved changes"
        description="You have unsaved responses for this question."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setNavModalOpen(false); pendingNavRef.current = null; }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={async () => {
              discardAllDirty();
              setNavModalOpen(false);
              const fn = pendingNavRef.current;
              pendingNavRef.current = null;
              fn?.();
            }}>
              Discard
            </Button>
            <Button onClick={async () => {
              const ok = await saveAllDirty();
              if (!ok) { toast("Failed to save response.", "error"); return; }
              setNavModalOpen(false);
              const fn = pendingNavRef.current;
              pendingNavRef.current = null;
              fn?.();
            }}>
              Save
            </Button>
          </>
        }
      />
    </div>
  );
}

