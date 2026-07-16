"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import OnboardingWelcomeModal from "@/components/onboarding/OnboardingWelcomeModal";
import { useUiFeedback } from "@/context/UiFeedbackContext";

function OnboardingContent() {
  const router = useRouter();
  const { confirm } = useUiFeedback();
  const { admin, isLoading } = useAuth();
  const {
    started,
    busy,
    doneCount,
    steps,
    startOnboarding,
    skipOnboarding,
  } = useOnboarding();

  const onboardingText = useMemo(() => {
    if (!admin) return null;

    if (admin.role === "auditor") {
      return {
        heading: "Auditor Onboarding",
        description:
          "Welcome to Audito. As an auditor, your main workflow is to receive audit assignments, review evidence, complete inspections, and submit reports with corrective action recommendations.",
        notes: [
          "Review your assigned audits from the dashboard.",
          "Record evidence and findings with clarity.",
          "Submit reports and track resolution status.",
        ],
        primaryLabel: "Continue to Dashboard",
        showSkip: false,
      };
    }

    if (admin.role === "entity_head") {
      return {
        heading: "Entity Head Onboarding",
        description:
          "Welcome to Audito. As an entity head, your main responsibility is to review audit findings and analyze performance for your assigned organization units.",
        notes: [
          "View audit findings and evidence in your assigned scope.",
          "Analyze performance and identify trends.",
          "Stay informed without making approvals or changes.",
        ],
        primaryLabel: "Continue to Dashboard",
        showSkip: false,
      };
    }

    return {
      heading: "Welcome to Audito",
      description:
        "We’ve designed a step-by-step onboarding experience to help you configure entities, users, and audit workflows for your organization.",
      notes: [
        "Create your first entities or teams.",
        "Add auditors and assign roles.",
        "Launch your first audit assignment.",
      ],
      primaryLabel: "Begin Setup Flow",
      secondaryLabel: "Explore Dashboard",
      showSkip: true,
    };
  }, [admin]);

  useEffect(() => {
    if (!isLoading && !admin) router.replace("/login");
  }, [isLoading, admin, router]);

  if (isLoading || !admin || !onboardingText) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const progressText = steps.length > 0 ? `${doneCount}/${steps.length} steps already completed` : undefined;
  const handleStart = admin?.role === "admin" ? startOnboarding : skipOnboarding;
  const handleSkip = async () => {
    const approved = await confirm({
      title: "Explore the dashboard instead?",
      message: "Your setup guide will close for now. You can resume onboarding later from your workspace.",
      confirmText: "Explore dashboard",
      cancelText: "Continue setup",
      variant: "warning",
    });
    if (approved) await skipOnboarding();
  };

  return (
    <div className="min-h-dvh overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-20 sm:px-6 lg:px-8 lg:pt-10">
        <OnboardingWelcomeModal
          open={!started}
          busy={busy}
          heading={onboardingText.heading}
          description={onboardingText.description}
          notes={onboardingText.notes}
          progressText={progressText}
          primaryLabel={onboardingText.primaryLabel}
          secondaryLabel={onboardingText.secondaryLabel}
          showSkip={onboardingText.showSkip}
          onStart={handleStart}
          onSkip={() => void handleSkip()}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}
