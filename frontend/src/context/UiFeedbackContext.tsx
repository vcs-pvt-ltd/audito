"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

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

type ToastItem = { id: number; message: string; type: ToastType };

function toneClasses(type: ToastType) {
  if (type === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (type === "error") return "border-red-500/30 bg-red-500/10 text-red-300";
  if (type === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-secondary-500/30 bg-secondary-500/10 text-secondary-300";
}

function ToneIcon({ type }: { type: ToastType }) {
  if (type === "success") return <CheckCircle2 size={16} className="text-emerald-400" />;
  if (type === "error") return <XCircle size={16} className="text-red-400" />;
  if (type === "warning") return <AlertTriangle size={16} className="text-amber-400" />;
  return <Info size={16} className="text-secondary-400" />;
}

export function UiFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const confirm = useCallback((input: ConfirmOptions | string) => {
    const options: ConfirmOptions = typeof input === "string" ? { message: input } : input;
    return new Promise<boolean>((resolve) => {
      setModal({ kind: "confirm", options, resolve });
    });
  }, []);

  const alert = useCallback((input: AlertOptions | string) => {
    const options: AlertOptions = typeof input === "string" ? { message: input } : input;
    return new Promise<void>((resolve) => {
      setModal({ kind: "alert", options, resolve });
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert, toast }), [confirm, alert, toast]);

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              if (modal.kind === "confirm") modal.resolve(false);
              else modal.resolve();
              setModal(null);
            }}
          />
          <div className="relative glass border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-start gap-3">
              <ToneIcon type={modal.options.variant || "info"} />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-white">{modal.options.title || (modal.kind === "confirm" ? "Please Confirm" : "Notice")}</h3>
                <p className="text-sm text-gray-300 mt-1">{modal.options.message}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              {modal.kind === "confirm" ? (
                <>
                  <button
                    onClick={() => {
                      modal.resolve(false);
                      setModal(null);
                    }}
                    className="px-3 py-2 rounded-lg text-xs border border-white/10 text-gray-300 hover:text-white hover:border-white/20"
                  >
                    {modal.options.cancelText || "Cancel"}
                  </button>
                  <button
                    onClick={() => {
                      modal.resolve(true);
                      setModal(null);
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400"
                  >
                    {modal.options.confirmText || "Confirm"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    modal.resolve();
                    setModal(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400"
                >
                  {modal.options.okText || "OK"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed right-4 top-4 z-[210] space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`min-w-[240px] max-w-[340px] px-3 py-2 rounded-lg border text-xs backdrop-blur-sm ${toneClasses(t.type)}`}>
            <div className="flex items-start gap-2">
              <ToneIcon type={t.type} />
              <p>{t.message}</p>
            </div>
          </div>
        ))}
      </div>
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback() {
  const ctx = useContext(UiFeedbackContext);
  if (!ctx) throw new Error("useUiFeedback must be used within UiFeedbackProvider");
  return ctx;
}

