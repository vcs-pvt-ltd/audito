"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Compass, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import { notice } from "./motion";

const HIDDEN_KEY = "audito_resume_setup_hidden";

// Shown to admins who skipped setup, so the guided setup is easy to find again.
export default function ResumeSetupBanner() {
  const { admin } = useAuth();
  const { busy, resumeOnboarding } = useOnboarding();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(window.sessionStorage.getItem(HIDDEN_KEY) === "1"); } catch { setHidden(false); }
  }, []);
  const eligible = admin?.role === "admin" && admin.onboarding_skipped && !admin.onboarding_completed;
  const hide = () => { setHidden(true); try { window.sessionStorage.setItem(HIDDEN_KEY, "1"); } catch { /* hidden for this view */ } };

  return <AnimatePresence initial={false}>
    {eligible && !hidden && <motion.div variants={notice} initial="initial" animate="animate" exit="exit" className="overflow-hidden">
      <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 lg:px-8">
        <section aria-label="Resume setup" className="flex flex-col gap-3 rounded-2xl border border-secondary-400/20 bg-secondary-500/[.07] p-4 sm:flex-row sm:items-center">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary-400/15 text-secondary-300" aria-hidden><Compass size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Your setup is not finished</p>
            <p className="text-sm text-gray-300">Pick up where you left off. Everything you added is kept.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" loading={busy} rightIcon={<ArrowRight size={15} />} onClick={() => void resumeOnboarding()} className="min-h-10">Resume setup</Button>
            <button type="button" onClick={hide} aria-label="Hide for now" className="grid h-10 w-10 place-items-center rounded-xl text-gray-400 hover:bg-white/[.06] hover:text-white"><X size={16} /></button>
          </div>
        </section>
      </div>
    </motion.div>}
  </AnimatePresence>;
}
