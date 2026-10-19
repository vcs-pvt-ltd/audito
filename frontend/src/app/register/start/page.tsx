"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import logo from "@/assets/logo/audito_logo.png";
import { usePackageState } from "@/lib/registration/usePackageState";
import WorkspacePackageBuilder, { contactHref } from "@/components/registration/WorkspacePackageBuilder";
import CustomSetupBar from "@/components/registration/CustomSetupBar";
import { focusRing } from "@/components/registration/ui";

function WorkspaceSetup() {
  const selection = usePackageState();

  return <main className="relative min-h-screen px-3 pb-28 pt-14 text-ws-ink sm:px-6 sm:py-8 md:pb-8">
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/4 top-1/3 h-80 w-80 rounded-full bg-primary-600/15 blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 h-60 w-60 rounded-full bg-accent-500/10 blur-3xl" />
    </div>

    <div className="glass relative mx-auto max-w-[1240px] overflow-hidden rounded-3xl border-white/10 pt-5 shadow-2xl shadow-black/20">
      <Link href="/login" aria-label="Back to sign in" className={`absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-ws-soft transition-colors hover:bg-white/[0.08] hover:text-white sm:left-6 sm:top-5 ${focusRing}`}><ArrowLeft size={18} /></Link>
      <div className="mb-3 px-5 text-center">
        <Link href="/" aria-label="Audito home" className={`inline-block rounded ${focusRing}`}><Image src={logo} alt="Audito" width={110} height={30} className="mx-auto h-8 w-auto" priority /></Link>
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <WorkspacePackageBuilder selection={selection} eyebrow={<>
          <span className="flex gap-1" aria-hidden><span className="h-1 w-5 rounded-full bg-[#00D492]" /><span className="h-1 w-5 rounded-full bg-white/15" /></span>
          Step 1 of 2 · Workspace and package
        </>} />
      </div>
      <CustomSetupBar href={contactHref(selection.state)} fixedBarBelow={false} className="bg-black/10" />
    </div>

    <p className="relative mt-4 text-center text-sm text-ws-soft">Already have an account? <Link href="/login" className={`rounded font-bold text-ws-gold hover:brightness-110 ${focusRing}`}>Log in</Link></p>
  </main>;
}

export default function RegisterStartPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 size={32} className="animate-spin text-ws-gold" /><span className="sr-only">Loading</span></div>}>
    <WorkspaceSetup />
  </Suspense>;
}
