"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, ShieldAlert, Trash2, X } from "lucide-react";

interface CriticalDeleteModalProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  description: string;
  consequences: string[];
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void | Promise<void>;
}

export default function CriticalDeleteModal({
  isOpen,
  title,
  itemName,
  description,
  consequences,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: CriticalDeleteModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setShowPassword(false);
    }
  }, [isOpen, itemName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    void onConfirm(password);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close delete confirmation"
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={() => { if (!busy) onCancel(); }}
      />

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200 sm:zoom-in-95 sm:slide-in-from-bottom-0">
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-red-500/20 bg-[#11151d]/95 shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl"
        >
          <div className="h-[3px] bg-gradient-to-r from-red-600 via-red-400 to-orange-400" />
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/15">
                <ShieldAlert size={21} className="text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-white">{title}</h2>
                <p className="mt-1 truncate text-sm font-medium text-red-300">{itemName}</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-gray-300">{description}</p>
            <div className="mt-3 rounded-xl border border-red-500/15 bg-red-500/[0.06] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-300">This permanently removes</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-gray-400">
                {consequences.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-red-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-300">
                <LockKeyhole size={13} className="text-red-300" />
                Confirm with your admin password
              </span>
              <div className="relative">
                <input
                  autoFocus
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 pr-11 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-red-400/50 focus:ring-2 focus:ring-red-500/10 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={busy}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 transition hover:text-gray-200 disabled:opacity-50"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-gray-300 transition hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep record
              </button>
              <button
                type="submit"
                disabled={!password || busy}
                className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Trash2 size={15} />
                )}
                {busy ? "Deleting..." : confirmLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
