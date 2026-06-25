"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import type { SubscriptionStatus } from "@/context/AuthContext";
import type { PaymentDetails } from "@/lib/api";
import { IconButton } from "@/components/ui";

/**
 * Shown on the login page when the backend blocks sign-in because the
 * organization's plan has expired. When a renewal payment is available the CTA
 * routes into the payment flow; otherwise it falls back to contact/sales.
 */
export default function SubscriptionExpiredModal({
  subscription,
  payment,
  onClose,
}: {
  subscription?: SubscriptionStatus | null;
  payment?: PaymentDetails | null;
  onClose: () => void;
}) {
  const router = useRouter();

  const renew = () => {
    if (payment?.payment_code) router.push(`/payment?code=${payment.payment_code}`);
    else router.push("/?section=contact");
  };

  const expiredOn = subscription?.end_date
    ? new Date(subscription.end_date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const planName = subscription?.plan_name;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#053B36] p-6 shadow-2xl">
        <IconButton onClick={onClose} aria-label="Close" className="absolute top-4 right-4">
          <X size={18} />
        </IconButton>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
          <AlertTriangle size={26} className="text-amber-400" />
        </div>

        <h2 className="text-center text-lg font-bold text-white">Subscription Expired</h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          {planName ? `Your ${planName} plan` : "Your plan"}
          {expiredOn ? ` expired on ${expiredOn}.` : " has expired."}{" "}
          You can’t sign in until your organization renews its subscription.
        </p>

        <button
          onClick={renew}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#059669] py-3 font-semibold text-white shadow-lg shadow-[#059669]/25 transition-all hover:bg-[#047A55]"
        >
          {payment?.payment_code ? "Renew Subscription" : "Renew / Contact Sales"}
          <ArrowRight size={16} />
        </button>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg py-2.5 text-sm text-gray-400 transition-colors hover:text-white"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}
