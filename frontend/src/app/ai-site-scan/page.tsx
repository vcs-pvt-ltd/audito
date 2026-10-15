"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Aperture, Building2, Camera, CameraOff, Check, CheckCircle2,
  ChevronDown, ChevronRight, CircleDot, FileImage, ImagePlus, Info,
  Lightbulb, MapPin, RefreshCw, RotateCcw, ScanLine, ShieldCheck,
  Sparkles, Upload, X, Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import Loading from "@/components/shared/Loading";
import { Button, Textarea } from "@/components/ui";
import { optimizeEvidenceImage } from "@/utils/imageOptimizer";
import { isNativeApp } from "@/lib/native/platform";
import {
  visualScanApi,
  type VisualScanIssue,
  type VisualScanResult,
  type VisualScanTreeNode,
} from "@/lib/api";

type CaptureMode = "camera" | "upload";
type ReviewDecision = "pending" | "confirmed" | "rejected";

const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];

const TYPE_TONES: Record<string, string> = {
  Company: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  Cluster: "border-teal-500/25 bg-teal-500/10 text-teal-300",
  Factory: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  Unit: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  Department: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  Section: "border-green-500/25 bg-green-500/10 text-green-300",
  Customer: "border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
  Supplier: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  "Buying Office": "border-purple-500/25 bg-purple-500/10 text-purple-300",
};

const SEVERITY_META = {
  low: { label: "Low", tone: "border-blue-500/25 bg-blue-500/10 text-blue-300" },
  medium: { label: "Medium", tone: "border-amber-500/25 bg-amber-500/10 text-amber-300" },
  high: { label: "High", tone: "border-orange-500/25 bg-orange-500/10 text-orange-300" },
  critical: { label: "Critical", tone: "border-red-500/25 bg-red-500/10 text-red-300" },
};

function locationKey(node: VisualScanTreeNode) {
  return `${node.entity_code}__${node.org_tree_id || "root"}`;
}

function LocationTree({ root, selectedKey, onSelect }: {
  root: VisualScanTreeNode;
  selectedKey: string;
  onSelect: (node: VisualScanTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([locationKey(root)]));

  const renderNode = (node: VisualScanTreeNode, depth = 0): React.ReactNode => {
    const key = locationKey(node);
    const open = expanded.has(key);
    const selected = selectedKey === key;
    const hasChildren = Boolean(node.children?.length);
    const tone = TYPE_TONES[node.entity_type] || "border-white/10 bg-white/5 text-gray-300";
    return (
      <div key={key}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${Math.min(depth, 5) * 12}px` }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded((previous) => {
                const next = new Set(previous);
                if (next.has(key)) next.delete(key); else next.add(key);
                return next;
              })}
              className="flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-white/5 hover:text-gray-300"
              aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : <span className="w-7 shrink-0" />}
          <button
            type="button"
            onClick={() => onSelect(node)}
            className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${selected ? "border-secondary-400/35 bg-secondary-500/10" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.035]"}`}
          >
            <Building2 size={14} className={selected ? "text-secondary-300" : "text-gray-500"} />
            <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tone}`}>{node.entity_type}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-200">{node.name}</span>
            {selected && <CheckCircle2 size={14} className="shrink-0 text-secondary-300" />}
          </button>
        </div>
        {hasChildren && open && <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return <div className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain p-2">{renderNode(root)}</div>;
}

function IssueSummaryItem({ issue, index, decision, onDecision }: {
  issue: VisualScanIssue;
  index: number;
  decision: ReviewDecision;
  onDecision: (decision: ReviewDecision) => void;
}) {
  const severity = SEVERITY_META[issue.severity];
  return (
    <li className={`rounded-2xl border p-4 transition ${decision === "confirmed" ? "border-emerald-500/30 bg-emerald-500/[0.045]" : decision === "rejected" ? "border-white/[0.06] bg-black/10 opacity-60" : "border-white/[0.1] bg-white/[0.025]"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${severity.tone}`}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-relaxed text-white">{issue.summary}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severity.tone}`}>{severity.label}</span>
            {decision !== "pending" && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${decision === "confirmed" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-gray-500/20 bg-white/5 text-gray-400"}`}>{decision === "confirmed" ? "Confirmed" : "Not an issue"}</span>}
          </div>
          {issue.observations.length > 0 && <ul className="mt-2 space-y-1.5">{issue.observations.map((observation, observationIndex) => <li key={observationIndex} className="flex gap-2 text-xs leading-relaxed text-gray-400"><CircleDot size={11} className="mt-0.5 shrink-0 text-secondary-400" />{observation}</li>)}</ul>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" type="button" size="sm" variant={decision === "confirmed" ? "primary" : "secondary"} leftIcon={<Check size={14} />} onClick={() => onDecision(decision === "confirmed" ? "pending" : "confirmed")}>Confirm issue</Button>
            <Button className="w-full sm:w-auto" type="button" size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={() => onDecision(decision === "rejected" ? "pending" : "rejected")}>Not an issue</Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function AiSiteScanPage() {
  const router = useRouter();
  const { admin, accessToken, isLoading: authLoading } = useAuth();
  const { toast } = useUiFeedback();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [tree, setTree] = useState<VisualScanTreeNode | null>(null);
  const [location, setLocation] = useState<VisualScanTreeNode | null>(null);
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<CaptureMode>("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VisualScanResult | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ReviewDecision>>({});

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setImageFile(null);
    setResult(null);
    setDecisions({});
  }, []);

  const useImage = useCallback(async (file: File) => {
    if (!ACCEPTED_IMAGES.includes(file.type)) return toast("Use a JPEG, PNG, or WebP image.", "error");
    setProcessingImage(true);
    try {
      // The scan API accepts 2 MB images (its own limit, separate from evidence).
      const processed = await optimizeEvidenceImage(file, { fallbackName: "site-scan", maxBytes: 2 * 1024 * 1024, maxLongEdge: 2560, minLongEdge: 1280 });
      clearPreview();
      const url = URL.createObjectURL(processed.file);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setImageFile(processed.file);
      stopCamera();
      if (processed.optimized) toast("Image optimized below 2 MB while preserving inspection detail.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "The image could not be processed.", "error");
    } finally {
      setProcessingImage(false);
    }
  }, [clearPreview, stopCamera, toast]);

  const startCamera = useCallback(async (requestedFacingMode = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported here. Upload an image instead.");
      return;
    }
    setCameraStarting(true);
    setCameraError(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: requestedFacingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (error) {
      setCameraError(error instanceof DOMException && error.name === "NotAllowedError"
        ? (isNativeApp()
          ? "Camera permission was not given. Allow it for Audito in Android Settings, or upload an image."
          : "Camera permission was blocked. Allow access in your browser or upload an image.")
        : "The camera could not start. Check whether another app is using it, or upload an image.");
    } finally {
      setCameraStarting(false);
    }
  }, [facingMode, stopCamera]);

  // Android app: release the camera while the app is in the background.
  useEffect(() => {
    if (!isNativeApp()) return;
    const onVisibility = () => { if (document.visibilityState === "hidden") stopCamera(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stopCamera]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return toast("Wait until the camera view is ready.", "warning");
    const scale = Math.min(1, 1800 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    if (facingMode === "user") { context.translate(canvas.width, 0); context.scale(-1, 1); }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return toast("The camera image could not be captured.", "error");
      void useImage(new File([blob], `site-scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.88);
  }, [facingMode, toast, useImage]);

  useEffect(() => {
    if (authLoading) return;
    if (!admin || admin.role !== "auditor") { router.replace("/dashboard"); return; }
    if (!accessToken) return;
    let active = true;
    setContextLoading(true);
    visualScanApi.getContext(accessToken).then((response) => {
      if (!active) return;
      if (!response.success || !response.data) return toast(response.message || "The site scan workspace could not be loaded.", "error");
      setTree(response.data.tree);
      setLocation(response.data.tree);
    }).finally(() => active && setContextLoading(false));
    return () => { active = false; };
  }, [accessToken, admin, authLoading, router, toast]);

  useEffect(() => () => {
    stopCamera();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  }, [stopCamera]);

  const switchMode = (nextMode: CaptureMode) => {
    if (analyzing) return;
    setMode(nextMode);
    setCameraError(null);
    if (nextMode === "upload") stopCamera();
  };

  const analyze = async () => {
    if (!accessToken || !location || !imageFile || analyzing) return;
    setAnalyzing(true); setProgress(7); setResult(null); setDecisions({});
    progressTimerRef.current = setInterval(() => setProgress((current) => current >= 91 ? current : Math.min(91, current + Math.max(1, Math.round((94 - current) / 8)))), 700);
    const response = await visualScanApi.analyze(accessToken, imageFile, {
      entity_code: location.entity_code, org_tree_id: location.org_tree_id, notes,
    });
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
    if (response.success && response.data) {
      setProgress(100); setResult(response.data);
      setDecisions(Object.fromEntries(response.data.issues.map((_, index) => [index, "pending"])));
      toast(response.message || "Scan complete.", response.data.issues.length ? "success" : "info");
    } else { setProgress(0); toast(response.message || "The image could not be analyzed.", "error"); }
    setAnalyzing(false);
  };

  const resetScan = () => {
    clearPreview(); setProgress(0); setNotes(""); setCameraError(null);
    if (mode === "camera") void startCamera();
  };

  const progressLabel = progress < 25 ? "Checking image quality" : progress < 55 ? "Reading the workplace scene" : progress < 82 ? "Comparing controls and past evidence" : progress < 100 ? "Preparing possible issues" : "Analysis complete";
  const confirmedCount = Object.values(decisions).filter((decision) => decision === "confirmed").length;
  const reviewedCount = Object.values(decisions).filter((decision) => decision !== "pending").length;

  if (authLoading || contextLoading) return <Loading className="h-[calc(100dvh-3rem)]" />;
  if (!admin || admin.role !== "auditor") return null;

  return (
    <div className="mx-auto w-full max-w-[1480px] overflow-x-hidden p-4 pb-28 pt-20 sm:p-6 sm:pb-28 lg:p-8 lg:pb-10 lg:pt-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-300"><Sparkles size={14} /> Visual inspection assistant</div>
          <h1 className="page-header">AI Site Scan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">Capture or upload a workplace image. Audito reviews the complete scene against your organization’s internal evidence and presents distinct supported issues as a concise summary.</p>
        </div>
        <div className="flex w-full items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2 text-xs leading-relaxed text-amber-200/80 sm:w-fit sm:items-center"><ShieldCheck size={15} className="mt-0.5 shrink-0 sm:mt-0" /> AI suggestions require auditor confirmation</div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.035] shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:rounded-3xl">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div><p className="flex items-center gap-2 text-sm font-semibold text-white"><ScanLine size={17} className="text-secondary-300" /> Capture inspection view</p><p className="mt-1 text-xs text-gray-500">Stop in a safe position and hold the camera steady.</p></div>
            <div className="grid w-full grid-cols-2 rounded-xl border border-white/[0.08] bg-black/10 p-1 sm:w-auto">
              <button type="button" onClick={() => switchMode("camera")} className={`flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${mode === "camera" ? "bg-secondary-500 text-primary-950" : "text-gray-400 hover:text-white"}`}><Camera size={14} /> Camera</button>
              <button type="button" onClick={() => switchMode("upload")} className={`flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${mode === "upload" ? "bg-secondary-500 text-primary-950" : "text-gray-400 hover:text-white"}`}><ImagePlus size={14} /> Upload</button>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            <div className="relative aspect-[4/3] max-h-[68dvh] min-h-[260px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#020a06] sm:aspect-video sm:min-h-[320px]">
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Selected site scan" className="h-full w-full object-contain" />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-950/70 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 backdrop-blur"><CheckCircle2 size={12} /> Ready to analyze</span>
                    <button type="button" disabled={analyzing} onClick={clearPreview} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur transition hover:bg-black/70 disabled:opacity-50" aria-label="Remove image"><X size={16} /></button>
                  </div>
                </>
              ) : mode === "camera" ? (
                <>
                  <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`} />
                  {!cameraActive && <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><Camera size={28} /></span>
                    <p className="mt-4 text-sm font-semibold text-white">Use your camera to inspect an area</p>
                    <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500">Camera access works on HTTPS or localhost. The captured image is analyzed but not saved as audit evidence.</p>
                    <Button type="button" className="mt-5" loading={cameraStarting} leftIcon={<Camera size={15} />} onClick={() => void startCamera()}>Open camera</Button>
                    {cameraError && <p className="mt-3 max-w-md text-xs leading-relaxed text-red-300">{cameraError}</p>}
                  </div>}
                  {cameraActive && <>
                    <div className="pointer-events-none absolute inset-[10%] rounded-3xl border border-white/35 shadow-[0_0_0_999px_rgba(0,0,0,0.08)]" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-4 pt-12 sm:gap-4 sm:px-4 sm:pb-5 sm:pt-14">
                      <button type="button" onClick={() => { const next = facingMode === "environment" ? "user" : "environment"; setFacingMode(next); void startCamera(next); }} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur" aria-label="Switch camera"><RefreshCw size={17} /></button>
                      <button type="button" onClick={captureFrame} className="flex h-16 w-16 items-center justify-center rounded-full border-[5px] border-white bg-secondary-400 text-primary-950 shadow-xl transition hover:scale-105 active:scale-95" aria-label="Capture image"><Aperture size={25} /></button>
                      <button type="button" onClick={stopCamera} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white backdrop-blur" aria-label="Close camera"><CameraOff size={17} /></button>
                    </div>
                  </>}
                </>
              ) : (
                <div
                  onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
                  onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) void useImage(file); }}
                  className={`absolute inset-3 flex flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center transition ${dragging ? "border-secondary-400 bg-secondary-500/10" : "border-white/[0.15] bg-white/[0.02]"}`}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-secondary-500/20 bg-secondary-500/10 text-secondary-300"><Upload size={27} /></span>
                  <p className="mt-4 text-sm font-semibold text-white">Drop a workplace image here</p><p className="mt-1 text-xs text-gray-500">JPEG, PNG or WebP · Images over 2 MB are optimized automatically</p>
                  <Button type="button" variant="secondary" className="mt-5" loading={processingImage} leftIcon={<FileImage size={15} />} onClick={() => fileInputRef.current?.click()}>Choose image</Button>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGES.join(",")} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void useImage(file); event.currentTarget.value = ""; }} />
                </div>
              )}
              {processingImage && !analyzing && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#03110b]/88 p-6 text-center backdrop-blur-sm">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-secondary-400/20 bg-secondary-500/10"><ImagePlus size={26} className="animate-pulse text-secondary-300" /></div>
                <p className="mt-4 text-sm font-semibold text-white">Optimizing image</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-gray-500">Reducing the file below 2 MB while preserving the full frame and inspection detail.</p>
              </div>}
              {analyzing && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#03110b]/88 p-6 text-center backdrop-blur-sm">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-secondary-400/20 bg-secondary-500/10 sm:h-20 sm:w-20"><ScanLine size={28} className="text-secondary-300 sm:h-[31px] sm:w-[31px]" /><span className="absolute inset-0 animate-ping rounded-full border border-secondary-400/20" /></div>
                <p className="mt-4 text-sm font-semibold text-white sm:mt-5">{progressLabel}</p><p className="mt-1 text-xs text-gray-500">Keep this page open while Audito reviews the image.</p>
                <div className="mt-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/[0.08] sm:mt-5"><div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-secondary-400 transition-all duration-700" style={{ width: `${progress}%` }} /></div>
                <p className="mt-2 text-xs font-semibold tabular-nums text-secondary-300">{progress}%</p>
              </div>}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-xs text-gray-500">{imageFile ? <span className="flex min-w-0 items-center gap-2"><FileImage size={14} className="shrink-0 text-emerald-400" /><span className="min-w-0 flex-1 truncate">{imageFile.name}</span><span className="shrink-0">({(imageFile.size / 1024 / 1024).toFixed(1)} MB)</span></span> : <span>Capture one clear, well-lit view. You can take another angle after review.</span>}</div>
              <Button type="button" disabled={!imageFile || !location || analyzing || processingImage} loading={analyzing} leftIcon={<Zap size={15} />} onClick={analyze} className="w-full shrink-0 sm:w-auto">Analyze image</Button>
            </div>
          </div>
        </section>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
          <section className="overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.035] sm:rounded-3xl">
            <div className="border-b border-white/[0.08] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-white"><MapPin size={16} className="text-secondary-300" /> Inspection context</p><p className="mt-1 text-xs text-gray-500">Helps AI choose the correct controls and evidence.</p></div>
            <div className="space-y-5 p-4">
              <div><label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Organization area</label>
                {tree ? <div className="rounded-2xl border border-white/[0.08] bg-black/10"><LocationTree root={tree} selectedKey={location ? locationKey(location) : ""} onSelect={(node) => { setLocation(node); setResult(null); setDecisions({}); }} /></div> : <p className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">No assigned area is available.</p>}
                {location && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500"><CheckCircle2 size={12} className="text-emerald-400" /> Scanning {location.name}</p>}
              </div>
              <div className="flex gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.045] p-3">
                <ScanLine size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                <p className="text-[11px] leading-relaxed text-gray-400"><span className="font-semibold text-emerald-200">Internal evidence only.</span> Audito reports a possible issue only when the current image matches completed evidence and its recorded response. Unsupported conditions are not classified.</p>
              </div>
              <Textarea label="Optional context" value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 500))} rows={3} placeholder="Example: Packing line 2, near the emergency exit…" disabled={analyzing} />
            </div>
          </section>
          <section className="rounded-3xl border border-blue-500/15 bg-blue-500/[0.045] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-blue-200"><Lightbulb size={15} /> Get a better result</p><ul className="mt-3 space-y-2 text-xs leading-relaxed text-gray-400"><li className="flex gap-2"><Check size={13} className="mt-0.5 text-blue-300" /> Stand still before capturing.</li><li className="flex gap-2"><Check size={13} className="mt-0.5 text-blue-300" /> Include the complete equipment or work area.</li><li className="flex gap-2"><Check size={13} className="mt-0.5 text-blue-300" /> Avoid faces, ID cards and confidential screens.</li></ul></section>
        </aside>
      </div>

      {result && <section className="mt-6 overflow-hidden rounded-2xl border border-white/[0.1] bg-white/[0.035] shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:rounded-3xl">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><Sparkles size={17} /></span><div className="min-w-0"><h2 className="text-base font-semibold text-white">Site scan summary</h2><p className="mt-0.5 break-words text-xs text-gray-500">{result.location.name} · Image quality: {result.image_quality}</p></div></div><p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">{result.issue_summary}</p></div><Button className="w-full sm:w-auto" type="button" variant="secondary" size="sm" leftIcon={<RotateCcw size={14} />} onClick={resetScan}>New scan</Button></div>
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            {result.needs_another_image && <div className="flex gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4 text-sm text-amber-100"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="font-semibold">Another view would improve the result</p><p className="mt-1 text-xs text-amber-100/65">Capture a closer or wider angle before reviewing uncertain points.</p></div></div>}
            {result.issues.length ? <ol className="space-y-3">{result.issues.map((issue, index) => <IssueSummaryItem key={`${issue.summary}-${index}`} issue={issue} index={index} decision={decisions[index] || "pending"} onDecision={(decision) => setDecisions((previous) => ({ ...previous, [index]: decision }))} />)}</ol> : <div className="flex flex-col items-center rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] px-5 py-12 text-center"><CheckCircle2 size={30} className="text-emerald-300" /><p className="mt-3 text-sm font-semibold text-white">No matching issue identified</p><p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500">The image did not match an issue in Audito’s reviewed internal evidence. Continue the physical inspection and scan another angle if needed.</p></div>}
          </div>
          <aside className="space-y-3">
            <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Auditor review</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-xl font-bold text-white">{reviewedCount}</p><p className="text-[10px] text-gray-500">Reviewed</p></div><div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.045] p-3"><p className="text-xl font-bold text-emerald-300">{confirmedCount}</p><p className="text-[10px] text-gray-500">Confirmed</p></div></div><p className="mt-3 text-[11px] leading-relaxed text-gray-500">Review decisions apply to this scan only. They do not create an audit, finding or CAP.</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4"><p className="flex items-center gap-2 text-xs font-semibold text-gray-300"><Info size={14} className="text-blue-300" /> Internal evidence used</p><div className="mt-3 space-y-2 text-[11px] text-gray-500"><p className="flex justify-between"><span>Total records</span><span className="font-semibold text-gray-300">{result.context_used.internal_evidence_records}</span></p><p className="flex justify-between"><span>Issue evidence</span><span className="font-semibold text-gray-300">{result.context_used.historical_issue_examples}</span></p><p className="flex justify-between"><span>Resolved/compliant</span><span className="font-semibold text-gray-300">{result.context_used.historical_comparison_examples}</span></p></div></div>
            {result.safety_message && <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.045] p-4"><p className="flex items-start gap-2 text-[11px] leading-relaxed text-red-200/80"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{result.safety_message}</p></div>}
          </aside>
        </div>
      </section>}
    </div>
  );
}
