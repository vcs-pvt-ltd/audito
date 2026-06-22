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
} from "lucide-react";

import feature1Img from "@/assets/landing/feature-1.png";
import feature2Img from "@/assets/landing/feature-2.png";
import feature3Img from "@/assets/landing/feature-3.png";
import feature4Img from "@/assets/landing/feature-4.png";
import feature5Img from "@/assets/landing/feature-5.png";
import feature6Img from "@/assets/landing/feature-6.png";
import feature7Img from "@/assets/landing/feature-7.png";
import overviewImg from "@/assets/landing/feature-main.png";

import companyManagementImg from "@/assets/landing/features/company-management.png";
import departmentStructureImg from "@/assets/landing/features/department-structure.png";
import auditCapacityImg from "@/assets/landing/features/audit-capacity.png";
import checklistsImg from "@/assets/landing/features/checklists.png";
import auditorPerformanceImg from "@/assets/landing/features/auditor-performance.png";
import crossCompanyImg from "@/assets/landing/features/cross-company.png";
import auditorSeatsImg from "@/assets/landing/features/auditor-seats.png";

const features = [
  { id: 1, icon: Building2, title: "Company Management", layout: "left", image: feature1Img,
    description: "Manage audits across different company entities or organizations within the platform. This allows users to organize audits separately for each company or business unit." },
  { id: 2, icon: PieChart, title: "Department Structure", layout: "right", image: feature2Img,
    description: "Create and manage departments inside a company (such as Finance, HR, Operations, or Quality) to organize audits and assign responsibilities more efficiently." },
  { id: 3, icon: Gauge, title: "Audit Capacity", layout: "left", image: feature3Img,
    description: "The total number of audits that can be conducted within the system. This controls how many audit processes or inspection cycles can be performed." },
  { id: 4, icon: ClipboardList, title: "Number of Checklists", layout: "right", image: feature4Img,
    description: "The number of audit templates or checklists that can be created and used to standardize audit procedures across departments or companies." },
  { id: 5, icon: Users, title: "Auditor Seats", layout: "left", image: feature5Img,
    description: "The number of users who can perform audits within the platform. Auditors can conduct inspections, submit reports, and monitor compliance activities." },
  { id: 6, icon: TrendingUp, title: "Auditor Performance Analytics", layout: "right", image: feature6Img,
    description: "A performance evaluation system that measures auditors based on audit results, completion quality, and compliance accuracy." },
  { id: 7, icon: GitBranch, title: "Cross-Company Audits", layout: "left", image: feature7Img,
    description: "Allows organizations to perform audits between companies, such as auditing suppliers, partners, or external organizations to ensure compliance and quality standards." },
];

const overviewHighlights = [
  { id: 1, label: "Company Management", image: companyManagementImg },
  { id: 2, label: "Department Structure", image: departmentStructureImg },
  { id: 3, label: "Audit Capacity", image: auditCapacityImg },
  { id: 4, label: "Number of Checklists", image: checklistsImg },
  { id: 5, label: "Auditor Performance Analytics", image: auditorPerformanceImg },
  { id: 6, label: "Cross-Company Audits", image: crossCompanyImg },
  { id: 7, label: "Auditor Seats", image: auditorSeatsImg },
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
          transition: transform 0.4s cubic-bezier(0.34,1.2,0.64,1), filter 0.3s ease;
          filter: drop-shadow(0 16px 32px rgba(0,0,0,0.4));
        }
        .feature-img-wrap:hover {
          transform: scale(1.025) translateY(-3px);
          filter: drop-shadow(0 24px 48px rgba(0,0,0,0.5)) brightness(1.04);
        }

        .overview-card {
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .overview-card:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 12px 30px rgba(0,0,0,0.3), 0 0 16px rgba(0,212,146,0.12);
          border-color: rgba(0,212,146,0.4) !important;
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

        {/* Overview image + floating cards */}
        <Reveal variant="zoom" delay={80} className="mb-14 sm:mb-20 relative">
          <div className="relative flex justify-center overflow-visible py-15">
            <Image src={overviewImg} alt="Features Overview"
              className="w-full max-w-2xl xl:max-w-3xl h-auto translate-y-10 object-contain rounded-2xl drop-shadow-2xl transition-transform duration-500 hover:scale-[1.01]"
            />
            <div className="hidden lg:flex absolute left-1/2 top-[1%] -translate-x-1/2 z-20 items-center gap-6">
              <OverviewCard {...overviewHighlights[0]} />
              <OverviewCard {...overviewHighlights[1]} />
              <OverviewCard {...overviewHighlights[2]} />
              <OverviewCard {...overviewHighlights[3]} />
            </div>
            <div className="hidden lg:block absolute left-[8%] bottom-[60%] z-20">
              <OverviewCard {...overviewHighlights[4]} />
            </div>
            <div className="hidden lg:block absolute right-[10%] bottom-[60%] z-20">
              <OverviewCard {...overviewHighlights[5]} />
            </div>
            <div className="hidden lg:block absolute right-[15%] bottom-[40%] z-20">
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

            return (
              <Reveal key={feature.id} variant={isImageLeft ? "left" : "right"}>
                {/* Desktop */}
                <div className={`hidden lg:flex items-center gap-12 xl:gap-16 2xl:gap-20 ${isImageLeft ? "flex-row" : "flex-row-reverse"}`}>
                  <div className="flex-1">
                    <div className="feature-img-wrap relative w-full aspect-[16/10] mx-auto max-w-xl">
                      <Image src={feature.image} alt={feature.title} fill
                        sizes="(max-width: 1280px) 50vw, 40vw"
                        className="object-contain" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="feature-card glass rounded-2xl p-8 sm:p-10 w-full max-w-md xl:max-w-lg mx-auto border border-white/10">
                      <div className="feature-icon-wrap w-14 h-14 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-6">
                        <Icon size={28} className="text-secondary-400" />
                      </div>
                      <h3 className="text-2xl xl:text-3xl font-bold text-white mb-4">{feature.title}</h3>
                      <p className="text-gray-400 text-base xl:text-lg leading-relaxed mb-6">{feature.description}</p>
                      <Link href="#" className="learn-more-link inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold">
                        Learn more
                        <ArrowRight size={16} className="arrow" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Tablet */}
                <div className="hidden md:flex lg:hidden items-center gap-6">
                  <div className="w-[55%] flex-shrink-0">
                    <div className="feature-img-wrap relative w-full aspect-[16/10]">
                      <Image src={feature.image} alt={feature.title} fill
                        sizes="55vw"
                        className="object-contain" />
                    </div>
                  </div>
                  <div className="flex-1 self-center">
                    <div className="feature-card glass rounded-2xl p-6 border border-white/10">
                      <div className="feature-icon-wrap w-11 h-11 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-4">
                        <Icon size={22} className="text-secondary-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">{feature.description}</p>
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
                      className="object-contain" />
                  </div>
                  <div className="feature-card glass rounded-2xl p-5 border border-white/10">
                    <div className="feature-icon-wrap w-10 h-10 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-4">
                      <Icon size={20} className="text-secondary-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">{feature.description}</p>
                    <Link href="#" className="learn-more-link inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold text-sm">
                      Learn more <ArrowRight size={14} className="arrow" />
                    </Link>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type OverviewCardProps = { id?: number; image: any; label: string; compact?: boolean };

function OverviewCard({ image, label, compact = false }: OverviewCardProps) {
  return (
    <div className={`overview-card glass rounded-xl border border-secondary-400/30 backdrop-blur-sm ${compact ? "w-full px-3 py-2" : "w-[200px] px-4 py-3"}`}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Image src={image} alt={label} width={40} height={40}
            className="w-10 h-10 object-cover rounded-lg transition-transform duration-300 group-hover:scale-110" />
        </div>
        <span className={`text-gray-400 font-medium leading-snug ${compact ? "text-xs" : "text-sm"}`}>
          {label}
        </span>
      </div>
    </div>
  );
}
