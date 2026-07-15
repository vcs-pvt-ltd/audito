"use client";

import Link from "next/link";
import Image from "next/image";
import { Sparkles, ArrowRight } from "lucide-react";
import left1 from "@/assets/landing/hero-left1.png";
import left2 from "@/assets/landing/hero-left2.png";
import right1 from "@/assets/landing/hero-right1.png";
import right2 from "@/assets/landing/hero-right2.png";

export default function HeroSection() {
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
        .hero-stats   { animation: statsPop 0.7s  cubic-bezier(0.16,1,0.3,1) 0.45s both; }

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

        .hero-img-wrap {
          transition: filter 0.3s ease;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.45));
        }
        .hero-img-wrap:hover { filter: drop-shadow(0 24px 50px rgba(0,0,0,0.55)) brightness(1.04); }
      `}</style>

      {/* ─── MOBILE / TABLET LAYOUT ─── */}
      <div className="lg:hidden flex flex-col w-full">

        <div className="grid grid-cols-2 gap-2 px-3 pt-16 sm:pt-20">
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

          <h1 className="hero-h1 text-2xl sm:text-3xl font-semibold leading-tight mb-3">
            Simplify Audits.
            <br />
            <span className="gradient-text-shimmer">Strengthen Compliance</span>
          </h1>

          <p className="hero-p text-gray-400 text-sm max-w-xs sm:max-w-sm mx-auto mb-6 leading-relaxed">
            Maintain <strong className="text-white">compliance</strong>,{" "}
            <strong className="text-white">reduce risks</strong>, and{" "}
            <strong className="text-white">improve efficiency</strong> with ease.
          </p>

          <Link href="/register?plan=Basic"
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

        <div className="hero-stats grid grid-cols-3 gap-2 sm:gap-3 px-4 pb-8">
          {[
            { value: "70%", label: "Time Saved" },
            { value: "500+", label: "Companies" },
            { value: "99.9%", label: "Accuracy" },
          ].map(({ value, label }) => (
            <div key={label} className="stat-item glass rounded-xl py-2.5 sm:py-3 px-2 text-center border border-white/[0.07] hover:border-secondary-500/30 transition-colors duration-300">
              <p className="text-lg sm:text-xl font-bold text-secondary-400">{value}</p>
              <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── DESKTOP LAYOUT ─── */}
      <div className="hidden lg:block relative z-10 w-full max-w-7xl mx-auto px-8 py-18 xl:py-20">
        <div className="flex items-center justify-between gap-4">

          {/* LEFT images */}
          <div className="relative flex-shrink-0 w-56 xl:w-72 h-[340px] xl:h-[400px]">
            <div className="float-b hero-img-wrap absolute top-70 left-0 w-56 xl:w-72 z-0">
              <Image src={left2} alt="Audit trend analysis" width={260} height={160}
                className="w-full h-auto object-contain" />
            </div>
            <div className="float-a hero-img-wrap absolute top-20 left-2 w-56 xl:w-72 z-10">
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

            <h1 className="hero-h1 text-3xl xl:text-4xl font-semibold leading-tight mb-4">
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

            <Link href="/register?plan=Basic"
              className="hero-cta cta-glow inline-flex items-center gap-2 px-6 py-3 bg-[#B8860B] hover:bg-[#A07509] text-white font-semibold rounded-lg transition-colors text-sm group"
            >
              Start a Free Trial
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
          </div>

          {/* RIGHT images */}
          <div className="relative flex-shrink-0 w-56 xl:w-72 h-[340px] xl:h-[400px]">
            <div className="float-c hero-img-wrap absolute top-20 right-0 w-56 xl:w-72">
              <Image src={right1} alt="Risk analysis monitor" width={320} height={220}
                className="w-full h-auto object-contain" />
            </div>
            <div className="float-d hero-img-wrap absolute top-80 right-2 w-56 xl:w-72">
              <Image src={right2} alt="Risk reduced card" width={260} height={160}
                className="w-full h-auto object-contain" />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="hero-stats mt-12 grid grid-cols-3 gap-6 xl:gap-8 max-w-md xl:max-w-xl mx-auto text-center">
          {[
            { value: "70%", label: "Time Saved" },
            { value: "500+", label: "Companies" },
            { value: "99.9%", label: "Accuracy" },
          ].map(({ value, label }) => (
            <div key={label} className="stat-item group cursor-default">
              <p className="text-2xl xl:text-3xl font-bold text-secondary-400 group-hover:text-secondary-300 transition-colors duration-200">{value}</p>
              <p className="text-xs mt-1 text-gray-400 group-hover:text-gray-300 transition-colors duration-200">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}