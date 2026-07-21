"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import auditoLogo from "../../assets/logo/audito_logo.png";
import {
  Loader2, ShieldCheck, ArrowRight, CheckCircle2, AlertTriangle, CreditCard, Lock,
} from "lucide-react";
import { paymentApi, type PaymentDetails } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accessToken, refreshMe } = useAuth();
  const { confirm } = useUiFeedback();

  const code = searchParams.get("code") || "";
  const gatewayReturn = searchParams.get("gateway_return");
  const temporaryPaymentMode = process.env.NEXT_PUBLIC_ENABLE_TEMPORARY_PAYMENT_ACCEPTANCE === "true";

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [creditApplied, setCreditApplied] = useState(0);
  const [netAmount, setNetAmount] = useState<number | null>(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);

  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    paymentApi.get(code)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.payment) {
          setPayment(res.data.payment);
          if (res.data.payment.status === "paid") setPaid(true);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code]);

  // The browser return is display-only. The page waits for Sampath's signed
  // server callback instead of trusting return query parameters.
  useEffect(() => {
    if (!gatewayReturn || !code || paid) return;
    const timer = window.setInterval(async () => {
      const res = await paymentApi.get(code);
      if (res.success && res.data?.payment) {
        setPayment(res.data.payment);
        if (res.data.payment.status === "paid") {
          setPaid(true);
          window.clearInterval(timer);
          if (accessToken) await refreshMe();
        }
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [accessToken, code, gatewayReturn, paid, refreshMe]);

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      if (temporaryPaymentMode) {
        const res = await paymentApi.temporaryAccept(code);
        if (res.success && res.data?.payment) {
          setPayment(res.data.payment);
          setPaid(res.data.payment.status === "paid");
          if (accessToken) await refreshMe();
        } else {
          setError(res.message || "Could not accept the temporary test payment.");
        }
        return;
      }

      const res = await paymentApi.initiate(code, { save_payment_method: savePaymentMethod });
      if (res.success && res.data?.checkout) {
        const form = document.createElement("form");
        form.method = res.data.checkout.method;
        form.action = res.data.checkout.action;
        form.style.display = "none";
        Object.entries(res.data.checkout.fields).forEach(([name, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
      } else {
        setError(res.message || "Could not start secure payment.");
      }
    } catch {
      setError("Something went wrong while starting secure payment.");
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    const leavePayment = await confirm({
      title: "Leave payment?",
      message: "Your administrator account and payment link will remain ready. You can sign in later to resume this payment.",
      confirmText: "Leave payment",
      cancelText: "Continue payment",
      variant: "warning",
    });
    if (leavePayment) router.push(accessToken ? "/settings/billing" : "/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-secondary-400" />
      </div>
    );
  }

  if (notFound || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#053B36] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
            <AlertTriangle size={26} className="text-amber-400" />
          </div>
          <h1 className="text-lg font-bold text-white">Payment Not Found</h1>
          <p className="mt-2 text-sm text-gray-400">This payment link is invalid or has expired.</p>
          <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#059669] px-5 py-3 font-semibold text-white hover:bg-[#047A55] transition-all">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const purpose = payment.purpose ?? "upgrade";
  const isRegistration = purpose === "registration";

  // ── Success screen ──
  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#053B36] p-8 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto mb-5 text-secondary-500" size={60} />
          <h1 className="text-xl font-bold text-white">Payment Successful</h1>
          <p className="mt-2 text-sm text-gray-400">
            Your {payment.plan_name} ({payment.billing_cycle}) subscription is now active.
          </p>

          {payment.invoice_number && (
            <p className="mt-3 text-xs text-gray-500">
              Invoice <span className="text-gray-300 font-medium">{payment.invoice_number}</span>
            </p>
          )}

          {/* Credit application breakdown */}
          {creditApplied > 0 && (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-left space-y-1.5">
              <p className="text-xs font-semibold text-emerald-400">Link Credit Applied</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Original amount</span>
                <span className="text-xs text-gray-300 tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400">Credit discount</span>
                <span className="text-xs text-emerald-400 tabular-nums">-{formatMoney(creditApplied, payment.currency)}</span>
              </div>
              {netAmount != null && (
                <div className="flex items-center justify-between border-t border-emerald-500/20 pt-1.5">
                  <span className="text-xs font-semibold text-white">You paid</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{formatMoney(netAmount, payment.currency)}</span>
                </div>
              )}
            </div>
          )}

          {isRegistration ? (
            <>
              <p className="mt-4 text-sm text-gray-400">
                Your account is all set. Sign in to get started.
              </p>
              <Link href="/login?registered=true" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#059669] px-5 py-3 font-semibold text-white hover:bg-[#047A55] transition-all">
                Go to Login <ArrowRight size={16} />
              </Link>
            </>
          ) : accessToken ? (
            <button
              onClick={() => router.push("/settings/billing")}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#059669] px-5 py-3 font-semibold text-white hover:bg-[#047A55] transition-all"
            >
              Back to Billing <ArrowRight size={16} />
            </button>
          ) : (
            <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#059669] px-5 py-3 font-semibold text-white hover:bg-[#047A55] transition-all">
              Continue to Login <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── Checkout / invoice screen ──
  const titleByPurpose: Record<string, string> = {
    registration: "Complete Your Subscription",
    upgrade: "Upgrade Your Plan",
    renewal: "Renew Your Subscription",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <Image src={auditoLogo} alt="Audito" width={110} height={28} className="h-8 mx-auto" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#053B36] p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard size={20} className="text-secondary-400" />
            <h1 className="text-lg font-semibold text-white">{titleByPurpose[purpose] ?? "Checkout"}</h1>
          </div>

          {/* Order summary */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Plan</span>
              <span className="text-sm font-semibold text-white">{payment.plan_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Billing cycle</span>
              <span className="text-sm font-semibold text-white">{payment.billing_cycle}</span>
            </div>
            {payment.org_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Organization</span>
                <span className="text-sm font-medium text-white truncate max-w-[60%] text-right">{payment.org_name}</span>
              </div>
            )}
            {payment.payer_email && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Billed to</span>
                <span className="text-sm font-medium text-white truncate max-w-[60%] text-right">{payment.payer_email}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total due</span>
              <span className="text-xl font-bold text-secondary-400">{formatMoney(payment.amount, payment.currency)}</span>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Temporary payment action — replace with the real gateway later */}
          <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 mb-4">
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <Lock size={12} className="text-secondary-500 shrink-0" />
              {temporaryPaymentMode
                ? "Temporary development mode is enabled. No bank payment or card data is used."
                : "You will be redirected to Sampath Bank's secure payment page. Audito never receives or stores card details."}
            </p>
          </div>

          {!temporaryPaymentMode && <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3.5 transition-colors hover:border-secondary-500/30">
            <input
              type="checkbox"
              checked={savePaymentMethod}
              onChange={(event) => setSavePaymentMethod(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-secondary-500 focus:ring-secondary-500"
            />
            <span>
              <span className="block text-sm font-medium text-white">Save payment method for future renewals</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                Sampath Bank stores your card securely. Audito stores only an encrypted payment token and masked card details.
              </span>
            </span>
          </label>}

          {gatewayReturn && payment.status !== "paid" && (
            <p className="mb-4 text-center text-xs text-gray-400">Confirming your payment securely with Sampath Bank…</p>
          )}

          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#059669] py-3 font-semibold text-white shadow-lg shadow-[#059669]/25 transition-all hover:bg-[#047A55] disabled:opacity-50"
          >
            {paying ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {temporaryPaymentMode ? (
              paying ? "Accepting test payment..." : `Accept Temporary Payment — ${formatMoney(payment.amount, payment.currency)}`
            ) : (<>
            {paying ? "Redirecting securely..." : `Proceed to Payment — ${formatMoney(payment.amount, payment.currency)}`}
            </>)}
          </button>

          <button
            type="button"
            onClick={() => void handleCancel()}
            className="mt-2 block w-full rounded-lg py-2.5 text-center text-sm text-gray-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-transparent">
          <Loader2 size={32} className="animate-spin text-secondary-400" />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
