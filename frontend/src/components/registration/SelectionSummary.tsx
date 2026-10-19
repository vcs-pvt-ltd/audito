import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import type { PackageQuote } from "@/lib/pricing/calculatePackage";
import { formatMoney } from "@/lib/registration/workspaceOptions";
import { Panel, Skeleton, focusRing } from "./ui";

const primaryButton = `flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ws-gold px-4 font-bold text-ws-gold-ink transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const cost = (amount: number) => amount === 0 ? <span className="text-ws-mint-soft">Free</span> : formatMoney(amount);
const count = (amount: number) => amount.toLocaleString("en-US");

type Props = {
  title: string;
  subtitle: string;
  onContinue: () => void;
} & ({
  mode: "company";
  planName: string;
  /** null while prices load. */
  quote: PackageQuote | null;
  pricingError: string;
  onRetry: () => void;
} | { mode: "review" });

/** Selection, price and Continue. On phones the Continue button moves to the sticky bottom bar. */
export default function SelectionSummary(props: Props) {
  const { title, subtitle, onContinue } = props;
  const quote = props.mode === "company" ? props.quote : null;

  return <Panel label="Your selection" highlight className="md:col-span-2 desk:col-span-1">
    <h3 className="text-xl font-bold leading-tight text-ws-ink">{title}</h3>
    <p className="mt-1 text-xs leading-snug text-ws-soft">{subtitle}</p>

    {props.mode === "company" ? <>
      {props.pricingError ? <div role="alert" className="mt-4 rounded-[10px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
        {props.pricingError}
        <button type="button" onClick={props.onRetry} className={`mt-2 flex min-h-9 items-center gap-1.5 font-bold text-white underline ${focusRing}`}><RefreshCw size={14} aria-hidden /> Retry</button>
      </div> : <>
        <p className="mt-3 flex items-baseline gap-2" aria-live="polite" aria-atomic>
          {quote ? <span className={`text-[40px] font-extrabold leading-none tracking-tight tabular-nums ${quote.total === 0 ? "text-ws-mint-soft" : "text-ws-ink"}`}>{quote.total === 0 ? "Free" : formatMoney(quote.total)}</span> : <><Skeleton className="h-10 w-24" /><span className="sr-only">Loading price</span></>}
          <span className="text-sm text-ws-soft">total, USD</span>
        </p>
        <div className="mt-3 rounded-[10px] bg-ws-mint/12 px-3 py-2.5">
          <p className="text-lg font-extrabold text-ws-mint-soft">{quote ? `${count(quote.credits)} audit credits` : <Skeleton className="h-5 w-36" />}</p>
          <p className="text-xs text-ws-soft">{quote && quote.bonusCredits > 0
            ? `${count(quote.lines)} for questions + ${count(quote.bonusCredits)} bonus from your plan and departments`
            : quote && quote.freeLines > 0 ? `${count(quote.freeLines)} free with ${props.planName} · 1 credit = 1 audit question` : "1 credit = 1 audit question"}</p>
        </div>
        <dl className="mt-3 space-y-1 text-[13px] text-ws-soft">
          {[
            [`${props.planName} (levels 1–${quote?.levels ?? "…"})`, quote && cost(quote.levelFee)],
            [`${quote ? count(quote.departments) : "…"} departments`, quote && cost(quote.deptFee)],
            [`${quote ? count(quote.lines) : "…"} audit questions${quote && quote.freeLines > 0 ? ` (${count(quote.freeLines)} free)` : ""}`, quote && cost(quote.questionsCost)],
          ].map(([label, value], index) => <div key={index} className="flex justify-between gap-3">
            <dt>{label}</dt><dd className="font-bold text-ws-ink tabular-nums">{value ?? <Skeleton className="h-3.5 w-10" />}</dd>
          </div>)}
        </dl>
      </>}
    </> : <p className="mt-4 rounded-[10px] bg-ws-raised px-3 py-2.5 text-sm text-ws-soft">No payment now. Pricing is agreed with our team after review.</p>}

    <div className="mt-auto hidden pt-4 md:block">
      <button type="button" onClick={onContinue} disabled={props.mode === "company" && !quote} className={`${primaryButton} w-full`}>
        {props.mode === "company" ? quote ? `Continue · ${quote.total === 0 ? "Free" : formatMoney(quote.total)}` : "Continue" : "Continue to request"}
      </button>
      <p className="mt-2 text-center text-xs text-ws-soft">Next: your company and contact details</p>
    </div>
  </Panel>;
}

/** Phone-only sticky bar with the total and Continue. */
export function MobileContinueBar({ position = "fixed", total, review, disabled, onContinue }: { position?: "fixed" | "sticky"; total: number | null; review: boolean; disabled: boolean; onContinue: () => void }) {
  // A fixed bar inside a backdrop-filter container (e.g. .glass) would be fixed to that container,
  // so it is portalled to <body>.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const placement = position === "fixed" ? "fixed inset-x-0 bottom-0" : "sticky bottom-0 -mx-4 mt-4 rounded-t-xl";
  const bar = <div className={`${placement} z-30 flex items-center gap-3 border-t border-white/8 bg-ws-panel/95 px-4 py-3 text-ws-ink backdrop-blur md:hidden`}>
    <div className="min-w-0 flex-1">
      {review ? <p className="text-xs text-ws-soft">No payment now</p> : <>
        <p className="text-xs text-ws-soft">Total, USD</p>
        <p className="text-xl font-extrabold tabular-nums text-ws-ink">{total === null ? <Skeleton className="h-5 w-16" /> : total === 0 ? "Free" : formatMoney(total)}</p>
      </>}
    </div>
    <button type="button" onClick={onContinue} disabled={disabled} className={`${primaryButton} shrink-0 px-5`}>
      {review ? "Continue to request" : "Continue"} <ArrowRight size={16} aria-hidden />
    </button>
  </div>;
  if (position === "sticky") return bar;
  return mounted ? createPortal(bar, document.body) : null;
}
