import type { ReactNode } from "react";

export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ws-gold";

export function Panel({ label, aside, highlight = false, className = "", children }: { label: ReactNode; aside?: ReactNode; highlight?: boolean; className?: string; children: ReactNode }) {
  return <section className={`flex flex-col rounded-[14px] border bg-ws-panel p-4 ${highlight ? "border-ws-gold" : "border-white/8"} ${className}`}>
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-ws-gold">{label}</h2>
      {aside && <span className="text-xs text-ws-soft">{aside}</span>}
    </div>
    {children}
  </section>;
}

/** Placeholder shown while prices load. */
export function Skeleton({ className = "h-4 w-10" }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-pulse rounded-md bg-white/12 align-middle ${className}`} />;
}
