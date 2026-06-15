"use client";

import React from "react";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  RotateCw,
  Check,
} from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { useAuth } from "@/context/AuthContext";

function StepStatusBadge({ state, active }: { state: "done" | "pending"; active?: boolean }) {
  if (state === "done") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 whitespace-nowrap">
        <CheckCircle2 size={10} /> DONE
      </span>
    );
  }
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap transition-all ${
      active
        ? "text-secondary-400 bg-secondary-400/10 border-secondary-400/40 animate-pulse"
        : "text-amber-400 bg-amber-400/10 border-amber-400/20"
    }`}>
      {active ? <RotateCw size={10} className="animate-spin" /> : <Clock size={10} />}
      {active ? "ACTIVE" : "PENDING"}
    </span>
  );
}

export default function OnboardingGuideMobile() {
  const { admin } = useAuth();
  const {
    steps, currentStep, progressPct, allDone,
    goBack, goNext, canGoBack, canGoNext,
    busy, skipOnboarding, completeOnboarding,
  } = useOnboarding();

  const step = steps[currentStep];
  if (!step || !admin) return null;

  const doneCount = steps.filter((s) => s.state === "done").length;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-primary-950/95 backdrop-blur-xl shadow-2xl">
      {/* Progress bar */}
      <div className="h-0.5 bg-white/5">
        <div
          className="h-full bg-secondary-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Step header */}
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
            step.state === "done" ? "bg-emerald-500 text-primary-950" : "bg-secondary-500/20 text-secondary-400"
          }`}>
            {step.state === "done" ? <Check size={13} /> : currentStep + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold leading-none mb-0.5">
              Step {currentStep + 1}/{steps.length} · {doneCount} done
            </p>
            <p className="text-sm font-semibold text-white truncate">{step.title}</p>
          </div>
          <StepStatusBadge state={step.state} active={step.state !== "done"} />
        </div>

        {/* Description */}
        <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>

        {/* Instructions */}
        <div className="space-y-1.5">
          {step.instructions.map((line, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
              <div className="mt-1.5 h-1 w-1 rounded-full bg-secondary-400 shrink-0" />
              <span className="leading-snug">{line}</span>
            </div>
          ))}
        </div>

       

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-20"
          >
            <ArrowLeft size={13} /> Prev
          </button>
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-secondary-500/10 border border-secondary-500/30 text-secondary-400 hover:bg-secondary-500/20 transition-all disabled:opacity-20"
          >
            Next <ChevronRight size={13} />
          </button>
          <button
            onClick={() => void completeOnboarding()}
            disabled={!allDone || busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-emerald-500 text-primary-950 hover:bg-emerald-400 disabled:opacity-30 transition-all"
          >
            <CheckCircle2 size={13} /> Done
          </button>
        </div>

        {/* Skip */}
        <button
          onClick={() => void skipOnboarding()}
          className="w-full text-center text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors"
        >
          Skip Setup
        </button>
      </div>
    </div>
  );
}