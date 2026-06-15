"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, LayoutGrid, User, ArrowRight } from "lucide-react";

const tabs = [
  {
    key: "global",
    label: "Customer",
    icon: Building2,
    entityType: "Customer",
    description:
      "For global buyers & brands managing audits across regions. Set up buying offices and track compliance across your network.",
    levels: ["Customer", "Buying Office"],
    color: "secondary",
  },
  {
    key: "unit",
    label: "Company",
    icon: LayoutGrid,
    entityType: "Company",
    description:
      "For manufacturing companies & service providers. Organize your operations into clusters, factories, units, and departments.",
    levels: ["Company", "Cluster", "Factory", "Unit", "Department"],
    color: "accent",
  },
  {
    key: "partner",
    label: "Audit Firm",
    icon: User,
    entityType: "Audit Firm",
    description:
      "For audit firms providing compliance services. Link with customers & companies for audit assignments.",
    levels: ["Company", "Branch", "Department"],
    color: "primary",
  },
] as const;

export default function AccountTypesSection() {
  const [active, setActive] = useState(0);
  const current = tabs[active];

  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tab Buttons */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex glass rounded-xl p-1.5">
            {tabs.map((tab, i) => {
              const Icon = tab.icon;
              const isActive = i === active;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-secondary-500 text-primary-950 shadow-lg"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-3xl mx-auto text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            {current.label}
          </h3>
          <p className="text-gray-400 text-lg mb-8">{current.description}</p>

          {/* Organization Levels */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {current.levels.map((level, i) => (
              <div key={level} className="flex items-center gap-2">
                <span className="px-4 py-2 rounded-lg glass text-sm text-white font-medium">
                  {level}
                </span>
                {i < current.levels.length - 1 && (
                  <ArrowRight size={16} className="text-secondary-400" />
                )}
              </div>
            ))}
          </div>

          <Link
            href={`/register?type=${current.entityType}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-secondary-500 hover:bg-secondary-600 text-primary-950 font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-secondary-500/25"
          >
            Register as {current.label}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
