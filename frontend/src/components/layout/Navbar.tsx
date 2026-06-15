"use client";

import { useState } from "react";
import Image from "next/image";
import auditoLogo from "../../assets/logo/audito_logo.png";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useLanding } from "@/context/LandingContext";

const SECTIONS = [
  { id: "pricing", label: "Pricing", index: 0 },
  { id: "features", label: "Features", index: 1 },
  { id: "home", label: "Home", index: 2 },
  { id: "contact", label: "Contact us", index: 3 },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setActiveSection } = useLanding();

  const handleNavClick = (index: number) => {
    setActiveSection(index);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop Navbar - Original Design */}
      <div className="fixed top-4 left-0 right-0 z-50 hidden md:flex justify-center px-4 sm:px-6 lg:px-8">
        <nav className="w-full max-w-5xl bg-[#0F1F1A] rounded-xl px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center justify-between w-full">
                <button 
                onClick={() => handleNavClick(0)}
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
                Pricing
              </button>
              <button 
                onClick={() => handleNavClick(1)}
                className="text-sm font-semibold text-white hover:text-secondary-400 transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => handleNavClick(2)}
                className="flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                <Image src={auditoLogo} alt="Audito" width={110} height={30} priority />
              </button>
              <button 
                onClick={() => handleNavClick(3)}
                className="text-sm font-semibold text-white hover:text-secondary-400 transition-colors"
              >
                Contact us
              </button>
              <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
                Login
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Mobile Navbar - Normal Top Navbar with Toggle */}
      <div className="fixed top-0 left-0 right-0 z-50 md:hidden bg-[#0F1F1A] shadow-lg">
        <nav className="px-4">
            <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <button 
              onClick={() => handleNavClick(0)}
              className="flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
            >
              <Image src={auditoLogo} alt="Audito" width={90} height={25} priority />
            </button>

            {/* Toggle Button */}
            <button
              className="text-gray-300 hover:text-white p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileOpen && (
            <div className="border-t border-white/10 py-3">
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => handleNavClick(2)}
                  className="text-base text-gray-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg text-left transition-colors"
                >
                  Home
                </button>
                <button 
                  onClick={() => handleNavClick(1)}
                  className="text-base text-gray-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg text-left transition-colors"
                >
                  Features
                </button>
                <button 
                  onClick={() => handleNavClick(0)}
                  className="text-base text-gray-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg text-left transition-colors"
                >
                  Pricing
                </button>
                <button 
                  onClick={() => handleNavClick(3)}
                  className="text-base text-gray-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg text-left transition-colors"
                >
                  Contact us
                </button>
                <div className="pt-2 mt-2 border-t border-white/10">
                  <Link 
                    href="/login" 
                    className="block text-base text-gray-300 hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
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