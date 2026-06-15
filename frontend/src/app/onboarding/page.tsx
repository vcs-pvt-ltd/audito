"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!isLoading && !admin) router.replace("/login");
  }, [isLoading, admin, router]);

  if (isLoading || !admin) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-8 pt-20 lg:pt-10 pb-28">
        <OnboardingWelcomeModal
          open={!started}
          busy={busy}
          progressText={`${doneCount}/${steps.length} steps already completed`}
          onStart={startOnboarding}
          onSkip={() => void skipOnboarding()}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return <OnboardingContent />;
}
