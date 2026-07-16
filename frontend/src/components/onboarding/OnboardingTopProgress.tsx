"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import logo from "@/assets/images/audito-logo-white.png";

export default function OnboardingTopProgress() {
  const { progressPct, currentStep, steps, isActive } = useOnboarding();
  if (!isActive) return null;

  const percent = Math.max(0, Math.min(100, progressPct));

  return (
    <header className="relative z-10 shrink-0 border-b border-white/10 bg-[#062117]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center gap-3 sm:gap-5">
        <Image src={logo} alt="Audito" width={86} height={26} className="hidden h-6 w-auto object-contain sm:block" priority />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] sm:text-xs">
            <span className="truncate font-semibold text-gray-200">Workspace setup</span>
            <span className="shrink-0 font-medium text-secondary-300">Step {Math.min(currentStep + 1, steps.length)} of {steps.length}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-label={`${percent}% complete`}>
            <div className="h-full rounded-full bg-gradient-to-r from-secondary-600 via-secondary-400 to-emerald-300 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="hidden items-center gap-1.5 text-xs font-semibold text-emerald-200 sm:flex">
          <CheckCircle2 size={15} /> {percent}%
        </div>
      </div>
    </header>
  );
}
