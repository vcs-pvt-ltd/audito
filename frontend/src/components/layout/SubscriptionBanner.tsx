"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/**
 * Shown when the organization's plan has expired (identified at login/getMe).
 * Only admins see a renewal CTA — they manage billing. The org has already been
 * downgraded to Basic limits on the backend; this prompts them to renew.
 */
export default function SubscriptionBanner() {
  const { admin, subscription } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !admin || !subscription?.is_expired) return null;

  const expiredOn = subscription.end_date
    ? new Date(subscription.end_date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const isAdmin = admin.role === "admin";

  return (
    <div className="px-4 sm:px-6 pt-3">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-200">
            Your {subscription.plan_name} plan has expired
            {expiredOn ? ` (${expiredOn})` : ""}.
          </p>
          <p className="text-xs text-amber-200/80 mt-0.5">
            {isAdmin
              ? "Your organization has been downgraded to Basic limits. Renew your plan to restore full access."
              : "Your organization has been downgraded to Basic limits. Please ask your administrator to renew the plan."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/settings/billing"
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-primary-950 transition-colors"
          >
            Renew plan
          </Link>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-300/70 hover:text-amber-200 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
