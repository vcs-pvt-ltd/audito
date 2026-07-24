"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep diagnostic information available to developers without exposing
    // technical details to end users.
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#053B36] p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
          <AlertTriangle size={26} />
        </div>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">Page unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">We couldn&apos;t load this page</h1>
        <p className="mt-3 text-sm leading-6 text-gray-300">
          Please try again. If the issue continues, return to your dashboard or contact the Audito team for help.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-secondary-500 px-4 py-3 text-sm font-semibold text-primary-950 transition-colors hover:bg-secondary-400"
          >
            <RefreshCw size={16} /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
          >
            <Home size={16} /> Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
