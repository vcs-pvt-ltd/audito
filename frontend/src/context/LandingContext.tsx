"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface LandingContextType {
  activeSection: number;
  setActiveSection: (index: number) => void;
  navigate: (direction: "left" | "right") => void;
}

const LandingContext = createContext<LandingContextType | undefined>(undefined);

export function LandingProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState(2); // Initial: Home (index 2)

  const navigate = (direction: "left" | "right") => {
    const totalSections = 4; // Home, Features, Pricing, Contact
    if (direction === "left") {
      setActiveSection((prev) => (prev - 1 + totalSections) % totalSections);
    } else {
      setActiveSection((prev) => (prev + 1) % totalSections);
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
