"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, X, BadgePercent, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import logo from "@/assets/logo/audito_logo.png";
import basicPlanHierarchy from "@/assets/landing/pricing-plans/basic-plan-hierarchy.png";
import proPlanHierarchy from "@/assets/landing/pricing-plans/pro-plan-hierarchy.png";
import elitePlanHierarchy from "@/assets/landing/pricing-plans/elite-plan-hierarchy.png";
import Reveal from "./Reveal";
import { plansApi, type PlanCatalog, type PromotionCampaign } from "@/lib/api";

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  renewalNote?: string;
  cta: string;
  href: string;
  originalPrice?: string;
  offerLabel?: string;
  offerEndsAt?: string;
};

const PLAN_DEFS = [
  { name: "Basic", priceMonthly: 99, description: "Perfect for trying out Audito", cta: "Get Started", href: "/register?plan=Basic" },
  { name: "Pro", priceMonthly: 199, description: "For growing teams", cta: "Get Started", href: "/register?plan=Pro" },
  { name: "Elite", priceMonthly: 299, description: "For large organizations", cta: "Get Started", href: "/register?plan=Elite" },
  { name: "Custom", priceMonthly: 0, description: "Tailored to your needs", cta: "Build Custom Plan", href: "/register?plan=Custom" },
];

const comparisonRows = [
  {
    group: "WORKSPACE MANAGEMENT",
    feature: "Company levels",
    values: [
      "1", "2", "5",
    ],
  },
  { group: "WORKSPACE MANAGEMENT", feature: "Departments", values: ["4", "8", "16"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Number of Audits", values: ["2", "6", "14"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Audit Checklists", values: ["3", "6", "25"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Number of Auditors", values: ["1", "3", "15"] },
  { group: "CORE FEATURES", feature: "Auditor Evaluation System", values: [false, false, true] },
  { group: "CORE FEATURES", feature: "Link Company to Company", values: [false, false, true] },
];

const planHierarchyVisuals = [
  { name: "Basic", image: basicPlanHierarchy, alt: "One company linked to four departments and one auditor", summary: "1 company · 4 departments · 1 auditor" },
  { name: "Pro", image: proPlanHierarchy, alt: "Headquarters linked to two companies, departments, and three auditors", summary: "2 company levels · 3 auditors" },
  { name: "Elite", image: elitePlanHierarchy, alt: "Five-level enterprise hierarchy linked to a larger audit team", summary: "5 hierarchy levels · audit team" },
];

type CardProps = { plan: Plan };

const OfferPrice = ({ plan, dark = false }: { plan: Plan; dark?: boolean }) => <>
  {plan.offerLabel && <div title={plan.offerLabel} className={`mb-2 inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${dark ? "border-secondary-400/25 bg-secondary-500/15 text-secondary-200" : "border-[#062D27]/15 bg-[#062D27]/10 text-[#062D27]"}`}><BadgePercent size={11} className="shrink-0" /> <span className="truncate">{plan.offerLabel}</span></div>}
  <div className="text-start mb-2">
    {plan.originalPrice && <span className={`mr-2 text-base font-medium line-through ${dark ? "text-gray-400" : "text-[#062D27]/55"}`}>{plan.originalPrice}</span>}
    <span className={`whitespace-nowrap text-3xl sm:text-4xl xl:text-[2.6rem] font-bold ${dark ? "text-white" : "text-[#062D27]"}`}>{plan.price}</span>
    <span className={`ml-1 text-sm ${dark ? "text-gray-400" : "text-[#062D27]"}`}>{plan.period}</span>
  </div>
  {plan.offerEndsAt && <p className={`mb-2 flex items-center gap-1 text-[10px] font-medium ${dark ? "text-secondary-200/75" : "text-[#062D27]/70"}`}><Clock3 size={11} /> Offer ends {new Date(plan.offerEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>}
</>;

const BasicCard = ({ plan }: CardProps) => {
  return (
  <div className="pricing-card rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#378745]/40 to-[#1D4226]/40 h-full flex flex-col">
    <div className="relative z-10 flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-white">{plan.name}</h3>
    </div>
    <OfferPrice plan={plan} dark />
    {plan.renewalNote && <p className="mb-1 text-xs font-semibold text-[#EECA53]">{plan.renewalNote}</p>}
    <p className="text-sm mb-5 text-start text-gray-400">{plan.description}</p>
    <Link href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-white bg-[#27645E] hover:bg-[#1d4f4a] hover:shadow-lg hover:shadow-black/30 active:scale-[0.98]"
    >
      {plan.cta}
    </Link>
  </div>
  );
};

const ProCard = ({ plan }: CardProps) => (
  <div className="pricing-card pricing-card-pro relative rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#F1FDF9]/40 to-[#B7DAD0]/60 h-full flex flex-col">
    <div className="badge-shimmer absolute -top-2.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#EECA53] to-[#E1A300] text-[#062D27] text-[10px] font-bold rounded-full uppercase tracking-wide shadow-lg whitespace-nowrap">
      Most Popular
    </div>
    <div className="relative z-10 flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-[#062D27]">{plan.name}</h3>
    </div>
    <OfferPrice plan={plan} />
    <p className="text-sm mb-5 text-start text-[#062D27]">{plan.description}</p>
    <Link href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-primary-950 bg-gradient-to-r from-[#EECA53] to-[#E1A300] hover:brightness-105 hover:shadow-lg hover:shadow-[#D9A346]/30 active:scale-[0.98]"
    >
      {plan.cta}
    </Link>
  </div>
);

const EliteCard = ({ plan }: CardProps) => (
  <div className="pricing-card rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#0F766E] to-[#062D27] h-full flex flex-col">
    <div className="flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-white">{plan.name}</h3>
    </div>
    <OfferPrice plan={plan} dark />
    <p className="text-sm mb-5 text-start text-gray-300">{plan.description}</p>
    <Link href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-white bg-[#053B36] hover:bg-[#042c28] hover:shadow-lg hover:shadow-black/30 active:scale-[0.98]"
    >
      {plan.cta}
    </Link>
  </div>
);

const CustomCard = ({ plan }: CardProps) => (
  <div className="pricing-card rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#1a1a2e]/60 to-[#16213e]/60 h-full flex flex-col relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#EECA53]/10 to-transparent rounded-bl-full" />
    <div className="relative z-10 flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-white">{plan.name}</h3>
    </div>
    <p className="text-sm mb-5 text-start text-gray-400">{plan.description}</p>
    <Link href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-primary-950 bg-gradient-to-r from-[#EECA53] to-[#E1A300] hover:brightness-105 hover:shadow-lg hover:shadow-[#D9A346]/30 active:scale-[0.98]"
    >
      {plan.cta}
    </Link>
  </div>
);

const DynamicPlanCard = ({ plan }: CardProps) => (
  <div className="pricing-card rounded-3xl border border-white/15 bg-gradient-to-br from-[#173b36] to-[#0a2522] p-6 sm:p-7 h-full flex flex-col">
    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
    <div className="mt-4"><OfferPrice plan={plan} dark /></div>
    <p className="mt-3 text-sm text-gray-400">{plan.description}</p>
    <Link href={plan.href} className="mt-auto pt-6 flex items-center justify-center rounded-xl bg-secondary-500 py-3 text-sm font-semibold text-primary-950 transition hover:bg-secondary-400">{plan.cta}</Link>
  </div>
);

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);

  useEffect(() => { plansApi.getPublic().then((result) => { if (result.success && result.data) setCatalog(result.data); }); }, []);
  const yearlyDiscount = Number(catalog?.plans[0]?.yearly_discount_percent ?? 20);

  const plans: Plan[] = useMemo(() => PLAN_DEFS.map((p) => {
    const config = catalog?.plans.find((item) => item.plan_name === p.name);
    const monthly = Number(config?.monthly_price ?? p.priceMonthly);
    const discount = Number(config?.yearly_discount_percent ?? 20);
    const amount = billingCycle === "monthly" ? Math.round(monthly) : Math.round(monthly * 12 * (1 - discount / 100));
    const isBasic = p.name === "Basic";
    const campaign = !isBasic ? (catalog?.active_promotions || [])
      .filter((offer) => offer.applies_to_registration && offer.plans.some((eligible) => eligible.plan_name === p.name && (eligible.billing_cycle === "Any" || eligible.billing_cycle === (billingCycle === "monthly" ? "Monthly" : "Yearly"))))
      .reduce<PromotionCampaign | null>((best, offer) => {
        const savings = offer.discount_type === "percentage" ? amount * (Number(offer.discount_value) / 100) : Number(offer.discount_value);
        const bestSavings = !best ? 0 : best.discount_type === "percentage" ? amount * (Number(best.discount_value) / 100) : Number(best.discount_value);
        return savings > bestSavings ? offer : best;
      }, null) : null;
    const offerDiscount = campaign ? Math.min(amount, campaign.discount_type === "percentage" ? Math.round(amount * (Number(campaign.discount_value) / 100)) : Math.round(Number(campaign.discount_value))) : 0;
    const saleAmount = Math.max(0, amount - offerDiscount);
    return {
      name: p.name,
      price: isBasic ? "$0" : `$${saleAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      period: isBasic ? "/month" : billingCycle === "monthly" ? "/month" : "/year",
      originalPrice: campaign ? `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined,
      offerLabel: campaign ? `${campaign.discount_type === "percentage" ? `${campaign.discount_value}% off` : `$${campaign.discount_value} off`} · ${campaign.name}` : undefined,
      offerEndsAt: campaign?.ends_at,
      description: p.description,
      renewalNote: isBasic ? `$${Math.round(monthly).toLocaleString()}/mo from 2nd month` : undefined,
      cta: p.cta,
      href: p.href.startsWith("/register") ? `${p.href}&billing=${isBasic || billingCycle === "monthly" ? "Monthly" : "Yearly"}` : p.href,
    };
  }), [billingCycle, catalog]);

  const renderedComparisonRows = useMemo(() => comparisonRows.map((row) => {
    if (!catalog) return row;
    const values = catalog.plans.map((plan) => row.feature === "Company levels" ? String(plan.max_company_levels) : row.feature === "Departments" ? String(plan.max_departments) : row.feature === "Number of Audits" ? String(plan.max_audits) : row.feature === "Audit Checklists" ? String(plan.max_checklists) : row.feature === "Number of Auditors" ? String(plan.max_auditors) : row.feature === "Auditor Evaluation System" ? !!plan.allow_auditor_eval : row.feature === "Link Company to Company" ? !!plan.allow_company_to_company : "");
    return { ...row, values };
  }), [catalog]);

  const workspaceRows = renderedComparisonRows.filter((r) => r.group === "WORKSPACE MANAGEMENT");
  const coreRows = renderedComparisonRows.filter((r) => r.group === "CORE FEATURES");
  const additionalPlans = useMemo(() => (catalog?.plans || [])
    .filter((plan) => !["Basic", "Pro", "Elite"].includes(plan.plan_name) && plan.is_active)
    .map((plan) => {
      const monthly = Math.round(Number(plan.monthly_price));
      const yearly = Math.round(monthly * 12 * (1 - Number(plan.yearly_discount_percent) / 100));
      const amount = billingCycle === "monthly" ? monthly : yearly;
      const campaign = (catalog?.active_promotions || []).filter((offer) => offer.applies_to_registration && offer.plans.some((eligible) => eligible.plan_name === plan.plan_name && (eligible.billing_cycle === "Any" || eligible.billing_cycle === (billingCycle === "monthly" ? "Monthly" : "Yearly")))).reduce<PromotionCampaign | null>((best, offer) => {
        const savings = offer.discount_type === "percentage" ? amount * Number(offer.discount_value) / 100 : Number(offer.discount_value);
        const bestSavings = !best ? 0 : best.discount_type === "percentage" ? amount * Number(best.discount_value) / 100 : Number(best.discount_value);
        return savings > bestSavings ? offer : best;
      }, null);
      const discount = campaign ? Math.min(amount, campaign.discount_type === "percentage" ? Math.round(amount * Number(campaign.discount_value) / 100) : Math.round(Number(campaign.discount_value))) : 0;
      return { name: plan.display_name || plan.plan_name, price: `$${(amount - discount).toLocaleString()}`, originalPrice: campaign ? `$${amount.toLocaleString()}` : undefined, offerLabel: campaign ? `${campaign.discount_type === "percentage" ? `${campaign.discount_value}% off` : `$${campaign.discount_value} off`} · ${campaign.name}` : undefined, offerEndsAt: campaign?.ends_at, period: billingCycle === "monthly" ? "/month" : "/year", description: plan.description || "A flexible Audito plan", cta: "Get Started", href: `/register?plan=${encodeURIComponent(plan.plan_name)}&billing=${billingCycle === "yearly" ? "Yearly" : "Monthly"}` };
    }), [billingCycle, catalog]);

  return (
    <section className="relative pt-20 pb-14 sm:py-18 lg:py-24 overflow-y-auto">
      <style>{`
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes badgeShimmer {
          0%, 100% { filter: brightness(1); }
          50%       { filter: brightness(1.15); }
        }
        @keyframes pricingFadeIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }

        .pricing-gradient-text {
          background: linear-gradient(90deg, #A8D0AF, #8BB9AC, #D4AF37, #A8D0AF);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 5s linear infinite;
        }

        .pricing-card {
          transition: transform 0.3s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.3s ease;
        }
        .pricing-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.4);
        }
        .pricing-card-pro:hover {
          box-shadow: 0 24px 64px rgba(0,0,0,0.4), 0 0 32px rgba(212,163,70,0.2);
        }

        .badge-shimmer { animation: badgeShimmer 2.5s ease-in-out infinite; }

        .table-row {
          transition: background 0.18s ease;
        }
        .table-row:hover { background: rgba(255,255,255,0.04); }

        .billing-pill {
          transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
        }
        .billing-pill:hover { filter: brightness(1.08); }

        .contact-link {
          transition: color 0.2s ease, text-decoration-color 0.2s ease;
          text-underline-offset: 3px;
        }
        .contact-link:hover { color: #a3e4d7; }

        .mobile-compare-card {
          transition: transform 0.25s ease, border-color 0.25s ease;
        }
        .mobile-compare-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.18) !important;
        }
      `}</style>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">

        {/* Header */}
        <Reveal variant="up" className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold text-white mb-3">
            Simple, Transparent
            <br />
            <span className="pricing-gradient-text">Pricing</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            Choose the perfect plan for your organization. All plans include our core features.
          </p>
         
        </Reveal>

        {/* Desktop comparison table */}
        <Reveal variant="up" className="hidden lg:block max-w-6xl xl:max-w-7xl mx-auto overflow-x-auto mb-8">
          <div className="min-w-[760px] rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-secondary-400">
                  <th className="text-left px-5 py-4 text-xs tracking-wide font-semibold uppercase">Workspace Management</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Basic</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Pro</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Elite</th>
                </tr>
              </thead>
              <tbody>
                {workspaceRows.map((row) => (
                  <tr key={row.feature} className="table-row border-t border-white/5">
                    <td className="px-5 py-4 text-gray-200">{row.feature}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-5 py-4 text-center text-white font-medium">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-white/10 bg-white/5">
                  <td className="px-5 py-3 text-xs tracking-wide font-semibold uppercase text-secondary-400">Core Features</td>
                  <td /><td /><td />
                </tr>
                {coreRows.map((row) => (
                  <tr key={row.feature} className="table-row border-t border-white/5">
                    <td className="px-5 py-4 text-gray-200">{row.feature}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-5 py-4 text-center">
                        {v
                          ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary-500 text-primary-950 shadow-sm shadow-secondary-500/40"><Check size={12} /></span>
                          : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-400"><X size={12} /></span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* Mobile/tablet comparison */}
        <div className="lg:hidden max-w-3xl mx-auto space-y-4 mb-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-400 px-1">Workspace Management</p>
          {workspaceRows.map((row) => (
            <div key={row.feature} className="mobile-compare-card glass rounded-xl border border-white/10 overflow-hidden">
              <p className="px-4 py-2.5 text-sm text-white font-medium border-b border-white/10">{row.feature}</p>
              <div className="grid grid-cols-3 divide-x divide-white/10">
                {["Basic", "Pro", "Elite"].map((name, i) => (
                  <div key={name} className="flex flex-col items-center py-3 gap-1">
                    <span className="text-[10px] text-gray-400">{name}</span>
                    <span className="text-sm font-semibold text-white">{row.values[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-400 px-1 pt-2">Core Features</p>
          {coreRows.map((row) => (
            <div key={row.feature} className="mobile-compare-card glass rounded-xl border border-white/10 overflow-hidden">
              <p className="px-4 py-2.5 text-sm text-white font-medium border-b border-white/10">{row.feature}</p>
              <div className="grid grid-cols-3 divide-x divide-white/10">
                {["Basic", "Pro", "Elite"].map((name, i) => (
                  <div key={name} className="flex flex-col items-center py-3 gap-1">
                    <span className="text-[10px] text-gray-400">{name}</span>
                    {row.values[i]
                      ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary-500 text-primary-950"><Check size={12} /></span>
                      : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-400"><X size={12} /></span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Plan hierarchy visual guide */}
        <Reveal variant="up" className="mb-10 max-w-6xl mx-auto">
          <div className="mb-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-400">Plan capacity at a glance</p>
            <p className="mt-1 text-sm text-gray-400">See how each plan scales your organization and audit team.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planHierarchyVisuals.map((visual) => (
              <div key={visual.name} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-3 shadow-lg shadow-black/10">
                <Image
                  src={visual.image}
                  alt={visual.alt}
                  className="aspect-square w-full rounded-xl object-cover"
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
                />
                <div className="flex items-center justify-between gap-3 px-1 pb-1 pt-3">
                  <p className="text-sm font-semibold text-white">{visual.name}</p>
                  <p className="text-right text-[11px] font-medium text-secondary-300">{visual.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Billing switch */}
        <div className="flex justify-center mb-8 sm:mb-10">
          <div className="glass rounded-lg p-1 flex items-center gap-1 border border-white/5">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 sm:px-5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${billingCycle === "monthly"
                  ? "bg-secondary-500 text-primary-950 shadow"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`relative px-4 sm:px-5 py-2 rounded-md text-xs sm:text-sm font-semibold transition-all ${billingCycle === "yearly"
                  ? "bg-secondary-500 text-primary-950 shadow"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              Yearly
              {billingCycle !== "yearly" && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-emerald-500 text-primary-950 text-[8px] font-bold rounded-full">
                  -{yearlyDiscount}%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop cards */}
        <div className="hidden lg:grid grid-cols-4 gap-6 xl:gap-8 max-w-7xl mx-auto mb-8 items-stretch">
          <Reveal variant="up" delay={0} className="h-full">
            <BasicCard plan={plans[0]} />
          </Reveal>
          <Reveal variant="up" delay={120} className="h-full"><ProCard plan={plans[1]} /></Reveal>
          <Reveal variant="up" delay={240} className="h-full"><EliteCard plan={plans[2]} /></Reveal>
          <Reveal variant="up" delay={360} className="h-full"><CustomCard plan={plans[3]} /></Reveal>
        </div>

        {/* Tablet cards */}
        <div className="hidden md:flex lg:hidden flex-col gap-5 max-w-3xl mx-auto mb-8">
          <div className="w-full"><ProCard plan={plans[1]} /></div>
          <div className="grid grid-cols-2 gap-5">
            <BasicCard plan={plans[0]} />
            <EliteCard plan={plans[2]} />
          </div>
          <div className="w-full"><CustomCard plan={plans[3]} /></div>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col md:hidden gap-5 max-w-sm mx-auto mb-8">
          <ProCard plan={plans[1]} />
          <BasicCard plan={plans[0]} />
          <EliteCard plan={plans[2]} />
          <CustomCard plan={plans[3]} />
        </div>

        {additionalPlans.length > 0 && <div className="mx-auto mb-8 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">{additionalPlans.map((plan) => <DynamicPlanCard key={plan.name} plan={plan} />)}</div>}


        
      </div>
    </section>
  );
}
