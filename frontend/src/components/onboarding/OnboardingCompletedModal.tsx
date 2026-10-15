"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ClipboardList, UsersRound } from "lucide-react";
import { Button } from "@/components/ui";
import { useOnboarding } from "@/context/OnboardingContext";
import { EASE } from "./motion";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default function OnboardingCompletedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (href?: string) => void;
}) {
  const { counts, steps } = useOnboarding();
  const hasAudits = steps.some(step => step.key === "audits");
  const summary = [
    steps.some(step => step.key === "organization-setup" || step.key === "entities") && "Organization structure saved",
    counts.checklists > 0 && plural(counts.checklists, "checklist"),
    counts.auditors > 0 && plural(counts.auditors, "auditor"),
    counts.organizationUsers > 0 && plural(counts.organizationUsers, "organization user"),
    counts.audits > 0 && `${plural(counts.audits, "audit")} assigned`,
  ].filter(Boolean) as string[];

  return <AnimatePresence>
    {open && <motion.div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-done-title"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-surface p-6 text-center shadow-2xl sm:max-w-md sm:rounded-3xl sm:p-8"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE }}>
        <motion.span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-400 text-primary-950 shadow-[0_0_0_8px_rgba(38,190,132,.12)]"
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}>
          <Check size={30} strokeWidth={3} aria-hidden />
        </motion.span>
        <h2 id="onboarding-done-title" className="mt-6 text-2xl font-bold tracking-tight text-white">You’re all set</h2>
        <p className="mt-2 text-sm leading-6 text-gray-300">{hasAudits ? "Your workspace is ready. Follow your first audit from the dashboard." : "Your workspace is ready. Manage your organization and team from the dashboard."}</p>
        {summary.length > 0 && <ul className="mt-6 space-y-2 rounded-2xl bg-white/[.04] p-4 text-left text-sm text-gray-200">
          {summary.map((line, index) => <motion.li key={line} className="flex items-center gap-2.5" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, ease: EASE, delay: 0.2 + index * 0.05 }}>
            <Check size={15} className="shrink-0 text-primary-300" aria-hidden />{line}
          </motion.li>)}
        </ul>}
        <Button autoFocus className="mt-7 min-h-12 rounded-2xl" fullWidth rightIcon={<ArrowRight size={17} />} onClick={() => onClose()}>Go to dashboard</Button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {hasAudits
            ? <Button variant="ghost" leftIcon={<ClipboardList size={15} />} onClick={() => onClose("/audits")}>View audits</Button>
            : <Button variant="ghost" leftIcon={<ClipboardList size={15} />} onClick={() => onClose("/organization")}>Organization</Button>}
          <Button variant="ghost" leftIcon={<UsersRound size={15} />} onClick={() => onClose("/users/list?type=auditors")}>Your team</Button>
        </div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}
