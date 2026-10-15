"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLanding } from "@/context/LandingContext";
import PricingSection from "./PricingSection";

export default function PackageSetupDialog() {
  const { packageSetupOpen, closePackageSetup } = useLanding();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!packageSetupOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closePackageSetup(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [packageSetupOpen, closePackageSetup]);

  if (!packageSetupOpen) return null;

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#03110f]/85 backdrop-blur-md sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closePackageSetup(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="package-setup-title" className="relative h-[100dvh] w-full max-w-6xl overflow-hidden border border-white/15 bg-[#071c18] shadow-2xl shadow-black/60 sm:h-auto sm:max-h-[min(94dvh,1050px)] sm:rounded-3xl">
      <button ref={closeRef} type="button" onClick={closePackageSetup} aria-label="Close package setup" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#102c26] text-gray-300 transition-colors hover:border-secondary-400/40 hover:text-white"><X size={18} /></button>
      <div className="h-full overflow-y-auto overscroll-contain sm:max-h-[min(94dvh,1050px)]"><PricingSection dialog /></div>
    </div>
  </div>;
}
