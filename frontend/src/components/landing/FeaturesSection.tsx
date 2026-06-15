"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Shield,
  BarChart3,
  Link as LinkIcon,
  Bot,
  FileCheck,
  ArrowRight,
  Zap,
  Building2,
  PieChart,
  Gauge,
  ClipboardList,
  Users,
  TrendingUp,
  GitBranch,
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
  {
    id: 1,
    icon: Building2,
    title: "Company Management",
    description:
      "Manage audits across different company entities or organizations within the platform. This allows users to organize audits separately for each company or business unit.",
    image: feature1Img,
    layout: "left",
  },
  {
    id: 2,
    icon: PieChart,
    title: "Department Structure",
    description:
      "Create and manage departments inside a company (such as Finance, HR, Operations, or Quality) to organize audits and assign responsibilities more efficiently.",
    image: feature2Img,
    layout: "right",
  },
  {
    id: 3,
    icon: Gauge,
    title: "Audit Capacity",
    description:
      "The total number of audits that can be conducted within the system. This controls how many audit processes or inspection cycles can be performed.",
    image: feature3Img,
    layout: "left",
  },
  {
    id: 4,
    icon: ClipboardList,
    title: "Number of Checklists",
    description:
      "The number of audit templates or checklists that can be created and used to standardize audit procedures across departments or companies.",
    image: feature4Img,
    layout: "right",
  },
  {
    id: 5,
    icon: Users,
    title: "Auditor Seats",
    description:
      "The number of users who can perform audits within the platform. Auditors can conduct inspections, submit reports, and monitor compliance activities.",
    image: feature5Img,
    layout: "left",
  },
  {
    id: 6,
    icon: TrendingUp,
    title: "Auditor Performance Analytics",
    description:
      "A performance evaluation system that measures auditors based on audit results, completion quality, and compliance accuracy.",
    image: feature6Img,
    layout: "right",
  },
  {
    id: 7,
    icon: GitBranch,
    title: "Cross-Company Audits",
    description:
      "Allows organizations to perform audits between companies, such as auditing suppliers, partners, or external organizations to ensure compliance and quality standards.",
    image: feature7Img,
    layout: "left",
  },
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
    <section className="relative pt-20 pb-14 sm:py-18 lg:py-24 overflow-y-auto">
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-4">
            <Zap size={14} className="text-[#00D492]" />
            <span className="text-sm text-[#00D492]">Powerful Features</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-4">
            Everything you need for
            <br />
            <span
              className="inline-block bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, #A8D0AF 0%, #8BB9AC 50%, #D4AF37 100%)",
              }}
            >
              Modern Audit Management
            </span>
          </h3>
        </div>

        {/* Overview Image with feature highlights */}
        <div className="mb-14 sm:mb-20 relative">
          <div className="relative flex justify-center overflow-visible py-15">
            <Image
              src={overviewImg}
              alt="Features Overview"
              className="w-full max-w-2xl h-auto translate-y-10 object-contain rounded-2xl drop-shadow-2xl"
            />

            {/* Desktop floating cards — unchanged */}
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

          {/* Mobile/tablet compact highlight cards — 2-col on sm, 1-col on xs */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {overviewHighlights.map((item) => (
              <OverviewCard key={item.id} {...item} compact />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center mb-16 sm:mb-24 lg:mb-32">
          <div className="h-px bg-gradient-to-r from-transparent via-secondary-500/30 to-transparent w-full max-w-2xl" />
        </div>

        {/* Features List */}
        <div className="space-y-14 sm:space-y-20 lg:space-y-24">
          {features.map((feature) => {
            const Icon = feature.icon;
            const isImageLeft = feature.layout === "left";

            return (
              <div key={feature.id}>
                {/* Desktop: side-by-side (unchanged) */}
                <div
                  className={`hidden lg:flex items-center gap-12 ${
                    isImageLeft ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div className="flex-1">
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="glass rounded-2xl p-8 sm:p-10 w-full max-w-md mx-auto">
                      <div className="w-14 h-14 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-6">
                        <Icon size={28} className="text-secondary-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
                      <p className="text-gray-400 text-base leading-relaxed mb-6">
                        {feature.description}
                      </p>
                      <Link
                        href="#"
                        className="inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold"
                      >
                        Learn more
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Tablet (md): image on top, card below — 2-col with image taking 55% */}
                <div className="hidden md:flex lg:hidden items-start gap-6">
                  <div className="w-[55%] flex-shrink-0">
                    <Image
                      src={feature.image}
                      alt={feature.title}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                  <div className="flex-1 self-center">
                    <div className="glass rounded-2xl p-6">
                      <div className="w-11 h-11 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-4">
                        <Icon size={22} className="text-secondary-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        {feature.description}
                      </p>
                      <Link
                        href="#"
                        className="inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold text-sm"
                      >
                        Learn more
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Mobile: stacked — image on top, card below */}
                <div className="flex flex-col md:hidden gap-4">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    className="w-full max-w-sm mx-auto h-auto object-contain"
                  />
                  <div className="glass rounded-2xl p-5">
                    <div className="w-10 h-10 rounded-lg bg-secondary-500/10 flex items-center justify-center mb-4">
                      <Icon size={20} className="text-secondary-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                      {feature.description}
                    </p>
                    <Link
                      href="#"
                      className="inline-flex items-center gap-2 text-secondary-400 hover:text-secondary-300 transition-colors font-semibold text-sm"
                    >
                      Learn more
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type OverviewCardProps = {
  id?: number;
  image: any;
  label: string;
  compact?: boolean;
};

function OverviewCard({ image, label, compact = false }: OverviewCardProps) {
  return (
    <div
      className={`glass rounded-xl border border-secondary-400/30 backdrop-blur-sm ${
        compact ? "w-full px-3 py-2" : "w-[200px] px-4 py-3"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Image
            src={image}
            alt={label}
            width={40}
            height={40}
            className="w-10 h-10 object-cover rounded-lg"
          />
        </div>
        <span
          className={`text-gray-400 font-medium leading-snug ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}