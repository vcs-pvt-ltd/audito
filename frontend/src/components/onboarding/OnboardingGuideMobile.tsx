"use client";

import { ArrowLeft, Check, CheckCircle2, ChevronRight } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";

export default function OnboardingGuideMobile() {
  const { confirm } = useUiFeedback();
  const {
    steps, currentStep, progressPct, allDone, goBack, goNext,
    canGoBack, canGoNext, busy, skipOnboarding, completeOnboarding,
  } = useOnboarding();

  const step = steps[currentStep];
  if (!step) return null;

  const handleSkip = async () => {
    const approved = await confirm({
      title: "Skip onboarding?",
      message: "You can return to setup later from your workspace, but your remaining onboarding steps will be closed for now.",
      confirmText: "Skip setup",
      cancelText: "Continue setup",
      variant: "warning",
    });
    if (approved) await skipOnboarding();
  };

  return (
    <aside className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#062117]/[0.98] px-4 pt-3 shadow-[0_-18px_42px_rgba(0,0,0,0.3)] backdrop-blur-2xl" style={{ paddingBottom: "max(0.85rem, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto max-w-xl">
        <div className="mb-3 flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold ${step.state === "done" ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-200" : "border-secondary-400/25 bg-secondary-500/15 text-secondary-300"}`}>
            {step.state === "done" ? <Check size={16} /> : currentStep + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">Current step · {Math.round(progressPct)}% complete</p>
            <p className="truncate text-sm font-semibold text-white">{step.title}</p>
          </div>
          {step.state === "done" && <CheckCircle2 size={17} className="shrink-0 text-emerald-300" />}
        </div>

        <p className="mb-3 max-h-10 overflow-hidden text-xs leading-5 text-gray-400">{step.description}</p>

        <div className="mb-3 flex items-center gap-2">
          <button onClick={goBack} disabled={!canGoBack} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-semibold text-gray-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-35">
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={goNext} disabled={!canGoNext} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-secondary-400/25 bg-secondary-500/12 px-3 text-xs font-semibold text-secondary-200 transition hover:bg-secondary-500/20 disabled:cursor-not-allowed disabled:opacity-35">
            Next step <ChevronRight size={14} />
          </button>
          <button onClick={() => void completeOnboarding()} disabled={!allDone || busy} aria-label="Complete setup" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-400 px-3 text-primary-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-35">
            <CheckCircle2 size={16} />
          </button>
        </div>

        <button onClick={() => void handleSkip()} disabled={busy} className="w-full pb-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 transition hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50">Skip setup for now</button>
      </div>
    </aside>
  );
}
