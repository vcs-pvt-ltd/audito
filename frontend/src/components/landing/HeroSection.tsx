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
    <section className="relative flex flex-col justify-center bg-cover bg-center bg-no-repeat overflow-hidden">
      <style>{`
        /* ── Float animations ── */
        @keyframes floatA {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50%       { transform: translateY(-14px) rotate(0.4deg) scale(1.01); }
        }
        @keyframes floatB {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50%       { transform: translateY(-10px) rotate(-0.3deg) scale(1.01); }
        }
        @keyframes floatC {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50%       { transform: translateY(-16px) rotate(0.5deg) scale(1.01); }
        }
        @keyframes floatD {
          0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); }
          50%       { transform: translateY(-11px) rotate(-0.4deg) scale(1.01); }
        }

        /* ── Entrance animations ── */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* ── Decorative ── */
        @keyframes shimmerText {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 18px rgba(184,134,11,0.25), 0 4px 14px rgba(0,0,0,0.4); }
          50%       { box-shadow: 0 0 36px rgba(184,134,11,0.45), 0 4px 20px rgba(0,0,0,0.4); }
        }
        @keyframes badgeShimmer {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.75; }
        }
        @keyframes statsPop {
          0%   { opacity: 0; transform: translateY(12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ── Apply ── */
        .float-a { animation: floatA 4.4s cubic-bezier(0.45,0.05,0.55,0.95) infinite; }
        .float-b { animation: floatB 5.2s cubic-bezier(0.45,0.05,0.55,0.95) infinite 1.2s; }
        .float-c { animation: floatC 4.8s cubic-bezier(0.45,0.05,0.55,0.95) infinite 0.6s; }
        .float-d { animation: floatD 4.1s cubic-bezier(0.45,0.05,0.55,0.95) infinite 1.8s; }

        .hero-badge   { animation: fadeInUp 0.55s cubic-bezier(0.16,1,0.3,1) 0.05s both, badgeShimmer 3s ease-in-out 1s infinite; }
        .hero-h1      { animation: fadeInUp 0.6s  cubic-bezier(0.16,1,0.3,1) 0.15s both; }
        .hero-p       { animation: fadeInUp 0.6s  cubic-bezier(0.16,1,0.3,1) 0.25s both; }
        .hero-cta     { animation: fadeInUp 0.6s  cubic-bezier(0.16,1,0.3,1) 0.35s both; }
        .hero-tabs    { animation: fadeInUp 0.6s  cubic-bezier(0.16,1,0.3,1) 0.45s both; }
        .hero-stats   { animation: statsPop 0.7s  cubic-bezier(0.16,1,0.3,1) 0.55s both; }

        .stat-item    { transition: transform 0.2s ease, opacity 0.2s ease; }
        .stat-item:hover { transform: translateY(-3px) scale(1.04); }

        .gradient-text-shimmer {
          background: linear-gradient(90deg, #A8D0AF, #8BB9AC, #D4AF37, #A8D0AF);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmerText 4s linear infinite;
        }

        .cta-glow { animation: glowPulse 2.8s ease-in-out infinite; }
        .cta-glow:hover { animation: none; box-shadow: 0 0 48px rgba(184,134,11,0.55), 0 4px 20px rgba(0,0,0,0.4); transform: translateY(-1px) scale(1.02); }
        .cta-glow { transition: transform 0.2s ease, box-shadow 0.2s ease; }

        .tab-btn {
          position: relative;
          transition: color 0.2s ease, background 0.2s ease;
          overflow: hidden;
        }
        .tab-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.04);
          opacity: 0;
          transition: opacity 0.2s ease;
          border-radius: inherit;
        }
        .tab-btn:hover::after { opacity: 1; }

        .hero-img-wrap {
          transition: filter 0.3s ease;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.45));
        }
        .hero-img-wrap:hover { filter: drop-shadow(0 24px 50px rgba(0,0,0,0.55)) brightness(1.04); }

        .tabs-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .tabs-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ─── MOBILE LAYOUT ─── */}
      <div className="lg:hidden flex flex-col w-full">

        <div className="grid grid-cols-2 gap-2 px-3 pt-20">
          <div className="float-a hero-img-wrap">
            <Image src={left1} alt="Audit dashboard" width={320} height={220}
              className="w-full h-auto object-contain rounded-xl" />
          </div>
          <div className="float-c hero-img-wrap">
            <Image src={right1} alt="Risk analysis monitor" width={320} height={220}
              className="w-full h-auto object-contain rounded-xl" />
          </div>
        </div>

        <div className="flex flex-col items-center text-center px-6 py-8">
          <div
            className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5 border border-secondary-500/20"
            style={{ background: "linear-gradient(135deg, rgba(0,79,59,0.45) 0%, rgba(212,175,55,0.2) 100%)" }}
          >
            <Sparkles size={13} className="text-secondary-400" />
            <span className="text-xs text-gray-300 font-medium tracking-wide">AI-Powered Audit Platform</span>
          </div>

          <h1 className="hero-h1 text-3xl font-semibold leading-tight mb-3">
            Simplify Audits.
            <br />
            <span className="gradient-text-shimmer">Strengthen Compliance</span>
          </h1>

          <p className="hero-p text-gray-400 text-sm max-w-xs mx-auto mb-6 leading-relaxed">
            Maintain <strong className="text-white">compliance</strong>,{" "}
            <strong className="text-white">reduce risks</strong>, and{" "}
            <strong className="text-white">improve efficiency</strong> with ease.
          </p>

          <Link href="/register"
            className="hero-cta cta-glow inline-flex items-center gap-2 px-6 py-3 bg-[#B8860B] hover:bg-[#A07509] text-white font-semibold rounded-lg transition-colors text-sm group"
          >
            Start a Free Trial
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pb-6">
          <div className="float-b hero-img-wrap">
            <Image src={left2} alt="Audit trend analysis" width={260} height={160}
              className="w-full h-auto object-contain rounded-xl" />
          </div>
          <div className="float-d hero-img-wrap">
            <Image src={right2} alt="Risk reduced card" width={260} height={160}
              className="w-full h-auto object-contain rounded-xl" />
          </div>
        </div>

        <div className="hero-tabs w-full px-4 pb-4">
          <div className="glass rounded-lg p-1 flex items-center gap-1 shadow-lg shadow-secondary-500/20 w-full border border-white/[0.07]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn flex flex-1 items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium ${
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

        <div className="hero-stats grid grid-cols-3 gap-3 px-4 pb-8">
          {[
            { value: "70%", label: "Time Saved" },
            { value: "500+", label: "Companies" },
            { value: "99.9%", label: "Accuracy" },
          ].map(({ value, label }) => (
            <div key={label} className="stat-item glass rounded-xl py-3 px-2 text-center border border-white/[0.07] hover:border-secondary-500/30 transition-colors duration-300">
              <p className="text-xl font-bold text-secondary-400">{value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── DESKTOP LAYOUT ─── */}
      <div className="hidden lg:block relative z-10 w-full max-w-7xl mx-auto px-8 py-14">
        <div className="flex items-center justify-between gap-4">

          {/* LEFT images */}
          <div className="relative flex-shrink-0 w-72 h-[400px]">
            <div className="float-b hero-img-wrap absolute top-70 left-0 w-72 z-0">
              <Image src={left2} alt="Audit trend analysis" width={260} height={160}
                className="w-full h-auto object-contain" />
            </div>
            <div className="float-a hero-img-wrap absolute top-20 left-2 w-72 z-10">
              <Image src={left1} alt="Audit dashboard" width={320} height={220}
                className="w-full h-auto object-contain" />
            </div>
          </div>

          {/* CENTER */}
          <div className="flex-1 text-center px-4">
            <div
              className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 border border-secondary-500/20"
              style={{ background: "linear-gradient(135deg, rgba(0,79,59,0.45) 0%, rgba(212,175,55,0.2) 100%)" }}
            >
              <Sparkles size={13} className="text-secondary-400" />
              <span className="text-sm text-gray-300 font-medium tracking-wide">AI-Powered Audit Platform</span>
            </div>

            <h1 className="hero-h1 text-4xl font-semibold leading-tight mb-4">
              Simplify Audits.
              <br />
              <span className="gradient-text-shimmer">Strengthen Compliance</span>
            </h1>

            <p className="hero-p text-gray-400 text-base max-w-xl mx-auto mb-8 leading-relaxed">
              Our comprehensive audit management solution helps you maintain{" "}
              <strong className="text-white">compliance</strong>,{" "}
              <strong className="text-white">reduce risks</strong>, and{" "}
              <strong className="text-white">improve operational efficiency</strong>{" "}
              with ease
            </p>

            <Link href="/register"
              className="hero-cta cta-glow inline-flex items-center gap-2 px-6 py-3 bg-[#B8860B] hover:bg-[#A07509] text-white font-semibold rounded-lg transition-colors text-sm group"
            >
              Start a Free Trial
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
          </div>

          {/* RIGHT images */}
          <div className="relative flex-shrink-0 w-72 h-[400px]">
            <div className="float-c hero-img-wrap absolute top-20 right-0 w-72">
              <Image src={right1} alt="Risk analysis monitor" width={320} height={220}
                className="w-full h-auto object-contain" />
            </div>
            <div className="float-d hero-img-wrap absolute top-80 right-2 w-72">
              <Image src={right2} alt="Risk reduced card" width={260} height={160}
                className="w-full h-auto object-contain" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="hero-tabs mt-12 flex justify-center">
          <div className="glass rounded-lg p-1 flex items-center gap-1 shadow-lg shadow-secondary-500/20 border border-white/[0.07]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
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
        <div className="hero-stats mt-12 grid grid-cols-3 gap-8 max-w-xl mx-auto text-center">
          {[
            { value: "70%", label: "Time Saved" },
            { value: "500+", label: "Companies" },
            { value: "99.9%", label: "Accuracy" },
          ].map(({ value, label }) => (
            <div key={label} className="stat-item group cursor-default">
              <p className="text-3xl font-bold text-secondary-400 group-hover:text-secondary-300 transition-colors duration-200">{value}</p>
              <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-300 transition-colors duration-200">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
