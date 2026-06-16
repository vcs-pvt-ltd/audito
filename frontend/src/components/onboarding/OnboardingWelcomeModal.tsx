"use client";

import React from "react";
import { ArrowRight, CheckCircle2, SkipForward, Sparkles, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";
import Image from "next/image";


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
  const showSkipButton = showSkip && secondaryLabel;
  if (!open) return null;
  return (
    <div className="glass rounded-3xl border border-white/10 p-8 md:p-12 relative overflow-hidden group animate-in zoom-in-95 fade-in duration-700 shadow-2xl">
      {/* Dynamic background accents */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary-500/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-secondary-500/10 transition-all duration-1000" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -ml-32 -mb-32 group-hover:bg-emerald-500/10 transition-all duration-1000" />

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex  mx-auto justify-center items-center">
            <Image src={logo} alt="Audito Logo" width={120} className="object-contain" />
          </div>
        </div>

        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.1]">
          {heading}
        </h1>
        <p className="text-lg text-gray-400 mt-6 max-w-2xl leading-relaxed">
          {description}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {notes.map((note, idx) => (
            <div key={idx} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
              {note}
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col md:flex-row items-center gap-6">
          <button
            onClick={onStart}
            disabled={busy}
            className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-lg font-bold bg-secondary-500 text-primary-950 hover:bg-secondary-400 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-secondary-500/20"
          >
            {busy ? "Starting..." : primaryLabel}
            <ArrowRight size={20} />
          </button>
          
          {showSkipButton ? (
            <button
              onClick={onSkip}
              disabled={busy}
              className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-lg font-bold border border-white/10 text-gray-400 hover:text-white hover:border-white/20 active:scale-95 transition-all"
            >
              <SkipForward size={20} />
              {secondaryLabel}
            </button>
          ) : null}
        </div>

        {progressText ? (
          <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-white/5 pt-8">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 size={14} className="text-emerald-400" />
              </div>
              <span className="font-medium">{progressText}</span>
            </div>
            <div className="flex -space-x-3 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-primary-950 bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
              Trusted by Enterprise Teams
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
