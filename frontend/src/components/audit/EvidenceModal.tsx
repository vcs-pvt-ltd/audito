"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Mic, Play, Square, Upload, Video, X } from "lucide-react";

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

const MEDIA_ORIGIN = process.env.NEXT_PUBLIC_MEDIA_URL || (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
const EVIDENCE_UPLOAD_URL = `${MEDIA_ORIGIN}/uploads`;

function fmtFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EvidenceModal({
  open,
  onClose,
  onUpload,
  uploading,
  error,
  view,
  onClearView,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<boolean>;
  uploading: boolean;
  error?: string;
  view?: {
    url: string;
    kind: "image" | "video" | "audio";
    title?: string;
  } | null;
  onClearView?: () => void;
}) {
  const [tab, setTab] = useState<"upload" | "photo" | "video" | "audio">("upload");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewType, setPreviewType] = useState<"image" | "video" | "audio" | "">("");
  const [localErr, setLocalErr] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);

  const stopStream = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    setRecording(false);
    const s = streamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    setLocalErr("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setPreviewType("");
    setTab("upload");
    chunksRef.current = [];
    return () => {
      stopStream();
    };
  }, [open, previewUrl, stopStream]);

  useEffect(() => {
    if (!open) return;
    setLocalErr("");
    chunksRef.current = [];
    stopStream();

    const start = async () => {
      try {
        if (tab === "photo") {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        }
        if (tab === "video") {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
        }
        if (tab === "audio") {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          streamRef.current = stream;
        }
      } catch {
        if (tab === "photo") setLocalErr("Camera permission denied or not available.");
        else if (tab === "video") setLocalErr("Camera/Microphone permission denied or not available.");
        else if (tab === "audio") setLocalErr("Microphone permission denied or not available.");
      }
    };

    start();
  }, [tab, open, stopStream]);

  const processImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const targetRatio = 16 / 9;
        let w = img.width;
        let h = img.height;
        let sx = 0;
        let sy = 0;

        if (w / h > targetRatio) {
          // Wider than 16:9
          const newW = h * targetRatio;
          sx = (w - newW) / 2;
          w = newW;
        } else {
          // Taller than 16:9
          const newH = w / targetRatio;
          sy = (h - newH) / 2;
          h = newH;
        }

        const canvas = document.createElement("canvas");
        // Don't make it TOO big if original was huge
        const maxWidth = 1920;
        let finalW = w;
        let finalH = h;
        if (finalW > maxWidth) {
          finalW = maxWidth;
          finalH = finalW / targetRatio;
        }

        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, sx, sy, w, h, 0, 0, finalW, finalH);
        }

        const attemptCompression = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                if (blob.size > MAX_EVIDENCE_BYTES && quality > 0.1) {
                  // If still too big, try lower quality
                  attemptCompression(quality - 0.1);
                } else if (blob.size > MAX_EVIDENCE_BYTES && finalW > 1024) {
                   // If still too big after quality drop, scale down
                   finalW = finalW * 0.8;
                   finalH = finalW / targetRatio;
                   canvas.width = finalW;
                   canvas.height = finalH;
                   ctx?.drawImage(img, sx, sy, w, h, 0, 0, finalW, finalH);
                   attemptCompression(0.85);
                } else {
                  resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg" }));
                }
              } else {
                resolve(file); // Fallback
              }
            },
            "image/jpeg",
            quality
          );
        };

        attemptCompression(0.85);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const pickFile = async (f?: File) => {
    setLocalErr("");
    if (!f) return;
    
    let fileToUpload = f;
    if (f.type.startsWith("image/")) {
      setLocalErr("Processing image...");
      fileToUpload = await processImage(f);
      setLocalErr("");
    }

    if (fileToUpload.size > MAX_EVIDENCE_BYTES) {
      setLocalErr(`File size too large: ${fmtFileSize(fileToUpload.size)}. Max 2MB.`);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const u = URL.createObjectURL(fileToUpload);
    setPreviewUrl(u);
    setPreviewType(fileToUpload.type.startsWith("image/") ? "image" : fileToUpload.type.startsWith("video/") ? "video" : "audio");
    
    const ok = await onUpload(fileToUpload);
    if (ok) onClose();
  };

  const capturePhoto = async () => {
    setLocalErr("");
    const v = videoRef.current;
    if (!v) return;
    
    const vW = v.videoWidth || 1280;
    const vH = v.videoHeight || 720;
    
    // Create a temporary canvas to get the raw image
    const canvas = document.createElement("canvas");
    canvas.width = vW;
    canvas.height = vH;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(v, 0, 0, vW, vH);
    
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setLocalErr("Failed to capture image.");
        return;
      }
      const rawFile = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      const processed = await processImage(rawFile);
      
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(processed));
      setPreviewType("image");
      
      const ok = await onUpload(processed);
      if (ok) onClose();
    }, "image/jpeg", 0.9);
  };

  const startRecording = () => {
    setLocalErr("");
    const s = streamRef.current;
    if (!s) {
      setLocalErr("Media device not ready.");
      return;
    }
    try {
      chunksRef.current = [];
      const rec = new MediaRecorder(s);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const mime = rec.mimeType || (tab === "audio" ? "audio/webm" : "video/webm");
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > MAX_EVIDENCE_BYTES) {
          setLocalErr(`Recording exceeds 2MB (${fmtFileSize(blob.size)}). Record a shorter clip.`);
          return;
        }
        const name = `${tab}-${Date.now()}.webm`;
        const file = new File([blob], name, { type: mime });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(file));
        setPreviewType(tab === "audio" ? "audio" : "video");
        const ok = await onUpload(file);
        if (ok) onClose();
      };
      rec.start();
      setRecording(true);
    } catch {
      setLocalErr("Recording is not supported in this browser.");
    }
  };

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
    setRecording(false);
  };

  const tabBtn = (k: typeof tab, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(k)}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
        tab === k
          ? "bg-secondary-500/15 text-secondary-300 border-secondary-500/30"
          : "bg-white/[0.02] text-gray-400 border-white/10 hover:border-white/20 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-primary-950 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="text-sm font-semibold text-white">{view ? "Evidence Preview" : "Add Evidence"}</h3>
            <p className="text-[11px] text-gray-500">{view ? (view.title || "") : "Max file size 2MB"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {(localErr || error) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300">
              <AlertCircle size={14} className="shrink-0" />
              <span className="text-xs">{localErr || error}</span>
            </div>
          )}

          {view ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                {view.kind === "image" ? (
                  <img src={view.url} alt={view.title || "evidence"} className="w-full max-h-[420px] object-contain rounded-lg bg-black/30" />
                ) : view.kind === "video" ? (
                  <video src={view.url} controls className="w-full max-h-[420px] rounded-lg bg-black/30" />
                ) : (
                  <audio src={view.url} controls className="w-full" />
                )}
              </div>
              {onClearView && (
                <button
                  type="button"
                  onClick={onClearView}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-gray-200 hover:bg-white/[0.05] hover:border-white/20 transition-all"
                >
                  <Upload size={16} />
                  Add more evidence
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {tabBtn("upload", "Upload", <Upload size={14} />)}
                {tabBtn("photo", "Capture", <Camera size={14} />)}
                {tabBtn("video", "Video", <Video size={14} />)}
                {tabBtn("audio", "Audio", <Mic size={14} />)}
              </div>

              {tab === "upload" && (
                <div className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      await pickFile(f);
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-gray-200 hover:bg-white/[0.05] hover:border-white/20 transition-all disabled:opacity-50"
                  >
                    <Upload size={16} />
                    Choose file
                  </button>

                  <p className="text-[11px] text-gray-600">Supported: image, video, audio</p>
                </div>
              )}

          {(tab === "photo" || tab === "video") && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <video ref={videoRef} playsInline muted className="w-full h-64 object-cover" />
              </div>

              {tab === "photo" ? (
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary-500 text-primary-950 font-semibold hover:bg-secondary-400 transition-all disabled:opacity-50"
                  >
                    <Camera size={16} />
                    Capture & Upload
                  </button>
                  <button
                    type="button"
                    onClick={stopStream}
                    className="px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all"
                  >
                    Stop
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  {!recording ? (
                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={uploading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary-500 text-primary-950 font-semibold hover:bg-secondary-400 transition-all disabled:opacity-50"
                    >
                      <Play size={16} />
                      Start Recording
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/90 text-white font-semibold hover:bg-red-500 transition-all"
                    >
                      <Square size={16} />
                      Stop & Upload
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={stopStream}
                    className="px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "audio" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">Microphone</p>
                    <p className="text-[11px] text-gray-600">Record a short voice note (max 2MB)</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${recording ? "bg-red-500" : "bg-emerald-500"}`} />
                </div>
              </div>

              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary-500 text-primary-950 font-semibold hover:bg-secondary-400 transition-all disabled:opacity-50"
                >
                  <Play size={16} />
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/90 text-white font-semibold hover:bg-red-500 transition-all"
                >
                  <Square size={16} />
                  Stop & Upload
                </button>
              )}

              <button
                type="button"
                onClick={stopStream}
                className="w-full px-4 py-3 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all"
              >
                Stop microphone
              </button>
            </div>
          )}

          {previewUrl && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
              <p className="text-xs text-gray-400">Latest preview</p>
              {previewType === "image" ? (
                <img src={previewUrl} alt="preview" className="w-full max-h-72 object-contain rounded-lg bg-black/30" />
              ) : previewType === "video" ? (
                <video src={previewUrl} controls className="w-full max-h-72 rounded-lg bg-black/30" />
              ) : previewType === "audio" ? (
                <audio src={previewUrl} controls className="w-full" />
              ) : null}
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-2 text-xs text-secondary-400">
              <div className="w-3.5 h-3.5 border border-secondary-400 border-t-transparent rounded-full animate-spin" />
              Uploading...
            </div>
          )}

             
            </>
          )}
        </div>
      </div>
    </div>
  );
}
