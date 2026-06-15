"use client";

import React from "react";
import Image from "next/image";
import { useOnboarding } from "@/context/OnboardingContext";
import logo from '@/assets/images/audito-logo-white.png';


export default function OnboardingTopProgress() {
  const { progressPct, isActive } = useOnboarding();

  if (!isActive) return null;

  const pct = Math.max(0, Math.min(100, progressPct));
  const isComplete = pct >= 100;

  return (
    <div className="w-full bg-primary-950/40 backdrop-blur-md border-b border-white/5 py-3 overflow-hidden flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-1000 shrink-0">

      {/* Abstract Background Art */}
      <div className="absolute top-0 right-0 w-[500px] h-full pointer-events-none">
        <div className="absolute top-[-100%] right-[-10%] w-[400px] h-[400px] bg-secondary-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[15%] w-[100px] h-[100px] bg-secondary-500/5 rounded-full blur-[40px] animate-pulse" />
      </div>

      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Top Centered Logo Row */}
      <div className="relative z-20 flex items-center gap-2 px-3 py-1 rounded-full bg-primary-950/60 backdrop-blur-sm border border-secondary-500/20 shadow-[0_0_20px_rgba(251,191,36,0.15)]">
        <Image
          src={logo}
          alt="Company Logo"
          width={50}
          height={50}
          className="object-contain drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
          priority
        />
      </div>

      {/* Progress & Percentage Row */}
      <div className="w-full px-8 flex items-center gap-8 relative z-10 max-w-[1600px] mx-auto">
        {/* Percentage Core */}
        <div className="flex items-baseline gap-1 group shrink-0">
          <span className="text-2xl font-black text-white tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            {progressPct}
          </span>
          <span className="text-[10px] font-bold text-secondary-500 uppercase tracking-widest opacity-80">
            %
          </span>
        </div>

        {/* High-Fidelity Progress Engine */}
        <div className="flex-1 relative h-2 bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
          {/* Track Shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer" />

          {/* Main Progress Fill */}
          <div
            className="h-full bg-gradient-to-r from-secondary-600 via-secondary-400 to-secondary-300 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(251,191,36,0.3)] relative"
            style={{ width: `${progressPct}%` }}
          >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />

            {/* Traveling Light Pulse */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-pulse-flow" />
          </div>
        </div>

        {/* Artistic Endcap */}
        <div className="flex gap-1.5 opacity-30 shrink-0">
          <div className="w-0.5 h-3 bg-white/20 rounded-full" />
          <div className="w-0.5 h-3 bg-white/20 rounded-full" />
          <div className="w-0.5 h-3 bg-white/20 rounded-full" />
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse-flow {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 4s infinite linear;
        }
        .animate-pulse-flow {
          animation: pulse-flow 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}