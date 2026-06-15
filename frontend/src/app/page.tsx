"use client";

import Navbar from "@/components/layout/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import PricingSection from "@/components/landing/PricingSection";
import ContactSection from "@/components/landing/ContactSection";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LandingProvider, useLanding } from "@/context/LandingContext";

const SECTIONS = [
  { id: "pricing", label: "Pricing", component: PricingSection },
  { id: "features", label: "Features", component: FeaturesSection },
  { id: "home", label: "Home", component: HeroSection },
  { id: "contact", label: "Contact us", component: ContactSection },
];

function HomePageContent() {
  const { activeSection, navigate } = useLanding();

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <Navbar />
      <main className="relative flex-1 overflow-hidden w-screen max-w-[100vw]">
        {/* Left Arrow */}
        <button
          onClick={() => navigate("left")}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full glass flex items-center justify-center text-gray-300 hover:text-white transition-colors"
          aria-label="Previous section"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Right Arrow */}
        <button
          onClick={() => navigate("right")}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full glass flex items-center justify-center text-gray-300 hover:text-white transition-colors"
          aria-label="Next section"
        >
          <ChevronRight size={20} />
        </button>

        {/* Sliding track */}
        <div
          className="flex h-full transition-transform duration-1500 ease-in-out"
          style={{ transform: `translateX(-${activeSection * 100}vw)` }}
        >
          {SECTIONS.map(({ id, component: Section }) => (
            <div key={id} className="w-screen h-full flex-shrink-0 overflow-y-auto">
              <Section />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <LandingProvider>
      <HomePageContent />
    </LandingProvider>
  );
}