"use client";

import { useState } from "react";
import Image from "next/image";
import auditoLogo from "../../assets/logo/audito_logo.png";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useLanding } from "@/context/LandingContext";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setActiveSection, activeSection } = useLanding();

  const handleNavClick = (index: number) => {
    setActiveSection(index);
    setMobileOpen(false);
  };

  return (
    <>
      <style>{`
        @keyframes navSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mobileMenuIn {
          from { opacity: 0; max-height: 0; transform: translateY(-4px); }
          to   { opacity: 1; max-height: 400px; transform: translateY(0); }
        }
        .nav-animate { animation: navSlideDown 0.4s cubic-bezier(0.16,1,0.3,1) both; }
        .mobile-menu-animate { animation: mobileMenuIn 0.25s cubic-bezier(0.16,1,0.3,1) both; }

        .nav-btn {
          position: relative;
          transition: color 0.2s ease;
        }
        .nav-btn::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1.5px;
          background: linear-gradient(90deg, #00D492, #D4AF37);
          border-radius: 2px;
          transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-btn:hover::after { width: 100%; }
        .nav-btn:hover { color: #fff; }

        .mobile-nav-item {
          position: relative;
          transition: background 0.18s ease, color 0.18s ease, padding-left 0.18s ease;
          border-left: 2px solid transparent;
        }
        .mobile-nav-item:hover {
          background: rgba(255,255,255,0.06);
          border-left-color: rgba(0, 212, 146, 0.5);
          padding-left: 18px;
          color: #fff;
        }
      `}</style>

      {/* Desktop Navbar */}
      <div className="fixed top-4 left-0 right-0 z-50 hidden md:flex justify-center px-4 sm:px-6 lg:px-8 nav-animate">
        <nav className="w-full max-w-5xl bg-[#0F1F1A]/95 backdrop-blur-md rounded-xl px-6 shadow-lg shadow-black/30 border border-white/[0.06]">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center justify-between w-full">
              <button
                onClick={() => handleNavClick(0)}
                className={`nav-btn text-sm transition-colors ${activeSection === 0 ? "text-secondary-400" : "text-gray-300"}`}
              >
                Pricing
              </button>
              <button
                onClick={() => handleNavClick(1)}
                className={`nav-btn text-sm font-semibold transition-colors ${activeSection === 1 ? "text-secondary-400" : "text-white"}`}
              >
                Features
              </button>
              <button
                onClick={() => handleNavClick(2)}
                className="flex items-center justify-center flex-shrink-0 hover:opacity-70 transition-opacity duration-200"
              >
                <Image src={auditoLogo} alt="Audito" width={110} height={30} priority />
              </button>
              <button
                onClick={() => handleNavClick(3)}
                className={`nav-btn text-sm font-semibold transition-colors ${activeSection === 3 ? "text-secondary-400" : "text-white"}`}
              >
                Contact us
              </button>
              <Link
                href="/login"
                className="text-sm text-gray-300 hover:text-white transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-white/[0.06] border border-transparent hover:border-white/10"
              >
                Login
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden bg-[#0F1F1A]/95 backdrop-blur-md shadow-lg shadow-black/30 border-b border-white/[0.06]">
        <nav className="px-4">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => handleNavClick(2)}
              className="flex items-center justify-center flex-shrink-0 hover:opacity-70 transition-opacity duration-200"
            >
              <Image src={auditoLogo} alt="Audito" width={90} height={25} priority />
            </button>

            <button
              className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-white/[0.06] transition-all duration-200"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
                <span className={`absolute transition-all duration-200 ${mobileOpen ? "opacity-100 rotate-0" : "opacity-0 rotate-90"}`}>
                  <X size={22} />
                </span>
                <span className={`absolute transition-all duration-200 ${mobileOpen ? "opacity-0 -rotate-90" : "opacity-100 rotate-0"}`}>
                  <Menu size={22} />
                </span>
              </div>
            </button>
          </div>

          {mobileOpen && (
            <div className="border-t border-white/10 py-3 mobile-menu-animate">
              <div className="flex flex-col gap-1">
                {[
                  { label: "Home", index: 2 },
                  { label: "Features", index: 1 },
                  { label: "Pricing", index: 0 },
                  { label: "Contact us", index: 3 },
                ].map(({ label, index }) => (
                  <button
                    key={label}
                    onClick={() => handleNavClick(index)}
                    className={`mobile-nav-item text-base px-3 py-2.5 rounded-lg text-left ${
                      activeSection === index ? "text-secondary-400 border-l-secondary-400 bg-white/[0.04]" : "text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="pt-2 mt-1 border-t border-white/10">
                  <Link
                    href="/login"
                    className="block text-base text-gray-300 hover:text-white hover:bg-white/[0.06] px-3 py-2.5 rounded-lg transition-colors duration-150"
                    onClick={() => setMobileOpen(false)}
                  >
                    Login
                  </Link>
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
