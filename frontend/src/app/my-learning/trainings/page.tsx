"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { myLearningApi } from "@/lib/api";
import { Check, Maximize2, Play, RefreshCw, RotateCcw, Search } from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Button, IconButton, Modal, Table, THead, Th } from "@/components/ui";

interface MyTraining {
  assignment_id: string;
  status: "assigned" | "completed";
  assigned_at: string;
  completed_at?: string | null;
  training_id: string;
  title: string;
  platform?: string | null;
  video_url: string;
  description?: string | null;
  duration_minutes?: number | null;
  watched_seconds?: number;
  last_position_seconds?: number;
  is_watching?: number | boolean;
}

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}` : `${minutes}:${String(remaining).padStart(2, "0")}`;
};

const isDirectVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v)(?:[?#].*)?$/i.test(url);
const isYouTubeVideo = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes("youtube.com") || hostname.includes("youtu.be");
  } catch { return false; }
};

const getEmbedUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}?rel=0&enablejsapi=1&playsinline=1`;
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}?rel=0&enablejsapi=1&playsinline=1` : url;
    }
    if (parsed.hostname.includes("vimeo.com") && !parsed.hostname.includes("player.")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
    if (parsed.hostname.includes("loom.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.loom.com/embed/${id}` : url;
    }
    if (parsed.hostname.includes("wistia.com") || parsed.hostname.includes("wi.st")) {
      const match = parsed.pathname.match(/(?:medias|embed\/medias)\/([^/?#]+)/);
      return match ? `https://fast.wistia.net/embed/medias/${match[1]}` : url;
    }
    if (parsed.hostname.includes("drive.google.com")) {
      const match = parsed.pathname.match(/\/d\/([^/]+)/);
      return match ? `https://drive.google.com/file/d/${match[1]}/preview` : url;
    }
    if (parsed.hostname.includes("streamable.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://streamable.com/e/${id}` : url;
    }
    if (parsed.hostname.includes("dailymotion.com") || parsed.hostname.includes("dai.ly")) {
      const id = parsed.hostname.includes("dai.ly") ? parsed.pathname.slice(1) : parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.dailymotion.com/embed/video/${id}` : url;
    }
    if (parsed.hostname.includes("vidyard.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://play.vidyard.com/${id}.html` : url;
    }
  } catch { /* keep the configured URL */ }
  return url;
};

function TrainingPlayerModal({
  training,
  accessToken,
  onClose,
  onCompleted,
  onProgress,
}: {
  training: MyTraining | null;
  accessToken: string | null;
  onClose: () => void;
  onCompleted: () => Promise<void>;
  onProgress: (assignmentId: string, progress: { watched_seconds?: number; is_watching?: boolean; last_position_seconds?: number }) => void;
}) {
  const { toast } = useUiFeedback();
  const playerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playbackPositionRef = useRef(0);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [completing, setCompleting] = useState(false);

  const requiredSeconds = Math.max(0, Number(training?.duration_minutes || 0) * 60);
  const progressPercent = requiredSeconds > 0 ? Math.min(100, Math.round((watchedSeconds / requiredSeconds) * 100)) : watchedSeconds > 0 ? 100 : 0;
  const canComplete = training?.status === "assigned" && (requiredSeconds > 0 ? watchedSeconds >= requiredSeconds : watchedSeconds > 0);
  const directVideo = training ? isDirectVideo(training.video_url) : false;

  useEffect(() => {
    if (!training) return;
    setWatchedSeconds(Number(training.watched_seconds || 0));
    const initialPosition = Number(training.last_position_seconds || 0);
    playbackPositionRef.current = initialPosition;
    setPlaybackPosition(initialPosition);
    setIsTracking(false);
  }, [training]);

  const saveProgress = useCallback(async (action: "start" | "heartbeat" | "pause") => {
    if (!training || !accessToken || training.status === "completed") return;
    const videoPosition = videoRef.current?.currentTime;
    const position = directVideo && typeof videoPosition === "number" ? videoPosition : playbackPositionRef.current;
    const result = await myLearningApi.saveTrainingProgress(accessToken, training.assignment_id, action, position);
    if (result.success && result.data) {
      const progress = result.data as { watched_seconds?: number; is_watching?: boolean };
      const watched = Number(progress.watched_seconds || 0);
      playbackPositionRef.current = position;
      setWatchedSeconds(watched);
      setPlaybackPosition(position);
      setIsTracking(Boolean(progress.is_watching));
      onProgress(training.assignment_id, { watched_seconds: watched, is_watching: progress.is_watching, last_position_seconds: position });
    }
  }, [accessToken, directVideo, onProgress, training]);

  useEffect(() => {
    if (!isTracking) return;
    // Persist frequently, while a separate UI timer keeps the progress feedback fluid.
    const heartbeat = window.setInterval(() => { void saveProgress("heartbeat"); }, 5000);
    return () => window.clearInterval(heartbeat);
  }, [isTracking, saveProgress]);

  useEffect(() => {
    if (!isTracking) return;
    const uiTicker = window.setInterval(() => {
      setWatchedSeconds((current) => requiredSeconds > 0 ? Math.min(requiredSeconds, current + 1) : current + 1);
    }, 1000);
    return () => window.clearInterval(uiTicker);
  }, [isTracking, requiredSeconds]);

  useEffect(() => {
    if (!training || directVideo) return;
    const handleEmbeddedPlayerEvent = (event: MessageEvent) => {
      if (!isYouTubeVideo(training.video_url)) return;
      if (!String(event.origin).includes("youtube")) return;
      let payload: any;
      try { payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (payload?.event === "onStateChange") {
        if (payload.info === 1) {
          setIsTracking(true);
          void saveProgress("start");
        }
        if (payload.info === 0 || payload.info === 2) {
          setIsTracking(false);
          void saveProgress("pause");
        }
      }
      if (payload?.event === "infoDelivery" && typeof payload?.info?.currentTime === "number") {
        playbackPositionRef.current = payload.info.currentTime;
        setPlaybackPosition(payload.info.currentTime);
      }
    };
    window.addEventListener("message", handleEmbeddedPlayerEvent);
    return () => window.removeEventListener("message", handleEmbeddedPlayerEvent);
  }, [directVideo, saveProgress, training]);

  const handleVideoReady = () => {
    if (videoRef.current && playbackPosition > 0) videoRef.current.currentTime = playbackPosition;
  };

  const handleStart = () => { setIsTracking(true); void saveProgress("start"); };
  const handlePause = () => { setIsTracking(false); void saveProgress("pause"); };

  const handleFullscreen = async () => {
    try {
      await playerRef.current?.requestFullscreen?.();
    } catch {
      toast("Fullscreen is unavailable in this browser.", "error");
    }
  };

  const handleComplete = async () => {
    if (!training || !accessToken || !canComplete) return;
    setCompleting(true);
    const result = await myLearningApi.completeTraining(accessToken, training.assignment_id);
    setCompleting(false);
    if (!result.success) {
      toast(result.message || "Unable to complete this training yet.", "error");
      return;
    }
    toast("Training completed.", "success");
    await onCompleted();
    onClose();
  };

  const handleClose = async () => {
    if (isTracking) await saveProgress("pause");
    onClose();
  };

  if (!training) return null;

  return (
    <Modal
      open={Boolean(training)}
      onClose={() => void handleClose()}
      title={training.title}
      description={training.platform || "Training video"}
      size="xl"
      bodyPadded={false}
      headerActions={(
        <div className="flex items-center gap-2">
          <div className="hidden min-w-28 sm:block">
            <div className="mb-1 flex justify-between text-[10px] text-gray-400"><span>Watch</span><span>{requiredSeconds ? `${progressPercent}%` : formatTime(watchedSeconds)}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-secondary-400 transition-all" style={{ width: `${progressPercent}%` }} /></div>
          </div>
          {training.status === "completed" ? <span className="hidden text-xs font-semibold text-emerald-400 sm:inline">Completed</span> : (
            <Button size="sm" loading={completing} disabled={!canComplete || completing} onClick={() => void handleComplete()} leftIcon={<Check size={14} />}>Complete</Button>
          )}
        </div>
      )}
    >
      <div className="overflow-hidden">
        <div ref={playerRef} className="relative aspect-video w-full bg-black">
          {directVideo ? (
            <video
              ref={videoRef}
              src={training.video_url}
              controls
              playsInline
              className="h-full w-full"
              onLoadedMetadata={handleVideoReady}
              onPlay={handleStart}
              onPause={handlePause}
              onEnded={handlePause}
              onTimeUpdate={() => {
                const position = Number(videoRef.current?.currentTime || 0);
                playbackPositionRef.current = position;
                setPlaybackPosition(position);
              }}
            />
          ) : (
            <iframe title={training.title} src={getEmbedUrl(training.video_url)} className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen onLoad={(event) => {
              if (getEmbedUrl(training.video_url).includes("youtube.com/embed")) {
                event.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: training.assignment_id }), "*");
                event.currentTarget.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), "*");
              }
            }} />
          )}
          <button onClick={() => void handleFullscreen()} aria-label="Fullscreen video" className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white transition hover:bg-black/80">
            <Maximize2 size={16} />
          </button>
        </div>      
        {!directVideo && (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-gray-400">
            <span>Having trouble with this provider?</span>
            <a href={training.video_url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-secondary-400 hover:text-secondary-300">Open original video</a>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function MyTrainingsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MyTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTraining, setActiveTraining] = useState<MyTraining | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await myLearningApi.myTrainings(accessToken);
    if (res.success && res.data) {
      const data = res.data as { trainings?: MyTraining[] };
      setItems((data.trainings || []).map((training) => ({ ...training, status: training.status ?? "assigned" })));
    }
    setLoading(false);
  }, [accessToken]);

  const handleProgress = useCallback((assignmentId: string, progress: { watched_seconds?: number; is_watching?: boolean; last_position_seconds?: number }) => {
    setItems((current) => current.map((item) => item.assignment_id === assignmentId ? { ...item, ...progress } : item));
  }, []);

  useEffect(() => { if (accessToken) void load(); }, [accessToken, load]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((training) => training.title.toLowerCase().includes(query) || training.description?.toLowerCase().includes(query) || training.platform?.toLowerCase().includes(query));
  }, [items, searchQuery]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filtered, currentPage, pageSize]);

  if (isLoading || !admin) return null;
  if (admin.role !== "auditor") return <div className="p-4 pt-20 text-gray-300 sm:p-6 lg:p-8 lg:pt-8">Only auditors can access this page.</div>;

  return (
    <div className="mx-auto min-h-full w-full max-w-7xl space-y-5 p-4 pb-28 pt-20 sm:p-6 sm:pb-28 lg:space-y-6 lg:p-8 lg:pb-10 lg:pt-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-secondary-500/20 bg-secondary-500/10"><Play size={20} className="text-secondary-400" /></div><div><h1 className="text-xl font-bold text-white">My Trainings</h1><p className="mt-0.5 text-xs text-gray-500">Watch, pause, resume, and complete assigned training videos.</p></div></div>
        <IconButton bordered size="md" onClick={() => void load()} title="Refresh" className="bg-white/5"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></IconButton>
      </div>

      {!loading && items.length > 0 && <div className="max-w-lg"><div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"><Search size={14} className="text-gray-500" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search trainings..." className="w-full bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-600" /></div></div>}

      {loading ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary-400 border-t-transparent" /></div>
        : items.length === 0 ? <EmptyState icon={Play} title="No trainings assigned" message="Trainings assigned to you will appear here once your organization adds them." />
          : filtered.length === 0 ? <div className="glass rounded-xl p-16 text-center"><Play size={36} className="mx-auto mb-4 text-gray-600" /><p className="mb-1 font-medium text-white">No matching trainings</p><p className="text-sm text-gray-400">Try adjusting your search query.</p></div>
            : <div className="space-y-4">
              <div className="hidden lg:block"><Table className="text-left"><THead><Th>Training</Th><Th align="center">Progress</Th><Th align="center">Status</Th><Th align="right">Action</Th></THead><tbody className="divide-y divide-white/5">
                {paginated.map((training) => {
                  const required = Math.max(0, Number(training.duration_minutes || 0) * 60);
                  const watched = Number(training.watched_seconds || 0);
                  const percent = required > 0 ? Math.min(100, Math.round((watched / required) * 100)) : 0;
                  return <tr key={training.assignment_id} className="group transition-colors hover:bg-white/[0.01]"><td className="px-6 py-5"><p className="text-sm font-bold text-white">{training.title}</p><p className="mt-1 text-[10px] font-semibold tracking-wider text-secondary-400">{training.platform || "Training video"}{training.duration_minutes ? ` · ${training.duration_minutes} minutes` : ""}</p></td><td className="px-6 py-5"><div className="mx-auto max-w-36"><div className="mb-1 flex justify-between text-[10px] text-gray-500"><span>{formatTime(watched)}</span><span>{required ? `${percent}%` : "—"}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-secondary-400" style={{ width: `${percent}%` }} /></div></div></td><td className="px-6 py-5 text-center"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black tracking-wider ${training.status === "completed" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>{training.status === "completed" ? "Completed" : watched > 0 ? "In progress" : "Pending"}</span></td><td className="px-6 py-5 text-right"><Button size="sm" variant={training.status === "completed" ? "secondary" : "primary"} leftIcon={training.status === "completed" ? <RotateCcw size={14} /> : <Play size={14} />} onClick={() => setActiveTraining(training)}>{training.status === "completed" ? "Review" : watched > 0 ? "Resume" : "Watch"}</Button></td></tr>;
                })}
              </tbody></Table></div>
              <div className="space-y-3 lg:hidden">{paginated.map((training) => { const required = Math.max(0, Number(training.duration_minutes || 0) * 60); const watched = Number(training.watched_seconds || 0); const percent = required > 0 ? Math.min(100, Math.round((watched / required) * 100)) : 0; return <div key={training.assignment_id} className="glass rounded-2xl border border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-white">{training.title}</h3><p className="mt-1 text-[10px] font-semibold tracking-wider text-secondary-400">{training.platform || "Training video"}{training.duration_minutes ? ` · ${training.duration_minutes} min` : ""}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black tracking-wider ${training.status === "completed" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>{training.status === "completed" ? "DONE" : watched > 0 ? "PAUSED" : "PENDING"}</span></div><div className="mt-4"><div className="mb-1.5 flex justify-between text-[10px] text-gray-500"><span>{formatTime(watched)} watched</span><span>{required ? `${percent}%` : ""}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-secondary-400" style={{ width: `${percent}%` }} /></div></div><Button fullWidth className="mt-4" variant={training.status === "completed" ? "secondary" : "primary"} leftIcon={training.status === "completed" ? <RotateCcw size={15} /> : <Play size={15} />} onClick={() => setActiveTraining(training)}>{training.status === "completed" ? "Review training" : watched > 0 ? "Resume training" : "Watch training"}</Button></div>; })}</div>
              <TablePagination currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
            </div>}

      <TrainingPlayerModal
        training={activeTraining}
        accessToken={accessToken}
        onClose={() => { setActiveTraining(null); void load(); }}
        onCompleted={load}
        onProgress={handleProgress}
      />
    </div>
  );
}
