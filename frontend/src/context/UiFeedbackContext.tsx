"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ToastType;
};

type AlertOptions = {
  title?: string;
  message: string;
  okText?: string;
  variant?: ToastType;
};

type UiFeedbackContextType = {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  toast: (message: string, type?: ToastType) => void;
};

const UiFeedbackContext = createContext<UiFeedbackContextType | null>(null);

type ModalState =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void }
  | null;

type ToastItem = { id: number; message: string; type: ToastType; exiting?: boolean };

// ─── Toast config ─────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, {
  icon: React.ReactNode;
  bar: string;
  bg: string;
  text: string;
  label: string;
}> = {
  success: {
    icon: <CheckCircle2 size={15} strokeWidth={2} />,
    bar: "bg-emerald-400",
    bg: "bg-[#0d1f17]/90 border-emerald-500/20",
    text: "text-emerald-300",
    label: "text-white",
  },
  error: {
    icon: <XCircle size={15} strokeWidth={2} />,
    bar: "bg-red-400",
    bg: "bg-[#1f0d0d]/90 border-red-500/20",
    text: "text-red-300",
    label: "text-white",
  },
  warning: {
    icon: <AlertTriangle size={15} strokeWidth={2} />,
    bar: "bg-amber-400",
    bg: "bg-[#1f1a0d]/90 border-amber-500/20",
    text: "text-amber-300",
    label: "text-white",
  },
  info: {
    icon: <Info size={15} strokeWidth={2} />,
    bar: "bg-blue-400",
    bg: "bg-[#0d1520]/90 border-blue-500/20",
    text: "text-blue-300",
    label: "text-white",
  },
};

// ─── Modal tone ───────────────────────────────────────────────────

function ModalIcon({ type }: { type: ToastType }) {
  const cls = "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0";
  if (type === "success") return <div className={`${cls} bg-emerald-500/15 border border-emerald-500/20`}><CheckCircle2 size={20} className="text-emerald-400" /></div>;
  if (type === "error") return <div className={`${cls} bg-red-500/15 border border-red-500/20`}><XCircle size={20} className="text-red-400" /></div>;
  if (type === "warning") return <div className={`${cls} bg-amber-500/15 border border-amber-500/20`}><AlertTriangle size={20} className="text-amber-400" /></div>;
  return <div className={`${cls} bg-blue-500/15 border border-blue-500/20`}><Info size={20} className="text-blue-400" /></div>;
}

// ─── Provider ─────────────────────────────────────────────────────

export function UiFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320);
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = idRef.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 3800);
  }, [dismissToast]);

  const confirm = useCallback((input: ConfirmOptions | string) => {
    const options: ConfirmOptions = typeof input === "string" ? { message: input } : input;
    return new Promise<boolean>(resolve => setModal({ kind: "confirm", options, resolve }));
  }, []);

  const alert = useCallback((input: AlertOptions | string) => {
    const options: AlertOptions = typeof input === "string" ? { message: input } : input;
    return new Promise<void>(resolve => setModal({ kind: "alert", options, resolve }));
  }, []);

  const value = useMemo(() => ({ confirm, alert, toast }), [confirm, alert, toast]);

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}

      {/* ── Confirm / Alert Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => {
              if (modal.kind === "confirm") modal.resolve(false);
              else modal.resolve();
              setModal(null);
            }}
          />
          <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Glass card */}
            <div className="glass border border-white/[0.12] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
              {/* Colored top accent line */}
              <div className={`h-[3px] w-full ${
                (modal.options.variant || "info") === "success" ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : (modal.options.variant || "info") === "error" ? "bg-gradient-to-r from-red-500 to-red-400"
                  : (modal.options.variant || "info") === "warning" ? "bg-gradient-to-r from-amber-500 to-amber-400"
                  : "bg-gradient-to-r from-blue-500 to-blue-400"
              }`} />

              <div className="p-5">
                <div className="flex items-start gap-4">
                  <ModalIcon type={modal.options.variant || "info"} />
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-sm font-semibold text-white leading-snug">
                      {modal.options.title || (modal.kind === "confirm" ? "Are you sure?" : "Notice")}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">{modal.options.message}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 justify-end">
                  {modal.kind === "confirm" ? (
                    <>
                      <button
                        onClick={() => { modal.resolve(false); setModal(null); }}
                        className="px-4 py-2 rounded-xl text-sm text-gray-400 border border-white/10 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
                      >
                        {modal.options.cancelText || "Cancel"}
                      </button>
                      <button
                        onClick={() => { modal.resolve(true); setModal(null); }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          (modal.options.variant || "info") === "error" || (modal.options.variant || "info") === "warning"
                            ? "bg-red-500 hover:bg-red-400 text-white"
                            : "bg-secondary-500 hover:bg-secondary-400 text-primary-950"
                        }`}
                      >
                        {modal.options.confirmText || "Confirm"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { modal.resolve(); setModal(null); }}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-secondary-500 hover:bg-secondary-400 text-primary-950 transition-all"
                    >
                      {modal.options.okText || "OK"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notifications — top center, Apple style ── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[210] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map(t => {
          const cfg = TOAST_CONFIG[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-300 ${cfg.bg} ${
                t.exiting
                  ? "opacity-0 -translate-y-1 scale-95"
                  : "opacity-100 translate-y-0 scale-100"
              }`}
              style={{ animation: t.exiting ? undefined : "toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}
            >
              {/* Coloured icon */}
              <span className={`shrink-0 ${cfg.text}`}>{cfg.icon}</span>

              {/* Message */}
              <p className={`flex-1 text-sm font-medium leading-snug ${cfg.label}`}>{t.message}</p>

              {/* Dismiss */}
              <button
                onClick={() => dismissToast(t.id)}
                className="shrink-0 p-0.5 rounded-lg text-gray-600 hover:text-gray-300 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback() {
  const ctx = useContext(UiFeedbackContext);
  if (!ctx) throw new Error("useUiFeedback must be used within UiFeedbackProvider");
  return ctx;
}