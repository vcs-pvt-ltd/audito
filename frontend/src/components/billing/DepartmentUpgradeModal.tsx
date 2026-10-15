"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers3, Loader2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { tokenApi, type DepartmentUpgradeInfo } from "@/lib/api";

/** Where the payment page returns to after an upgrade is paid: { code, path }. */
export const PAYMENT_RETURN_KEY = "audito_payment_return";

/** The page to return to after paying `paymentCode`, if one was saved for it. */
export function paymentReturnPath(paymentCode: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PAYMENT_RETURN_KEY) || "null") as { code?: string; path?: string } | null;
    const path = saved?.code === paymentCode ? saved.path : null;
    return path && path.startsWith("/") && !path.startsWith("//") ? path : null;
  } catch { return null; }
}
const money = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Buy more departments for the workspace's package. */
export default function DepartmentUpgradeModal({ open, onClose, suggested, onApplied }: {
  open: boolean; onClose: () => void;
  /** Departments the user needs, e.g. the number in a setup draft. */
  suggested?: number;
  /** Called when the upgrade applied without payment (within the free departments). */
  onApplied?: () => void;
}) {
  const { accessToken } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [info, setInfo] = useState<DepartmentUpgradeInfo | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");
  const departments = Number(input);

  // Start at the needed number, or one more than the current limit.
  useEffect(() => {
    if (!open || !accessToken) return;
    setInfo(null); setError(""); setLoading(true);
    tokenApi.departmentUpgrade(accessToken).then(result => {
      if (!result.success || !result.data) { setError(result.message || "Could not load your departments."); setLoading(false); return; }
      setInput(String(Math.max(result.data.current + 1, suggested || 0)));
    });
  }, [open, accessToken, suggested]);

  // Price the chosen number.
  useEffect(() => {
    if (!open || !accessToken || !input) return;
    if (!Number.isSafeInteger(departments) || departments < 1) { setError("Enter a whole number."); return; }
    setLoading(true);
    const timer = window.setTimeout(() => {
      tokenApi.departmentUpgrade(accessToken, departments).then(result => {
        setLoading(false);
        if (result.success && result.data) { setInfo(result.data); setError(""); }
        else setError(result.message || "Could not price this number.");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, accessToken, input]); // departments follows input

  async function buy() {
    if (!accessToken || !info || error) return;
    setBuying(true);
    const result = await tokenApi.buyDepartments(accessToken, departments);
    setBuying(false);
    if (!result.success || !result.data) { setError(result.message || "Could not add departments."); return; }
    if (result.data.applied) {
      toast(`Your workspace now has ${result.data.departments} departments.`, "success");
      onApplied?.(); onClose(); return;
    }
    const code = result.data.payment!.payment_code;
    try { sessionStorage.setItem(PAYMENT_RETURN_KEY, JSON.stringify({ code, path: `${window.location.pathname}${window.location.search}` })); } catch { /* billing is the fallback */ }
    router.push(`/payment?code=${encodeURIComponent(code)}`);
  }

  const quote = info && !error && info.quote.departments === departments ? info.quote : null;
  return <Modal open={open} onClose={onClose} size="md" title="Add departments"
    icon={<span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary-500/10 text-secondary-300"><Layers3 size={18} /></span>}
    description={info ? `Your package has ${info.current} departments · ${info.used} in use` : "Your package"}
    footer={<>
      <Button variant="secondary" onClick={onClose} disabled={buying}>Cancel</Button>
      <Button rightIcon={<ArrowRight size={15} />} loading={buying} disabled={!quote || loading || buying} onClick={() => void buy()}>
        {quote && quote.total_price <= 0 ? "Add departments" : "Continue to payment"}
      </Button>
    </>}>
    <div className="space-y-4">
      <label className="block text-sm text-gray-300">Departments you need
        <input type="number" min={(info?.current || 0) + 1} max={10000} step={1} inputMode="numeric" autoFocus value={input} onChange={event => setInput(event.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/[.18] px-3 py-2.5 text-lg font-semibold text-white outline-none focus:border-secondary-400/50" />
      </label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="rounded-xl border border-white/[.08] bg-white/[.03] p-4" aria-live="polite">
        {loading && !quote ? <p className="flex items-center gap-2 text-sm text-gray-400"><Loader2 size={15} className="animate-spin" />Checking price…</p>
          : quote ? <>
            <div className="flex items-baseline justify-between gap-3"><span className="text-sm text-gray-400">To pay</span><span className="text-2xl font-bold text-white">{money(quote.total_price)}</span></div>
            <div className="mt-1 flex justify-between gap-3 text-xs text-gray-400"><span>{quote.from_departments} → {quote.departments} departments</span>{quote.total_tokens > 0 && <span className="text-secondary-300">+{quote.total_tokens.toLocaleString()} tokens</span>}</div>
            <p className="mt-3 text-[11px] text-gray-500">1–{quote.free_departments} departments are free. With more, every department is {money(quote.department_price)}. You pay the difference.</p>
          </> : <p className="text-sm text-gray-500">Enter a number above your current departments.</p>}
      </div>
    </div>
  </Modal>;
}
