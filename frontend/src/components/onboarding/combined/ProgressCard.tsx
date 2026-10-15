"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { EASE } from "../motion";
import type { ProgressInfo } from "./model";

type Mode = "reading" | "updating" | "saving";

// Stages of a read, in order, with the share of the bar each covers. The first
// is the upload request itself; the rest are reported by the server.
const READING_STAGES = [
  { match: /^$/, label: "Uploading", from: 0, to: 4 },
  { match: /preparing/i, label: "Opening file", from: 4, to: 12 },
  { match: /matching/i, label: "Matching your organization", from: 12, to: 20 },
  { match: /organization and checklist/i, label: "Finding areas", from: 20, to: 92, parts: true },
  { match: /saving/i, label: "Saving draft", from: 92, to: 99 },
];
// The second read, after the organization is verified.
const QUESTION_STAGES = [
  { match: /questions/i, label: "Reading questions", from: 0, to: 92, parts: true },
  { match: /saving/i, label: "Saving draft", from: 92, to: 99 },
];
const SIMPLE = { updating: "Applying your change", saving: "Saving your setup" };
type Stage = { match: RegExp; label: string; from: number; to: number; parts?: boolean };

// Percentage window for the current stage: the bar sits at `floor` and eases
// toward `ceiling` while the server works, so it never looks stuck or jumps back.
// It stops short of 100 until the server reports that the work is finished.
function windowFor(mode: Mode, stages: Stage[], questions: boolean, progress: ProgressInfo | null, uploading: boolean) {
  if (mode !== "reading") return { index: -1, floor: 3, ceiling: 92 };
  const found = stages.findIndex((stage, i) => (questions || i > 0) && progress && stage.match.test(progress.stage));
  const index = questions ? Math.max(0, found) : uploading ? 0 : Math.max(1, found);
  const stage = stages[index];
  const share = stage.parts ? partShare(questions, progress) : null;
  if (share) {
    const span = stage.to - stage.from;
    return { index, floor: stage.from + (share.finished / share.parts) * span, ceiling: stage.from + (Math.min(share.finished + 1, share.parts) / share.parts) * span - 1 };
  }
  return { index, floor: stage.from, ceiling: Math.max(stage.from, stage.to - 1) };
}

// Parts finished out of all parts. The questions read reports its first step
// as done 1, so its parts start after it; the organization read counts from 0.
function partShare(questions: boolean, progress: ProgressInfo | null) {
  if (!progress || progress.total <= 1) return null;
  const parts = questions ? progress.total - 1 : progress.total;
  return { parts, finished: Math.min(Math.max(questions ? progress.done - 1 : progress.done, 0), parts) };
}

export default function ProgressCard({ mode, phase = "structure", progress, uploading = false }: { mode: Mode; phase?: "structure" | "questions"; progress: ProgressInfo | null; uploading?: boolean }) {
  const questions = phase === "questions";
  const stages: Stage[] = questions ? QUESTION_STAGES : READING_STAGES;
  const { index, floor, ceiling } = windowFor(mode, stages, questions, progress, uploading);
  const [value, setValue] = useState(floor);
  useEffect(() => {
    setValue(current => Math.max(current, floor));
    const timer = window.setInterval(() => setValue(current => {
      const base = Math.max(current, floor);
      return base >= ceiling ? base : base + Math.max(0.05, (ceiling - base) * 0.035);
    }), 400);
    return () => window.clearInterval(timer);
  }, [floor, ceiling]);
  const percent = Math.min(99, Math.round(value));
  const share = mode === "reading" && stages[index]?.parts ? partShare(questions, progress) : null;
  const questionPart = share ? ` · ${share.finished}/${share.parts}` : "";
  // The server double-checks rows the first read did not return.
  const checking = mode === "reading" && questions && /missed/i.test(progress?.stage || "");
  const title = mode === "reading" ? (checking ? "Double-checking questions" : stages[index].label) : SIMPLE[mode];

  return <section role="status" aria-live="polite" className="overflow-hidden rounded-3xl border border-white/[.08] bg-white/[.03] p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-500/15" aria-hidden><Loader2 size={19} className="animate-spin text-secondary-300" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}<span className="font-normal text-gray-400">{questionPart}</span></p>
          <p className="mt-0.5 text-xs leading-5 text-gray-400">{mode === "reading"
            ? uploading ? "Keep this page open." : "Big sheets take a few minutes. Safe to refresh."
            : "A few seconds."}</p>
        </div>
      </div>
      <span className="shrink-0 text-2xl font-bold tabular-nums text-secondary-200" aria-hidden>{percent}%</span>
    </div>
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.07]" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <div className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-primary-400 transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
    </div>
    {mode === "reading" && <ol className="mt-5 space-y-2.5">
      {stages.map((stage, i) => <li key={stage.label} className={`flex items-center gap-3 text-sm ${i < index ? "text-gray-300" : i === index ? "font-semibold text-white" : "text-gray-500"}`}>
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${i < index ? "border-primary-400 bg-primary-400 text-primary-950" : i === index ? "border-secondary-300" : "border-white/15"}`} aria-hidden>
          {i < index ? <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ duration: 0.2, ease: EASE }}><Check size={12} strokeWidth={3} /></motion.span> : i === index ? <Loader2 size={11} className="animate-spin text-secondary-300" /> : null}
        </span>
        <span className="leading-tight">{stage.label}<span className="sr-only">{i < index ? " (done)" : i === index ? " (in progress)" : ""}</span></span>
      </li>)}
    </ol>}
  </section>;
}
