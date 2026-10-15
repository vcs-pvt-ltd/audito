"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock3, PencilRuler, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { useOnboarding } from "@/context/OnboardingContext";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { EASE, rise, stagger } from "@/components/onboarding/motion";
import logo from "@/assets/images/audito-logo-white.png";

type Method = "ai" | "manual";

// The AI option's mark: sparkles on Audito's green-to-gold gradient, with a soft
// rotating glow and an "AI" tag. The glow stops for people who prefer reduced motion.
function AiMark({ active }: { active: boolean }) {
  return <span className="relative grid h-12 w-12 shrink-0 place-items-center" aria-hidden>
    <span className={`absolute -inset-[3px] animate-[spin_6s_linear_infinite] rounded-[18px] bg-[conic-gradient(from_0deg,var(--color-primary-400),var(--color-secondary-400),var(--color-accent-400),var(--color-primary-400))] blur-[3px] transition-opacity ${active ? "opacity-80" : "opacity-45 group-hover:opacity-70"}`} />
    <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-500 text-white shadow-lg shadow-primary-950/40 ring-1 ring-inset ring-white/20">
      <Sparkles size={22} strokeWidth={2.2} />
    </span>
    <span className="absolute -right-2 -top-2 rounded-md border border-primary-950/30 bg-secondary-300 px-1 py-px text-[9px] font-black leading-tight tracking-wide text-primary-950 shadow">AI</span>
  </span>;
}

export default function OrganizationSetupChoicePage() {
  const router = useRouter();
  const { isActive, hydrated, busy, skipOnboarding } = useOnboarding();
  const { admin } = useAuth();
  const { confirm } = useUiFeedback();
  const combined = admin?.account_type !== "Audit Firm";
  const [method, setMethod] = useState<Method>("ai");
  const [leaving, setLeaving] = useState(false);
  const onboardingFinished = Boolean(admin?.onboarding_completed || admin?.onboarding_skipped);

  // This page belongs to guided setup. Outside it, send people to the right place.
  useEffect(() => {
    if (hydrated && !isActive) router.replace(onboardingFinished ? "/organization" : "/onboarding");
  }, [hydrated, isActive, onboardingFinished, router]);

  if (!hydrated || !isActive) return null;

  const options = [
    {
      method: "ai" as const, icon: Sparkles, recommended: true, time: "About 5 minutes",
      title: "Set up with AI",
      text: combined
        ? "Upload the audit sheet you already use. Audito prepares your organization and checklist, and you review everything before it is saved."
        : "Upload an organization document or describe your organization. Audito prepares your structure, and you review it before it is saved.",
      needs: combined
        ? ["Your current audit sheet: Excel, Word, PDF or a photo", "A few minutes to review the suggestions"]
        : ["An organization chart, branch list, or a short description", "A few minutes to review the suggestions"],
      after: combined ? "Next: upload your sheet" : "Next: add your document",
      action: "Continue with AI setup",
    },
    {
      method: "manual" as const, icon: PencilRuler, recommended: false, time: "About 15 minutes",
      title: "Set it up myself",
      text: combined
        ? "Create each area of your organization, arrange them into your structure, then write your checklist."
        : "Create each branch and department, then arrange them into your structure.",
      needs: combined
        ? ["The names of your areas, such as factories and departments", "The questions you want auditors to answer"]
        : ["The names of your branches and departments"],
      after: "Next: create your first areas",
      action: "Continue with manual setup",
    },
  ];
  const chosen = options.find(option => option.method === method)!;

  const proceed = () => {
    setLeaving(true);
    try { window.localStorage.setItem("audito_onboarding_organization_method", method); } catch { /* the URL also records the method */ }
    router.push(method === "ai" ? "/organization/ai-setup?onboarding=1" : "/structure?manual=1&onboarding=1");
  };
  const skip = async () => {
    const approved = await confirm({
      title: "Skip setup for now?",
      message: "Your progress is kept. You can resume setup from your dashboard.",
      confirmText: "Skip setup",
      cancelText: "Keep going",
      variant: "warning",
    });
    if (approved) await skipOnboarding();
  };

  return <div className="flex min-h-full flex-col px-4 py-5 sm:px-6 sm:py-8">
  

    <motion.div initial="initial" animate="animate" variants={stagger(0.06)} className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-8 sm:py-12">
      <motion.p variants={rise} className="text-center text-xs font-semibold uppercase tracking-[.2em] text-secondary-300">Organization setup</motion.p>
      <motion.h1 variants={rise} className="mt-3 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">How would you like to set up?</motion.h1>
      <motion.p variants={rise} className="mx-auto mt-3 max-w-xl text-center text-base text-gray-300">Choose one. You can change your mind later, and nothing is saved until you confirm it.</motion.p>

      <motion.div variants={rise} role="radiogroup" aria-label="Setup method" className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2">
        {options.map(option => {
          const Icon = option.icon;
          const active = method === option.method;
          return <label key={option.method}
            className={`group relative flex h-full cursor-pointer flex-col rounded-3xl border p-5 text-left transition-colors sm:p-6 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-secondary-400/70 ${active ? "border-secondary-400/60 bg-secondary-500/[.08]" : "border-white/10 bg-white/[.03] hover:border-white/25"}`}>
            <input type="radio" name="setup-method" value={option.method} checked={active} onChange={() => setMethod(option.method)} className="sr-only" />
            <span className="flex items-center justify-between gap-3">
              {option.method === "ai"
                ? <AiMark active={active} />
                : <span className={`grid h-11 w-11 place-items-center rounded-2xl transition-colors ${active ? "bg-secondary-400 text-primary-950" : "bg-white/[.07] text-gray-200"}`}><Icon size={21} aria-hidden /></span>}
              <span className="flex items-center gap-2">
                {option.recommended && <span className="rounded-full bg-secondary-400/15 px-2.5 py-1 text-[11px] font-semibold text-secondary-200">Recommended</span>}
                <span aria-hidden className={`grid h-6 w-6 place-items-center rounded-full border transition-colors ${active ? "border-secondary-400 bg-secondary-400 text-primary-950" : "border-white/20"}`}>
                  {active && <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18, ease: EASE }}><Check size={14} strokeWidth={3} /></motion.span>}
                </span>
              </span>
            </span>
            <span className="mt-5 text-xl font-semibold text-white">{option.title}</span>
            <span className="mt-2 text-sm leading-6 text-gray-300">{option.text}</span>
            <span className="mt-5 block rounded-2xl bg-black/[.15] p-4">
              <span className="block text-xs font-semibold uppercase tracking-[.12em] text-gray-400">What you need</span>
              <span className="mt-2 block space-y-1.5">
                {option.needs.map(need => <span key={need} className="flex items-start gap-2 text-sm text-gray-200"><Check size={15} className="mt-0.5 shrink-0 text-primary-300" aria-hidden />{need}</span>)}
              </span>
            </span>
            <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-5 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><Clock3 size={13} aria-hidden />{option.time}</span>
              <span>{option.after}</span>
            </span>
          </label>;
        })}
      </motion.div>

      <motion.div variants={rise} className="mx-auto mt-8 w-full max-w-sm">
        <Button fullWidth className="min-h-12 rounded-2xl text-base" loading={leaving} leftIcon={method === "ai" ? <Sparkles size={18} aria-hidden /> : undefined} rightIcon={<ArrowRight size={18} />} onClick={proceed}>{chosen.action}</Button>
      </motion.div>
    </motion.div>
  </div>;
}
