"use client";

import React from "react";
import { X, ShieldAlert, ArrowUpCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  limit: number;
}

export default function LimitReachedModal({
  isOpen,
  onClose,
  title,
  message,
  limit,
}: LimitReachedModalProps) {
  const router = useRouter();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <div className="relative glass rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-red-500/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
              <p className="text-xs text-red-400/80 font-medium uppercase tracking-wider">Plan Limit Reached</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-300 text-sm leading-relaxed">
            {message} 
            <span className="block mt-2 font-semibold text-white">
              Maximum allowed: {limit}
            </span>
          </p>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary-500/20 flex items-center justify-center text-secondary-400 flex-shrink-0">
                <ArrowUpCircle size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Need more?</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Upgrade your subscription to the Elite plan to get unlimited access and higher quotas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-white transition-all font-medium"
          >
            Dismiss
          </button>
          <button
            onClick={() => {
              onClose();
              router.push("/settings/billing");
            }}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all shadow-lg shadow-secondary-500/20"
          >
            Upgrade Plan
          </button>
        </div>
      </div>
    </div>
  );
}
