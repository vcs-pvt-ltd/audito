"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface LandingContextType {
  activeSection: number;
  setActiveSection: (index: number) => void;
  navigate: (direction: "left" | "right") => void;
}

const LandingContext = createContext<LandingContextType | undefined>(undefined);

// Slider order — keep in sync with SECTIONS in app/page.tsx
const SECTION_IDS = ["pricing", "features", "home", "contact"];

export function LandingProvider({ children }: { children: ReactNode }) {
  // Keep the first server and client render identical. The deep-link is read
  // after hydration so `/?section=pricing` never causes a hydration mismatch.
  const [activeSection, setActiveSection] = useState(2); // Initial: Home (index 2)

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("section");
    const idx = param ? SECTION_IDS.indexOf(param) : -1;
    if (idx !== -1) setActiveSection(idx);
  }, []);

  const navigate = (direction: "left" | "right") => {
    const totalSections = 4;
    if (direction === "left") {
      setActiveSection((prev) => Math.max(0, prev - 1));
    } else {
      setActiveSection((prev) => Math.min(totalSections - 1, prev + 1));
    }
  };

  return (
    <LandingContext.Provider value={{ activeSection, setActiveSection, navigate }}>
      {children}
    </LandingContext.Provider>
  );
}

export function useLanding() {
  const context = useContext(LandingContext);
  if (!context) {
    throw new Error("useLanding must be used within LandingProvider");
  }
  return context;
}
