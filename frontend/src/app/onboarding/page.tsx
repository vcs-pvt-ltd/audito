"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOnboarding } from "@/context/OnboardingContext";
import OnboardingWelcomeModal from "@/components/onboarding/OnboardingWelcomeModal";

function OnboardingContent() {
  const router = useRouter();
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
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const progressText = steps.length > 0 ? `${doneCount}/${steps.length} steps already completed` : undefined;
  const handleStart = admin?.role === "admin" ? startOnboarding : skipOnboarding;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-8 pt-20 lg:pt-10 pb-28">
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
          onSkip={() => void skipOnboarding()}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}
