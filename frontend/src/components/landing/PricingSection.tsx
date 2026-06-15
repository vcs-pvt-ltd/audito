"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";
import { useLanding } from "@/context/LandingContext";

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  href: string;
};

const plans: Plan[] = [
  {
    name: "Basic",
    price: "$0",
    period: "/1 months",
    description: "Perfect for trying out Audito",
    cta: "Get Started",
    href: "/register",
  },
  {
    name: "Pro",
    price: "$99",
    period: "/month",
    description: "For growing teams",
    cta: "Get Started",
    href: "/register",
  },
  {
    name: "Elite",
    price: "$299",
    period: "/month",
    description: "For large organizations",
    cta: "Get Started",
    href: "/register",
  },
];

const comparisonRows = [
  { group: "WORKSPACE MANAGEMENT", feature: "Levels of Company", values: ["1", "2", "6"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Departments", values: ["4", "8", "16"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Number of Audits", values: ["2", "6", "14"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Audit Checklists", values: ["3", "6", "25"] },
  { group: "WORKSPACE MANAGEMENT", feature: "Number of Auditors", values: ["1", "3", "15"] },
  { group: "CORE FEATURES", feature: "Auditor Evaluation System", values: [false, false, true] },
  { group: "CORE FEATURES", feature: "Link Company to Company", values: [false, false, true] },
];

type CardProps = { plan: Plan };

const BasicCard = ({ plan }: CardProps) => (
  <div className="rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#378745]/40 to-[#1D4226]/40 h-full flex flex-col">
    <div className="flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-white">
        {plan.name}
      </h3>
    </div>
    <div className="text-start mb-2">
      <span className="text-4xl sm:text-5xl font-bold text-white">{plan.price}</span>
      <span className="ml-1 text-sm text-gray-400">{plan.period}</span>
    </div>
    <p className="text-sm mb-5 text-start text-gray-400">{plan.description}</p>
    <Link
      href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-white bg-[#27645E] hover:bg-[#1d4f4a]"
    >
      {plan.cta}
    </Link>
  </div>
);

const ProCard = ({ plan }: CardProps) => (
  <div className="relative rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#F1FDF9]/40 to-[#B7DAD0]/60 h-full flex flex-col">
    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#EECA53] to-[#E1A300] text-[#062D27] text-[10px] font-bold rounded-full uppercase tracking-wide shadow-lg whitespace-nowrap">
      Most Popular
    </div>
    <div className="flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-[#062D27]">
        {plan.name}
      </h3>
    </div>
    <div className="text-start mb-2">
      <span className="text-4xl sm:text-5xl font-bold text-[#062D27]">{plan.price}</span>
      <span className="ml-1 text-sm text-[#062D27]">{plan.period}</span>
    </div>
    <p className="text-sm mb-5 text-start text-[#062D27]">{plan.description}</p>
    <Link
      href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-primary-950 bg-gradient-to-r from-[#EECA53] to-[#E1A300] hover:brightness-95"
    >
      {plan.cta}
    </Link>
  </div>
);

const EliteCard = ({ plan }: CardProps) => (
  <div className="rounded-3xl p-6 sm:p-7 border border-white/15 bg-gradient-to-br from-[#0F766E] to-[#062D27] h-full flex flex-col">
    <div className="flex justify-start mb-4">
      <Image src={logo} alt="Audito" className="h-auto w-24 object-contain" />
      <h3 className="text-2xl sm:text-3xl font-bold mb-2 text-center pl-2 pt-3 text-white">
        {plan.name}
      </h3>
    </div>
    <div className="text-start mb-2">
      <span className="text-4xl sm:text-5xl font-bold text-white">{plan.price}</span>
      <span className="ml-1 text-sm text-gray-300">{plan.period}</span>
    </div>
    <p className="text-sm mb-5 text-start text-gray-300">{plan.description}</p>
    <Link
      href={plan.href}
      className="mt-auto flex items-center justify-center py-3 rounded-xl font-semibold text-sm transition-all text-white bg-[#053B36] hover:bg-[#042c28]"
    >
      {plan.cta}
    </Link>
  </div>
);

export default function PricingSection() {
  const { setActiveSection } = useLanding();
  const workspaceRows = comparisonRows.filter((row) => row.group === "WORKSPACE MANAGEMENT");
  const coreRows = comparisonRows.filter((row) => row.group === "CORE FEATURES");

  return (
    <section className="relative pt-20 pb-14 sm:py-18 lg:py-24 overflow-y-auto">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Simple, Transparent
            <br />
            <span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, #A8D0AF 0%, #8BB9AC 50%, #D4AF37 100%)",
              }}
            >
              Pricing
            </span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            Choose the perfect plan for your organization. All plans include our core features.
          </p>
        </div>

        {/* Billing Switch */}
        <div className="flex justify-center mb-8 sm:mb-10">
          <div className="glass rounded-full p-1 inline-flex items-center gap-1">
            <button className="px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm text-gray-200 font-medium">
              Year Billing
            </button>
            <button className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
              Save 20%
            </button>
            <button className="px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold bg-gradient-to-r from-[#EECA53] to-[#E1A300] text-[#062D27] shadow-[0_0_20px_rgba(251,191,36,0.35)]">
              Monthly Billing
            </button>
          </div>
        </div>

        {/* Plan Cards
            Mobile:  1-column stack
            Tablet:  Pro featured on top (full-width), Basic + Elite side by side below
            Desktop: 3-column (unchanged)
        */}
        {/* Desktop */}
        <div className="hidden lg:grid grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
          <BasicCard plan={plans[0]} />
          <ProCard plan={plans[1]} />
          <EliteCard plan={plans[2]} />
        </div>

        {/* Tablet */}
        <div className="hidden md:flex lg:hidden flex-col gap-5 max-w-3xl mx-auto mb-8">
          {/* Pro featured full-width on top */}
          <div className="w-full">
            <ProCard plan={plans[1]} />
          </div>
          {/* Basic + Elite side by side */}
          <div className="grid grid-cols-2 gap-5">
            <BasicCard plan={plans[0]} />
            <EliteCard plan={plans[2]} />
          </div>
        </div>

        {/* Mobile */}
        <div className="flex flex-col md:hidden gap-5 max-w-sm mx-auto mb-8">
          <ProCard plan={plans[1]} />
          <BasicCard plan={plans[0]} />
          <EliteCard plan={plans[2]} />
        </div>

        {/* Comparison Table
            Desktop: full table (unchanged, min-width guard)
            Mobile/Tablet: card-based stacked layout
        */}

        {/* Desktop table */}
        <div className="hidden lg:block max-w-6xl mx-auto overflow-x-auto">
          <div className="min-w-[820px] rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-secondary-400">
                  <th className="text-left px-5 py-4 text-xs tracking-wide font-semibold uppercase">
                    Workspace Management
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Basic</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Pro</th>
                  <th className="px-5 py-4 text-xs font-semibold">Audito Elite</th>
                </tr>
              </thead>
              <tbody>
                {workspaceRows.map((row) => (
                  <tr key={row.feature} className="border-t border-white/5">
                    <td className="px-5 py-4 text-gray-200">{row.feature}</td>
                    {row.values.map((value, idx) => (
                      <td key={`${row.feature}-${idx}`} className="px-5 py-4 text-center text-white">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-white/10 bg-white/5">
                  <td className="px-5 py-3 text-xs tracking-wide font-semibold uppercase text-secondary-400">
                    Core Features
                  </td>
                  <td /><td /><td />
                </tr>
                {coreRows.map((row) => (
                  <tr key={row.feature} className="border-t border-white/5">
                    <td className="px-5 py-4 text-gray-200">{row.feature}</td>
                    {row.values.map((value, idx) => (
                      <td key={`${row.feature}-${idx}`} className="px-5 py-4 text-center">
                        {value ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary-500 text-primary-950">
                            <Check size={12} />
                          </span>
                        ) : (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                            <X size={12} />
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile + Tablet: card-based comparison */}
        <div className="lg:hidden max-w-3xl mx-auto space-y-4">
          {/* Section label */}
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-400 px-1">
            Workspace Management
          </p>
          {workspaceRows.map((row) => (
            <div
              key={row.feature}
              className="glass rounded-xl border border-white/10 overflow-hidden"
            >
              <p className="px-4 py-2.5 text-sm text-white font-medium border-b border-white/10">
                {row.feature}
              </p>
              <div className="grid grid-cols-3 divide-x divide-white/10">
                {["Basic", "Pro", "Elite"].map((planName, idx) => (
                  <div key={planName} className="flex flex-col items-center py-3 gap-1">
                    <span className="text-[10px] text-gray-400">{planName}</span>
                    <span className="text-sm font-semibold text-white">{row.values[idx]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs font-semibold uppercase tracking-wide text-secondary-400 px-1 pt-2">
            Core Features
          </p>
          {coreRows.map((row) => (
            <div
              key={row.feature}
              className="glass rounded-xl border border-white/10 overflow-hidden"
            >
              <p className="px-4 py-2.5 text-sm text-white font-medium border-b border-white/10">
                {row.feature}
              </p>
              <div className="grid grid-cols-3 divide-x divide-white/10">
                {["Basic", "Pro", "Elite"].map((planName, idx) => (
                  <div key={planName} className="flex flex-col items-center py-3 gap-1">
                    <span className="text-[10px] text-gray-400">{planName}</span>
                    {row.values[idx] ? (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary-500 text-primary-950">
                        <Check size={12} />
                      </span>
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                        <X size={12} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          Need a custom solution?{" "}
          <button 
            onClick={() => setActiveSection(3)}
            className="text-secondary-400 hover:text-secondary-300 underline"
          >
            Contact our sales team here
          </button>
        </p>
      </div>
    </section>
  );
}