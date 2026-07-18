"use client";

import { useState } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Play, Volume2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { getEvidenceUrl } from "@/utils/executionService";

type ChecklistMediaKind = "image" | "video" | "audio" | "document";

function getFileName(mediaPath: string, fileName?: string) {
  if (fileName) return fileName;
  return decodeURIComponent(mediaPath.split("/").pop() || "Checklist reference");
}

export function getChecklistMediaKind(mediaPath: string): ChecklistMediaKind {
  const path = mediaPath.toLowerCase().split("?")[0];
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(path)) return "image";
  if (/\.(mp4|webm|mov|m4v|avi|mkv)$/.test(path)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac|webm)$/.test(path)) return "audio";
  return "document";
}

function MediaTypeIcon({ kind, size = 16 }: { kind: ChecklistMediaKind; size?: number }) {
  if (kind === "image") return <ImageIcon size={size} />;
  if (kind === "video") return <Play size={size} />;
  if (kind === "audio") return <Volume2 size={size} />;
  return <FileText size={size} />;
}

export default function ChecklistMediaPreview({
  mediaPath,
  fileName,
  label = "Checklist reference",
}: {
  mediaPath?: string | null;
  fileName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!mediaPath) return null;

  const kind = getChecklistMediaKind(mediaPath);
  const url = getEvidenceUrl(mediaPath);
  const name = getFileName(mediaPath, fileName);
  const typeLabel = kind === "document" ? "Document" : kind[0].toUpperCase() + kind.slice(1);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full max-w-md items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-2.5 text-left transition-colors hover:border-secondary-500/35 hover:bg-secondary-500/[0.06]"
        aria-label={`Preview ${name}`}
      >
        <div className="relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-primary-950/70">
          {kind === "image" ? (
            <img src={url} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : kind === "video" ? (
            <>
              <video src={url} muted preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white"><Play size={16} fill="currentColor" /></span>
            </>
          ) : (
            <span className={kind === "audio" ? "text-emerald-400" : "text-secondary-400"}>
              <MediaTypeIcon kind={kind} size={22} />
            </span>
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
          <span className="block truncate text-sm font-medium text-gray-200">{name}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-400">
            <MediaTypeIcon kind={kind} size={11} /> {typeLabel} · Click to view
          </span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        description={`${label} · ${typeLabel}`}
        icon={<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary-500/10 text-secondary-400"><MediaTypeIcon kind={kind} size={17} /></span>}
        size="xl"
        bodyPadded={false}
      >
        <div className="bg-black/30 p-3 sm:p-5">
          {kind === "image" && <img src={url} alt={name} className="mx-auto max-h-[68dvh] w-auto max-w-full rounded-xl object-contain" />}
          {kind === "video" && <video src={url} controls autoPlay className="mx-auto max-h-[68dvh] w-full rounded-xl bg-black" />}
          {kind === "audio" && (
            <div className="flex min-h-52 flex-col items-center justify-center gap-6 rounded-xl border border-white/10 bg-primary-950/60 p-8">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400"><Volume2 size={30} /></span>
              <audio src={url} controls className="w-full max-w-xl" />
            </div>
          )}
          {kind === "document" && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-primary-950/60">
              {/\.pdf$/i.test(mediaPath.split("?")[0]) ? (
                <iframe title={name} src={url} className="h-[68dvh] w-full bg-white" />
              ) : (
                <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
                  <FileText size={36} className="mb-3 text-secondary-400" />
                  <p className="text-sm font-medium text-white">This document opens in your browser or preferred app.</p>
                  <a href={url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-primary-950 transition-colors hover:bg-secondary-400">
                    Open document <ExternalLink size={15} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
