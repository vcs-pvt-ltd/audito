"use client";

import React from "react";
import { CheckCircle2, Rocket, Sparkles } from "lucide-react";

export default function OnboardingCompletedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-primary-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="glass rounded-3xl border border-white/10 w-full max-w-md p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
        {/* Decorative background effects */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-6 mx-auto rotate-12 group-hover:rotate-0 transition-transform duration-500 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles size={16} className="text-secondary-400" />
            <h3 className="text-2xl font-bold text-white text-center tracking-tight">Mission Accomplished</h3>
            <Sparkles size={16} className="text-secondary-400" />
          </div>
          
          <p className="text-sm text-gray-400 mt-2 text-center leading-relaxed">
            Fantastic job! Your workspace is now fully configured and ready for action. You're set up for success.
          </p>
          
          <div className="mt-8 space-y-3">
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-base font-bold bg-secondary-500 text-primary-950 hover:bg-secondary-400 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-secondary-500/20"
            >
              <Rocket size={18} />
              Launch Dashboard
            </button>
            <p className="text-[10px] text-gray-600 text-center uppercase tracking-widest font-bold">
              Setup Complete • Audito
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
