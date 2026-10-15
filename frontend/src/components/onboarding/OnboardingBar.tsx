"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, CircleAlert, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui";
import { useOnboarding } from "@/context/OnboardingContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import logo from "@/assets/images/audito-logo-white.png";
import { blockedReason } from "./journey";
import { EASE, notice } from "./motion";

// Compact names for the desktop stepper, so every step fits on one line.
const SHORT_TITLES: Record<string, string> = {
  entities: "Entities",
  "organization-setup": "Organization",
  auditors: "Auditors",
  "organization-users": "Org users",
  checklists: "Checklist",
  audits: "First audit",
};

/**
 * Overall setup progress: a filling bar with a percentage that counts up when
 * a step is completed. A short glow marks each increase.
 */
function ProgressMeter({ percent, done, total, size = "md" }: { percent: number; done: number; total: number; size?: "sm" | "md" }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(percent);
  const label = useTransform(value, v => `${Math.round(v)}%`);
  const [gained, setGained] = useState(0);
  useEffect(() => {
    const from = value.get();
    if (percent > from) setGained(key => key + 1);
    const controls = animate(value, percent, { duration: reduce ? 0 : 0.8, ease: EASE });
    return () => controls.stop();
  }, [percent, reduce, value]);
  const complete = percent >= 100;
  const small = size === "sm";

  return <div className="min-w-0" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% complete, ${done} of ${total} steps done`}>
    {!small && <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="truncate whitespace-nowrap text-[11px] font-medium uppercase tracking-[.14em] text-gray-400">{complete ? "Ready to finish" : <><span className="hidden xl:inline">Setup </span>progress</>}</span>
      <motion.span className={`text-sm font-bold tabular-nums ${complete ? "text-primary-300" : "text-secondary-200"}`} aria-hidden>{label}</motion.span>
    </div>}
    <div className="flex items-center gap-2">
      <div className={`relative flex-1 overflow-hidden rounded-full bg-white/[.08] ring-1 ring-inset ring-white/[.04] ${small ? "h-1.5" : "h-2"}`}>
        <motion.div className={`absolute inset-y-0 left-0 overflow-hidden rounded-full bg-gradient-to-r ${complete ? "from-primary-500 to-primary-300" : "from-primary-500 via-primary-400 to-secondary-400"}`}
          initial={false} animate={{ width: `${Math.max(percent, 3)}%` }} transition={{ duration: reduce ? 0 : 0.8, ease: EASE }}>
          <span aria-hidden className="onboarding-progress-shine absolute inset-0" />
        </motion.div>
        {gained > 0 && <motion.span key={gained} aria-hidden className="absolute inset-y-0 rounded-full bg-secondary-200/60 blur-[3px]"
          style={{ left: `calc(${Math.max(percent, 3)}% - 14px)`, width: 14 }}
          initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.5 }} />}
      </div>
      {small && <motion.span className={`w-9 shrink-0 text-right text-xs font-bold tabular-nums ${complete ? "text-primary-300" : "text-secondary-200"}`} aria-hidden>{label}</motion.span>}
    </div>
  </div>;
}

function useSkip() {
  const { confirm } = useUiFeedback();
  const { skipOnboarding } = useOnboarding();
  return async () => {
    const approved = await confirm({
      title: "Skip setup for now?",
      message: "Your progress is kept. You can resume setup from your dashboard.",
      confirmText: "Skip setup",
      cancelText: "Keep going",
      variant: "warning",
    });
    if (approved) await skipOnboarding();
  };
}

// Where the current step stands, shared by the bar and the step guide.
function useStepStatus() {
  const onboarding = useOnboarding();
  const pathname = usePathname();
  const type = useSearchParams().get("type");
  const { steps, currentStep, allDone, canGoNext, entityOrder } = onboarding;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const entityIndex = step?.key === "entities" ? entityOrder.findIndex(item => item.slug === type) : -1;
  const reason = !allDone && !canGoNext
    ? blockedReason(step, { pathname, isLastEntityType: entityIndex === entityOrder.length - 1, isLastStep })
    : "";
  const next = steps[currentStep + 1];
  return {
    ...onboarding, step, isLastStep, reason, next,
    entity: entityIndex >= 0 ? { index: entityIndex, total: entityOrder.length, label: entityOrder[entityIndex].label, next: entityOrder[entityIndex + 1]?.label } : null,
  };
}

/**
 * The onboarding header. "full" carries the journey progress and the Back /
 * Continue actions. "compact" is for screens with their own stepper (AI setup),
 * so each screen shows only one progress indicator.
 */
export default function OnboardingBar({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { steps, currentStep, allDone, busy, canGoBack, canGoNext, canEnterStep, goBack, goNext, goToStep, completeOnboarding, step, reason } = useStepStatus();
  const skip = useSkip();
  if (!step) return null;
  const doneCount = steps.filter(item => item.state === "done").length;
  // Optional steps never hold setup back, so the bar is full once Finish is available.
  const percent = allDone ? 100 : Math.round((doneCount / Math.max(steps.length, 1)) * 100);

  if (variant === "compact") {
    return <header className="relative z-30 shrink-0 border-b border-white/[.06] bg-surface-dark/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Image src={logo} alt="Audito" width={86} height={26} className="h-6 w-auto object-contain" priority />
        <span className="hidden h-5 w-px bg-white/10 sm:block" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-xs text-gray-400 sm:text-sm">
          <span className="text-gray-500">Setup step {currentStep + 1} of {steps.length}</span>
          <span className="hidden sm:inline"> · <span className="font-medium text-gray-200">{step.title}</span></span>
        </p>
        <div className="hidden w-36 sm:block"><ProgressMeter size="sm" percent={percent} done={doneCount} total={steps.length} /></div>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void skip()}>Skip for now</Button>
      </div>
    </header>;
  }

  const next = allDone
    ? <Button size="sm" leftIcon={<CheckCircle2 size={15} />} disabled={busy} onClick={() => void completeOnboarding()} className="min-h-10">Finish setup</Button>
    : <Button size="sm" rightIcon={<ArrowRight size={15} />} disabled={!canGoNext} aria-describedby={reason ? "onboarding-next-reason" : undefined} onClick={goNext} className="min-h-10">Continue</Button>;

  return <header className="relative z-30 shrink-0 border-b border-white/[.06] bg-surface-dark/85 backdrop-blur-xl">
    {reason && <span id="onboarding-next-reason" className="sr-only">{reason}</span>}
    {/* Desktop */}
    <div className="mx-auto hidden h-[72px] max-w-[1440px] items-center gap-5 px-6 lg:flex xl:gap-6 xl:px-8">
      <Image src={logo} alt="Audito" width={86} height={26} className="h-6 w-auto object-contain" priority />
      <span className="h-8 w-px shrink-0 bg-white/10" aria-hidden />
      <div className="w-32 shrink-0 xl:w-48"><ProgressMeter percent={percent} done={doneCount} total={steps.length} /></div>
      {/* The stepper only uses the space left between the meter and the actions:
          connectors shrink first, and other steps' names appear only when the
          whole row fits (more steps need more room). */}
      <nav aria-label="Setup steps" className="@container flex min-w-0 flex-1 items-center justify-center">
        <ol className="flex min-w-0 max-w-full items-center gap-1">
          {steps.map((item, index) => {
            const active = index === currentStep;
            const done = item.state === "done";
            return <li key={item.key} className="flex min-w-0 items-center gap-1">
              {index > 0 && <span className="relative h-px w-8 min-w-1 shrink overflow-hidden bg-white/10" aria-hidden>
                <motion.span className="absolute inset-0 origin-left bg-primary-400/60" initial={false} animate={{ scaleX: steps[index - 1].state === "done" ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
              </span>}
              <button type="button" disabled={active || !canEnterStep(index)} onClick={() => goToStep(index)} aria-current={active ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${item.title}${done ? ", done" : ""}${item.optional ? ", optional" : ""}`} title={active ? undefined : item.title}
                className={`relative flex shrink-0 items-center gap-2 rounded-full py-1.5 text-sm transition-colors ${active ? "px-2.5 text-white" : `px-1 @2xl:px-2 ${done ? "text-gray-300 hover:bg-white/[.04]" : "text-gray-500 enabled:hover:bg-white/[.04]"}`} disabled:cursor-default`}>
                {active && <motion.span layoutId="onboarding-active-step" aria-hidden className="absolute inset-0 rounded-full border border-secondary-400/25 bg-secondary-400/[.08]" transition={{ duration: 0.35, ease: EASE }} />}
                <span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors ${done ? "bg-primary-400 text-primary-950" : active ? "bg-secondary-400 text-primary-950 shadow-[0_0_0_4px_rgba(229,178,70,.15)]" : "border border-white/15"}`}>
                  {done ? <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ duration: 0.2, ease: EASE }}><Check size={13} strokeWidth={3} /></motion.span> : index + 1}
                </span>
                <span className={`relative whitespace-nowrap ${active ? "font-semibold" : `hidden ${steps.length <= 4 ? "@2xl:inline" : steps.length === 5 ? "@4xl:inline" : "@5xl:inline"}`}`}>{SHORT_TITLES[item.key] || item.title}{item.optional ? <span className={`ml-1 hidden text-[11px] font-normal text-gray-500 ${steps.length <= 4 ? "@2xl:inline" : "@5xl:inline"}`}>(optional)</span> : null}</span>
              </button>
            </li>;
          })}
        </ol>
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void skip()}><span className="xl:hidden">Skip</span><span className="hidden xl:inline">Skip for now</span></Button>
        <Button size="sm" variant="secondary" aria-label="Back" leftIcon={<ArrowLeft size={15} />} disabled={!canGoBack} onClick={goBack} className="min-h-10"><span className="hidden xl:inline">Back</span></Button>
        {next}
      </div>
    </div>

    {/* Phones and tablets */}
    <div className="px-4 pb-3 pt-3 sm:px-6 lg:hidden">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" aria-label="Back" disabled={!canGoBack} onClick={goBack} className="!min-h-10 !px-2.5"><ArrowLeft size={16} /></Button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-gray-400">Step {currentStep + 1} of {steps.length}{step.optional ? " · optional" : ""}</p>
          <p className="truncate text-sm font-semibold text-white">{step.title}</p>
        </div>
        {next}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1"><ProgressMeter size="sm" percent={percent} done={doneCount} total={steps.length} /></div>
        <button type="button" disabled={busy} onClick={() => void skip()} className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50">Skip</button>
      </div>
    </div>
  </header>;
}

/**
 * What the current step is for, what is required, and what comes next.
 * It can be folded away; the choice is remembered per step.
 */
export function OnboardingHint() {
  const { step, allDone, reason, next, isLastStep, entity } = useStepStatus();
  const key = step ? `audito_onboarding_hint_folded:${step.key}` : "";
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    if (!key) return;
    try { setFolded(window.localStorage.getItem(key) === "1"); } catch { setFolded(false); }
  }, [key]);
  if (!step) return null;
  const toggle = () => {
    const value = !folded;
    setFolded(value);
    try { window.localStorage.setItem(key, value ? "1" : "0"); } catch { /* stays folded for this view */ }
  };
  const done = step.state === "done";
  const nextText = allDone && isLastStep ? "Next: finish setup" : next ? `Next: ${next.title}` : "Next: finish setup";
  const status = done
    ? { label: "Done", tone: "bg-primary-400/15 text-primary-200" }
    : step.optional ? { label: "Optional", tone: "bg-white/[.07] text-gray-300" } : { label: "Required", tone: "bg-secondary-400/15 text-secondary-200" };

  return <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
    <motion.section key={step.key} aria-label="About this step" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}
      className={`rounded-2xl border transition-colors ${done ? "border-primary-400/25 bg-primary-400/[.06]" : "border-secondary-400/15 bg-secondary-500/[.05]"}`}>
      <button type="button" onClick={toggle} aria-expanded={!folded} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${done ? "bg-primary-400/15 text-primary-300" : "bg-secondary-500/15 text-secondary-300"}`} aria-hidden>{done ? <CheckCircle2 size={16} /> : <Lightbulb size={16} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{entity ? `${step.title}: ${entity.label}` : step.title}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.tone}`}>{status.label}</span>
            {entity && <span className="text-[11px] text-gray-400">Type {entity.index + 1} of {entity.total}</span>}
          </span>
          {folded && <span className="mt-0.5 block truncate text-xs text-gray-400">{reason || nextText}</span>}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${folded ? "" : "rotate-180"}`} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {!folded && <motion.div variants={notice} initial="initial" animate="animate" exit="exit" className="overflow-hidden">
          <div className="grid gap-4 px-4 pb-4 sm:pl-[60px] md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-sm leading-6 text-gray-300">{done ? "This step is done. You can add more here, or continue when you are ready." : step.description}</p>
              {!done && step.instructions.length > 0 && <ol className="mt-2.5 space-y-1.5 text-sm text-gray-200">
                {step.instructions.map((line, index) => <li key={line} className="flex items-start gap-2"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold" aria-hidden>{index + 1}</span>{line}</li>)}
              </ol>}
            </div>
            <div className="space-y-2 self-end text-sm">
              {entity && entity.next && <p className="text-gray-400">Continue moves to <span className="text-gray-200">{entity.next}</span>. You can leave this type empty.</p>}
              <AnimatePresence initial={false}>
                {reason && <motion.p variants={notice} initial="initial" animate="animate" exit="exit" role="status" className="flex items-start gap-2 overflow-hidden text-amber-200"><CircleAlert size={15} className="mt-0.5 shrink-0" aria-hidden />{reason}</motion.p>}
              </AnimatePresence>
              <p className="flex items-center gap-1.5 text-gray-400"><ArrowRight size={14} aria-hidden />{entity?.next ? `Then: ${next?.title || "finish setup"}` : nextText}{next?.optional ? " (optional)" : ""}</p>
            </div>
          </div>
        </motion.div>}
      </AnimatePresence>
    </motion.section>
  </div>;
}
