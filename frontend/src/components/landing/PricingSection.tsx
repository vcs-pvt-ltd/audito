"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo/audito_logo.png";
import Reveal from "./Reveal";
import { PLAN_COMPANY_LEVEL_LIMITS } from "@/lib/planLimits";

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  href: string;
};

const PLAN_DEFS = [
  { name: "Basic", priceMonthly: 0, description: "Perfect for trying out Audito", cta: "Get Started", href: "/register?plan=Basic" },
  { name: "Pro", priceMonthly: 199, description: "For growing teams", cta: "Get Started", href: "/register?plan=Pro" },
  { name: "Elite", priceMonthly: 299, description: "For large organizations", cta: "Get Started", href: "/register?plan=Elite" },
  { name: "Custom", priceMonthly: 0, description: "Tailored to your needs", cta: "Contact Us", href: "/custom-solution" },
];

const BASIC_YEARLY_TOTAL = Math.round(99 * 11 * 0.8);

const comparisonRows = [
  {
    group: "WORKSPACE MANAGEMENT",
    feature: "Company hierarchy depth",
    values: [
      String(PLAN_COMPANY_LEVEL_LIMITS.Basic),
      String(PLAN_COMPANY_LEVEL_LIMITS.Pro),
      String(PLAN_COMPANY_LEVEL_LIMITS.Elite),
      "Custom",
    ],
  },
  { group: "WORKSPACE MANAGEMENT", feature: "Departments", values: ["4", "8", "16", "Custom"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Number of Audits", values: ["2", "6", "14", "Custom"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Audit Checklists", values: ["3", "6", "25", "Custom"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Number of Auditors", values: ["1", "3", "15", "Custom"] },
  { group: "CORE FEATURES", feature: "Auditor Evaluation System", values: [false, false, true, true] },
  { group: "CORE FEATURES", feature: "Link Company to Company", values: [false, false, true, true] },
];

type CardProps = { plan: Plan };

const BasicCard = ({ plan, billingCycle }: CardProps & { billingCycle?: "monthly" | "yearly" }) => {
  const isYearly = billingCycle === "yearly";
  return (
  <div className="pricing-card rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#378745]/40 to-[#1D4226]/40 h-full flex flex-col">
    <div className="flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-white">{plan.name}</h3>
    </div>
    <div className="text-start mb-1">
      <span className="text-4xl sm:text-5xl font-bold text-white">{isYearly ? `$${BASIC_YEARLY_TOTAL}` : plan.price}</span>
      <span className="ml-1 text-sm text-gray-400">{isYearly ? "/year" : "/month"}</span>
    </div>
    <p className="text-xs text-secondary-400 mb-1">{isYearly ? "$79.20/mo after 1st month free" : "$99/mo from 2nd month"}</p>
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
    <div className="flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-[#062D27]">{plan.name}</h3>
    </div>
    <div className="text-start mb-2">
      <span className="text-4xl sm:text-5xl font-bold text-[#062D27]">{plan.price}</span>
      <span className="ml-1 text-sm text-[#062D27]">{plan.period}</span>
    </div>
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
    <div className="text-start mb-2">
      <span className="text-4xl sm:text-5xl font-bold text-white">{plan.price}</span>
      <span className="ml-1 text-sm text-gray-300">{plan.period}</span>
    </div>
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
    <div className="flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-white">{plan.name}</h3>
    </div>
    <div className="text-start mb-2">
      <span className="text-4xl sm:text-5xl font-bold text-[#EECA53]">Custom</span>
    </div>
    <p className="text-sm mb-5 text-start text-gray-400">{plan.description}</p>
    <Link href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-primary-950 bg-gradient-to-r from-[#EECA53] to-[#E1A300] hover:brightness-105 hover:shadow-lg hover:shadow-[#D9A346]/30 active:scale-[0.98]"
    >
      {plan.cta}
    </Link>
  </div>
);

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const plans: Plan[] = PLAN_DEFS.map((p) => ({
    name: p.name,
    price: `$${billingCycle === "monthly" ? p.priceMonthly : Math.round(p.priceMonthly * 12 * 0.8)}`,
    period: billingCycle === "monthly" ? "/month" : "/year",
    description: p.description,
    cta: p.cta,
    href: p.href.startsWith("/register")
      ? `${p.href}&billing=${billingCycle === "yearly" ? "Yearly" : "Monthly"}`
      : p.href,
  }));

  const workspaceRows = comparisonRows.filter((r) => r.group === "WORKSPACE MANAGEMENT");
  const coreRows = comparisonRows.filter((r) => r.group === "CORE FEATURES");

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
          <p className="mt-2 text-xs text-gray-500">
            Company hierarchy depth counts Company as level 1, followed by Cluster, Factory, Unit, Department, and Section.
          </p>
        </Reveal>

        {/* Desktop comparison table */}
        <Reveal variant="up" className="hidden lg:block max-w-6xl xl:max-w-7xl mx-auto overflow-x-auto mb-8">
          <div className="min-w-[920px] rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-secondary-400">
                  <th className="text-left px-5 py-4 text-xs tracking-wide font-semibold uppercase">Workspace Management</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Basic</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Pro</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Elite</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Custom</th>
                </tr>
              </thead>
              <tbody>
                {workspaceRows.map((row) => (
                  <tr key={row.feature} className="table-row border-t border-white/5">
                    <td className="px-5 py-4 text-gray-200">{row.feature}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-5 py-4 text-center text-white font-medium">
                        {v === "Custom" ? <span className="text-[#EECA53] font-semibold">Custom</span> : v}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-white/10 bg-white/5">
                  <td className="px-5 py-3 text-xs tracking-wide font-semibold uppercase text-secondary-400">Core Features</td>
                  <td /><td /><td /><td />
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
              <div className="grid grid-cols-4 divide-x divide-white/10">
                {["Basic", "Pro", "Elite", "Custom"].map((name, i) => (
                  <div key={name} className="flex flex-col items-center py-3 gap-1">
                    <span className="text-[10px] text-gray-400">{name}</span>
                    <span className={`text-sm font-semibold ${name === "Custom" ? "text-[#EECA53]" : "text-white"}`}>{row.values[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-400 px-1 pt-2">Core Features</p>
          {coreRows.map((row) => (
            <div key={row.feature} className="mobile-compare-card glass rounded-xl border border-white/10 overflow-hidden">
              <p className="px-4 py-2.5 text-sm text-white font-medium border-b border-white/10">{row.feature}</p>
              <div className="grid grid-cols-4 divide-x divide-white/10">
                {["Basic", "Pro", "Elite", "Custom"].map((name, i) => (
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
                  -20%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop cards */}
        <div className="hidden lg:grid grid-cols-4 gap-6 xl:gap-8 max-w-7xl mx-auto mb-8 items-stretch">
          <Reveal variant="up" delay={0} className="h-full">
            <BasicCard plan={plans[0]} billingCycle={billingCycle} />
          </Reveal>
          <Reveal variant="up" delay={120} className="h-full"><ProCard plan={plans[1]} /></Reveal>
          <Reveal variant="up" delay={240} className="h-full"><EliteCard plan={plans[2]} /></Reveal>
          <Reveal variant="up" delay={360} className="h-full"><CustomCard plan={plans[3]} /></Reveal>
        </div>

        {/* Tablet cards */}
        <div className="hidden md:flex lg:hidden flex-col gap-5 max-w-3xl mx-auto mb-8">
          <div className="w-full"><ProCard plan={plans[1]} /></div>
          <div className="grid grid-cols-2 gap-5">
            <BasicCard plan={plans[0]} billingCycle={billingCycle} />
            <EliteCard plan={plans[2]} />
          </div>
          <div className="w-full"><CustomCard plan={plans[3]} /></div>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col md:hidden gap-5 max-w-sm mx-auto mb-8">
          <ProCard plan={plans[1]} />
          <BasicCard plan={plans[0]} billingCycle={billingCycle} />
          <EliteCard plan={plans[2]} />
          <CustomCard plan={plans[3]} />
        </div>


        
      </div>
    </section>
  );
}
