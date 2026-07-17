"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  LayoutGrid,
  User,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Check,
  CheckCircle2,
  ShieldCheck,
  Globe,
  BarChart3,
  Tag,
  X,
  Crown,
  Sparkles,
  LockKeyhole,
} from "lucide-react";
import Image from "next/image";
import logo from "@/assets/logo/audito_logo.png";
import {
  authApi,
  countriesApi,
  type Country,
  type RegisterPayload,
  type AllEntityType,
} from "@/lib/api";
import { canRegisterEntityType, CUSTOM_PLAN_MINIMUM_LIMITS, PLAN_COMPANY_LEVEL_LIMITS } from "@/lib/planLimits";

/* ─── Country Code → IANA Timezone Map ──────────────────────────── */

const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  AF: "Asia/Kabul", AL: "Europe/Tirane", DZ: "Africa/Algiers", AO: "Africa/Luanda",
  AR: "America/Argentina/Buenos_Aires", AM: "Asia/Yerevan", AU: "Australia/Sydney",
  AT: "Europe/Vienna", AZ: "Asia/Baku", BH: "Asia/Bahrain", BD: "Asia/Dhaka",
  BY: "Europe/Minsk", BE: "Europe/Brussels", BZ: "America/Belize", BJ: "Africa/Porto-Novo",
  BT: "Asia/Thimphu", BO: "America/La_Paz", BA: "Europe/Sarajevo", BW: "Africa/Gaborone",
  BR: "America/Sao_Paulo", BN: "Asia/Brunei", BG: "Europe/Sofia", BF: "Africa/Ouagadougou",
  BI: "Africa/Bujumbura", KH: "Asia/Phnom_Penh", CM: "Africa/Douala", CA: "America/Toronto",
  CV: "Atlantic/Cape_Verde", CF: "Africa/Bangui", TD: "Africa/Ndjamena", CL: "America/Santiago",
  CN: "Asia/Shanghai", CO: "America/Bogota", KM: "Indian/Comoro", CG: "Africa/Brazzaville",
  CD: "Africa/Kinshasa", CR: "America/Costa_Rica", HR: "Europe/Zagreb", CU: "America/Havana",
  CY: "Asia/Nicosia", CZ: "Europe/Prague", DK: "Europe/Copenhagen", DJ: "Africa/Djibouti",
  DO: "America/Santo_Domingo", EC: "America/Guayaquil", EG: "Africa/Cairo",
  SV: "America/El_Salvador", GQ: "Africa/Malabo", ER: "Africa/Asmara", EE: "Europe/Tallinn",
  ET: "Africa/Addis_Ababa", FI: "Europe/Helsinki", FR: "Europe/Paris", GA: "Africa/Libreville",
  GM: "Africa/Banjul", GE: "Asia/Tbilisi", DE: "Europe/Berlin", GH: "Africa/Accra",
  GR: "Europe/Athens", GT: "America/Guatemala", GN: "Africa/Conakry", GW: "Africa/Bissau",
  GY: "America/Guyana", HT: "America/Port-au-Prince", HN: "America/Tegucigalpa",
  HK: "Asia/Hong_Kong", HU: "Europe/Budapest", IS: "Atlantic/Reykjavik", IN: "Asia/Kolkata",
  ID: "Asia/Jakarta", IR: "Asia/Tehran", IQ: "Asia/Baghdad", IE: "Europe/Dublin",
  IL: "Asia/Jerusalem", IT: "Europe/Rome", CI: "Africa/Abidjan", JM: "America/Jamaica",
  JP: "Asia/Tokyo", JO: "Asia/Amman", KZ: "Asia/Almaty", KE: "Africa/Nairobi",
  KP: "Asia/Pyongyang", KR: "Asia/Seoul", KW: "Asia/Kuwait", KG: "Asia/Bishkek",
  LA: "Asia/Vientiane", LV: "Europe/Riga", LB: "Asia/Beirut", LS: "Africa/Maseru",
  LR: "Africa/Monrovia", LY: "Africa/Tripoli", LI: "Europe/Vaduz", LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg", MK: "Europe/Skopje", MG: "Indian/Antananarivo", MW: "Africa/Blantyre",
  MY: "Asia/Kuala_Lumpur", MV: "Indian/Maldives", ML: "Africa/Bamako", MT: "Europe/Malta",
  MR: "Africa/Nouakchott", MU: "Indian/Mauritius", MX: "America/Mexico_City", MD: "Europe/Chisinau",
  MC: "Europe/Monaco", MN: "Asia/Ulaanbaatar", ME: "Europe/Podgorica", MA: "Africa/Casablanca",
  MZ: "Africa/Maputo", MM: "Asia/Rangoon", NA: "Africa/Windhoek", NP: "Asia/Kathmandu",
  NL: "Europe/Amsterdam", NZ: "Pacific/Auckland", NI: "America/Managua", NE: "Africa/Niamey",
  NG: "Africa/Lagos", NO: "Europe/Oslo", OM: "Asia/Muscat", PK: "Asia/Karachi",
  PA: "America/Panama", PG: "Pacific/Port_Moresby", PY: "America/Asuncion", PE: "America/Lima",
  PH: "Asia/Manila", PL: "Europe/Warsaw", PT: "Europe/Lisbon", QA: "Asia/Qatar",
  RO: "Europe/Bucharest", RU: "Europe/Moscow", RW: "Africa/Kigali", SA: "Asia/Riyadh",
  SN: "Africa/Dakar", RS: "Europe/Belgrade", SL: "Africa/Freetown", SG: "Asia/Singapore",
  SK: "Europe/Bratislava", SI: "Europe/Ljubljana", SO: "Africa/Mogadishu", ZA: "Africa/Johannesburg",
  SS: "Africa/Juba", ES: "Europe/Madrid", LK: "Asia/Colombo", SD: "Africa/Khartoum",
  SR: "America/Paramaribo", SZ: "Africa/Mbabane", SE: "Europe/Stockholm", CH: "Europe/Zurich",
  SY: "Asia/Damascus", TW: "Asia/Taipei", TJ: "Asia/Dushanbe", TZ: "Africa/Dar_es_Salaam",
  TH: "Asia/Bangkok", TL: "Asia/Dili", TG: "Africa/Lome", TT: "America/Port_of_Spain",
  TN: "Africa/Tunis", TR: "Europe/Istanbul", TM: "Asia/Ashgabat", UG: "Africa/Kampala",
  UA: "Europe/Kiev", AE: "Asia/Dubai", GB: "Europe/London", US: "America/New_York",
  UY: "America/Montevideo", UZ: "Asia/Tashkent", VE: "America/Caracas", VN: "Asia/Ho_Chi_Minh",
  YE: "Asia/Aden", ZM: "Africa/Lusaka", ZW: "Africa/Harare",
};

/* ─── Account Type Config ─────────────────────────────────────────── */

type AccountGroup = "Customer" | "Company" | "Audit Firm";
type AccountEntityType = {
  name: AllEntityType;
  label?: string;
  level: number;
  desc: string;
  color?: string;
};

type AccountTypeConfig = {
  key: AccountGroup;
  label: string;
  icon: any;
  description: string;
  entityTypes: AccountEntityType[];
  highlightLevels: number[];
  detail: {
    desc: string;
    capabilities: { icon: any; label: string }[];
  };
};

const accountTypes: AccountTypeConfig[] = [
  {
    key: "Customer",
    label: "Customers",
    icon: Building2,
    description: "Buyers and regional offices",
    entityTypes: [
      { name: "Customer", level: 7, color: "bg-secondary-500", desc: "Top-level buyer organization" },
      { name: "Buying Office", level: 6, color: "bg-secondary-500/80", desc: "Regional buying offices" },
      { name: "Supplier", level: 5, color: "bg-secondary-500/60", desc: "Suppliers under buying office" },
    ],
    highlightLevels: [7, 6, 5],
    detail: {
      desc: "Top-level enterprise entity managing the entire global audit ecosystem and compliance policies.",
      capabilities: [
        { icon: Globe, label: "Manage global supplier audits" },
        { icon: ShieldCheck, label: "Control compliance across regions" },
        { icon: BarChart3, label: "Centralized reporting & analytics" },
      ],
    },
  },
  {
    key: "Company",
    label: "Company",
    icon: LayoutGrid,
    description: "Manufacturing & operations",
    entityTypes: [
      { name: "Company", level: 5, color: "bg-primary-400", desc: "Top-level company entity" },
      { name: "Cluster", level: 4, color: "bg-primary-400/80", desc: "Regional or product clusters" },
      { name: "Factory", level: 3, color: "bg-primary-400/60", desc: "Manufacturing factories" },
      { name: "Unit", level: 2, color: "bg-primary-400/40", desc: "Operational units within factories" },
      { name: "Department", level: 1, color: "bg-primary-400/30", desc: "Departments within units" },
    ],
    highlightLevels: [6, 5, 4, 3, 2, 1],
    detail: {
      desc: "Manufacturing or service company managing multi-level operations, factories, and departments.",
      capabilities: [
        { icon: LayoutGrid, label: "Multi-level org structure" },
        { icon: ShieldCheck, label: "Factory & unit management" },
        { icon: BarChart3, label: "Operational reporting" },
      ],
    },
  },
  {
    key: "Audit Firm",
    label: "Audit Firms",
    icon: User,
    description: "Firms, branches and teams",
    entityTypes: [
      { name: "Audit Firm Company", label: "Company", level: 5, color: "bg-accent-500", desc: "Audit firm organization" },
      { name: "Branch", level: 4, color: "bg-accent-500/80", desc: "Audit firm branch / office" },
      { name: "Audit Firm Department", label: "Department", level: 3, color: "bg-accent-500/60", desc: "Department within branch" },
    ],
    highlightLevels: [5, 4, 3],
    detail: {
      desc: "Independent audit firm providing compliance services across branches and departments.",
      capabilities: [
        { icon: User, label: "Manage audit teams" },
        { icon: Globe, label: "Multi-branch operations" },
        { icon: ShieldCheck, label: "Client audit linking" },
      ],
    },
  },
];

/* ─── Helpers ────────────────────────────────────────────────────── */

const ALL_LEVELS = [7, 6, 5, 4, 3, 2, 1];
/** Price or plan requirement shown on every selectable hierarchy card. */
const ENTITY_ENTRY_PRICE_LABELS: Partial<Record<AllEntityType, string>> = {
  Customer: "$999",
  "Buying Office": "$599",
  Supplier: "$299",
  Cluster: "$199",
  Branch: "$199",
  Company: "$299",
  "Audit Firm Company": "$299",
};

const CUSTOM_CONFIGURATION_FEATURES = [
  { key: "max_company_levels" as const, label: "Company levels", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_company_levels, max: 100, desc: "Company-level capacity for your workspace" },
  { key: "max_departments" as const, label: "Departments", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_departments, max: 100, desc: "Department entities in your organization" },
  { key: "max_audits" as const, label: "Audits", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_audits, max: 100, desc: "Active audit assignments" },
  { key: "max_checklists" as const, label: "Audit checklists", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_checklists, max: 100, desc: "Reusable audit checklist templates" },
  { key: "max_auditors" as const, label: "Auditors", min: CUSTOM_PLAN_MINIMUM_LIMITS.max_auditors, max: 100, desc: "Auditor accounts on your team" },
];

type CustomSolutionLimits = {
  max_company_levels: number;
  max_departments: number;
  max_audits: number;
  max_checklists: number;
  max_auditors: number;
  allow_auditor_eval: boolean;
  allow_company_to_company: boolean;
};

const normalizeCustomSolution = (candidate?: Partial<CustomSolutionLimits>): CustomSolutionLimits => ({
  max_company_levels: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_company_levels, Number(candidate?.max_company_levels) || CUSTOM_PLAN_MINIMUM_LIMITS.max_company_levels),
  max_departments: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_departments, Number(candidate?.max_departments) || CUSTOM_PLAN_MINIMUM_LIMITS.max_departments),
  max_audits: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_audits, Number(candidate?.max_audits) || CUSTOM_PLAN_MINIMUM_LIMITS.max_audits),
  max_checklists: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_checklists, Number(candidate?.max_checklists) || CUSTOM_PLAN_MINIMUM_LIMITS.max_checklists),
  max_auditors: Math.max(CUSTOM_PLAN_MINIMUM_LIMITS.max_auditors, Number(candidate?.max_auditors) || CUSTOM_PLAN_MINIMUM_LIMITS.max_auditors),
  allow_auditor_eval: true,
  allow_company_to_company: true,
});

/** Returns the bar colour class for a given group + level, or null if empty */
function getLevelStyle(group: AccountGroup, level: number): string | null {
  const config = accountTypes.find((t) => t.key === group)!;
  const et = config.entityTypes.find((e) => e.level === level);
  return et ? (et.color ?? null) : null;
}

/** Returns the entity name for a given group + level, or null */
function getLevelName(group: AccountGroup, level: number): string | null {
  const config = accountTypes.find((t) => t.key === group)!;
  const et = config.entityTypes.find((e) => e.level === level);
  return et ? (et.label ?? et.name) : null;
}

/* ─── Input Component ────────────────────────────────────────────── */

function Input({
  label,
  required,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-11 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-400/60 focus:bg-white/[0.05] focus:outline-none focus:ring-4 focus:ring-secondary-500/10"
        placeholder={placeholder}
      />
    </div>
  );
}

/* ─── Step Indicator ─────────────────────────────────────────────── */

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="mx-auto mb-2 flex max-w-xs items-center justify-center gap-2" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i + 1 === current
            ? "w-10 bg-secondary-400 shadow-[0_0_12px_rgba(217,163,70,.32)]"
            : i + 1 < current
              ? "w-7 bg-secondary-500/50"
              : "w-7 bg-white/10"
            }`}
        />
      ))}
    </div>
  );
}

/* ─── Plan Selection Step ──────────────────────────────────────── */

const BASIC_YEARLY_TOTAL = Math.round(99 * 11 * 0.8);

function PlanSelectionStep({
  selectedPlan,
  billingCycle,
  onPlanSelect,
  onBillingCycleChange,
  onNext,
  error,
  promoCode,
  promoDiscount,
  promoLoading,
  promoError,
  onPromoCodeChange,
  onValidatePromo,
  onRemovePromo,
}: {
  selectedPlan: string;
  billingCycle: "Monthly" | "Yearly";
  onPlanSelect: (plan: string) => void;
  onBillingCycleChange: (cycle: "Monthly" | "Yearly") => void;
  onNext: () => void;
  error: string;
  promoCode: string;
  promoDiscount: number | null;
  promoLoading: boolean;
  promoError: string;
  onPromoCodeChange: (value: string) => void;
  onValidatePromo: () => void;
  onRemovePromo: () => void;
}) {
  const router = useRouter();
  const isYearly = billingCycle === "Yearly";

  const plans = [
    {
      key: "Basic",
      name: "Basic",
      price: isYearly ? `$${BASIC_YEARLY_TOTAL}` : "$0",
      period: isYearly ? "/year" : "/month",
      subtitle: isYearly ? "1st month free, then $79.20/mo" : "1st month free, then $99/mo",
      desc: "Perfect for trying out Audito",
      color: "from-[#378745]/40 to-[#1D4226]/40",
      textColor: "text-white",
    },
    {
      key: "Pro",
      name: "Pro",
      price: isYearly ? `$${Math.round(199 * 12 * 0.8)}` : "$199",
      period: isYearly ? "/year" : "/month",
      subtitle: isYearly ? `Save $${Math.round(199 * 12 * 0.2)}/year` : null,
      desc: "For growing teams",
      color: "from-[#F1FDF9]/40 to-[#B7DAD0]/60",
      textColor: "text-[#062D27]",
      badge: "Most Popular",
    },
    {
      key: "Elite",
      name: "Elite",
      price: isYearly ? `$${Math.round(299 * 12 * 0.8)}` : "$299",
      period: isYearly ? "/year" : "/month",
      subtitle: isYearly ? `Save $${Math.round(299 * 12 * 0.2)}/year` : null,
      desc: "For large organizations",
      color: "from-[#0F766E] to-[#062D27]",
      textColor: "text-white",
    },
    {
      key: "Custom",
      name: "Custom",
      price: "",
      period: "",
      subtitle: null,
      desc: "Tailored to your needs",
      color: "from-[#1a1a2e]/60 to-[#16213e]/60",
      textColor: "text-[#EECA53]",
    },
  ];

  const comparisonRows = [
    {
      group: "WORKSPACE MANAGEMENT",
      feature: "Company levels",
      values: [
        String(PLAN_COMPANY_LEVEL_LIMITS.Basic),
        String(PLAN_COMPANY_LEVEL_LIMITS.Pro),
        String(PLAN_COMPANY_LEVEL_LIMITS.Elite),
      ],
    },
    { group: "WORKSPACE MANAGEMENT", feature: "Departments", values: ["4", "8", "16"] },
    { group: "WORKSPACE MANAGEMENT", feature: "Number of Audits", values: ["2", "6", "14"] },
    { group: "WORKSPACE MANAGEMENT", feature: "Audit Checklists", values: ["3", "6", "25"] },
    { group: "WORKSPACE MANAGEMENT", feature: "Number of Auditors", values: ["1", "3", "15"] },
    { group: "CORE FEATURES", feature: "Auditor Evaluation System", values: [false, false, true] },
    { group: "CORE FEATURES", feature: "Link Company to Company", values: [false, false, true] },
  ];
  const workspaceRows = comparisonRows.filter((r) => r.group === "WORKSPACE MANAGEMENT");
  const coreRows = comparisonRows.filter((r) => r.group === "CORE FEATURES");

  return (
    <div className="p-5 pt-1 sm:p-8 sm:pt-2">
      <div className="mb-6 flex items-start gap-3">
        <button type="button" onClick={() => router.push('/')} aria-label="Go back" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Choose your plan</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">Compare workspace limits and select the plan that fits your organization.</p>
        </div>
      </div>

   

      {/* ── Comparison Table ── */}
      {/* Desktop table */}
      <div className="hidden lg:block mb-7 overflow-x-auto">
        <div className="min-w-[580px] overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-secondary-400">
                <th className="text-left px-5 py-3 text-xs tracking-wide font-semibold uppercase">Workspace Management</th>
                <th className="px-5 py-3 text-xs font-semibold">Basic</th>
                <th className="px-5 py-3 text-xs font-semibold">Pro</th>
                <th className="px-5 py-3 text-xs font-semibold">Elite</th>
              </tr>
            </thead>
            <tbody>
              {workspaceRows.map((row) => (
                <tr key={row.feature} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-gray-200 text-xs">{row.feature}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-5 py-3 text-center text-white font-medium text-xs">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-white/10 bg-white/5">
                <td className="px-5 py-2.5 text-xs tracking-wide font-semibold uppercase text-secondary-400">Core Features</td>
                <td /><td /><td />
              </tr>
              {coreRows.map((row) => (
                <tr key={row.feature} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-gray-200 text-xs">{row.feature}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-5 py-3 text-center">
                      {v
                        ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-secondary-500 text-primary-950 shadow-sm shadow-secondary-500/40 mx-auto"><Check size={12} /></span>
                        : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-400 mx-auto"><X size={12} /></span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

         {/* Billing toggle */}
      <div className="mb-7 flex justify-center">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/15 p-1.5">
          {(["Monthly", "Yearly"] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => onBillingCycleChange(cycle)}
              className={`relative min-w-24 px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                billingCycle === cycle
                  ? "bg-secondary-500 text-primary-950 shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {cycle}
              {cycle === "Yearly" && billingCycle !== "Yearly" && (
                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-emerald-500 text-primary-950 text-[8px] font-bold rounded-full">
                  -20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile/tablet comparison cards */}
      <div className="lg:hidden space-y-3 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary-400 px-1">Workspace Management</p>
        {workspaceRows.map((row) => (
          <div key={row.feature} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10">
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
          <div key={row.feature} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/10">
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

      {/* Plan cards */}
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.key;
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => onPlanSelect(plan.key)}
              className={`relative min-h-[180px] text-left rounded-2xl p-5 border transition-all duration-200 ${
                isSelected
                  ? `bg-gradient-to-br ${plan.color} border-secondary-400/60 ring-2 ring-secondary-400 ring-offset-2 ring-offset-[#0b2118] shadow-xl shadow-black/20`
                  : `bg-gradient-to-br ${plan.color} border-white/10 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-lg hover:shadow-black/15`
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#EECA53] to-[#E1A300] text-[#062D27] text-[9px] font-bold rounded-full uppercase tracking-wide whitespace-nowrap">
                  {plan.badge}
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                {plan.key === "Custom" ? (
                  <Sparkles size={18} className="text-[#EECA53]" />
                ) : plan.key === "Elite" ? (
                  <Crown size={18} className="text-white" />
                ) : (
                  <Image src={logo} alt="Audito" className="h-auto w-16 object-contain" />
                )}
                <h4 className={`text-lg font-bold ${plan.textColor}`}>{plan.name}</h4>
              </div>
              {plan.price && (
                <div className="mb-2">
                  <span className={`text-2xl font-bold ${plan.textColor}`}>{plan.price}</span>
                  {plan.period && <span className={`ml-1 text-xs ${plan.textColor} opacity-60`}>{plan.period}</span>}
                </div>
              )}
              {plan.subtitle && (
                <p className="text-[11px] text-secondary-400 font-medium mb-1">{plan.subtitle}</p>
              )}
              <p className={`text-xs ${plan.textColor} opacity-60`}>{plan.desc}</p>
              <div className={`mt-3 w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-secondary-400 bg-secondary-400" : "border-white/20"}`}>
                {isSelected && <Check size={11} className="text-primary-950" />}
              </div>
            </button>
          );
        })}
      </div>

      {(["Pro", "Elite"] as const).includes(selectedPlan as "Pro" | "Elite") && (
        <PromoCodePanel
          promoCode={promoCode}
          promoDiscount={promoDiscount}
          promoLoading={promoLoading}
          promoError={promoError}
          onPromoCodeChange={onPromoCodeChange}
          onValidate={onValidatePromo}
          onRemove={onRemovePromo}
        />
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3.5 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px"
      >
        Continue Setup
        <ArrowRight size={18} />
      </button>

      <p className="text-center text-sm text-gray-400 mt-5">
        Already have an account?{" "}
        <Link href="/login" className="text-secondary-400 hover:text-secondary-300 font-medium">Log in</Link>
      </p>
    </div>
  );
}

/* ─── Step 2: Account Type + Hierarchy ────────────────────── */

function PromoCodePanel({
  promoCode,
  promoDiscount,
  promoLoading,
  promoError,
  onPromoCodeChange,
  onValidate,
  onRemove,
}: {
  promoCode: string;
  promoDiscount: number | null;
  promoLoading: boolean;
  promoError: string;
  onPromoCodeChange: (value: string) => void;
  onValidate: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-secondary-400/20 bg-secondary-500/15 text-secondary-300"><Tag size={16} /></div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-white">Do you have a promo code?</h4>
          <p className="mt-0.5 text-xs leading-5 text-gray-400">Apply it now and your discount will be included when you continue to payment.</p>
        </div>
      </div>

      {promoDiscount !== null ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2.5">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-200"><CheckCircle2 size={16} /> {promoDiscount}% discount applied</p>
          <button type="button" onClick={onRemove} className="text-xs font-semibold text-emerald-300 transition hover:text-white">Remove code</button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={promoCode} onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onValidate(); } }} placeholder="Enter promo code" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/15 px-3 text-sm font-medium tracking-wide text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-600 focus:outline-none focus:border-secondary-500/50" />
            <button type="button" onClick={onValidate} disabled={promoLoading || !promoCode.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-secondary-400/25 bg-secondary-500/10 px-4 text-sm font-semibold text-secondary-300 transition hover:bg-secondary-500/20 disabled:cursor-not-allowed disabled:opacity-50">{promoLoading && <Loader2 size={15} className="animate-spin" />}{promoLoading ? "Checking" : "Apply code"}</button>
          </div>
          {promoError && <p className="mt-2 text-xs font-medium text-red-300">{promoError}</p>}
        </div>
      )}
    </section>
  );
}

function PromoCodeStep({
  planName,
  billingCycle,
  onNext,
  ...promoProps
}: {
  planName: "Pro" | "Elite";
  billingCycle: "Monthly" | "Yearly";
  onNext: () => void;
} & React.ComponentProps<typeof PromoCodePanel>) {
  return (
    <div className="p-5 pt-1 sm:p-8 sm:pt-2">
      <div className="mb-6">
        <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Apply a promo code</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">Your {planName} {billingCycle.toLowerCase()} plan is selected. A promo code is optional and can be applied before you continue.</p>
      </div>
      <PromoCodePanel {...promoProps} />
      <button type="button" onClick={onNext} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3.5 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px">
        Continue to account type <ArrowRight size={18} />
      </button>
    </div>
  );
}

function AccountTypeStep({
  selectedGroup,
  selectedEntityType,
  planName,
  customCompanyLevelLimit,
  onGroupSelect,
  onEntityTypeSelect,
  onNext,
  onBack,
  error,
}: {
  selectedGroup: AccountGroup | null;
  selectedEntityType: AllEntityType | null;
  planName: string;
  customCompanyLevelLimit: number;
  onGroupSelect: (g: AccountGroup) => void;
  onEntityTypeSelect: (e: AllEntityType) => void;
  onNext: () => void;
  onBack: () => void;
  error: string;
}) {
  const activeGroup = selectedGroup ?? "Customer";
  const activeConfig = accountTypes.find((t) => t.key === activeGroup)!;
  const shouldShowEntryPrices = planName !== "Custom";

  const isEntityLocked = (group: AccountGroup, entityName: AllEntityType) =>
    !canRegisterEntityType(planName, group, entityName);

  const firstAvailableEntity = (group: AccountGroup) =>
    accountTypes.find((type) => type.key === group)!.entityTypes.find((entity) => !isEntityLocked(group, entity.name))?.name;

  const isLevelLocked = (group: AccountGroup, level: number) => {
    const config = accountTypes.find((type) => type.key === group)!;
    const entity = config.entityTypes.find((item) => item.level === level);
    return entity ? isEntityLocked(group, entity.name) : false;
  };

  const handleLevelClick = (group: AccountGroup, level: number) => {
    const name = getLevelName(group, level);
    if (!name) return;
    const availableEntity = firstAvailableEntity(group);
    if (!availableEntity) return;
    if (group !== activeGroup) onGroupSelect(group);
    const config = accountTypes.find((t) => t.key === group)!;
    const et = config.entityTypes.find((e) => e.level === level)!;
    if (isEntityLocked(group, et.name)) return;
    onEntityTypeSelect(et.name);
  };

  const selectedLevel =
    selectedEntityType
      ? activeConfig.entityTypes.find((e) => e.name === selectedEntityType)?.level ?? null
      : null;
  const selectedEntity = selectedEntityType
    ? activeConfig.entityTypes.find((e) => e.name === selectedEntityType)
    : activeConfig.entityTypes[0];
  const ActiveIcon = activeConfig.icon;

  return (
    <div className="p-5 pt-1 sm:p-8 sm:pt-2">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <button type="button" onClick={onBack} aria-label="Go back" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white transition-colors sm:left-6 sm:top-6">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Choose your account type</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-400">Select the organization that best represents your workspace, then choose where it sits in the hierarchy.</p>
        </div>
      </div>

    

     

      {/* ══════════════════════════════════════
          MOBILE LAYOUT (< sm)
      ══════════════════════════════════════ */}
      <div className="sm:hidden space-y-5">
        {/* Group selector tabs */}
        <div className="grid grid-cols-3 gap-2">
          {accountTypes.map((type) => {
            const Icon = type.icon;
            const isActive = activeGroup === type.key;
            const isGroupLocked = !firstAvailableEntity(type.key);
            return (
              <button
                key={type.key}
                type="button"
                disabled={isGroupLocked}
                onClick={() => { const entity = firstAvailableEntity(type.key); onGroupSelect(type.key); if (entity) onEntityTypeSelect(entity); }}
                className={`relative flex min-h-[86px] flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl border transition-all ${isGroupLocked ? "cursor-not-allowed border-white/[0.06] bg-black/10 opacity-45" : isActive ? "bg-secondary-500/12 border-secondary-500/50 shadow-lg shadow-black/10" : "bg-white/[0.035] border-white/10"}`}
              >
                <Icon size={18} className={isActive ? "text-secondary-400" : "text-gray-400"} />
                <span className={`text-[11px] font-semibold text-center leading-tight ${isActive ? "text-secondary-400" : "text-white"}`}>{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Entity type list for selected group */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold tracking-[2px] text-secondary-500 uppercase px-1">Choose organizational level</p>
          {activeConfig.entityTypes.map((et) => {
            const isSelected = selectedEntityType === et.name;
            const isLocked = isEntityLocked(activeGroup, et.name);
            return (
              <button
                key={et.name}
                type="button"
                disabled={isLocked}
                onClick={() => onEntityTypeSelect(et.name)}
                className={`w-full min-h-[68px] flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${isLocked ? "cursor-not-allowed border-white/[0.06] bg-black/10 opacity-45" : isSelected ? "bg-secondary-500/10 border-secondary-500/45 shadow-lg shadow-black/10" : "bg-white/[0.035] border-white/10"}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${et.color ?? "bg-white/20"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? "text-secondary-400" : "text-white"}`}>{et.label ?? et.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{et.desc}</p>
                </div>
                {shouldShowEntryPrices && ENTITY_ENTRY_PRICE_LABELS[et.name] && <span className="self-end text-[10px] font-semibold text-secondary-300">{ENTITY_ENTRY_PRICE_LABELS[et.name]}</span>}
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500"><LockKeyhole size={12} /> Upgrade</span>
                ) : isSelected && <Check size={15} className="text-secondary-400 shrink-0" />}
              </button>
            );
          })}
        </div>
        
      </div>

      {/* ══════════════════════════════════════
          DESKTOP LAYOUT (sm+)
      ══════════════════════════════════════ */}
      <div className="hidden sm:block">
        {/* Top: 3 account type cards */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          {accountTypes.map((type) => {
            const Icon = type.icon;
            const isActive = activeGroup === type.key;
            const isGroupLocked = !firstAvailableEntity(type.key);
            return (
              <button
                key={type.key}
                type="button"
                disabled={isGroupLocked}
                onClick={() => { const entity = firstAvailableEntity(type.key); onGroupSelect(type.key); if (entity) onEntityTypeSelect(entity); }}
                className={`group relative min-h-[132px] text-left rounded-2xl p-4 border transition-all duration-200 ${isGroupLocked ? "cursor-not-allowed border-white/[0.06] bg-black/10 opacity-45" : isActive ? "bg-secondary-500/10 border-secondary-500/50 shadow-lg shadow-black/10" : "bg-white/[0.035] border-white/10 hover:-translate-y-0.5 hover:bg-white/[0.055] hover:border-white/20"}`}
              >
                {isActive && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-secondary-500 text-primary-950"><Check size={12} strokeWidth={3} /></span>}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${isActive ? "bg-secondary-500/20" : "bg-white/5 group-hover:bg-white/10"}`}>
                  <Icon size={18} className={isActive ? "text-secondary-400" : "text-gray-400"} />
                </div>
                <p className={`text-sm font-semibold ${isActive ? "text-secondary-400" : "text-white"}`}>{type.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{type.description}</p>
                
              </button>
            );
          })}
        </div>
       

        {/* Bottom: full-width hierarchy grid */}
        <div className="rounded-2xl border border-white/[0.08] bg-black/10 p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[2px] text-secondary-500 uppercase">Organization hierarchy</p>
              <p className="mt-1 text-xs text-gray-500">Higher levels have broader workspace oversight.</p>
            </div>
            <span className="hidden md:inline text-[10px] text-gray-500">Select one level to continue</span>
          </div>
          <div className="min-w-0">
            <div className="grid grid-cols-3 gap-3">
              {accountTypes.map((type) => {
                const isColActive = activeGroup === type.key;
                return (
                  <div key={type.key} className="flex flex-col gap-1.5">
                    {ALL_LEVELS.map((lvl) => {
                      const name = getLevelName(type.key, lvl);
                      const colorCls = getLevelStyle(type.key, lvl);
                      const isEmpty = !name;
                      const isLocked = !isEmpty && isLevelLocked(type.key, lvl);
                      const isSelected = isColActive && selectedLevel === lvl && !isEmpty;
                      return (
                        <div key={lvl} className="flex items-center gap-2">
                          <span className={`text-[9px] font-mono w-5 text-right shrink-0 ${isEmpty ? "text-white/10" : "text-secondary-600"}`}>L{lvl}</span>
                          <button
                            type="button"
                            disabled={isEmpty || isLocked}
                            onClick={() => handleLevelClick(type.key, lvl)}
                            title={isLocked ? `${planName} does not include ${name} as a workspace entry type. Choose an available type or upgrade the plan.` : undefined}
                            className={`relative flex-1 h-10 rounded-xl px-3 text-xs font-medium text-left transition-all ${isEmpty ? "opacity-[0.08] cursor-default" : isLocked ? "cursor-not-allowed bg-white/[0.035] opacity-35 grayscale" : "cursor-pointer hover:brightness-110 hover:translate-x-0.5"} ${isLocked ? "" : colorCls ?? "bg-white/5"} ${isSelected ? "ring-2 ring-secondary-300 ring-offset-2 ring-offset-[#0a1d15] shadow-lg shadow-black/20" : ""} text-white`}
                          >
                            <span className="flex items-center justify-between gap-1">
                              <span className="truncate">{name ?? ""}</span>
                              {isLocked ? <LockKeyhole size={11} className="shrink-0" /> : isSelected && <Check size={12} className="shrink-0" strokeWidth={3} />}
                            </span>
                            {shouldShowEntryPrices && ENTITY_ENTRY_PRICE_LABELS[name as AllEntityType] && <span className="absolute bottom-1 right-2 text-[9px] font-semibold text-secondary-200">{ENTITY_ENTRY_PRICE_LABELS[name as AllEntityType]}</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

          {/* Selected account summary — kept at the top so context stays visible while choosing a level. */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/[0.11] via-primary-500/[0.08] to-transparent">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-secondary-500/25 bg-secondary-500/15 text-secondary-400 shadow-lg shadow-black/10">
              <ActiveIcon size={21} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-500">Currently selected</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold text-white">{selectedEntity?.label ?? selectedEntity?.name ?? activeConfig.label}</p>
                {selectedEntity && <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 text-[10px] font-medium text-gray-400">Level {selectedEntity.level}</span>}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{activeConfig.detail.desc}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:max-w-[46%] sm:justify-end">
            {activeConfig.detail.capabilities.map((cap) => {
              const CapIcon = cap.icon;
              return (
                <span key={cap.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/10 px-2.5 py-1.5 text-[10px] font-medium text-gray-300">
                  <CapIcon size={11} className="text-secondary-400" />
                  {cap.label}
                </span>
              );
            })}

            
          </div>
        </div>
      </div>
      </div>
      

      {error && (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3.5 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px"
      >
        Continue Setup
        <ArrowRight size={18} />
      </button>

      <p className="text-center text-sm text-gray-400 mt-5">
        Already have an account?{" "}
        <Link href="/login" className="text-secondary-400 hover:text-secondary-300 font-medium">Log in</Link>
      </p>
    </div>
  );
}

/* ─── Register Form ──────────────────────────────────────────────── */

function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const planFromUrl = searchParams.get("plan");
  const typeFromUrl = searchParams.get("type");
  const billingFromUrl = searchParams.get("billing");
  const isPricingPromoPlan = planFromUrl === "Pro" || planFromUrl === "Elite";

  const [step, setStep] = useState(() => {
    if (isPricingPromoPlan) return 1;
    if (planFromUrl && ["Basic", "Pro", "Elite"].includes(planFromUrl)) return 2;
    if (planFromUrl === "Custom") return 2;
    return 1;
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AccountGroup | null>(
    (typeFromUrl && ["Customer", "Company", "Audit Firm"].includes(typeFromUrl) ? typeFromUrl : "Customer") as AccountGroup
  );
  const [selectedEntityType, setSelectedEntityType] = useState<AllEntityType | null>(
    (typeFromUrl && ["Customer", "Company", "Audit Firm"].includes(typeFromUrl)
      ? accountTypes.find((t) => t.key === typeFromUrl)!.entityTypes[0].name
      : "Customer") as AllEntityType
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  const [isCustomPlan, setIsCustomPlan] = useState(false);
  const [customLimitsReady, setCustomLimitsReady] = useState(false);
  const [customSolution, setCustomSolution] = useState<CustomSolutionLimits>(() => normalizeCustomSolution());

  const [formData, setFormData] = useState<RegisterPayload & { promo_code?: string }>({
    entity_type: "Customer",
    org_name: "",
    registration_number: "",
    org_email: "",
    address_line_1: "",
    address_line_2: "",
    address_line_3: "",
    country: "",
    org_phone_number: "",
    company_type: "",
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    plan_name: "Free",
    billing_cycle: billingFromUrl === "Yearly" ? "Yearly" : "Monthly",
    timezone: "",
    promo_code: "",
  });

  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [agreedToPrivacyPolicy, setAgreedToPrivacyPolicy] = useState(false);

  const selectedCountry = countries.find((c) => c.country === formData.country);
  const dialCode = selectedCountry?.international_dialing || "";

  useEffect(() => {
    countriesApi.getAll().then(setCountries);
  }, []);

  useEffect(() => {
    const plan = searchParams.get("plan");
    const type = searchParams.get("type");
    const billing = searchParams.get("billing");

    if (type && ["Customer", "Company", "Audit Firm"].includes(type)) {
      const group = type as AccountGroup;
      setSelectedGroup(group);
      const defaultEntity = accountTypes.find((t) => t.key === group)!.entityTypes
        .find((entity) => canRegisterEntityType(plan || "Basic", group, entity.name))?.name;
      if (!defaultEntity) return;
      setSelectedEntityType(defaultEntity);
      setFormData((prev) => ({ ...prev, entity_type: defaultEntity }));
    }

    if (plan) {
      if (plan === "Custom") {
        setIsCustomPlan(true);
        setFormData((prev) => ({ ...prev, plan_name: "Custom" }));

        try {
          const raw = sessionStorage.getItem("custom_solution_payload");
          if (raw) {
            const payload = JSON.parse(raw);
            sessionStorage.removeItem("custom_solution_payload");
            if (payload.customSolution) {
              setCustomSolution(normalizeCustomSolution(payload.customSolution));
              setCustomLimitsReady(true);
            }
            if (payload.billing_cycle) {
              setFormData((prev) => ({ ...prev, billing_cycle: payload.billing_cycle }));
            }
          }
        } catch {
          // Ignore parse errors
        }
      } else if (["Basic", "Pro", "Elite"].includes(plan)) {
        setFormData((prev) => ({ ...prev, plan_name: plan }));
      }
    }
    if (billing === "Monthly" || billing === "Yearly") {
      setFormData((prev) => ({ ...prev, billing_cycle: billing }));
    }
  }, [searchParams]);

  // Keep the selected entry type valid when the selected plan changes.
  useEffect(() => {
    const planName = formData.plan_name ?? "Basic";
    if (selectedGroup && selectedEntityType && canRegisterEntityType(planName, selectedGroup, selectedEntityType)) return;

    const replacement = accountTypes
      .map((group) => ({ group: group.key, entity: group.entityTypes.find((item) => canRegisterEntityType(planName, group.key, item.name))?.name }))
      .find((item) => item.entity);
    if (!replacement?.entity) return;
    const nextEntityType = replacement.entity;
    setSelectedGroup(replacement.group);
    setSelectedEntityType(nextEntityType);
    setFormData((prev) => ({ ...prev, entity_type: nextEntityType }));
  }, [formData.plan_name, selectedEntityType, selectedGroup]);

  // Auto-sync org_email to admin email
  useEffect(() => {
    setFormData((prev) => ({ ...prev, email: prev.org_email || "" }));
  }, [formData.org_email]);

  const updateField = (field: keyof RegisterPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleGroupSelect = (group: AccountGroup) => {
    setSelectedGroup(group);
    const defaultEntity = accountTypes.find((t) => t.key === group)!.entityTypes
      .find((entity) => canRegisterEntityType(formData.plan_name ?? "Basic", group, entity.name))?.name;
    if (!defaultEntity) return;
    setSelectedEntityType(defaultEntity);
    setFormData((prev) => ({ ...prev, entity_type: defaultEntity }));
  };

  const handleEntityTypeSelect = (entityType: AllEntityType) => {
    setSelectedEntityType(entityType);
    setFormData((prev) => ({ ...prev, entity_type: entityType }));
  };

  const handleStep1Next = () => {
    if (!formData.plan_name || !["Basic", "Pro", "Elite", "Custom"].includes(formData.plan_name)) {
      setError("Please select a plan to continue.");
      return;
    }
    setError("");
    if (formData.plan_name === "Custom") {
      setIsCustomPlan(true);
      if (customLimitsReady) {
        setStep(4);
      } else {
        setStep(2);
      }
    } else {
      setStep(2);
    }
  };

  const handleStep2Next = () => {
    if (!selectedEntityType) {
      setError("Please select an entity type to continue.");
      return;
    }
    if (!selectedGroup || !canRegisterEntityType(formData.plan_name ?? "Basic", selectedGroup, selectedEntityType)) {
      setError(`${formData.plan_name} does not include the selected organization entry type. Choose an available type or upgrade your plan.`);
      return;
    }
    setError("");
    setStep(isCustomPlan && !customLimitsReady ? 3 : 4);
  };

  const passwordRequirements = useMemo(() => ({
    length: formData.password.length >= 8,
    upper: /[A-Z]/.test(formData.password),
    lower: /[a-z]/.test(formData.password),
    number: /[0-9]/.test(formData.password),
    special: /[@$!%*?&#]/.test(formData.password),
  }), [formData.password]);

  const passwordStrength = useMemo(() => {
    const met = Object.values(passwordRequirements).filter(Boolean).length;
    if (met === 0) return { label: "", color: "bg-gray-800", width: "0%", text: "gray-500" };
    if (met <= 2) return { label: "Weak", color: "bg-red-500", width: "33%", text: "text-red-500" };
    if (met <= 4) return { label: "Medium", color: "bg-yellow-500", width: "66%", text: "text-yellow-500" };
    return { label: "Strong", color: "bg-emerald-500", width: "100%", text: "text-emerald-500" };
  }, [passwordRequirements]);

  const validateStep3 = () => {
    if (!formData.org_name.trim()) return "Organization name is required.";
    if (
      selectedEntityType === "Company" &&
      (!formData.company_type || !formData.company_type.trim())
    )
      return "Company type is required.";
    if (!formData.registration_number?.trim()) return "Registration number is required.";
    if (!formData.org_email?.trim()) return "Organization email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.org_email || ""))
      return "Invalid organization email address.";
    if (!formData.country?.trim()) return "Country is required.";
    if (!formData.org_phone_number?.trim()) return "Organization phone number is required.";
    if (!formData.address_line_1?.trim()) return "Address line 1 is required.";
    if (!formData.address_line_2?.trim()) return "Address line 2 is required.";
    return null;
  };

  const validateStep4 = () => {
    if (!formData.first_name.trim()) return "First name is required.";
    if (!formData.last_name.trim()) return "Last name is required.";
    if (!formData.email.trim()) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      return "Invalid email address.";
    if (!formData.phone_number?.trim()) return "Phone number is required.";

    // Password Strength Check
    const { length, upper, lower, number, special } = passwordRequirements;
    if (!length || !upper || !lower || !number || !special) {
      return "Please ensure your password meets all requirements.";
    }

    if (!formData.password) return "Password is required.";
    if (formData.password !== confirmPassword) return "Passwords do not match.";
    if (!agreedToPrivacyPolicy) return "You must agree to the Privacy Policy to create an account.";
    return null;
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code.");
      return;
    }
    setPromoLoading(true);
    setPromoError("");
    setPromoDiscount(null);
    try {
      const res = await authApi.validatePromoCode(promoCode.trim());
      if (res.success && res.data) {
        setPromoDiscount(res.data.discount_percentage);
        setFormData((prev) => ({ ...prev, promo_code: promoCode.trim().toUpperCase() }));
      } else {
        setPromoError((res as any).message || "Invalid or expired promo code.");
        setFormData((prev) => ({ ...prev, promo_code: "" }));
      }
    } catch {
      setPromoError("Failed to validate promo code.");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
    setPromoDiscount(null);
    setPromoError("");
    setFormData((prev) => ({ ...prev, promo_code: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep4();
    if (err) { setError(err); return; }
    setLoading(true);
    setError("");
    try {
      const payload = isCustomPlan
        ? { ...formData, custom_solution: normalizeCustomSolution(customSolution) }
        : formData;
      const res = (await authApi.register(payload)) as { success: boolean; message?: string };
      // Email verification comes first; paid plans continue to payment after
      // the email is verified (see the verify-email page).
      if (res.success) setIsRegistered(true);
      else setError(res.message || "Registration failed.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const activeConfig = selectedGroup
    ? accountTypes.find((t) => t.key === selectedGroup)!
    : null;

  /* ── Success screen ── */
  if (isRegistered) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col pt-12">
        <div className="max-w-md mx-auto w-full px-4">
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center backdrop-blur-xl">
            <CheckCircle2 className="mx-auto text-secondary-500 mb-6" size={64} />
            <h1 className="text-xl font-bold text-white mb-2">Check Your Email</h1>
            <p className="text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed">
              We've sent a verification link to{" "}
              <span className="text-white font-medium">{formData.email}</span>.
              Please click the link inside to activate your account.
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 px-6 py-3 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400"
            >
              Go to Login <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-4 pb-12 pt-16 sm:py-12">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-primary-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-60 h-60 bg-accent-500/10 rounded-full blur-3xl" />
      </div>

      <div className="glass relative mx-auto max-w-4xl overflow-hidden rounded-3xl border-white/10 pt-6 shadow-2xl shadow-black/20 sm:pt-8">
        {/* Logo */}
        <div className="mb-5 px-5 text-center sm:px-8">
          <Link href="/" className="inline-block">
            <Image src={logo} alt="Audito" width={110} height={30} className="h-8 mx-auto" />
          </Link>
          <p className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">
            Create your workspace
          </p>
        </div>

        <StepIndicator current={step} total={4} />
        <p className={"mb-5 px-5 text-center text-xs font-medium text-gray-500 sm:px-8 " + (isPricingPromoPlan && step === 1 ? "hidden" : "")}>
          {step === 1 && "Step 1 of 4 — Choose Your Plan"}
          {step === 2 && "Step 2 of 4 — Account Type"}
          {step === 3 && (isCustomPlan && !customLimitsReady ? "Step 3 of 4 — Configure Plan" : "Step 3 of 4 — Organization Details")}
          {step === 4 && (isCustomPlan && !customLimitsReady ? "Step 4 of 4 — Organization Details" : "Step 4 of 4 — Admin Account")}
          {step === 5 && "Step 4 of 4 — Admin Account"}
        </p>
        {isPricingPromoPlan && step === 1 && <p className="mb-5 px-5 text-center text-xs font-medium text-gray-500 sm:px-8">Step 1 of 4 — Promo Code</p>}

        {/* ─── Step 1: Plan Selection ── */}
        {step === 1 && !planFromUrl && (
          <PlanSelectionStep
            selectedPlan={formData.plan_name || "Basic"}
            billingCycle={formData.billing_cycle as "Monthly" | "Yearly"}
            onPlanSelect={(plan) => {
              setFormData((prev) => ({ ...prev, plan_name: plan }));
              if (plan !== "Pro" && plan !== "Elite") handleRemovePromo();
              setError("");
            }}
            onBillingCycleChange={(cycle) => updateField("billing_cycle", cycle)}
            onNext={handleStep1Next}
            error={error}
            promoCode={promoCode}
            promoDiscount={promoDiscount}
            promoLoading={promoLoading}
            promoError={promoError}
            onPromoCodeChange={(value) => { setPromoCode(value); setPromoError(""); }}
            onValidatePromo={() => void handleValidatePromo()}
            onRemovePromo={handleRemovePromo}
          />
        )}

        {/* ─── Step 2: Merged account type + hierarchy ── */}
        {step === 1 && isPricingPromoPlan && (
          <PromoCodeStep
            planName={planFromUrl as "Pro" | "Elite"}
            billingCycle={formData.billing_cycle as "Monthly" | "Yearly"}
            promoCode={promoCode}
            promoDiscount={promoDiscount}
            promoLoading={promoLoading}
            promoError={promoError}
            onPromoCodeChange={(value) => { setPromoCode(value); setPromoError(""); }}
            onValidate={() => void handleValidatePromo()}
            onRemove={handleRemovePromo}
            onNext={() => { setError(""); setStep(2); }}
          />
        )}

        {step === 2 && (
          <>
            <AccountTypeStep
            selectedGroup={selectedGroup}
            selectedEntityType={selectedEntityType}
            planName={formData.plan_name ?? "Basic"}
            customCompanyLevelLimit={6}
            onGroupSelect={handleGroupSelect}
            onEntityTypeSelect={handleEntityTypeSelect}
            onNext={handleStep2Next}
            onBack={() => {
              if (isPricingPromoPlan) setStep(1);
              else if (isCustomPlan && customLimitsReady) router.push("/custom-solution");
              else if (isCustomPlan) setStep(1);
              else router.push("/");
            }}
            error={error}
            />
          </>
        )}

        {/* ─── Step 3: Custom Configuration (when coming from /custom-solution without pre-filled limits) ── */}
        {step === 3 && isCustomPlan && !customLimitsReady && (() => {
          const updateCustomLimit = (key: keyof typeof CUSTOM_PLAN_MINIMUM_LIMITS, value: number) => {
            const feature = CUSTOM_CONFIGURATION_FEATURES.find((item) => item.key === key)!;
            setCustomSolution((previous) => ({ ...previous, [key]: Math.min(feature.max, Math.max(feature.min, value)) }));
          };

          return (
            <div className="p-5 pt-1 sm:p-8 sm:pt-2">
              <div className="mb-6 flex items-start gap-3">
                <button type="button" onClick={() => setStep(2)} aria-label="Go back" className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6">
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Configure your custom plan</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">Start with every Elite feature, then increase the capacity your workspace requires.</p>
                </div>
              </div>

              {error && (
                <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="mb-7 space-y-4">
                <div className="rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/10 to-transparent p-4">
                  <p className="text-sm font-semibold text-white">Elite is your starting point</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-400">Every custom plan includes Elite&apos;s feature set. Capacity can increase from this baseline, but never decrease below it.</p>
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Capacity</p>
                {CUSTOM_CONFIGURATION_FEATURES.map((feature) => {
                  const value = customSolution[feature.key];
                  const volume = (value / feature.max) * 100;
                  const eliteMarker = (feature.min / feature.max) * 100;
                  return (
                    <div key={feature.key} className="rounded-2xl border border-white/[0.08] bg-black/10 p-4 transition-colors hover:bg-white/[0.035]">
                      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(240px,0.9fr)] sm:items-center">
                        <div><p className="text-sm font-medium text-white">{feature.label}</p><p className="mt-0.5 text-[11px] text-gray-500">{feature.desc}</p></div>
                        <div>
                          <div className="mb-2 flex justify-end"><output className="text-[11px] font-semibold text-secondary-300">{value}</output></div>
                          <div className="relative">
                            <input type="range" min={0} max={feature.max} value={value} onChange={(event) => updateCustomLimit(feature.key, Number(event.target.value))} aria-label={`${feature.label} volume`} className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-secondary-500" style={{ background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${volume}%, rgba(255,255,255,.1) ${volume}%, rgba(255,255,255,.1) 100%)` }} />
                            <span aria-hidden="true" className="pointer-events-none absolute -top-1 h-4 w-px bg-secondary-200" style={{ left: `${eliteMarker}%` }} />
                            <span aria-hidden="true" className="pointer-events-none absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-secondary-300" style={{ left: `${eliteMarker}%` }}>Elite {feature.min}</span>
                          </div>
                          <div className="mt-1.5 flex justify-between text-[10px] text-gray-500"><span>0</span><span>{feature.max}</span></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <p className="pt-3 text-[10px] font-semibold uppercase tracking-[2px] text-secondary-500">Included Elite features</p>
                {[["Auditor Evaluation System", "Evaluate auditor performance with tests and scoring"], ["Company-to-Company Linking", "Link and collaborate with external organizations"]].map(([title, description]) => (
                  <div key={title} className="flex items-center justify-between gap-4 rounded-2xl border border-secondary-500/15 bg-secondary-500/[0.06] p-4"><div><p className="text-sm font-medium text-white">{title}</p><p className="mt-0.5 text-[11px] text-gray-500">{description}</p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-secondary-500/25 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-semibold text-secondary-300"><Check size={12} /> Included</span></div>
                ))}
              </div>

              <div className="mb-7 rounded-2xl border border-secondary-500/20 bg-gradient-to-r from-secondary-500/10 to-transparent p-4 sm:p-5">
                <p className="text-xs text-secondary-400 font-semibold uppercase tracking-wide mb-2">Your Custom Selection</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {CUSTOM_CONFIGURATION_FEATURES.map((feature) => <span key={feature.key} className="text-gray-400">{feature.label}: <span className="font-medium text-white">{customSolution[feature.key]}</span></span>)}
                  <span className="text-gray-400">Elite features: <span className="font-medium text-white">Included</span></span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(4);
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px"
              >
                Next: Organization Details
                <ArrowRight size={16} />
              </button>
            </div>
          );
        })()}

        {/* ─── Step 4: Organization Details ──────────────────────────── */}
        {step === 4 && (
          <div className="p-5 pt-1 sm:p-8 sm:pt-2">
            <div className="mb-7 flex items-start gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(isCustomPlan && !customLimitsReady ? 3 : 2);
                }}
                aria-label="Go back"
                className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Organization details</h3>
                  <span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-semibold text-secondary-400">{activeConfig?.label}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">Tell us about the organization this Audito workspace belongs to.</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-5">
              <Input
                label="Organization Name"
                required
                value={formData.org_name}
                onChange={(v) => updateField("org_name", v)}
                placeholder="Enter organization name"
              />

              {selectedEntityType === "Company" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Company Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.company_type || ""}
                    onChange={(e) => updateField("company_type", e.target.value)}
                    className="w-full min-h-11 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white transition-all focus:border-secondary-400/60 focus:outline-none focus:ring-4 focus:ring-secondary-500/10"
                  >
                    <option value="" disabled className="bg-[#0c2218] text-white">Select company type</option>
                    <option value="Ready to sell" className="bg-[#0c2218] text-white">Ready to sell</option>
                    <option value="Ready to bill" className="bg-[#0c2218] text-white">Ready to bill</option>
                  </select>
                </div>
              )}

              <Input
                label="Registration Number"
                required
                value={formData.registration_number || ""}
                onChange={(v) => updateField("registration_number", v)}
                placeholder="Business registration number"
              />

              <Input
                label="Organization Email"
                required
                type="email"
                value={formData.org_email || ""}
                onChange={(v) => updateField("org_email", v)}
                placeholder="info@company.com"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Country Dropdown */}
                <div className="relative">
                  <label className="mb-2 block text-sm font-medium text-gray-300">Country <span className="text-red-400">*</span></label>
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white transition-all hover:border-white/20"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  >
                    {formData.country ? (
                      <>
                        <span>{selectedCountry?.flag}</span>
                        <span className="truncate">{formData.country}</span>
                        {dialCode && (
                          <span className="text-gray-500 ml-auto text-xs">{dialCode}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500">Country</span>
                    )}
                  </div>
                  {showCountryDropdown && (
                    <div className="absolute z-50 mt-2 max-h-60 w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0b2118]/95 shadow-2xl backdrop-blur-xl">
                      <div className="p-2 border-b border-white/10">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search countries..."
                          className="w-full rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-secondary-400/60 focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-40">
                        {countries
                          .filter((c) =>
                            c.country.toLowerCase().includes(countrySearch.toLowerCase())
                          )
                          .map((c) => (
                            <div
                              key={c.id}
                              className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-white/10 ${formData.country === c.country
                                ? "bg-secondary-500/15 text-secondary-400"
                                : "text-white"
                                }`}
                              onClick={() => {
                                const tz = COUNTRY_TIMEZONE_MAP[c.country_code] ?? "";
                                setFormData(prev => ({ ...prev, country: c.country, timezone: tz }));
                                setError("");
                                setShowCountryDropdown(false);
                                setCountrySearch("");
                              }}
                            >
                              <span>{c.flag}</span>
                              <span className="truncate">{c.country}</span>
                              {c.international_dialing && (
                                <span className="text-gray-500 ml-auto text-xs">
                                  {c.international_dialing}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Org Phone */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Phone number <span className="text-red-400">*</span></label>
                  <div className="flex">
                    {dialCode && (
                      <span className="inline-flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-gray-400">
                        {dialCode}
                      </span>
                    )}
                    <input
                      type="text"
                      value={formData.org_phone_number || ""}
                      onChange={(e) => updateField("org_phone_number", e.target.value)}
                      placeholder="Phone number"
                      className={`min-h-11 w-full border border-white/10 bg-black/10 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-400/60 focus:outline-none focus:ring-4 focus:ring-secondary-500/10 ${dialCode ? "rounded-r-xl" : "rounded-xl"
                        }`}
                    />
                  </div>
                </div>
              </div>

              {/* Timezone hint — outside the grid so it never disrupts Country/Phone layout */}
              {formData.timezone && (
                <div className="-mt-1 flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2 text-[11px] text-gray-500">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-secondary-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Timezone auto-detected: <span className="text-secondary-500 font-medium">{formData.timezone}</span>
                </div>
              )}

              <div className="space-y-5 border-t border-white/[0.07] pt-5">
                <Input
                  label="Address Line 1"
                  required
                  value={formData.address_line_1 || ""}
                  onChange={(v) => updateField("address_line_1", v)}
                  placeholder="Street address, P.O. box"
                />
                <Input
                  label="Address Line 2"
                  required
                  value={formData.address_line_2 || ""}
                  onChange={(v) => updateField("address_line_2", v)}
                  placeholder="Apartment, suite, unit, building, floor, etc."
                />
                <Input
                  label="Address Line 3"
                  value={formData.address_line_3 || ""}
                  onChange={(v) => updateField("address_line_3", v)}
                  placeholder="City, State/Province, Region (optional)"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const err = validateStep3();
                  if (err) { setError(err); return; }
                  setError("");
                  setStep(5);
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px"
              >
                Next: Admin Account
                <ArrowRight size={16} />
              </button>
            </div>

            <p className="text-center text-sm text-gray-400 mt-4">
              Already have an account?{" "}
              <Link href="/login" className="text-secondary-400 hover:text-secondary-300 font-medium">
                Log in
              </Link>
            </p>
          </div>
        )}

        {/* ─── Step 5: Admin Account ─────────────────────────────────── */}
        {step === 5 && (
          <form onSubmit={handleSubmit} className="p-5 pt-1 sm:p-8 sm:pt-2">
            <div className="mb-7 flex items-start gap-3">
              <button
                type="button"
                onClick={() => setStep(isCustomPlan && !customLimitsReady ? 3 : 4)}
                aria-label="Go back"
                className="absolute left-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-6"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Admin account</h3>
                  <span className="rounded-full border border-secondary-500/20 bg-secondary-500/10 px-2.5 py-1 text-[10px] font-semibold text-secondary-400">{activeConfig?.label}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-400">Create the primary administrator who will manage this workspace.</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  required
                  value={formData.first_name}
                  onChange={(v) => updateField("first_name", v)}
                  placeholder="First name"
                />
                <Input
                  label="Last Name"
                  required
                  value={formData.last_name}
                  onChange={(v) => updateField("last_name", v)}
                  placeholder="Last name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Email <span className="text-red-400">*</span>
                    <span className="ml-1.5 text-[10px] text-secondary-500 font-normal">(same as organization email)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    readOnly
                    className="min-h-11 w-full cursor-not-allowed rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-sm text-white/50 placeholder-gray-500"
                    placeholder="auto-filled from organization email"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Phone number <span className="text-red-400">*</span></label>
                  <div className="flex">
                    {dialCode && (
                      <span className="inline-flex h-[46px] items-center rounded-l-xl border border-r-0 border-white/10 bg-white/[0.04] px-3 text-sm text-gray-400">
                        {dialCode}
                      </span>
                    )}
                    <input
                      type="text"
                      value={formData.phone_number || ""}
                      onChange={(e) => updateField("phone_number", e.target.value)}
                      placeholder="Phone number"
                      className={`h-[46px] w-full border border-white/10 bg-black/10 px-4 py-3 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-400/60 focus:outline-none focus:ring-4 focus:ring-secondary-500/10 ${dialCode ? "rounded-r-xl" : "rounded-xl"
                        }`}
                    />
                  </div>
                </div>
              </div>

          

              {/* Password Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-white/10 bg-black/10 px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 transition-all focus:border-secondary-400/60 focus:outline-none focus:ring-4 focus:ring-secondary-500/10"
                      placeholder="Strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`min-h-11 w-full rounded-xl border bg-black/10 px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 transition-all focus:outline-none focus:ring-4 ${
                        confirmPassword && formData.password !== confirmPassword 
                        ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10" 
                        : "border-white/10 focus:border-secondary-400/60 focus:ring-secondary-500/10"
                      }`}
                      placeholder="Repeat password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              {formData.password && (
                <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-white/[0.08] bg-black/10 p-4 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">Security Strength</span>
                    <span className={`text-[10px] uppercase tracking-wider ${passwordStrength.text}`}>{passwordStrength.label}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                    <div 
                      className={`h-full transition-all duration-500 ${passwordStrength.color}`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {[
                      { key: "length", label: "8+ Characters" },
                      { key: "upper", label: "Uppercase Letter" },
                      { key: "lower", label: "Lowercase Letter" },
                      { key: "number", label: "One Number" },
                      { key: "special", label: "Special Character (@$!%*?&#)" },
                    ].map((req) => (
                      <div key={req.key} className="flex items-center gap-2">
                        <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border transition-colors ${
                          passwordRequirements[req.key as keyof typeof passwordRequirements] 
                          ? "bg-secondary-500/20 border-secondary-500/50" 
                          : "border-white/10"
                        }`}>
                          {passwordRequirements[req.key as keyof typeof passwordRequirements] && <Check size={8} className="text-secondary-400" />}
                        </div>
                        <span className={`text-[10px] font-medium transition-colors ${
                          passwordRequirements[req.key as keyof typeof passwordRequirements] ? "text-white" : "text-gray-500"
                        }`}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy Policy Agreement */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreedToPrivacyPolicy}
                    onChange={(e) => setAgreedToPrivacyPolicy(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${
                    agreedToPrivacyPolicy
                      ? "bg-secondary-500 border-secondary-500"
                      : "border-white/30 bg-white/5 group-hover:border-white/50"
                  }`}>
                    {agreedToPrivacyPolicy && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-950" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-400 leading-snug">
                  I agree to the{" "}
                  <Link
                    href="/privacy-policies"
                    target="_blank"
                    className="text-secondary-400 hover:text-secondary-300 font-medium underline underline-offset-2"
                  >
                    Privacy Policy
                  </Link>
                  {" "}and acknowledge that my data will be processed in accordance with it.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !agreedToPrivacyPolicy}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-secondary-400 to-secondary-500 py-3 font-semibold text-primary-950 shadow-lg shadow-secondary-950/25 transition-all hover:from-secondary-300 hover:to-secondary-400 active:translate-y-px disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : "Create Account"}
              </button>
            </div>

            <p className="text-center text-sm text-gray-400 mt-4">
              Already have an account?{" "}
              <Link href="/login" className="text-secondary-400 hover:text-secondary-300 font-medium">
                Log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── Page Export ─────────────────────────────────────────────────── */

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-transparent">
          <Loader2 size={32} className="animate-spin text-secondary-400" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
