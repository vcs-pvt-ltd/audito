"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, FileImage, FileSpreadsheet, FileText, LockKeyhole, Presentation, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui";
import { ONBOARDING_DOCUMENT_ACCEPT } from "@/utils/aiDocumentFiles";
import { EASE } from "../motion";

const FORMATS = [
  { label: "Excel / CSV", icon: FileSpreadsheet, tone: "text-emerald-300" },
  { label: "PDF / Word", icon: FileText, tone: "text-sky-300" },
  { label: "PowerPoint", icon: Presentation, tone: "text-orange-300" },
  { label: "Photo", icon: FileImage, tone: "text-violet-300" },
];

/** Choose the audit sheet, then Prepare. A sheet already uploaded can be read again without choosing it. */
export default function UploadStep({ files, busy, hasDraft, storedSheet, onFiles, onRemove, onPrepare, onReturn }: {
  files: File[]; busy: boolean; hasDraft: boolean;
  /** The sheet uploaded earlier is still stored. */
  storedSheet: boolean;
  onFiles: (files: File[]) => void; onRemove: (index: number) => void; onPrepare: () => void; onReturn: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const canPrepare = files.length > 0 || storedSheet;
  return <section className="mx-auto max-w-xl" aria-labelledby="upload-title">
    <h2 id="upload-title" className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">{hasDraft ? "Upload another sheet" : "Upload your audit sheet"}</h2>

    <motion.label
      onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) onFiles(Array.from(event.dataTransfer.files || [])); }}
      animate={{ scale: dragging ? 1.015 : 1 }} transition={{ duration: 0.15, ease: EASE }}
      className={`group mt-6 flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed px-5 py-10 text-center transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-secondary-400/70 sm:py-12 ${dragging ? "border-secondary-400 bg-secondary-500/10" : "border-white/15 bg-white/[.02] hover:border-secondary-400/50 hover:bg-secondary-500/[.04]"} ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <span className={`grid h-16 w-16 place-items-center rounded-2xl transition-colors ${dragging ? "bg-secondary-400 text-primary-950" : "bg-secondary-400/15 text-secondary-300 group-hover:bg-secondary-400/25"}`} aria-hidden><UploadCloud size={30} /></span>
      <span className="mt-4 text-lg font-semibold text-white">{dragging ? "Drop to add" : "Click or drop your file"}</span>
      <span className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Supported files">
        {FORMATS.map(({ label, icon: Icon, tone }) => <span key={label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-xs text-gray-300"><Icon size={13} className={tone} aria-hidden />{label}</span>)}
      </span>
      <span className="mt-3 text-[11px] text-gray-500">Up to 4 files · 10 MB each</span>
      <input aria-label="Choose audit sheet" className="sr-only" type="file" multiple accept={ONBOARDING_DOCUMENT_ACCEPT} disabled={busy} onChange={event => { onFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
    </motion.label>

    <ul className="mt-3 space-y-2" aria-label="Chosen files">
      <AnimatePresence initial={false}>
        {files.map((file, index) => <motion.li key={`${file.name}-${file.size}-${file.lastModified}`} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18, ease: EASE }}
          className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.04] px-3 py-2.5">
          <FileText size={16} className="shrink-0 text-secondary-300" aria-hidden /><span className="min-w-0 flex-1 truncate text-sm text-gray-100">{file.name}</span>
          <span className="shrink-0 text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          <button type="button" disabled={busy} onClick={() => onRemove(index)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-white/[.06] hover:text-white disabled:opacity-40" aria-label={`Remove ${file.name}`}><X size={15} /></button>
        </motion.li>)}
      </AnimatePresence>
    </ul>

    <Button className="mt-4 min-h-12 rounded-2xl text-base" fullWidth disabled={busy || !canPrepare} rightIcon={<ArrowRight size={18} />} onClick={onPrepare}>
      {files.length || !storedSheet ? "Prepare" : "Prepare with uploaded sheet"}
    </Button>
    <p className="mt-3 text-center text-xs leading-5 text-gray-400"><span className="font-semibold text-gray-300">Best:</span> Excel with headings, question numbers and area names.</p>
    {hasDraft && <Button className="mt-3" fullWidth variant="ghost" leftIcon={<ArrowLeft size={15} />} disabled={busy} onClick={onReturn}>Back to my draft</Button>}
    <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-gray-500"><LockKeyhole size={12} aria-hidden />File deleted when setup is saved</p>
  </section>;
}
