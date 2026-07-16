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
import { useRouter } from "next/navigation";
import { useUiFeedback } from "@/context/UiFeedbackContext";

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

export default function OnboardingGuide() {
  const { admin } = useAuth();
  const { confirm } = useUiFeedback();
  const {
    steps, currentStep, allDone, goBack, goNext,
    canGoBack, canGoNext, busy, skipOnboarding, completeOnboarding,
  } = useOnboarding();

  const step = steps[currentStep];
  if (!step || !admin) return null;

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="glass rounded-2xl border border-white/10 p-6 relative overflow-hidden group shrink-0">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-secondary-500/10 rounded-full blur-3xl group-hover:bg-secondary-500/20 transition-all duration-700" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary-400 bg-secondary-400/10 px-2 py-1 rounded-md">
                Current Mission
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-tight">{step.title}</h1>
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">{step.description}</p>
            <div className="mt-6 space-y-3">
              {step.instructions.map((line, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-secondary-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] shrink-0" />
                  <span className="leading-snug">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">Journey Map</p>
          {steps.map((s, idx) => (
            <div
              key={s.key}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
                idx === currentStep ? "bg-white/5 border border-white/10" : "opacity-40"
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                s.state === "done" ? "bg-emerald-500 text-primary-950" : "bg-white/10 text-white"
              }`}>
                {s.state === "done" ? <Check size={14} /> : idx + 1}
              </div>
              <span className="text-xs font-medium text-white truncate">{s.title}</span>
              <span className="ml-auto shrink-0">
                <StepStatusBadge state={s.state} active={idx === currentStep && s.state !== "done"} />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="shrink-0 p-6 pt-4 border-t border-white/10 bg-primary-950/40 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-20"
          >
            <ArrowLeft size={14} /> PREV
          </button>
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-20"
          >
            NEXT <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/5">
          <button
            onClick={() => void handleSkip()}
            disabled={busy}
            className="text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-gray-400 transition-colors"
          >
            Skip Setup
          </button>
          <button
            onClick={() => void completeOnboarding()}
            disabled={!allDone || busy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-500 text-primary-950 hover:bg-emerald-400 disabled:opacity-20 transition-all shadow-lg shadow-emerald-500/10"
          >
            <CheckCircle2 size={14} /> FINISH
          </button>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
