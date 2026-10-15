"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import OnboardingWelcome from "@/components/onboarding/OnboardingWelcomeModal";
import { journeyPreview, type JourneyItem } from "@/components/onboarding/journey";
import { useUiFeedback } from "@/context/UiFeedbackContext";

const tips = (items: { title: string; description: string }[]): JourneyItem[] =>
  items.map(item => ({ key: item.title, ...item, state: "upcoming" }));

function OnboardingContent() {
  const router = useRouter();
  const { confirm } = useUiFeedback();
  const { admin, isLoading } = useAuth();
  const {
    started,
    busy,
    hydrated,
    steps,
    organizationSetupMethod,
    refreshProgress,
    startOnboarding,
    skipOnboarding,
  } = useOnboarding();
  const isAdmin = admin?.role === "admin";
  // Saved progress decides where Start or Continue leads, so read it first.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    // If the check fails, Start still works and opens the first unfinished step it knows of.
    refreshProgress().catch(() => undefined).finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [isAdmin, refreshProgress]);

  const content = useMemo(() => {
    if (!admin) return null;

    if (admin.role === "auditor") {
      return {
        heading: "Ready for your next audit?",
        description: "Your assignments, evidence and reports in one workspace.",
        items: tips([
          { title: "Find your audits", description: "Open your assignments from the dashboard." },
          { title: "Record your findings", description: "Add answers, evidence and inspection notes." },
          { title: "Share your report", description: "Submit results and follow up on actions." },
        ]),
        variant: "tips" as const,
        primaryLabel: "Continue to dashboard",
      };
    }

    if (admin.role === "organization_user") {
      return {
        heading: "See how your team is doing.",
        description: "Find audit results and follow progress across the areas assigned to you.",
        items: tips([
          { title: "Explore your areas", description: "See the organization areas you can access." },
          { title: "Review audit findings", description: "Read results and supporting evidence." },
          { title: "Follow progress", description: "Track performance and spot areas to improve." },
        ]),
        variant: "tips" as const,
        primaryLabel: "Continue to dashboard",
      };
    }

    const combinedAvailable = admin.account_type !== "Audit Firm";
    return {
      heading: "Welcome to Audito",
      description: combinedAvailable
        ? "Set up your organization, checklist and team, then assign your first audit. We guide you through each step."
        : "Set up your organization and team. We guide you through each step.",
      items: journeyPreview(steps, { method: organizationSetupMethod, combinedAvailable }),
      variant: "journey" as const,
      primaryLabel: "Start setup",
      secondaryLabel: "Explore the dashboard first",
    };
  }, [admin, steps, organizationSetupMethod]);

  useEffect(() => {
    if (!isLoading && !admin) router.replace("/login");
    if (!isLoading && admin && (admin.onboarding_completed || admin.onboarding_skipped)) router.replace("/dashboard");
  }, [isLoading, admin, router]);

  if (isLoading || !admin || !content || admin.onboarding_completed || admin.onboarding_skipped) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary-400 border-t-transparent" />
      </div>
    );
  }

  const doneCount = content.items.filter(item => item.state === "done").length;
  const handleSkip = async () => {
    const approved = await confirm({
      title: "Explore the dashboard instead?",
      message: "Your setup guide closes for now. Your progress is kept, and you can return to setup from your workspace.",
      confirmText: "Explore dashboard",
      cancelText: "Continue setup",
      variant: "warning",
    });
    if (approved) await skipOnboarding();
  };

  return (
    <div className="flex min-h-dvh items-center overflow-x-clip">
      <div className="mx-auto w-full px-4 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-16">
        <OnboardingWelcome
          busy={busy}
          checking={isAdmin && (!checked || !hydrated)}
          heading={content.heading}
          description={content.description}
          items={content.items}
          variant={content.variant}
          progress={isAdmin ? { done: doneCount, total: content.items.length } : undefined}
          primaryLabel={isAdmin && (started || doneCount > 0) ? "Continue setup" : content.primaryLabel}
          secondaryLabel={content.secondaryLabel}
          onStart={isAdmin ? startOnboarding : () => void skipOnboarding()}
          onSkip={isAdmin ? () => void handleSkip() : undefined}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}
