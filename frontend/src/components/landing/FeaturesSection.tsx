"use client";

import Image from "next/image";
import Link from "next/link";
import Reveal from "./Reveal";
import {
  Building2,
  PieChart,
  Gauge,
  ClipboardList,
  Users,
  TrendingUp,
  GitBranch,
  ArrowRight,
  Zap,
  PlayCircle,
} from "lucide-react";

import companyManagementHierarchyImg from "@/assets/landing/features/company-layer-management-hierarchy.png";
import departmentStructureHierarchyImg from "@/assets/landing/features/department-structure-hierarchy.png";
import auditCapacityDashboardImg from "@/assets/landing/features/number-of-audits-workflow.png";
import checklistLibraryImg from "@/assets/landing/features/checklist-library.png";
import feature5Img from "@/assets/landing/features/Auditor Management.png";
import feature6Img from "@/assets/landing/features/Auditor Performance Analytics.png";
import feature7Img from "@/assets/landing/features/Cross-Company Audits.png";
import overviewImg from "@/assets/landing/feature-main.png";

const features = [
  { id: 1, anchor: "company-layer-management", icon: Building2, title: "Company Layer Management", layout: "left", image: companyManagementHierarchyImg,
    description: "Manage audits across different company entities or organizations within the platform. This allows users to organize audits separately for each company or business unit." },
  { id: 2, anchor: "department-structure", icon: PieChart, title: "Department Structure", layout: "right", image: departmentStructureHierarchyImg,
    description: "Create and manage multiple departments and department heads inside a company (such as HR, Operations, Quality, Warehouse) to organize audits and assign responsibilities more efficiently." },
  { id: 3, anchor: "number-of-audits", icon: Gauge, title: "Number Of Audits", layout: "left", image: auditCapacityDashboardImg,
    description: "The total number of audits that can be conducted within the system. This controls how many audit processes or inspection cycles can be performed." },
  { id: 4, anchor: "different-types-of-auditss", icon: ClipboardList, title: "Different Types of Audits", layout: "right", image: checklistLibraryImg,
    description: "The number of audit templates or checklists that can be created and used to standardize audit procedures across departments or companies." },
  { id: 5, anchor: "auditor-management", icon: Users, title: "Auditor Management", layout: "left", image: feature5Img,
    description: "The number of auditors who can perform audits within the platform. Auditors can conduct inspections, submit reports, and monitor corrective actions taken." },
  { id: 6, anchor: "auditor-performance-analytics", icon: TrendingUp, title: "Auditor Performance Analytics", layout: "right", image: feature6Img,
    description: "A performance evaluation system that measures auditors based on audit results, completion quality, time and compliance accuracy." },
  { id: 7, anchor: "cross-company-audits", icon: GitBranch, title: "Cross-Company Audits", layout: "left", image: feature7Img,
    description: "Allows organizations to perform audits between companies, such as suppliers, partners, or external organizations to ensure compliance and quality standards." },
];

const overviewHighlights = [
  { id: 1, label: "Company Layer Management", target: "company-layer-management", icon: Building2, tone: "emerald" },
  { id: 2, label: "Department Structure", target: "department-structure", icon: PieChart, tone: "violet" },
  { id: 3, label: "Number Of Audits", target: "number-of-audits", icon: Gauge, tone: "amber" },
  { id: 4, label: "Different Types of Audits", target: "different-types-of-auditss", icon: ClipboardList, tone: "pink" },
  { id: 5, label: "Auditor Performance Analytics", target: "auditor-performance-analytics", icon: TrendingUp, tone: "blue" },
  { id: 6, label: "Cross-Company Audits", target: "cross-company-audits", icon: GitBranch, tone: "orange" },
  { id: 7, label: "Auditor Management", target: "auditor-management", icon: Users, tone: "teal" },
];

export default function FeaturesSection() {
  return (
    <section className="relative pt-20 pb-14 sm:py-18 lg:py-24 xl:py-28 overflow-y-auto">
      <style>{`
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes dividerGlow {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 0.7; }
        }
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,212,146,0); }
          50%       { box-shadow: 0 0 0 6px rgba(0,212,146,0.08); }
        }
        @keyframes overviewJump {
          0%, 82%, 100% { translate: 0 0; }
          88% { translate: 0 -5px; }
          94% { translate: 0 -1px; }
        }

        .features-gradient-text {
          background: linear-gradient(90deg, #A8D0AF, #8BB9AC, #D4AF37, #A8D0AF);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 5s linear infinite;
        }

        .feature-card {
          transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.35), 0 0 30px rgba(0,212,146,0.05);
          border-color: rgba(255,255,255,0.18) !important;
        }

        .feature-img-wrap {
          overflow: hidden;
          border: 1px solid rgba(0, 212, 146, 0.18);
          border-radius: 1.5rem;
          background: linear-gradient(145deg, rgba(0, 212, 146, 0.1), rgba(3, 29, 25, 0.72));
          transition: transform 0.4s cubic-bezier(0.34,1.2,0.64,1), filter 0.3s ease;
          box-shadow: 0 18px 42px rgba(0,0,0,0.34), inset 0 0 0 1px rgba(255,255,255,0.025);
        }
        .feature-img-wrap:hover {
          transform: scale(1.025) translateY(-3px);
          filter: brightness(1.04);
          box-shadow: 0 24px 52px rgba(0,0,0,0.48), 0 0 28px rgba(0,212,146,0.08);
        }

        .overview-card {
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease, border-color 0.25s ease;
          animation: overviewJump 5.6s cubic-bezier(0.34,1.25,0.64,1) infinite;
        }
        .overview-card-2 { animation-duration: 4.7s; animation-timing-function: ease-in-out; }
        .overview-card-3 { animation-duration: 6.1s; }
        .overview-card-4 { animation-duration: 5.2s; animation-timing-function: ease-in-out; }
        .overview-card-5 { animation-duration: 6.5s; }
        .overview-card-6 { animation-duration: 4.9s; animation-timing-function: ease-in-out; }
        .overview-card-7 { animation-duration: 5.8s; }
        .overview-card:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 12px 30px rgba(0,0,0,0.3), 0 0 16px rgba(0,212,146,0.12);
          border-color: rgba(0,212,146,0.4) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .overview-card { animation: none; }
        }

        .features-badge {
          animation: badgePulse 3s ease-in-out infinite;
          transition: transform 0.2s ease;
        }
        .features-badge:hover { transform: scale(1.04); }

        .learn-more-link {
          transition: gap 0.2s ease, color 0.2s ease;
        }
        .learn-more-link:hover { gap: 10px; }
        .learn-more-link .arrow {
          transition: transform 0.2s ease;
        }
        .learn-more-link:hover .arrow { transform: translateX(4px); }

        .divider-line {
          animation: dividerGlow 3s ease-in-out infinite;
        }

        .feature-icon-wrap {
          transition: background 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }
        .feature-card:hover .feature-icon-wrap {
          background: rgba(0,212,146,0.15);
          box-shadow: 0 0 20px rgba(0,212,146,0.15);
          transform: scale(1.08) rotate(3deg);
        }

        .feature-video-frame {
          box-shadow: 0 28px 70px rgba(0,0,0,0.38), 0 0 0 1px rgba(0,212,146,0.08);
        }
        .feature-video-frame video {
          display: block;
          background: #031d19;
        }
      `}</style>

      <div className="relative z-10 max-w-7xl 2xl:max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 w-full">

        {/* Header */}
        <Reveal variant="up" className="text-center mb-5">
          <div className="features-badge inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-4 border border-secondary-500/20">
            <Zap size={14} className="text-[#00D492]" />
            <span className="text-sm text-[#00D492] font-medium">Powerful Features</span>
          </div>
          <h3 className="text-2xl sm:text-3xl xl:text-4xl font-semibold text-white mb-4">
            Everything you need for
            <br />
            <span className="features-gradient-text">Modern Audit Management</span>
          </h3>
        </Reveal>

        {/* Product video preview */}
        <Reveal variant="zoom" delay={45} className="mb-14 sm:mb-20">
          <section aria-labelledby="features-video-title" className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-secondary-500/[0.07] p-4 shadow-2xl shadow-black/20 sm:p-6 lg:p-8">
            <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-10">
              <div className="px-1 sm:px-2">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary-500/25 bg-secondary-500/10 px-3 py-1.5 text-xs font-semibold text-secondary-300">
                  <PlayCircle size={15} />
                  Product walkthrough
                </div>
                <h4 id="features-video-title" className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  See Audito in action
                </h4>
                <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400 sm:text-[15px]">
                  Follow the complete workflow—from structuring your organization to completing audits, tracking actions, and sharing clear reports.
                </p>
                <p className="mt-5 text-xs font-medium text-secondary-300">Press play to preview the Audito experience.</p>
              </div>

              <div className="feature-video-frame overflow-hidden rounded-2xl border border-white/10">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full object-cover"
                  aria-label="Audito product explainer video"
                >
                  <source src="/videos/audito-product-explainer.mp4" type="video/mp4" />
                  Your browser does not support embedded video.
                </video>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Overview image + floating cards */}
        <Reveal variant="zoom" delay={80} className="mb-14 sm:mb-20 relative">
          <div className="relative flex min-h-[23rem] items-center justify-center overflow-visible py-12 sm:min-h-[28rem] lg:min-h-[31rem] xl:min-h-[34rem]">
            <Image src={overviewImg} alt="Features Overview"
              className="relative z-10 h-auto w-full max-w-lg object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-[1.01] sm:max-w-xl lg:max-w-2xl"
            />
          
            <div className="hidden lg:block absolute left-[1%] top-[15%] z-20">
              <OverviewCard {...overviewHighlights[0]} />
            </div>
            <div className="hidden lg:block absolute left-[3%] top-[45%] z-20">
              <OverviewCard {...overviewHighlights[1]} />
            </div>
            <div className="hidden lg:block absolute left-[11%] bottom-[8%] z-20">
              <OverviewCard {...overviewHighlights[2]} />
            </div>
            <div className="hidden lg:block absolute right-[1%] top-[15%] z-20">
              <OverviewCard {...overviewHighlights[3]} />
            </div>
            <div className="hidden lg:block absolute right-[3%] top-[45%] z-20">
              <OverviewCard {...overviewHighlights[4]} />
            </div>
            <div className="hidden lg:block absolute right-[11%] bottom-[8%] z-20">
              <OverviewCard {...overviewHighlights[5]} />
            </div>
            <div className="hidden lg:block absolute left-1/2 bottom-[-1%] z-20 -translate-x-1/2">
              <OverviewCard {...overviewHighlights[6]} />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {overviewHighlights.map((item) => (
              <OverviewCard key={item.id} {...item} compact />
            ))}
          </div>
        </Reveal>

        {/* Divider */}
        <div className="flex items-center justify-center mb-16 sm:mb-24 lg:mb-32">
          <div className="divider-line h-px w-full max-w-2xl"
            style={{ background: "linear-gradient(90deg, transparent, rgba(0,212,146,0.35), rgba(212,175,55,0.35), transparent)" }}
          />
        </div>

        {/* Feature list */}
        <div className="space-y-14 sm:space-y-20 lg:space-y-24">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isImageLeft = feature.layout === "left";
            const featureNumber = String(feature.id).padStart(2, "0");

            return (
              <section key={feature.id} id={feature.anchor} className="scroll-mt-24">
              <Reveal variant={isImageLeft ? "left" : "right"}>
                {/* Desktop */}
                <div className="hidden lg:grid lg:grid-cols-2 items-center gap-12 xl:gap-16 2xl:gap-20">
                  <div className={isImageLeft ? "order-1" : "order-2"}>
                    <div className="feature-img-wrap relative aspect-[16/10] w-full">
                      <Image src={feature.image} alt={feature.title} fill
                        sizes="(max-width: 1280px) 50vw, 40vw"
                        className="object-cover" />
                    </div>
                  </div>
                  <div className={`flex ${isImageLeft ? "order-2" : "order-1"}`}>
                    <div className={`feature-card glass w-full max-w-md rounded-2xl border border-white/10 p-7 xl:p-8 ${isImageLeft ? "ml-auto" : "mr-auto"}`}>
                      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">Feature {featureNumber}</p>
                      <div className="feature-icon-wrap mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary-500/10">
                        <Icon size={28} className="text-secondary-400" />
                      </div>
                      <h3 className="mb-3 text-2xl font-bold text-white xl:text-[1.65rem]">{feature.title}</h3>
                      <p className="mb-5 text-sm leading-6 text-gray-400 xl:text-[15px]">{feature.description}</p>
                      <Link href="#" className="learn-more-link inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold">
                        Learn more
                        <ArrowRight size={16} className="arrow" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Tablet */}
                <div className={`hidden md:flex lg:hidden items-center gap-6 ${isImageLeft ? "flex-row" : "flex-row-reverse"}`}>
                  <div className="w-[55%] flex-shrink-0">
                    <div className="feature-img-wrap relative w-full aspect-[16/10]">
                      <Image src={feature.image} alt={feature.title} fill
                        sizes="55vw"
                        className="object-cover" />
                    </div>
                  </div>
                  <div className="flex-1 self-center">
                    <div className="feature-card glass rounded-2xl p-6 border border-white/10">
                      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">Feature {featureNumber}</p>
                      <div className="feature-icon-wrap w-11 h-11 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-4">
                        <Icon size={22} className="text-secondary-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                      <p className="text-gray-400 text-[13px] leading-5 mb-4">{feature.description}</p>
                      <Link href="#" className="learn-more-link inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold text-sm">
                        Learn more <ArrowRight size={14} className="arrow" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Mobile */}
                <div className="flex flex-col md:hidden gap-4">
                  <div className="feature-img-wrap relative w-full max-w-sm mx-auto aspect-[16/10]">
                    <Image src={feature.image} alt={feature.title} fill
                      sizes="(max-width: 640px) 100vw, 24rem"
                      className="object-cover" />
                  </div>
                  <div className="feature-card glass rounded-2xl p-4 sm:p-5 border border-white/10">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">Feature {featureNumber}</p>
                    <div className="feature-icon-wrap w-10 h-10 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-4">
                      <Icon size={20} className="text-secondary-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-[13px] leading-5 mb-4">{feature.description}</p>
                    <Link href="#" className="learn-more-link inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold text-sm">
                      Learn more <ArrowRight size={14} className="arrow" />
                    </Link>
                  </div>
                </div>
              </Reveal>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const overviewToneClasses: Record<string, { icon: string; glow: string; arrow: string }> = {
  emerald: { icon: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200", glow: "from-emerald-300/25", arrow: "text-emerald-200" },
  violet: { icon: "border-violet-300/30 bg-violet-400/15 text-violet-200", glow: "from-violet-300/25", arrow: "text-violet-200" },
  amber: { icon: "border-amber-300/30 bg-amber-400/15 text-amber-200", glow: "from-amber-300/25", arrow: "text-amber-200" },
  pink: { icon: "border-pink-300/30 bg-pink-400/15 text-pink-200", glow: "from-pink-300/25", arrow: "text-pink-200" },
  blue: { icon: "border-blue-300/30 bg-blue-400/15 text-blue-200", glow: "from-blue-300/25", arrow: "text-blue-200" },
  orange: { icon: "border-orange-300/30 bg-orange-400/15 text-orange-200", glow: "from-orange-300/25", arrow: "text-orange-200" },
  teal: { icon: "border-teal-300/30 bg-teal-400/15 text-teal-200", glow: "from-teal-300/25", arrow: "text-teal-200" },
};

type OverviewCardProps = { id?: number; label: string; target: string; icon: any; tone: string; compact?: boolean };

function OverviewCard({ id, label, target, icon: Icon, tone, compact = false }: OverviewCardProps) {
  const colors = overviewToneClasses[tone] ?? overviewToneClasses.emerald;

  return (
    <a
     href={`#${target}`}
     aria-label={`View ${label}`}
     className={`overview-card overview-card-${id} group block cursor-pointer rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.03] shadow-lg shadow-black/20 backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-400 ${compact ? "w-full px-3 py-2" : "w-[176px] px-3 py-2.5"}`}
    >
      <div className="flex items-center gap-3">
        <div className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border ${colors.icon}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${colors.glow} to-transparent`} />
          <Icon size={19} className="relative" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <span className={`block font-semibold leading-snug text-white ${compact ? "text-xs" : "text-[12px]"}`}>
            {label}
          </span>
        </div>
        <ArrowRight size={14} className={`flex-shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 ${colors.arrow}`} />
      </div>
    </a>
  );
}
