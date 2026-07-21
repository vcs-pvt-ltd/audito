"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Loader2,
  Lock,
  Check,
  X as XIcon,
  Building2,
  Users as UsersIcon,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Receipt,
  BadgePercent,
  Star,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { auditApi, checklistApi, usersApi, structureApi, paymentApi, billingCreditsApi, plansApi, type PaymentDetails, type LinkBillingCredit, type SavedPaymentMethod, type PlanCatalog } from "@/lib/api";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { Table, THead, Th, TBody, Tr, Td } from "@/components/ui";

const PLANS = [
  {
    name: "Basic",
    priceMonthly: 99,
    description: "First month free, then the monthly renewal rate.",
    color: "from-[#378745]/40 to-[#1D4226]/40",
    badge: null,
    limits: { audits: 2, checklists: 3, auditors: 1, department: 4 },
  },
  {
    name: "Pro",
    priceMonthly: 199,
    description: "For growing teams",
    popular: true,
    color: "from-[#F1FDF9]/40 to-[#B7DAD0]/60",
    textColor: "text-[#062D27]",
    badge: "Most Popular",
    limits: { audits: 6, checklists: 6, auditors: 3, department: 8 },
  },
  {
    name: "Elite",
    priceMonthly: 299,
    description: "For large organizations",
    color: "from-[#0F766E] to-[#062D27]",
    badge: null,
    limits: { audits: 14, checklists: 25, auditors: 15, department: 16 },
  },
];

export default function BillingPage() {
  const { admin, accessToken, isLoading, subscription } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [stats, setStats] = useState({ audits: 0, checklists: 0, auditors: 0, departments: 0 });
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentDetails[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [linkCredits, setLinkCredits] = useState<LinkBillingCredit[]>([]);
  const [creditAvailable, setCreditAvailable] = useState(0);
  const [planCatalog, setPlanCatalog] = useState<PlanCatalog | null>(null);

  useEffect(() => {
    plansApi.getPublic().then((res) => {
      if (res.success && res.data) setPlanCatalog(res.data);
    });
  }, []);

  useEffect(() => {
    if (subscription?.billing_cycle === "Yearly") setBillingCycle("yearly");
  }, [subscription?.billing_cycle]);

  const loadPaymentMethods = async () => {
    if (!accessToken) return;
    const res = await paymentApi.listMethods(accessToken);
    if (res.success && res.data?.methods) setPaymentMethods(res.data.methods);
  };

  const handleDefaultPaymentMethod = async (methodId: string) => {
    if (!accessToken) return;
    const res = await paymentApi.setDefaultMethod(accessToken, methodId);
    if (res.success) {
      await loadPaymentMethods();
      toast("Default payment method updated.", "success");
    } else {
      toast(res.message || "Could not update payment method.", "error");
    }
  };

  const handleDeletePaymentMethod = async (methodId: string) => {
    if (!accessToken) return;
    const res = await paymentApi.deleteMethod(accessToken, methodId);
    if (res.success) {
      await loadPaymentMethods();
      toast("Saved payment method removed.", "success");
    } else {
      toast(res.message || "Could not remove payment method.", "error");
    }
  };

  const handleUpgrade = async (planName: string) => {
    if (!accessToken) return;
    setCheckingOut(planName);
    try {
      const res = await paymentApi.checkout(accessToken, {
        plan_name: planName,
        billing_cycle: billingCycle === "yearly" ? "Yearly" : "Monthly",
        purpose: subscription?.is_expired ? "renewal" : "upgrade",
      });
      if (res.success && res.data?.payment?.payment_code) {
        router.push(`/payment?code=${res.data.payment.payment_code}`);
      } else {
        toast(res.message || "Could not start checkout.", "error");
        setCheckingOut(null);
      }
    } catch {
      toast("Something went wrong starting checkout.", "error");
      setCheckingOut(null);
    }
  };

  useEffect(() => {
    if (accessToken && admin?.role === "admin") {
      const isCompany = admin?.account_type === "Company";
      Promise.all([
        auditApi.list(accessToken),
        checklistApi.list(accessToken),
        usersApi.list(accessToken, "Auditor"),
        isCompany ? structureApi.listByType(accessToken, "department") : Promise.resolve({ success: true, data: { items: [] } }),
      ])
        .then(([auditsRes, checklistsRes, auditorsRes, deptsRes]) => {
          setStats({
            audits: (auditsRes.data as any)?.audits?.length || 0,
            checklists: (checklistsRes.data as any)?.checklists?.length || (checklistsRes.data as any)?.length || 0,
            auditors: (auditorsRes.data as any)?.users?.length || 0,
            departments: (deptsRes.data as any)?.items?.length || 0,
          });
        })
        .finally(() => setLoadingUsage(false));
    } else {
      setLoadingUsage(false);
    }
  }, [accessToken, admin]);

  useEffect(() => {
    if (accessToken && admin?.role === "admin") {
      paymentApi.list(accessToken).then((res) => {
        if (res.success && res.data?.payments) setPayments(res.data.payments);
      });
      loadPaymentMethods();
      billingCreditsApi.list(accessToken).then((res) => {
        if (res.success && res.data) {
          setLinkCredits(res.data.credits || []);
          setCreditAvailable(res.data.available_amount || 0);
        }
      });
    }
  }, [accessToken, admin]);

  const configuredPlans = useMemo(() => PLANS.map((plan) => {
    const settings = planCatalog?.plans.find((item) => item.plan_name === plan.name);
    if (!settings) return { ...plan, yearlyDiscountPercent: 20 };
    return {
      ...plan,
      priceMonthly: Number(settings.monthly_price),
      yearlyDiscountPercent: Number(settings.yearly_discount_percent),
      limits: {
        audits: settings.max_audits,
        checklists: settings.max_checklists,
        auditors: settings.max_auditors,
        department: settings.max_departments,
      },
    };
  }), [planCatalog]);
  const yearlyDiscountPercent = Number(planCatalog?.plans[0]?.yearly_discount_percent ?? 20);

  const configuredComparisonRows = useMemo(() => [
    { group: "WORKSPACE MANAGEMENT", feature: "Levels of Company", values: configuredPlans.map((plan) => String(planCatalog?.plans.find((item) => item.plan_name === plan.name)?.max_company_levels ?? (plan.name === "Basic" ? 1 : plan.name === "Pro" ? 2 : 5))) },
    { group: "WORKSPACE MANAGEMENT", feature: "Departments", values: configuredPlans.map((plan) => String(plan.limits.department)) },
    { group: "WORKSPACE MANAGEMENT", feature: "Number of Audits", values: configuredPlans.map((plan) => String(plan.limits.audits)) },
    { group: "WORKSPACE MANAGEMENT", feature: "Audit Checklists", values: configuredPlans.map((plan) => String(plan.limits.checklists)) },
    { group: "WORKSPACE MANAGEMENT", feature: "Number of Auditors", values: configuredPlans.map((plan) => String(plan.limits.auditors)) },
    { group: "CORE FEATURES", feature: "Auditor Evaluation System", values: configuredPlans.map((plan) => planCatalog?.plans.find((item) => item.plan_name === plan.name)?.allow_auditor_eval ?? plan.name === "Elite") },
    { group: "CORE FEATURES", feature: "Link Company to Company", values: configuredPlans.map((plan) => planCatalog?.plans.find((item) => item.plan_name === plan.name)?.allow_company_to_company ?? plan.name === "Elite") },
  ], [configuredPlans, planCatalog]);

  const currentPlan = useMemo(() => {
    if (!admin?.plan_limits) return configuredPlans[0];
    const deptLimit = admin.plan_limits.department;
    if (deptLimit >= configuredPlans[2].limits.department) return configuredPlans[2];
    if (deptLimit >= configuredPlans[1].limits.department) return configuredPlans[1];
    return configuredPlans[0];
  }, [admin, configuredPlans]);

  const currentPlanIndex = useMemo(() => configuredPlans.findIndex((p) => p.name === currentPlan.name), [configuredPlans, currentPlan]);
  const visiblePlans = useMemo(() => configuredPlans.slice(currentPlanIndex), [configuredPlans, currentPlanIndex]);

  const visibleRows = useMemo(
    () => configuredComparisonRows.map((r) => ({ ...r, values: r.values.slice(currentPlanIndex) })),
    [configuredComparisonRows, currentPlanIndex]
  );
  const workspaceRows = visibleRows.filter((r) => r.group === "WORKSPACE MANAGEMENT");
  const coreRows = visibleRows.filter((r) => r.group === "CORE FEATURES");
  const planCols = visiblePlans.length;
  const selectedBillingCycle = billingCycle === "yearly" ? "Yearly" : "Monthly";
  const activeBillingCycle = subscription?.billing_cycle === "Yearly" ? "Yearly" : "Monthly";
  const subscriptionEndsOn = subscription?.end_date
    ? new Date(subscription.end_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
  const isCurrentPlanExpired = Boolean(subscription?.is_expired);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent pt-14 lg:pt-0">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary-400 border-t-transparent" />
      </div>
    );
  }

  if (!admin) return null;

  if (admin.role !== "admin") {
    return (
      <div className="p-8 max-w-7xl w-full mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="glass rounded-2xl p-10 border border-white/10 text-center max-w-md w-full shadow-2xl">
          <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-5 border border-white/10">
            <Lock className="text-gray-400" size={28} />
          </div>
          <h2 className="text-lg font-bold text-white">Access Restricted</h2>
          <p className="text-sm text-gray-500 mt-2">Only administrators can manage subscription and billing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-transparent flex flex-col">
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 max-w-6xl w-full mx-auto space-y-8 pb-16">

       {/* ── Header ── */}
<div className="flex items-center justify-between gap-4">
  <div>
    <h1 className="text-xl font-bold text-white flex items-center gap-2">
      <CreditCard size={20} className="text-secondary-400" />
      Plans & Billing
    </h1>
    <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
      Manage your subscription and workspace limits.
    </p>
  </div>

  {/* Billing toggle */}
  <div className="glass rounded-lg p-1 flex items-center gap-1 border border-white/5 shrink-0">
    <button
      onClick={() => setBillingCycle("monthly")}
      className={`px-3 sm:px-4 py-2 rounded-md text-xs font-semibold transition-all ${
        billingCycle === "monthly"
          ? "bg-secondary-500 text-primary-950 shadow"
          : "text-gray-400 hover:text-white"
      }`}
    >
      Monthly
    </button>
    <button
      onClick={() => setBillingCycle("yearly")}
      className={`px-3 sm:px-4 py-2 rounded-md text-xs font-semibold transition-all relative ${
        billingCycle === "yearly"
          ? "bg-secondary-500 text-primary-950 shadow"
          : "text-gray-400 hover:text-white"
      }`}
    >
      Yearly
      {billingCycle !== "yearly" && (
        <span className="absolute -top-2 -right-3 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-primary-950">
          SAVE {yearlyDiscountPercent}%
        </span>
      )}
    </button>
  </div>
</div>

        {/* ── Active Plan Summary ── */}
        <div className="glass border border-white/10 rounded-xl p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-secondary-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Plan name + badge row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-emerald-400" size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{isCurrentPlanExpired ? "Subscription expired" : "Active plan"}</p>
                <h2 className="text-lg font-bold text-white">{currentPlan.name}</h2>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2 py-0.5 text-[10px] font-semibold text-secondary-300">{activeBillingCycle}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isCurrentPlanExpired ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>{isCurrentPlanExpired ? "Action needed" : "Active"}</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-black/10 px-3.5 py-2.5 sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{isCurrentPlanExpired ? "Ended" : "Renews on"}</p>
              <p className={`mt-0.5 text-sm font-semibold ${isCurrentPlanExpired ? "text-red-300" : "text-white"}`}>{subscriptionEndsOn || "No renewal date"}</p>
            </div>
          </div>

          {billingCycle === "yearly" && activeBillingCycle !== "Yearly" && !isCurrentPlanExpired && (
            <div className="mb-5 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold text-emerald-300">Save {yearlyDiscountPercent}% with yearly billing</p><p className="mt-0.5 text-xs text-emerald-100/55">Choose your current plan below to move your next payment to an annual cycle.</p></div>
              <span className="shrink-0 text-xs font-bold text-emerald-300">12 months · one payment</span>
            </div>
          )}

          {/* Usage bars — 2 col on mobile, 5 col on md+ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { label: "Audits", current: stats.audits, limit: admin.plan_limits?.audits, icon: BarChart3 },
              { label: "Checklists", current: stats.checklists, limit: admin.plan_limits?.checklists, icon: CheckCircle2 },
              { label: "Auditors", current: stats.auditors, limit: admin.plan_limits?.auditors, icon: UsersIcon },
              { label: "Departments", current: stats.departments, limit: admin.plan_limits?.department, icon: Building2 },
            ].map((item) => {
              const pct = Math.min(100, ((item.current) / (item.limit || 1)) * 100);
              const isNearLimit = pct >= 80;
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <item.icon size={11} className="text-gray-500" />
                      <span className="text-[11px] text-gray-500 font-medium">{item.label}</span>
                    </div>
                    <span className={`text-[11px] font-semibold tabular-nums ${isNearLimit ? "text-amber-400" : "text-white"}`}>
                      {item.current}/{item.limit}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isNearLimit ? "bg-amber-400" : "bg-secondary-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Plan Cards ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            {visiblePlans.length === 1 ? "Current Plan" : "Current & Upgrade Plans"}
          </h2>
          <div
            className={`grid gap-4 sm:gap-6 ${
              planCols === 1
                ? "grid-cols-1 max-w-sm"
                : planCols === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {visiblePlans.map((plan) => {
              const isCurrent = currentPlan.name === plan.name;
              const isBasicTrial = plan.name === "Basic";
              const price = plan.priceMonthly === 0
                ? 0
                : isBasicTrial || billingCycle === "monthly"
                  ? plan.priceMonthly
                  : Math.round(plan.priceMonthly * 12 * (1 - plan.yearlyDiscountPercent / 100));
              const period = isBasicTrial || billingCycle === "monthly" ? "/mo" : "/year";
              const periodLabel = price === 0 ? "included" : period;
              const canMoveToYearly = isCurrent && !isCurrentPlanExpired && selectedBillingCycle === "Yearly" && activeBillingCycle !== "Yearly";
              const canRenewCurrent = isCurrent && isCurrentPlanExpired;
              const canCheckout = !isCurrent || canMoveToYearly || canRenewCurrent;
              const actionLabel = isCurrent
                ? canRenewCurrent ? "Renew plan" : canMoveToYearly ? "Move to yearly billing" : "Current plan"
                : subscription?.is_expired ? "Renew with this plan" : "Upgrade";

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border border-white/10 bg-gradient-to-br ${plan.color} p-5 sm:p-6 flex flex-col transition-all duration-300 ${
                    isCurrent
                      ? "ring-2 ring-secondary-500 ring-offset-2 ring-offset-primary-950"
                      : "hover:border-white/20"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#EECA53] to-[#E1A300] text-[#062D27] text-[10px] font-bold rounded-full uppercase tracking-wide shadow-lg whitespace-nowrap z-10">
                      {plan.badge}
                    </div>
                  )}

                  <div className={`mb-4 ${plan.textColor || "text-white"}`}>
                    <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                    <p className="text-xs mt-0.5 opacity-60">{plan.description}</p>
                  </div>

                  <div className={`mb-5 ${plan.textColor || "text-white"}`}>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold">{price === 0 ? "Free" : `$${price}`}</span>
                      <span className="text-xs opacity-60">{periodLabel}</span>
                    </div>
                    {price > 0 && billingCycle === "yearly" && (
                      <p className="text-[10px] opacity-60 mt-0.5">${Math.round(price / 12)}/mo when billed annually</p>
                    )}
                  </div>

                  <button
                    disabled={!canCheckout || checkingOut !== null}
                    onClick={() => handleUpgrade(plan.name)}
                    className={`mt-auto flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                      !canCheckout
                        ? "bg-white/10 text-white/40 cursor-default border border-white/10"
                        : plan.name === "Elite" || canMoveToYearly || canRenewCurrent
                        ? "bg-secondary-500 text-primary-950 hover:bg-secondary-400"
                        : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    } ${checkingOut !== null && canCheckout ? "opacity-60 cursor-wait" : ""}`}
                  >
                    {checkingOut === plan.name ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        {actionLabel}
                        {canCheckout && <ArrowRight size={14} />}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Comparison — desktop table / mobile cards ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Plan Comparison</h2>

          {/* Desktop table */}
          <div className="hidden lg:block">
            <Table>
              <THead>
                <Th className="w-2/5 text-secondary-400">Feature</Th>
                {visiblePlans.map((p) => (
                  <Th key={p.name} align="center" className="text-white font-semibold">
                    {p.name}
                    {currentPlan.name === p.name && (
                      <span className="ml-1.5 text-[9px] text-secondary-400 font-normal">(current)</span>
                    )}
                  </Th>
                ))}
              </THead>
              <TBody>
                {workspaceRows.map((row) => (
                  <Tr key={row.feature}>
                    <Td className="text-gray-300">{row.feature}</Td>
                    {row.values.map((v, i) => (
                      <Td key={i} align="center" className="text-white font-semibold">{v}</Td>
                    ))}
                  </Tr>
                ))}
                <Tr className="bg-white/[0.02]">
                  <Td colSpan={planCols + 1} className="py-2.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Core Features
                  </Td>
                </Tr>
                {coreRows.map((row) => (
                  <Tr key={row.feature}>
                    <Td className="text-gray-300">{row.feature}</Td>
                    {row.values.map((v, i) => (
                      <Td key={i} align="center">
                        {typeof v === "boolean" ? (
                          v ? (
                            <span className="inline-flex w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/20 items-center justify-center mx-auto">
                              <Check className="text-emerald-400" size={11} />
                            </span>
                          ) : (
                            <span className="inline-flex w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 items-center justify-center mx-auto">
                              <XIcon className="text-red-400/50" size={10} />
                            </span>
                          )
                        ) : (
                          <span className="text-sm text-white font-semibold">{v}</span>
                        )}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Mobile + tablet cards */}
          <div className="lg:hidden space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-secondary-400 px-1">Workspace Management</p>
            {workspaceRows.map((row) => (
              <div key={row.feature} className="glass rounded-xl border border-white/10 overflow-hidden">
                <p className="px-4 py-2.5 text-sm text-white font-medium border-b border-white/[0.06]">{row.feature}</p>
                <div
                  className={`grid divide-x divide-white/[0.06]`}
                  style={{ gridTemplateColumns: `repeat(${planCols}, minmax(0, 1fr))` }}
                >
                  {visiblePlans.map((plan, i) => (
                    <div key={plan.name} className="flex flex-col items-center py-3 gap-1">
                      <span className="text-[10px] text-gray-500">{plan.name}</span>
                      <span className="text-sm font-semibold text-white">{row.values[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p className="text-[10px] font-semibold uppercase tracking-widest text-secondary-400 px-1 pt-2">Core Features</p>
            {coreRows.map((row) => (
              <div key={row.feature} className="glass rounded-xl border border-white/10 overflow-hidden">
                <p className="px-4 py-2.5 text-sm text-white font-medium border-b border-white/[0.06]">{row.feature}</p>
                <div
                  className="grid divide-x divide-white/[0.06]"
                  style={{ gridTemplateColumns: `repeat(${planCols}, minmax(0, 1fr))` }}
                >
                  {visiblePlans.map((plan, i) => (
                    <div key={plan.name} className="flex flex-col items-center py-3 gap-1">
                      <span className="text-[10px] text-gray-500">{plan.name}</span>
                      {typeof row.values[i] === "boolean" ? (
                        row.values[i] ? (
                          <span className="inline-flex w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/20 items-center justify-center">
                            <Check className="text-emerald-400" size={11} />
                          </span>
                        ) : (
                          <span className="inline-flex w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 items-center justify-center">
                            <XIcon className="text-red-400/50" size={10} />
                          </span>
                        )
                      ) : (
                        <span className="text-sm font-semibold text-white">{row.values[i]}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Billing History ── */}
        {paymentMethods.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard size={15} className="text-secondary-400" />
              Saved Payment Methods
            </h2>
            <div className="glass rounded-xl border border-white/10 overflow-hidden divide-y divide-white/[0.05]">
              {paymentMethods.map((method) => {
                const label = method.card_brand || "Saved payment method";
                const suffix = method.card_last4 ? ` •••• ${method.card_last4}` : "";
                const expiry = method.expiry_month && method.expiry_year
                  ? `Expires ${String(method.expiry_month).padStart(2, "0")}/${method.expiry_year}`
                  : "Securely stored by Sampath Bank";
                return (
                  <div key={method.payment_method_id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                      <CreditCard size={17} className="text-secondary-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white capitalize">{label}{suffix}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{expiry}</p>
                    </div>
                    {Boolean(method.is_default) ? (
                      <span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2 py-0.5 text-[10px] font-semibold text-secondary-300">Default</span>
                    ) : (
                      <button onClick={() => handleDefaultPaymentMethod(method.payment_method_id)} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-secondary-300" title="Set as default" aria-label="Set as default payment method">
                        <Star size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDeletePaymentMethod(method.payment_method_id)} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Remove saved payment method" aria-label="Remove saved payment method">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">Card details are held by Sampath Bank. Removing a method immediately prevents its use in Audito.</p>
          </div>
        )}

        {payments.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Receipt size={15} className="text-secondary-400" />
              Billing History
            </h2>
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="divide-y divide-white/[0.05]">
                {payments.map((p) => {
                  const dateStr = (p.paid_at || p.created_at)
                    ? new Date((p.paid_at || p.created_at) as string).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                    : "";
                  const statusStyle =
                    p.status === "paid"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                      : p.status === "pending"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                      : "bg-white/5 text-gray-400 border-white/10";
                  return (
                    <div key={p.payment_code} className="flex items-center gap-4 px-4 sm:px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {p.invoice_number || "Pending invoice"}
                          <span className="ml-2 text-xs text-gray-500 capitalize">{p.purpose}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {p.plan_name} · {p.billing_cycle}{dateStr ? ` · ${dateStr}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-white tabular-nums shrink-0">
                        {(() => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency || "USD" }).format(p.amount); } catch { return `${p.currency} ${p.amount}`; } })()}
                      </span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${statusStyle}`}>
                        {p.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Link Billing Credits ── */}
        {linkCredits.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BadgePercent size={15} className="text-secondary-400" />
              Link Billing Credits
            </h2>

            {/* Available balance card */}
            <div className="glass border border-white/10 rounded-xl p-5 sm:p-6 mb-4 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Available Credit Balance</p>
                  <p className="text-2xl font-bold text-emerald-400 tabular-nums mt-1">
                    {(() => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(creditAvailable); } catch { return `$${creditAvailable.toFixed(2)}`; } })()}
                  </p>
                </div>
                <p className="text-xs text-gray-500 max-w-xs">
                  Credits are generated automatically when an Elite organization accepts your link request. They are applied to your next subscription payment.
                </p>
              </div>
            </div>

            {/* Credit list */}
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="divide-y divide-white/[0.05]">
                {linkCredits.map((c) => {
                  const dateStr = new Date(c.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
                  const statusStyle =
                    c.status === "active"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                      : c.status === "fully_applied"
                      ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                      : "bg-white/5 text-gray-400 border-white/10";
                  return (
                    <div key={c.credit_id} className="flex items-center gap-4 px-4 sm:px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          From {c.credit_from_entity_code}
                          <span className="ml-2 text-xs text-gray-500">{c.source_plan_name} ({c.source_billing_cycle})</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.remaining_months} months remaining · Generated {dateStr}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-white tabular-nums">
                          {(() => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(c.credit_amount); } catch { return `$${c.credit_amount}`; } })()}
                        </p>
                        {c.applied_amount > 0 && (
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {(() => { try { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(c.applied_amount); } catch { return `$${c.applied_amount}`; } })()} applied
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusStyle}`}>
                        {c.status === "fully_applied" ? "Used" : c.status === "reversed" ? "Reversed" : "Available"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
