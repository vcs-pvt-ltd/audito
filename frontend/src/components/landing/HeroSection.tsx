"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Users,
  LayoutGrid,
  User,
} from "lucide-react";
import left1 from "@/assets/landing/hero-left1.png";
import left2 from "@/assets/landing/hero-left2.png";
import right1 from "@/assets/landing/hero-right1.png";
import right2 from "@/assets/landing/hero-right2.png";

const TABS = [
  { id: "global", label: "Audito Global", icon: Users },
  { id: "unit", label: "Audito Unit", icon: LayoutGrid },
  { id: "partner", label: "Audito Partner", icon: User },
];

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState("global");

  return (
    <section
      className="relative flex flex-col justify-center bg-cover bg-center bg-no-repeat overflow-hidden"
    >
      <style>{`
        @keyframes floatA {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-9px); }
        }
        @keyframes floatC {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-14px); }
        }
        @keyframes floatD {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .float-a { animation: floatA 4.2s ease-in-out infinite; }
        .float-b { animation: floatB 5s ease-in-out infinite 1.2s; }
        .float-c { animation: floatC 4.6s ease-in-out infinite 0.6s; }
        .float-d { animation: floatD 3.9s ease-in-out infinite 1.8s; }

        .tabs-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .tabs-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ═══════════════════════════════════════════════
          MOBILE LAYOUT (< lg)
      ═══════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col w-full">

        {/* ── TOP IMAGE ROW ── */}
        <div className="grid grid-cols-2 gap-2 px-3 pt-20">
          <div className="float-a">
            <Image
              src={left1}
              alt="Audit dashboard"
              width={320}
              height={220}
              className="w-full h-auto object-contain drop-shadow-xl rounded-xl"
            />
          </div>
          <div className="float-c">
            <Image
              src={right1}
              alt="Risk analysis monitor"
              width={320}
              height={220}
              className="w-full h-auto object-contain drop-shadow-xl rounded-xl"
            />
          </div>
        </div>

        {/* ── CENTER TEXT ── */}
        <div className="flex flex-col items-center text-center px-6 py-8">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(0, 79, 59, 0.4) 0%, rgba(212, 175, 55, 0.2) 100%)",
            }}
          >
            <Sparkles size={13} className="text-secondary-400" />
            <span className="text-xs text-gray-300">AI-Powered Audit Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl font-semibold leading-tight mb-3">
            Simplify Audits.
            <br />
            <span className="text-gradient">Strengthen Compliance</span>
          </h1>

          {/* Subtitle */}
          <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
            Maintain <strong className="text-white">compliance</strong>,{" "}
            <strong className="text-white">reduce risks</strong>, and{" "}
            <strong className="text-white">improve efficiency</strong> with ease.
          </p>

          {/* CTA */}
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#B8860B] hover:bg-[#A07509] text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-secondary-500/25 text-sm"
          >
            Start a Free Trial
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* ── BOTTOM IMAGE ROW ── */}
        <div className="grid grid-cols-2 gap-2 px-3 pb-6">
          <div className="float-b">
            <Image
              src={left2}
              alt="Audit trend analysis"
              width={260}
              height={160}
              className="w-full h-auto object-contain drop-shadow-xl rounded-xl"
            />
          </div>
          <div className="float-d">
            <Image
              src={right2}
              alt="Risk reduced card"
              width={260}
              height={160}
              className="w-full h-auto object-contain drop-shadow-xl rounded-xl"
            />
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="w-full px-4 pb-4">
          <div className="glass rounded-lg p-1 flex items-center gap-1 shadow-lg shadow-secondary-500/20 w-full">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#D9A346]/15 text-[#D9A346] border border-[#D9A346]/30 shadow-md shadow-[#D9A346]/20"
                      : "border border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-3 px-4 pb-8">
          <div className="glass rounded-xl py-3 px-2 text-center">
            <p className="text-xl font-bold text-secondary-400">70%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Time Saved</p>
          </div>
          <div className="glass rounded-xl py-3 px-2 text-center">
            <p className="text-xl font-bold text-secondary-400">500+</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Companies</p>
          </div>
          <div className="glass rounded-xl py-3 px-2 text-center">
            <p className="text-xl font-bold text-secondary-400">99.9%</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Accuracy</p>
          </div>
        </div>

      </div>

      {/* ═══════════════════════════════════════════════
          DESKTOP LAYOUT (lg+)
      ═══════════════════════════════════════════════ */}
      <div className="hidden lg:block relative z-10 w-full max-w-7xl mx-auto px-8 py-14">

        {/* 3-col hero row */}
        <div className="flex items-center justify-between gap-4">

          {/* LEFT floating images */}
          <div className="relative flex-shrink-0 w-72 h-[400px]">
            <div className="float-b absolute top-70 left-0 w-72 z-0">
              <Image src={left2} alt="Audit trend analysis" width={260} height={160}
                className="w-full h-auto object-contain drop-shadow-2xl" />
            </div>
            <div className="float-a absolute top-20 left-2 w-72 z-10">
              <Image src={left1} alt="Audit dashboard" width={320} height={220}
                className="w-full h-auto object-contain drop-shadow-2xl" />
            </div>
          </div>

          {/* CENTER */}
          <div className="flex-1 text-center px-4">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0, 79, 59, 0.4) 0%, rgba(212, 175, 55, 0.2) 100%)",
              }}
            >
              <Sparkles size={13} className="text-secondary-400" />
              <span className="text-sm text-gray-300">AI-Powered Audit Platform</span>
            </div>

            <h1 className="text-4xl font-semibold leading-tight mb-4">
              Simplify Audits.
              <br />
              <span className="text-gradient">Strengthen Compliance</span>
            </h1>

            <p className="text-gray-400 text-base max-w-xl mx-auto mb-8">
              Our comprehensive audit management solution helps you maintain{" "}
              <strong className="text-white">compliance</strong>,{" "}
              <strong className="text-white">reduce risks</strong>, and{" "}
              <strong className="text-white">improve operational efficiency</strong>{" "}
              with ease
            </p>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#B8860B] hover:bg-[#A07509] text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-secondary-500/25 text-sm"
            >
              Start a Free Trial
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* RIGHT floating images */}
          <div className="relative flex-shrink-0 w-72 h-[400px]">
            <div className="float-c absolute top-20 right-0 w-72">
              <Image src={right1} alt="Risk analysis monitor" width={320} height={220}
                className="w-full h-auto object-contain drop-shadow-2xl" />
            </div>
            <div className="float-d absolute top-80 right-2 w-72">
              <Image src={right2} alt="Risk reduced card" width={260} height={160}
                className="w-full h-auto object-contain drop-shadow-2xl" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12 flex justify-center">
          <div className="glass rounded-lg p-1 flex items-center gap-1 shadow-lg shadow-secondary-500/20">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[#D9A346]/15 text-[#D9A346] border border-[#D9A346]/30 shadow-md shadow-[#D9A346]/20"
                      : "border border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-3 gap-8 max-w-xl mx-auto text-center">
          <div>
            <p className="text-3xl font-bold text-secondary-400">70%</p>
            <p className="text-xs text-gray-400 mt-1">Time Saved</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-secondary-400">500+</p>
            <p className="text-xs text-gray-400 mt-1">Companies</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-secondary-400">99.9%</p>
            <p className="text-xs text-gray-400 mt-1">Accuracy</p>
          </div>
        </div>

      </div>
    </section>
  );
}