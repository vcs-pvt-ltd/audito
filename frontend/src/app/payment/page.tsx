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

  const code = searchParams.get("code") || "";

  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

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

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await paymentApi.confirm(code);
      if (res.success && res.data?.payment) {
        setPayment(res.data.payment);
        setPaid(true);
        // Refresh the in-app session so new plan limits take effect immediately.
        if (accessToken) await refreshMe();
      } else {
        setError(res.message || "Payment could not be completed.");
      }
    } catch {
      setError("Something went wrong while processing the payment.");
    } finally {
      setPaying(false);
    }
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
              Payment gateway integration pending. Use the button below to simulate a successful payment.
            </p>
          </div>

          <button
            onClick={handlePay}
            disabled={paying}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#059669] py-3 font-semibold text-white shadow-lg shadow-[#059669]/25 transition-all hover:bg-[#047A55] disabled:opacity-50"
          >
            {paying ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {paying ? "Processing..." : `Pay ${formatMoney(payment.amount, payment.currency)}`}
          </button>

          <Link
            href={accessToken ? "/settings/billing" : "/login"}
            className="mt-2 block w-full rounded-lg py-2.5 text-center text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
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
