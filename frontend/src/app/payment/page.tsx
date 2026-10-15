"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import auditoLogo from "../../assets/logo/audito_logo.png";
import {
  Loader2, ShieldCheck, ArrowRight, CheckCircle2, AlertTriangle, CreditCard, Lock, Mail, RefreshCw, Clock3,
} from "lucide-react";
import { paymentApi, type PaymentDetails } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { paymentReturnPath } from "@/components/billing/DepartmentUpgradeModal";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function PackageDetails({ snapshot, currency, totalTokens, bonusTokens }: {
  snapshot: Record<string, unknown>;
  currency: string;
  totalTokens: number;
  bonusTokens: number;
}) {
  const levelNames = ["Department", "Unit", "Factory", "Cluster", "Company"];
  const levels = Number(snapshot.company_levels) + (Number(snapshot.pricing_version) === 2 ? 1 : 0);
  const departments = Number(snapshot.departments);
  const auditQuestions = Number(snapshot.lines_per_audit);
  const highestLevel = Number.isInteger(levels) && levels >= 1 && levels <= levelNames.length ? levelNames[levels - 1] : null;
  const questionTokens = Number(snapshot.line_tokens ?? snapshot.lines_per_audit);
  const additionalTokens = Number(snapshot.additional_tokens);

  return <section className="border-t border-white/10 pt-4" aria-labelledby="package-details-title">
    <h2 id="package-details-title" className="text-sm font-semibold text-white">Your package details</h2>

    <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary-300">What you selected</h3>
      <dl className="mt-3 space-y-2.5 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><dt className="text-gray-400">Highest level</dt><dd className="font-medium text-white">{highestLevel || `${levels} levels`}</dd></div>
        {highestLevel && <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><dt className="text-gray-400">Organization levels</dt><dd className="font-medium text-white">{levels}</dd></div>}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><dt className="text-gray-400">Departments</dt><dd className="font-medium text-white">{departments.toLocaleString()}</dd></div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><dt className="text-gray-400">Audit questions per audit</dt><dd className="font-medium text-white">{auditQuestions.toLocaleString()}</dd></div>
      </dl>
      <p className="mt-3 border-t border-white/10 pt-3 text-xs text-gray-400">1 audit question uses 1 token.</p>
    </div>

    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary-300">Price breakdown</h3>
      <dl className="mt-3 space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3"><dt className="text-gray-400">Company levels</dt><dd className="font-medium tabular-nums text-white">{formatMoney(Number(snapshot.company_level_charge), currency)}</dd></div>
        <div className="flex items-baseline justify-between gap-3"><dt className="text-gray-400">Departments</dt><dd className="font-medium tabular-nums text-white">{formatMoney(Number(snapshot.department_charge), currency)}</dd></div>
        <div className="flex items-baseline justify-between gap-3"><dt className="text-gray-400">Audit questions</dt><dd className="font-medium tabular-nums text-white">{formatMoney(Number(snapshot.line_charge), currency)}</dd></div>
        <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2.5"><dt className="font-medium text-white">Package subtotal</dt><dd className="font-semibold tabular-nums text-white">{formatMoney(Number(snapshot.total_price), currency)}</dd></div>
      </dl>
    </div>

    <div className="mt-4 border-t border-white/10 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary-300">Tokens included</h3>
      <dl className="mt-3 space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3"><dt className="text-gray-400">For audit questions</dt><dd className="font-medium tabular-nums text-white">{questionTokens.toLocaleString()}</dd></div>
        <div className="flex items-baseline justify-between gap-3"><dt className="text-gray-400">From level and department charges</dt><dd className="font-medium tabular-nums text-white">{additionalTokens.toLocaleString()}</dd></div>
        {bonusTokens > 0 && <div className="flex items-baseline justify-between gap-3"><dt className="text-gray-400">Bonus tokens</dt><dd className="font-medium tabular-nums text-white">{bonusTokens.toLocaleString()}</dd></div>}
        <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2.5"><dt className="font-semibold text-white">Total tokens</dt><dd className="font-semibold tabular-nums text-secondary-300">{totalTokens.toLocaleString()}</dd></div>
      </dl>
    </div>
  </section>;
}

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accessToken, refreshMe } = useAuth();
  const { confirm } = useUiFeedback();

  const code = searchParams.get("code") || "";
  const gatewayReturn = searchParams.get("gateway_return");
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [paymentMode, setPaymentMode] = useState<"manual_approval" | "gateway">("manual_approval");
  const [paymentContactEmail, setPaymentContactEmail] = useState("hi@audito.cloud");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [creditApplied, setCreditApplied] = useState(0);
  const [netAmount, setNetAmount] = useState<number | null>(null);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMessage, setPromoMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    paymentApi.get(code)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.payment) {
          setPayment(res.data.payment);
          setPaymentMode(res.data.payment_mode);
          setPaymentContactEmail(res.data.payment_contact_email);
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

  useEffect(() => {
    if (!code || paid || paymentMode !== "manual_approval" || payment?.manual_approval_status !== "requested") return;
    const timer = window.setInterval(async () => {
      const res = await paymentApi.get(code);
      if (!res.success || !res.data?.payment) return;
      setPayment(res.data.payment);
      if (res.data.payment.status === "paid") {
        setPaid(true);
        window.clearInterval(timer);
        if (accessToken) await refreshMe();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [accessToken, code, paid, payment?.manual_approval_status, paymentMode, refreshMe]);

  const handlePay = async () => {
    setPaying(true);
    setError("");
    try {
      if (paymentMode === "manual_approval") {
        const res = await paymentApi.requestManualApproval(code);
        if (res.success && res.data?.payment) {
          setPayment(res.data.payment);
          setPaymentMode(res.data.payment_mode);
          setPaymentContactEmail(res.data.payment_contact_email);
          setPaid(res.data.payment.status === "paid");
          if (accessToken) await refreshMe();
        } else {
          setError(res.message || "Could not send the payment approval request.");
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

  // Promo codes change the amount due on the server; the page shows the result.
  const applyPromo = async () => {
    const value = promoInput.trim();
    if (!value) { setPromoMessage({ tone: "error", text: "Enter a promo code." }); return; }
    setPromoBusy(true); setPromoMessage(null);
    try {
      const res = await paymentApi.applyPromoCode(code, value);
      if (res.success && res.data?.payment) {
        setPayment(res.data.payment); setPromoInput("");
        setPromoMessage({ tone: "ok", text: res.message || "Promo code applied." });
      } else setPromoMessage({ tone: "error", text: res.message || "This promo code could not be applied." });
    } catch { setPromoMessage({ tone: "error", text: "Could not apply the promo code. Try again." }); }
    finally { setPromoBusy(false); }
  };
  const removePromo = async () => {
    setPromoBusy(true); setPromoMessage(null);
    try {
      const res = await paymentApi.removePromoCode(code);
      if (res.success && res.data?.payment) { setPayment(res.data.payment); setPromoMessage({ tone: "ok", text: "Promo code removed." }); }
      else setPromoMessage({ tone: "error", text: res.message || "Could not remove the promo code." });
    } catch { setPromoMessage({ tone: "error", text: "Could not remove the promo code. Try again." }); }
    finally { setPromoBusy(false); }
  };
  const completeFree = async () => {
    setPaying(true); setError("");
    try {
      const res = await paymentApi.completeFree(code);
      if (res.success && res.data?.payment) {
        setPayment(res.data.payment);
        setPaid(res.data.payment.status === "paid");
        if (accessToken) await refreshMe();
      } else setError(res.message || "Could not complete the purchase.");
    } catch { setError("Could not complete the purchase. Try again."); }
    finally { setPaying(false); }
  };

  const refreshPaymentStatus = async () => {
    setPaying(true);
    setError("");
    try {
      const res = await paymentApi.get(code);
      if (!res.success || !res.data?.payment) {
        setError(res.message || "Could not refresh the payment status.");
        return;
      }
      setPayment(res.data.payment);
      setPaid(res.data.payment.status === "paid");
      if (res.data.payment.status === "paid" && accessToken) await refreshMe();
    } catch {
      setError("Could not refresh the payment status.");
    } finally {
      setPaying(false);
    }
  };

  // The page that started this payment (for example the AI setup), if saved for it.
  const returnPath = () => (payment ? paymentReturnPath(payment.payment_code) : null);

  const handleCancel = async () => {
    const leavePayment = await confirm({
      title: "Leave payment?",
      message: "Your administrator account and payment link will remain ready. You can sign in later to resume this payment.",
      confirmText: "Leave payment",
      cancelText: "Continue payment",
      variant: "warning",
    });
    if (leavePayment) router.push(accessToken ? returnPath() || "/settings/billing" : "/login");
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
  const isTokenReload = purpose === "token_reload";
  // More departments for an active package.
  const departmentUpgrade = payment.pricing_snapshot?.purchase_type === "department_upgrade" ? payment.pricing_snapshot : null;
  const isCompanyPackage = payment.plan_name === "Package" && !departmentUpgrade && !isTokenReload;
  const packageSnapshot = isCompanyPackage ? payment.pricing_snapshot : null;
  // A Customer or Audit Firm workspace registered from an Audito quote.
  const quotedSnapshot = payment.pricing_snapshot?.purchase_type === "quoted_account" ? payment.pricing_snapshot : null;
  const quotedLabel = quotedSnapshot ? `${String(quotedSnapshot.account_type)} workspace` : "";
  const totalTokens = Number(payment.token_quantity || 0) + Number(payment.bonus_token_quantity || 0);
  const approvalRequested = payment.manual_approval_status === "requested";
  const listAmount = Number(payment.list_amount ?? payment.amount);
  const promoDiscount = Number(payment.promo_discount_amount || 0);
  const campaignDiscount = payment.promo_code ? 0 : Number(payment.promotion_discount_amount || 0);
  const freeWithCode = Boolean(payment.promo_code) && Number(payment.amount) === 0;
  // The amount is fixed once approval is requested or a bank checkout is running.
  const promoLocked = approvalRequested || paying || Boolean(gatewayReturn);
  const contactBody = [
    "Hello Audito team,",
    "",
    `I would like to arrange payment for this ${isTokenReload ? "token reload" : departmentUpgrade ? "department upgrade" : isCompanyPackage ? "Company package" : quotedSnapshot ? `quoted ${quotedLabel}` : "permanent plan activation"}:`,
    `Organization: ${payment.org_name || "-"}`,
    ...(departmentUpgrade ? [`Departments: ${Number(departmentUpgrade.from_departments)} → ${Number(departmentUpgrade.departments)}`] : []),
    ...(isCompanyPackage || quotedSnapshot || departmentUpgrade ? [] : [`Plan: ${payment.plan_name}`]),
    ...(totalTokens > 0 ? [`Tokens: ${totalTokens.toLocaleString()}`] : []),
    `Amount: ${formatMoney(payment.amount, payment.currency)}`,
  ].join("\n");
  const contactHref = `mailto:${paymentContactEmail}?subject=${encodeURIComponent("Audito payment")}&body=${encodeURIComponent(contactBody)}`;

  // ── Success screen ──
  if (paid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#053B36] p-8 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto mb-5 text-secondary-500" size={60} />
          <h1 className="text-xl font-bold text-white">Payment Successful</h1>
          <p className="mt-2 text-sm text-gray-400">
            {isTokenReload
              ? `${totalTokens.toLocaleString()} tokens were added to your workspace.`
              : departmentUpgrade ? `Your workspace now has ${Number(departmentUpgrade.departments)} departments${totalTokens > 0 ? ` and ${totalTokens.toLocaleString()} more tokens` : ""}.`
              : isCompanyPackage ? `Your Company package is active with ${totalTokens.toLocaleString()} tokens.`
              : quotedSnapshot ? `Your ${quotedLabel} is active with ${totalTokens.toLocaleString()} tokens.`
              : `Your permanent ${payment.plan_name} plan is now active${totalTokens > 0 ? ` with ${totalTokens.toLocaleString()} tokens` : ""}.`}
          </p>

          {payment.invoice_number && (
            <p className="mt-3 text-xs text-gray-500">
              Invoice <span className="text-gray-300 font-medium">{payment.invoice_number}</span>
            </p>
          )}

          {Number(payment.promo_discount_amount || 0) > 0 && payment.promo_code && (
            <p className="mt-2 text-xs text-primary-300">
              You saved {formatMoney(Number(payment.promo_discount_amount), payment.currency)} with promo code <span className="font-mono font-semibold">{payment.promo_code}</span>.
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
              onClick={() => router.push(returnPath() || "/settings/billing")}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#059669] px-5 py-3 font-semibold text-white hover:bg-[#047A55] transition-all"
            >
              {returnPath() ? "Continue" : "Back to Billing"} <ArrowRight size={16} />
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
    registration: "Activate Your Plan",
    upgrade: "Upgrade Your Plan",
    renewal: "Activate Your Plan",
    plan_activation: "Activate Your Plan",
    plan_upgrade: "Upgrade Your Plan",
    token_reload: "Reload Audit Tokens",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
       

        <div className="rounded-2xl border border-white/10 bg-[#053B36] p-6 sm:p-8 shadow-2xl">
           <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <Image src={auditoLogo} alt="Audito" width={110} height={28} className="h-8 mx-auto" />
          </Link>
        </div>  
          
          <div className="flex items-center gap-2 mb-6">
            <CreditCard size={20} className="text-secondary-400" />
            <h1 className="text-lg font-semibold text-white">{departmentUpgrade ? "Add departments" : isCompanyPackage ? "Activate your package" : titleByPurpose[purpose] ?? "Checkout"}</h1>
          </div>

          {/* Order summary */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
            {departmentUpgrade ? <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Departments</span>
              <span className="text-sm font-semibold text-white">{Number(departmentUpgrade.from_departments)} → {Number(departmentUpgrade.departments)}</span>
            </div> : <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{isCompanyPackage ? "Package" : quotedSnapshot ? "Account" : "Plan"}</span>
              <span className="text-sm font-semibold text-white">{isCompanyPackage ? "Company package" : quotedSnapshot ? quotedLabel : payment.plan_name}</span>
            </div>}
            {quotedSnapshot && <div className="border-t border-white/10 pt-3 text-sm text-gray-300">
              <p>{String(quotedSnapshot.entity_type)} · {Number(quotedSnapshot.departments).toLocaleString()} departments · {Number(quotedSnapshot.lines_per_audit).toLocaleString()} audit lines</p>
              <p className="mt-1 text-xs text-gray-500">Price quoted by the Audito team. 1 token = 1 audit line.</p>
            </div>}
            {isCompanyPackage && packageSnapshot && <PackageDetails snapshot={packageSnapshot} currency={payment.currency} totalTokens={totalTokens} bonusTokens={Number(payment.bonus_token_quantity || 0)} />}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Purchase type</span>
              <span className="text-sm font-semibold text-white">{isTokenReload ? "Token reload" : departmentUpgrade ? "Department upgrade" : "One-time activation"}</span>
            </div>
            {totalTokens > 0 && !(isCompanyPackage && packageSnapshot) && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Tokens</span>
                <span className="text-sm font-semibold text-secondary-300">{totalTokens.toLocaleString()}</span>
              </div>
            )}
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
            {(promoDiscount > 0 || campaignDiscount > 0) && (
              <div className="space-y-2 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Price</span>
                  <span className="text-sm text-gray-300 tabular-nums">{formatMoney(listAmount, payment.currency)}</span>
                </div>
                {campaignDiscount > 0 && <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-300">Promotion</span>
                  <span className="text-sm text-primary-300 tabular-nums">−{formatMoney(campaignDiscount, payment.currency)}</span>
                </div>}
                {promoDiscount > 0 && <div className="flex items-center justify-between">
                  <span className="text-sm text-primary-300">Promo code <span className="font-mono font-semibold">{payment.promo_code}</span></span>
                  <span className="text-sm text-primary-300 tabular-nums">−{formatMoney(promoDiscount, payment.currency)}</span>
                </div>}
              </div>
            )}
            <div className="border-t border-white/10 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total due</span>
              <span className="text-xl font-bold text-secondary-400">{formatMoney(payment.amount, payment.currency)}</span>
            </div>
          </div>

          {/* Promo code — not offered when adding departments */}
          {!departmentUpgrade && <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            {payment.promo_code ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-300">Promo code <span className="font-mono font-semibold text-white">{payment.promo_code}</span> applied</p>
                {!promoLocked && <button type="button" onClick={() => void removePromo()} disabled={promoBusy}
                  className="rounded-lg px-2 py-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-white disabled:opacity-50">Remove</button>}
              </div>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void applyPromo(); }}>
                <label htmlFor="promo-code" className="block text-sm font-medium text-gray-300">Have a promo code?</label>
                <div className="mt-2 flex gap-2">
                  <input id="promo-code" value={promoInput} maxLength={30} autoComplete="off" spellCheck={false} disabled={promoBusy || promoLocked}
                    onChange={(event) => { setPromoInput(event.target.value.toUpperCase().replace(/\s/g, "")); setPromoMessage(null); }}
                    placeholder="Enter code" aria-describedby={promoMessage ? "promo-message" : undefined} aria-invalid={promoMessage?.tone === "error"}
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 font-mono text-sm uppercase text-white placeholder:font-sans placeholder:normal-case placeholder:text-gray-500 focus:border-secondary-400/60 focus:outline-none disabled:opacity-50" />
                  <button type="submit" disabled={promoBusy || promoLocked || !promoInput.trim()}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-secondary-500/30 bg-secondary-500/10 px-4 text-sm font-semibold text-secondary-300 transition-colors hover:bg-secondary-500/15 disabled:opacity-50">
                    {promoBusy && <Loader2 size={15} className="animate-spin" />}Apply
                  </button>
                </div>
              </form>
            )}
            {promoMessage && <p id="promo-message" role={promoMessage.tone === "error" ? "alert" : "status"} className={`mt-2 text-xs ${promoMessage.tone === "error" ? "text-red-400" : "text-primary-300"}`}>{promoMessage.text}</p>}
          </div>}

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Backend-selected manual approval or hosted gateway flow. A promo code
              that covers the full amount completes the purchase directly. */}
          {freeWithCode ? (
            <div className="mt-5 mb-4 rounded-xl border border-primary-400/25 bg-primary-400/[0.07] p-4">
              <p className="text-sm font-semibold text-white">Nothing to pay</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">Your promo code covers the full amount. Complete the purchase to activate it.</p>
            </div>
          ) : paymentMode === "manual_approval" ? (
            <div className="mt-5 mb-4 space-y-3">
              <div className="rounded-xl border border-secondary-500/20 bg-secondary-500/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <Mail size={18} className="mt-0.5 shrink-0 text-secondary-400" />
                  <div>
                    <p className="text-sm font-semibold text-white">Contact Audito to arrange payment</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">
                      Email <span className="font-medium text-secondary-400">{paymentContactEmail}</span> from your registered organization email. After payment is arranged, send the approval request below.
                    </p>
                  </div>
                </div>
                <a href={contactHref} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-secondary-500/30 bg-secondary-500/10 py-2.5 text-sm font-semibold text-secondary-300 transition-colors hover:bg-secondary-500/15">
                  <Mail size={15} /> Email {paymentContactEmail}
                </a>
              </div>
              {approvalRequested && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-center">
                  <Clock3 size={24} className="mx-auto text-amber-400" />
                  <p className="mt-2 text-sm font-semibold text-white">Awaiting Audito approval</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-400">Your request is in the Audito Admin payment queue. This page updates automatically after approval.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 mb-4">
              <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                <Lock size={12} className="text-secondary-500 shrink-0" />
                You will be redirected to Sampath Bank&apos;s secure payment page. Audito never receives or stores card details.
              </p>
            </div>
          )}

          {paymentMode === "gateway" && !freeWithCode && <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3.5 transition-colors hover:border-secondary-500/30">
            <input
              type="checkbox"
              checked={savePaymentMethod}
              onChange={(event) => setSavePaymentMethod(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-secondary-500 focus:ring-secondary-500"
            />
            <span>
              <span className="block text-sm font-medium text-white">Save payment method for future purchases</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                Sampath Bank stores your card securely. Audito stores only an encrypted payment token and masked card details.
              </span>
            </span>
          </label>}

          {gatewayReturn && payment.status !== "paid" && (
            <p className="mb-4 text-center text-xs text-gray-400">Confirming your payment securely with Sampath Bank…</p>
          )}

          <button
            onClick={freeWithCode ? completeFree : approvalRequested ? refreshPaymentStatus : handlePay}
            disabled={paying || promoBusy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#059669] py-3 font-semibold text-white shadow-lg shadow-[#059669]/25 transition-all hover:bg-[#047A55] disabled:opacity-50"
          >
            {paying ? <Loader2 size={18} className="animate-spin" /> : approvalRequested ? <RefreshCw size={18} /> : <ShieldCheck size={18} />}
            {freeWithCode
              ? (paying ? "Completing..." : "Complete Purchase")
              : paymentMode === "manual_approval"
              ? approvalRequested
                ? (paying ? "Checking approval..." : "Refresh Approval Status")
                : (paying ? "Sending request..." : "Request Payment Approval")
              : (paying ? "Redirecting securely..." : `Proceed to Payment — ${formatMoney(payment.amount, payment.currency)}`)}
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
