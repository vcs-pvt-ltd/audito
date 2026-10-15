"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Check, History, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui";
import logo from "@/assets/logo/audito_logo.png";
import type { JourneyItem } from "./journey";
import { EASE, rise, stagger } from "./motion";

// The onboarding welcome page: what setup involves, the journey ahead, and one
// clear action to start or continue. Rendered as a page, not as a dialog.
export default function OnboardingWelcome({
  busy, checking, heading, description, items, variant, progress,
  primaryLabel, secondaryLabel, onStart, onSkip,
}: {
  busy: boolean;
  /** Saved progress is still being loaded; the start action waits for it. */
  checking?: boolean;
  heading: string;
  description: string;
  items: JourneyItem[];
  /** "journey" shows setup steps with their status; "tips" shows what a role can do. */
  variant: "journey" | "tips";
  progress?: { done: number; total: number };
  primaryLabel: string;
  secondaryLabel?: string;
  onStart: () => void;
  onSkip?: () => void;
}) {
  const journey = variant === "journey";
  const percent = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <motion.section aria-labelledby="onboarding-title" className="relative mx-auto w-full max-w-6xl" initial="initial" animate="animate" variants={stagger(0.06)}>
      <div aria-hidden className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary-500/[.08] blur-[100px]" />

      <motion.div variants={rise} className="relative mb-10 flex items-center justify-between gap-4 sm:mb-14">
        <Image src={logo} alt="Audito" width={120} height={36} className="h-8 w-auto object-contain" priority />
        {journey && <span className="rounded-full border border-white/[.08] bg-white/[.03] px-3 py-1.5 text-xs text-gray-400">Setup guide</span>}
      </motion.div>

      <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <motion.p variants={rise} className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-secondary-300">
            {progress && progress.done > 0 ? "Setup in progress" : "Let’s get started"}
          </motion.p>
          <motion.h1 variants={rise} id="onboarding-title" className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">{heading}</motion.h1>
          <motion.p variants={rise} className="mt-5 max-w-md text-base leading-7 text-gray-300 sm:text-lg sm:leading-8">{description}</motion.p>

          {progress && progress.done > 0 && (
            <motion.div variants={rise} className="mt-7 max-w-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-white">{progress.done} of {progress.total} steps done</span>
                <span className="tabular-nums text-gray-400">{percent}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <motion.div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-300" initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.6, ease: EASE, delay: 0.2 }} />
              </div>
            </motion.div>
          )}

          <motion.div variants={rise} className="mt-8 flex max-w-sm flex-col items-stretch gap-2 sm:mt-10">
            <Button disabled={busy || checking} loading={busy || checking} rightIcon={<ArrowRight size={18} />} onClick={onStart} className="min-h-13 rounded-2xl text-base">
              {checking ? "Checking your progress…" : busy ? "Please wait…" : primaryLabel}
            </Button>
            {secondaryLabel && onSkip && <Button variant="ghost" disabled={busy} onClick={onSkip} className="min-h-11 text-sm">{secondaryLabel}</Button>}
          </motion.div>

          {journey && (
            <motion.p variants={rise} className="mt-5 flex max-w-sm items-start gap-2 text-xs leading-5 text-gray-400">
              <History size={15} className="mt-0.5 shrink-0 text-secondary-300" aria-hidden />
              Your progress is saved as you go. You can stop and come back to setup at any time.
            </motion.p>
          )}
        </div>

        <motion.div variants={rise} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-surface-light via-surface to-surface-dark p-5 shadow-2xl shadow-black/20 sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full border border-secondary-300/10" />
          <div className="relative mb-6">
            <h2 className="text-base font-semibold text-white">{journey ? "Your setup journey" : "Everything you need to begin"}</h2>
            <p className="mt-1 text-sm text-gray-400">{journey ? `${items.length} steps. We guide you through each one.` : "A quick look at your workspace."}</p>
          </div>

          <motion.ol className="relative" variants={stagger(0.05)}>
            {items.map((item, index) => {
              const done = item.state === "done";
              const next = item.state === "next";
              const last = index === items.length - 1;
              return (
                <motion.li key={item.key} variants={rise} className="relative flex gap-4 pb-5 last:pb-0" aria-current={next ? "step" : undefined}>
                  {!last && <span aria-hidden className={`absolute left-[19px] top-11 bottom-1 w-px ${done ? "bg-primary-400/50" : "bg-white/10"}`} />}
                  <span aria-hidden className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-primary-400 text-primary-950" : next ? "bg-secondary-400 text-primary-950 ring-4 ring-secondary-400/15" : "border border-white/15 text-gray-300"}`}>
                    {done ? <Check size={18} strokeWidth={3} /> : index + 1}
                  </span>
                  <div className={`min-w-0 flex-1 rounded-2xl px-4 py-3 ${next ? "border border-secondary-400/25 bg-secondary-400/[.06]" : "border border-transparent"}`}>
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold sm:text-base ${done ? "text-gray-300" : "text-white"}`}>{item.title}</span>
                      {item.optional && <span className="rounded-full bg-white/[.06] px-2 py-0.5 text-[11px] text-gray-400">Optional</span>}
                      {journey && done && <span className="rounded-full bg-primary-400/15 px-2 py-0.5 text-[11px] font-semibold text-primary-200">Done</span>}
                      {journey && next && <span className="rounded-full bg-secondary-400/15 px-2 py-0.5 text-[11px] font-semibold text-secondary-200">Up next</span>}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-gray-400">{item.description}</p>
                    {journey && done && <span className="sr-only">Completed</span>}
                  </div>
                </motion.li>
              );
            })}
          </motion.ol>

          <p className="relative mt-6 flex items-start gap-2 border-t border-white/[.07] pt-5 text-xs leading-5 text-gray-400">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-secondary-300" aria-hidden />
            {journey ? "You check AI suggestions before anything is saved to your organization." : "What you can see is based on your role and assigned areas."}
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}
