"use client";

import React from "react";
import Image from "next/image";
import { ArrowRight, CheckCircle2, Compass, ShieldCheck, SkipForward, Sparkles } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";

export default function OnboardingWelcomeModal({
  open,
  busy,
  heading,
  description,
  notes,
  progressText,
  primaryLabel,
  secondaryLabel,
  showSkip,
  onStart,
  onSkip,
}: {
  open: boolean;
  busy: boolean;
  heading: string;
  description: string;
  notes: string[];
  progressText?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  showSkip?: boolean;
  onStart: () => void;
  onSkip: () => void;
}) {
  if (!open) return null;

  const showSkipButton = Boolean(showSkip && secondaryLabel);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#083021]/85 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-8 lg:p-10" aria-labelledby="onboarding-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_5%,rgba(217,163,70,0.2),transparent_28%),radial-gradient(circle_at_5%_100%,rgba(0,169,103,0.18),transparent_34%)]" />
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/3 -translate-y-1/3 rounded-full border border-secondary-400/15" />

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
        <div>
          <div className="mb-7 flex items-center justify-between gap-4">
            <Image src={logo} alt="Audito" width={108} height={30} className="h-7 w-auto object-contain sm:h-8" priority />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary-400/25 bg-secondary-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-secondary-300">
              <Sparkles size={12} /> Guided setup
            </span>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-300">Your workspace, ready your way</p>
          <h1 id="onboarding-title" className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {heading}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base sm:leading-7">
            {description}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {notes.map((note, index) => (
              <div key={note} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-500/15 text-xs font-bold text-secondary-300">
                  {index + 1}
                </span>
                <p className="text-sm leading-5 text-gray-200">{note}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button onClick={onStart} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-300 to-secondary-500 px-5 py-3 text-sm font-bold text-primary-950 shadow-lg shadow-secondary-950/25 transition hover:from-secondary-200 hover:to-secondary-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {busy ? "Starting setup..." : primaryLabel}
              <ArrowRight size={17} />
            </button>
            {showSkipButton && (
              <button onClick={onSkip} disabled={busy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/12 px-5 py-3 text-sm font-semibold text-gray-300 transition hover:border-white/25 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                <SkipForward size={16} /> {secondaryLabel}
              </button>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/15 p-5 lg:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <Compass size={20} />
          </div>
          <h2 className="mt-5 text-base font-semibold text-white">A clear path forward</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">Complete each practical step at your own pace. Your progress is saved as you go.</p>
          <div className="mt-5 border-t border-white/10 pt-4">
            {progressText ? (
              <div className="flex items-center gap-2 text-xs text-emerald-200"><CheckCircle2 size={15} /> {progressText}</div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-400"><ShieldCheck size={15} className="text-secondary-300" /> You can return to setup any time.</div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
