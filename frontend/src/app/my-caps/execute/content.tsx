"use client";

import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { useExecution } from "@/context/ExecutionContext";
import { capApi, auditExecutionApi } from "@/lib/api";

// Shared utilities
import { findNode, findNodeByEdgeId, getAggProgress, TreeNode as SharedTreeNode } from "@/utils/treeHelpers";
import { ENTITY_TYPE_COLORS, fmtDate } from "@/utils/executionFormatters";
import {
  calculateProgress,
  progressKey,
  compressImage,
  getEvidenceUrl,
  inferEvidenceKind,
  fmtFileSize,
  normalizeSelectedOptionIds,
} from "@/utils/executionService";
import { CircularProgress } from "@/components/shared/CircularProgress";
import EvidenceModal from "@/components/audit/EvidenceModal";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Save,
  Building2,
  FileText,
  Camera,
  AlertTriangle,
  Trash2,
  ImageIcon,
  Video,
  Mic,
  HelpCircle,
  AlignLeft,
  CheckSquare,
  List,
} from "lucide-react";

interface Cap {
  id: number;
  cap_plan_code: string;
  title: string;
  status: string;
}

interface CapQuestionOption {
  id: number;
  option_text: string;
  marks: number;
  order_index: number;
}

interface CapQuestion {
  id: number;
  entity_code: string;
  org_tree_id?: number | null;
  question_text: string;
  order_index: number;
  status: string;
  ca_description?: string;
  answer_type: "free_text" | "single_option" | "multiple_options" | "dropdown";
  total_marks: number;
  options: CapQuestionOption[];
}

interface Evidence {
  id: number;
  file_type: string;
  file_path: string;
  file_name: string;
  file_size: number;
}

interface CapResponse {
  id: number;
  cap_question_id: number;
  response_text: string | null;
  answer_text?: string | null;
  selected_option_ids: string | null;
  marks_obtained: number;
  remarks: string | null;
  cap_required: number;
  status?: string;
  evidence: Evidence[];
}

interface CapProgress {
  entity_code: string;
  org_tree_id?: number | null;
  total_questions: number;
  answered_questions: number;
  total_marks: number;
  obtained_marks: number;
  status: string;
}

// Use shared TreeNode type from utilities
type TreeNode = SharedTreeNode;

function EntityCard({
  node,
  index,
  progressMap,
  targetCodes,
  onClick,
}: {
  node: TreeNode;
  index: number;
  progressMap: Record<string, CapProgress>;
  targetCodes: Set<string>;
  onClick: () => void;
}) {
  const { tQ: t, aQ: a } = getAggProgress(node, targetCodes, progressMap, (code, n) => progressKey(code, n.edge_id ?? null));
  const pct = t > 0 ? Math.round((a / t) * 100) : 0;
  const subsections = (node.children ?? []).length;
  const status = pct >= 100 ? "Completed" : a > 0 ? "In Progress" : "Not Started";
  const statusCls = pct >= 100 ? "bg-emerald-500 text-white" : a > 0 ? "bg-blue-500 text-white" : "bg-gray-600 text-white";

  return (
    <div onClick={onClick} className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] cursor-pointer transition-all hover:border-white/20 group shadow-sm hover:shadow-lg shadow-black/20">
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary-800 to-primary-800/60 border-b border-white/[0.04]">
        <span className="w-8 h-8 rounded-full bg-secondary-500 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-secondary-500/30">{index}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{node.name || node.code}</span>
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded inline-block mt-0.5 ${ENTITY_TYPE_COLORS[node.entity_type] ?? "bg-gray-500/20 text-gray-300"}`}>{node.entity_type}</span>
        </div>
        <ChevronRight size={18} className="text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
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
              <span className="text-gray-400">{a} / {t} Answered</span>
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

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

interface CapQuestionCardHandle {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
}

interface CapQuestionCardProps {
  question: CapQuestion;
  response?: CapResponse;
  capId: string;
  entityCode: string;
  accessToken: string;
  onSaved: () => Promise<void>;
  onDirtyChange?: (questionId: number, dirty: boolean) => void;
  isOpen?: boolean;
  onToggle?: (id: number) => void;
}

// CAP Question Card - full audit-style design
const CapQuestionCard = forwardRef<CapQuestionCardHandle, CapQuestionCardProps>(function CapQuestionCard(
  {
    question,
    response,
    capId,
    entityCode,
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
      answerText: response?.answer_text || response?.response_text || "",
      selectedOptions: normalizeSelectedOptionIds(response?.selected_option_ids),
      freeTextMarks: response?.marks_obtained || 0,
      remarks: response?.remarks || "",
      capRequired: !!response?.cap_required,
    };
  }, [response?.answer_text, response?.response_text, response?.selected_option_ids, response?.marks_obtained, response?.remarks, response?.cap_required]);

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
  }, [dirty, onDirtyChange, question.id]);

  useEffect(() => {
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
    const res = await capApi.respond(accessToken, capId, {
      cap_question_id: question.id,
      response_text: question.answer_type === "free_text" ? answerText : undefined,
      answer_text: question.answer_type === "free_text" ? answerText : undefined,
      selected_option_ids: selectedOptions.length > 0 ? selectedOptions : undefined,
      marks_obtained: marksObtained,
      remarks: remarks || undefined,
      cap_required: canToggleCap ? capRequired : false,
    } as any);
    setSaving(false);
    if (!res.success) return false;
    await onSaved();
    return true;
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
    discard,
  }), [dirty, handleSave, discard]);

  const handleFileUpload = async (file: File): Promise<boolean> => {
    setEvidenceErr("");
    if (file.size > MAX_EVIDENCE_BYTES) {
      setEvidenceErr(`File size must be 2MB or less. Selected: ${fmtFileSize(file.size)}`);
      return false;
    }
    let localResponseId: number | null = null;
    if (!response?.id) {
      // Try to auto-save the CAP response so the evidence can be attached
      const saveRes = await capApi.respond(accessToken, capId, {
        cap_question_id: question.id,
        response_text: question.answer_type === "free_text" ? answerText : undefined,
      });
      if (!saveRes.success) {
        setEvidenceErr(saveRes.message || "Please save your answer first to enable evidence uploads.");
        return false;
      }
      // attempt to extract response id
      const newRespId = (saveRes.data && ((saveRes.data as any).id ?? (saveRes.data as any).response_id ?? (saveRes.data as any).response?.id)) || null;
      // set local responseId for immediate upload
      localResponseId = newRespId;
      await onSaved();
      if (!newRespId) {
        setEvidenceErr("Saved answer but could not determine response id for evidence upload.");
        return false;
      }
    }
    // find the response id to use for upload (may have been created above)
    const responseId = localResponseId ?? response?.id ?? null;

    setUploading(true);
    setEvidenceToast("");
    let processedFile = file;
    const fileType = file.type.startsWith("image/") ? "image" :
      file.type.startsWith("video/") ? "video" : "audio";

    // Compress images
    if (fileType === "image") {
      processedFile = await compressImage(file);
    }

    const res = await capApi.uploadEvidence?.(accessToken, capId, Number(responseId), processedFile, fileType);
    if (res?.success && res?.data) {
      setEvidence(prev => [...prev, res.data as Evidence]);
      setEvidenceToast("Evidence uploaded");
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setEvidenceToast(""), 2200);
      setUploading(false);
      return true;
    }
    setUploading(false);
    return false;
  };

  const handleDeleteEvidence = async (evidenceId: number) => {
    await capApi.deleteEvidence?.(accessToken, evidenceId);
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

  const isAnswered = response?.status === "answered" || !!(response?.answer_text?.trim() || response?.response_text?.trim() || response?.selected_option_ids);
  const answerTypeConfig: Record<string, { label: string; icon: React.ReactNode }> = {
    free_text: { label: "Free Text", icon: <AlignLeft size={11} /> },
    single_option: { label: "Single Choice", icon: <CheckSquare size={11} /> },
    multiple_options: { label: "Multiple Choice", icon: <List size={11} /> },
    dropdown: { label: "Dropdown", icon: <ChevronDown size={11} /> },
  };
  const atCfg = answerTypeConfig[question.answer_type] || answerTypeConfig.free_text;

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${isAnswered ? "border-emerald-500/20 bg-white/[0.03]" : "border-white/[0.06] bg-white/[0.02]"
      }`}>
      {/* Accordion header */}
      <button
        onClick={() => onToggle?.(question.id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-500 font-mono">
          {question.order_index + 1}
        </span>
        <p className={`text-sm flex-1 ${isOpen ? "text-white font-medium" : "text-gray-300 truncate"}`}>
          {question.question_text}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {(isAnswered || response?.status === "completed") && <CheckCircle2 size={14} className="text-emerald-400" />}
          <span className="text-[10px] font-medium text-gray-500 bg-white/5 px-2 py-0.5 rounded">
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
          {(isAnswered || response?.status === "completed") && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={10} /> Answered
            </span>
          )}
        </div>

        {/* CAP Requirement Info */}
        {question.ca_description && (
          <div className="rounded-lg border border-orange-500/10 bg-orange-500/5 px-3 py-2.5 text-xs">
            <p className="font-bold text-orange-400/80 uppercase tracking-widest text-[9px] mb-1.5 flex items-center gap-1.5">
              <AlertCircle size={12} /> Corrective Action Plan Requirement
            </p>
            <p className="text-gray-300 leading-relaxed italic">"{question.ca_description}"</p>
          </div>
        )}

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
                <p className="text-xs text-gray-400 mb-2 font-medium">Assign Marks</p>
                <select
                  value={freeTextMarks}
                  onChange={(e) => setFreeTextMarks(Number(e.target.value))}
                  className="w-full sm:max-w-[200px] bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary-500/40 transition-colors cursor-pointer"
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
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-secondary-500/40 transition-colors cursor-pointer"
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${isSelected
                      ? "bg-secondary-500/15 border-secondary-500/40 text-white"
                      : "bg-white/[0.02] border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                      }`}
                  >
                    <div className={`w-4 h-4 rounded-${question.answer_type === "single_option" ? "full" : "sm"} border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-secondary-400 bg-secondary-500/30" : "border-gray-600"
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
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${canToggleCap
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
              className={`relative w-10 h-5 rounded-full transition-all ${capRequired ? "bg-orange-500" : "bg-white/10"
                } ${!canToggleCap ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${capRequired ? "left-5" : "left-0.5"
                }`} />
            </button>
          </div>
        )}

        {/* Toggle buttons for remarks & evidence */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRemarks(!showRemarks)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${showRemarks ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "text-gray-500 border-white/10 hover:text-white"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${showEvidence ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "text-gray-500 border-white/10 hover:text-white"
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
                          <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest shrink-0 ${kind === "image" ? "bg-blue-500/10 text-blue-400" :
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
                <span className="text-[11px] text-emerald-400">{evidenceToast}</span>
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

export default function MyCapExecutePage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const searchParams = useSearchParams();
  const capId = searchParams.get("id") as string;

  const [cap, setCap] = useState<Cap | null>(null);
  const [questions, setQuestions] = useState<CapQuestion[]>([]);
  const [progress, setProgress] = useState<CapProgress[]>([]);
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [prunedTree, setPrunedTree] = useState<TreeNode | null>(null);
  const [responses, setResponses] = useState<Record<string, CapResponse[]>>({});
  const [stepHistory, setStepHistory] = useState<Array<{ mode: "cards"; parentCode: string | null } | { mode: "questions"; entityCode: string; orgTreeId: number | null }>>([{ mode: "cards", parentCode: null }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const contentRef = useRef<HTMLDivElement>(null);
  const questionCardRefs = useRef<Record<number, CapQuestionCardHandle | null>>({});
  const dirtyMapRef = useRef<Record<number, boolean>>({});
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [navModalOpen, setNavModalOpen] = useState(false);
  const pendingNavRef = useRef<null | (() => void)>(null);
  const [openQuestionId, setOpenQuestionId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    const [itemsRes, progressRes, detailRes] = await Promise.all([
      capApi.getItems(accessToken, capId),
      capApi.getProgress(accessToken, capId),
      capApi.get(accessToken, capId),
    ]);
    setLoading(false);
    if (!itemsRes.success || !itemsRes.data) {
      setError(itemsRes.message || "Failed to load CAP items.");
      return;
    }
    const items = itemsRes.data as { questions: CapQuestion[]; responses: CapResponse[]; tree: TreeNode | null };
    setQuestions(items.questions || []);
    // Resolve tree: prefer items.tree -> audit entity tree fallback -> minimal flat tree from questions
    let resolvedTree = items.tree || null;
    if ((!items.tree || items.tree == null) && detailRes && detailRes.success && detailRes.data) {
      const capData = (detailRes.data as any).cap;
      const auditIdFromCap = capData?.audit_id ?? capData?.audit?.id ?? null;
      if (auditIdFromCap) {
        try {
          const treeRes = await auditExecutionApi.getEntityTree(accessToken, String(auditIdFromCap));
          if (treeRes.success && treeRes.data) {
            resolvedTree = (treeRes.data as any).tree || null;
          }
        } catch {
          // ignore
        }
      }
    }

    // If we still don't have a tree, build a minimal flat tree from the questions so UI remains usable
    if (!resolvedTree) {
      const instances: Record<string, { code: string; name: string; entity_type: string; edge_id: number | null }> = {};
      for (const q of items.questions || []) {
        const code = q.entity_code || (q as any).entityCode || "";
        const otid = q.org_tree_id ?? null;
        const key = progressKey(code, otid);
        if (!instances[key]) {
          instances[key] = {
            code,
            name: (q as any).question_entity_name || (q as any).entity_name || code,
            entity_type: (q as any).question_entity_type || "",
            edge_id: otid,
          };
        }
      }
      const children = Object.values(instances).map((inst) => ({
        code: inst.code,
        name: inst.name,
        entity_type: inst.entity_type,
        edge_id: inst.edge_id,
        children: [],
      }));
      resolvedTree = {
        code: "__root__",
        name: "All Entities",
        entity_type: "",
        edge_id: null,
        children,
      };
    }

    setTree(resolvedTree);
    const grouped: Record<string, CapResponse[]> = {};
    for (const r of items.responses || []) {
      if (!grouped[r.cap_question_id]) grouped[r.cap_question_id] = [];
      grouped[r.cap_question_id].push(r);
    }
    setResponses(grouped);
    if (progressRes.success && progressRes.data) setProgress((progressRes.data as { progress: CapProgress[] }).progress || []);
    if (detailRes.success && detailRes.data) setCap((detailRes.data as { cap: Cap }).cap);
    setHasUnsaved(false);
  }, [accessToken, capId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [stepHistory]);

  const handleDirtyChange = useCallback((questionId: number, dirty: boolean) => {
    dirtyMapRef.current[questionId] = dirty;
    const anyDirty = Object.values(dirtyMapRef.current).some(d => d);
    setHasUnsaved(anyDirty);
  }, []);

  const discardAllDirty = useCallback(() => {
    for (const ref of Object.values(questionCardRefs.current)) {
      ref?.discard?.();
    }
    dirtyMapRef.current = {};
    setHasUnsaved(false);
  }, []);

  const saveAllDirty = useCallback(async (): Promise<boolean> => {
    for (const ref of Object.values(questionCardRefs.current)) {
      if (ref?.isDirty?.()) {
        const ok = await ref?.save?.();
        if (!ok) return false;
      }
    }
    dirtyMapRef.current = {};
    setHasUnsaved(false);
    await load();
    return true;
  }, [load]);

  const requestNav = useCallback((fn: () => void) => {
    if (!hasUnsaved) return fn();
    pendingNavRef.current = fn;
    setNavModalOpen(true);
  }, [hasUnsaved]);

  const qMap: Record<string, CapQuestion[]> = {};
  for (const q of questions) {
    const k = progressKey(q.entity_code, (q as any).org_tree_id ?? null);
    if (!qMap[k]) qMap[k] = [];
    qMap[k].push(q);
  }
  const pMap: Record<string, CapProgress> = {};
  for (const p of progress) {
    const k = progressKey(p.entity_code, (p as any).org_tree_id ?? null);
    pMap[k] = p;
  }
  const questionInstanceKeys = new Set<string>(Object.keys(qMap));

  const hasQuestionsForNode = useCallback(
    (n: TreeNode): boolean => {
      const k = progressKey(n.code, n.edge_id ?? null);
      if (questionInstanceKeys.has(k)) return true;
      return false;
    },
    [questionInstanceKeys]
  );

  const hasQuestionsInSubtree = useCallback(
    (n: TreeNode): boolean => {
      if (hasQuestionsForNode(n)) return true;
      return (n.children || []).some((c) => hasQuestionsInSubtree(c as any));
    },
    [hasQuestionsForNode]
  );

  const pruneTreeByQuestions = useCallback((n: TreeNode | null): TreeNode | null => {
    if (!n) return null;
    const prunedChildren = (n.children || [])
      .map((c) => pruneTreeByQuestions(c as any))
      .filter(Boolean) as TreeNode[];
    if (hasQuestionsForNode(n) || prunedChildren.length > 0) {
      return { ...n, children: prunedChildren };
    }
    return null;
  }, [hasQuestionsForNode]);

  const getQuestionRelevantChildren = useCallback((n: TreeNode): TreeNode[] => {
    return (n.children || []).filter((c) => hasQuestionsInSubtree(c as any)) as TreeNode[];
  }, [hasQuestionsInSubtree]);

  useEffect(() => {
    if (!tree) {
      setPrunedTree(null);
      return;
    }
    const pruned = pruneTreeByQuestions(tree as any);
    setPrunedTree(pruned as any);
  }, [tree, questions]);

  const totalQ = questions.length;
  const answeredQ = questions.filter((q) => q.status === "completed" || (responses[q.id]?.some(r => r.response_text?.trim()) ?? false)).length;
  const overallPct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;
  const activeStep = stepHistory[stepHistory.length - 1];
  let activeEntityProgress: CapProgress | null = null;
  if (activeStep?.mode === "questions") {
    const activeNode = prunedTree ? findNode(prunedTree, activeStep.entityCode) : null;
    const activeKey = progressKey(activeStep.entityCode, activeNode?.edge_id ?? null);
    activeEntityProgress = pMap[activeKey] || null;
    if (!activeEntityProgress) {
      const fallbackKey = Object.keys(pMap).find((k) => k.startsWith(`${activeStep.entityCode}__`));
      activeEntityProgress = fallbackKey ? pMap[fallbackKey] : null;
    }
  }

  if (isLoading) return <div className="h-screen bg-transparent flex items-center justify-center"><div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" /></div>;
  if (!admin) return null;

  return (
    <div className="h-screen bg-transparent flex">
      <div className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">
        <div className="shrink-0 px-6 py-3 flex items-center justify-between gap-4 bg-transparent/80 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => requestNav(() => router.push(`/my-caps/details?id=${capId}`))} className="p-2 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all">
              <ArrowLeft size={14} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white truncate flex items-center gap-2"><ClipboardList size={15} className="text-secondary-400" />{cap?.title || "CAP Execution"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">

            <div className="hidden md:block text-right">
              <span className="text-[11px] font-medium text-gray-400">{answeredQ} / {totalQ} questions</span>
              <div className="w-28 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-secondary-400 transition-all duration-300" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6"><div className="glass rounded-xl p-8 text-center max-w-sm"><AlertCircle size={32} className="text-red-400 mx-auto mb-3" /><p className="text-red-400 text-sm">{error}</p></div></div>
        ) : (
          <div ref={contentRef} className="flex-1 overflow-y-auto p-4 md:p-8">
            {(() => {
              const step = stepHistory[stepHistory.length - 1];
              if (!prunedTree) return <p className="text-gray-500 text-center mt-10">Entity tree unavailable.</p>;

              const findInTree = (code: string) => findNode(prunedTree, code);

              const breadcrumbNodes: { label: string; goTo: () => void }[] = [];
              const seenStepKeys = new Set<string>();
              for (let i = 0; i < stepHistory.length; i++) {
                const s = stepHistory[i];
                const key = s.mode === "questions" ? `${s.entityCode}__${s.orgTreeId}` : `parent__${s.parentCode}`;
                if (key && !seenStepKeys.has(key)) {
                  seenStepKeys.add(key);
                  const code = s.mode === "questions" ? s.entityCode : s.parentCode;
                  const idx = i;
                  let label = code;
                  if (code) {
                    const nd = s.mode === "questions" && s.orgTreeId
                      ? findNodeByEdgeId(prunedTree, s.orgTreeId)
                      : findNode(prunedTree, code);
                    label = nd?.name || code;
                  }
                  breadcrumbNodes.push({
                    label: label || "Root",
                    goTo: () => setStepHistory((h) => h.slice(0, idx + 1)),
                  });
                }
              }

              const isRoot = step.mode === "cards" && step.parentCode === null;

              // === CARDS VIEW ===
              if (step.mode === "cards") {
                const parent = step.parentCode ? findNode(prunedTree, step.parentCode) : prunedTree;
                const baseCards = parent
                  ? (step.parentCode
                    ? getQuestionRelevantChildren(parent as any)
                    : (ENTITY_TYPE_COLORS[parent.entity_type] ? [parent] : getQuestionRelevantChildren(parent as any)))
                  : [];

                const cards = baseCards;
                return (
                  <div className="max-w-4xl mx-auto">
                    {/* Breadcrumb */}
                    {!isRoot && (
                      <nav className="flex items-center gap-1.5 flex-wrap mb-5 text-xs">
                        <button
                          onClick={() => setStepHistory([{ mode: "cards", parentCode: null }])}
                          className="flex items-center gap-1 text-gray-400 hover:text-secondary-400 transition-colors"
                        >
                          <ArrowLeft size={12} /> All Entities
                        </button>
                        {breadcrumbNodes.map((bc, idx) => (
                          <span key={idx} className="flex items-center gap-1.5">
                            <ChevronRight size={12} className="text-gray-600" />
                            {idx < breadcrumbNodes.length - 1 ? (
                              <button onClick={bc.goTo} className="text-gray-400 hover:text-secondary-400 transition-colors">
                                {bc.label}
                              </button>
                            ) : (
                              <span className="text-secondary-400 font-medium">{bc.label}</span>
                            )}
                          </span>
                        ))}
                      </nav>
                    )}

                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={16} className="text-secondary-400" />
                        <span className="font-semibold text-white">{parent?.name || "Root"}</span>
                      </div>
                      <span className="text-gray-600 px-1">—</span>
                      <span>Select an entity to respond to CAP</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {cards.map((n: any, i) => (
                        <EntityCard
                          key={`${n.code}-${i}`}
                          node={n}
                          index={i + 1}
                          progressMap={pMap}
                          targetCodes={questionInstanceKeys}
                          onClick={() => {
                            const instKey = progressKey(n.code, n.edge_id ?? null);
                            const hasQ = (qMap[instKey] || []).length > 0;
                            const hasKids = getQuestionRelevantChildren(n as any).length > 0;
                            if (!hasQ && hasKids) setStepHistory((h) => [...h, { mode: "cards", parentCode: n.code }]);
                            else {
                              setOpenQuestionId(null);
                              setStepHistory((h) => [...h, { mode: "questions", entityCode: n.code, orgTreeId: n.edge_id ?? null }]);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              }

              // === QUESTIONS VIEW ===
              const entityCode = step.entityCode;
              const orgTreeId = (step as any).orgTreeId ?? null;
              const entityNode = orgTreeId ? findNodeByEdgeId(prunedTree, orgTreeId) : findNode(prunedTree, entityCode);
              const currentKey = progressKey(entityCode, orgTreeId);
              const questionsForEntity = qMap[currentKey] || [];
              const childrenWithQuestions = entityNode ? getQuestionRelevantChildren(entityNode as any) : [];
              const hasNextQuestionEntities = childrenWithQuestions.length > 0;

              return (
                <div className="max-w-4xl mx-auto pb-24">
                  {/* Breadcrumb */}
                  <nav className="flex items-center gap-1.5 flex-wrap mb-5 text-xs">
                    <button
                      onClick={() => setStepHistory([{ mode: "cards", parentCode: null }])}
                      className="flex items-center gap-1 text-gray-400 hover:text-secondary-400 transition-colors"
                    >
                      <ArrowLeft size={12} /> All Entities
                    </button>
                    {breadcrumbNodes.map((bc, idx) => (
                      <span key={idx} className="flex items-center gap-1.5">
                        <ChevronRight size={12} className="text-gray-600" />
                        {idx < breadcrumbNodes.length - 1 ? (
                          <button onClick={bc.goTo} className="text-gray-400 hover:text-secondary-400 transition-colors">
                            {bc.label}
                          </button>
                        ) : (
                          <span className="text-secondary-400 font-medium">{bc.label}</span>
                        )}
                      </span>
                    ))}
                  </nav>

                  <div className="flex items-center justify-between mb-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${ENTITY_TYPE_COLORS[entityNode?.entity_type || ""] || "bg-gray-500/20 text-gray-400"}`}>
                          {entityNode?.entity_type || "Entity"}
                        </span>
                        <h2 className="text-lg font-bold text-white">{entityNode?.name || entityCode}</h2>
                      </div>
                      <p className="text-xs text-gray-500">Respond to all required corrective actions below</p>
                    </div>
                    {hasUnsaved && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {questionsForEntity.map((q) => {
                      const resp = responses[q.id]?.[0];
                      return (
                        <CapQuestionCard
                          key={q.id}
                          ref={(r) => { questionCardRefs.current[q.id] = r; }}
                          question={q}
                          response={resp}
                          capId={capId}
                          entityCode={entityCode}
                          accessToken={accessToken!}
                          onSaved={load}
                          onDirtyChange={handleDirtyChange}
                          isOpen={openQuestionId === q.id}
                          onToggle={(id) => setOpenQuestionId(openQuestionId === id ? null : id)}
                        />
                      );
                    })}
                  </div>

                  {/* Navigation bar */}
                  <div className="bottom-0 left-0 right-0 lg:left-0 z-30 p-4 backdrop-blur-md border-t border-white/5">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                      <button
                        onClick={() => setStepHistory((h) => h.slice(0, -1))}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all"
                      >
                        <ArrowLeft size={14} /> Back
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const ok = await saveAllDirty();
                            if (!ok) toast("Failed to save response.", "error");
                          }}
                          disabled={!hasUnsaved}
                          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all border ${!hasUnsaved
                            ? "bg-white/5 text-gray-600 border-white/10 cursor-not-allowed"
                            : "bg-secondary-500 text-primary-950 border-secondary-400 hover:bg-secondary-400 shadow-lg shadow-secondary-500/20"
                            }`}
                        >
                          <Save size={14} /> Save Changes
                        </button>

                        {hasNextQuestionEntities && (
                          <button
                            onClick={() => {
                              setStepHistory((h) => [...h, { mode: "cards", parentCode: entityCode }]);
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-secondary-500/20 bg-primary-800 text-white border border-white/10 hover:bg-primary-700"
                          >
                            Next <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {navModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md glass rounded-xl border border-white/10 p-5">
              <h3 className="text-white font-semibold text-base">Unsaved changes</h3>
              <p className="text-sm text-gray-400 mt-1">You have unsaved responses.</p>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  onClick={() => { setNavModalOpen(false); pendingNavRef.current = null; }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 border border-white/10 hover:bg-white/[0.05] hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { discardAllDirty(); setNavModalOpen(false); pendingNavRef.current?.(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={async () => {
                    const ok = await saveAllDirty();
                    if (!ok) return;
                    setNavModalOpen(false);
                    pendingNavRef.current?.();
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
