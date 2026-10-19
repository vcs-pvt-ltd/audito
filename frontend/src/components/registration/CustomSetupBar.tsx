import Link from "next/link";
import { focusRing } from "./ui";

/** `fixedBarBelow`: leave room for the phone-only fixed Continue bar. */
export default function CustomSetupBar({ href, fixedBarBelow = true, className = "" }: { href: string; fixedBarBelow?: boolean; className?: string }) {
  return <footer className={`shrink-0 border-t border-white/8 px-4 py-3 sm:px-6 md:pb-3 lg:px-10 ${fixedBarBelow ? "pb-24" : ""} ${className}`}>
    <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ws-soft"><strong className="text-ws-ink">Need something custom?</strong> A different structure, more than 5,000 questions or a special setup: we will tailor it.</p>
      <Link href={href} className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] border border-ws-gold px-4 text-sm font-bold text-ws-gold transition-colors hover:bg-ws-gold/10 ${focusRing}`}>Contact our team</Link>
    </div>
  </footer>;
}
