"use client";

import { Tag } from "lucide-react";
import { usePackageSelection } from "@/lib/registration/usePackageState";
import WorkspacePackageBuilder, { contactHref } from "@/components/registration/WorkspacePackageBuilder";
import CustomSetupBar from "@/components/registration/CustomSetupBar";

/** Landing page pricing: the same builder as /register/start, with local (not URL) state. */
export default function PricingSection({ dialog = false }: { dialog?: boolean }) {
  const selection = usePackageSelection();

  return <section aria-labelledby={dialog ? undefined : "pricing-title"} className="flex min-h-full flex-col text-ws-ink">
    <div className={`flex flex-1 flex-col justify-center px-4 sm:px-6 lg:px-10 ${dialog ? "pb-4 pt-6 sm:pr-16" : "pb-4 pt-20"}`}>
      <div className="mx-auto w-full max-w-[1200px]">
        <WorkspacePackageBuilder selection={selection} eyebrow={<><Tag size={14} aria-hidden />Simple Pricing</>} headingAs="h2" headingId={dialog ? "package-setup-title" : "pricing-title"} mobileBar="sticky" />
      </div>
    </div>
    {/* Room on the right for the landing assistant's floating button. */}
    <CustomSetupBar href={contactHref(selection.state)} fixedBarBelow={false} className={dialog ? "" : "sm:pr-24 lg:pr-24"} />
  </section>;
}
