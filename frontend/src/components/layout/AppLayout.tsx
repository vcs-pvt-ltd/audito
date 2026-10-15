"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SubscriptionBanner from "@/components/layout/SubscriptionBanner";
import { useAuth } from "@/context/AuthContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import OnboardingCompletedModal from "@/components/onboarding/OnboardingCompletedModal";
import OnboardingBar, { OnboardingHint } from "@/components/onboarding/OnboardingBar";
import ResumeSetupBanner from "@/components/onboarding/ResumeSetupBanner";
import { MotionConfig } from "framer-motion";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { admin } = useAuth();
  const { isActive, showCompletionModal, closeCompletionModal } = useOnboarding();

  const isOnboardingUrl = pathname.startsWith("/onboarding") || searchParams.get("onboarding") === "1";
  const onboardingFinished = Boolean(admin?.onboarding_completed || admin?.onboarding_skipped);
  const isOnboardingFlow = !onboardingFinished && ((admin?.role === "admin" && isActive) || isOnboardingUrl);
  const isOrganizationSetupChoice = pathname === "/organization/setup-choice";
  const isOnboardingWelcome = pathname.startsWith("/onboarding");

  // Choosing AI or manual setup happens before the guided missions begin.
  // Keep this screen focused and show the journey UI only after a method is selected.
  const showAdminOnboardingGuide = isOnboardingFlow
    && admin?.role === "admin"
    && !isOnboardingWelcome
    && !isOrganizationSetupChoice;
  // The AI setup screen has its own stepper, so the journey bar stays compact
  // there and each screen shows a single progress indicator.
  const hasOwnStepper = pathname.startsWith("/organization/ai-setup");

  return (
    <MotionConfig reducedMotion="user">
    <div data-onboarding={isOnboardingFlow ? "" : undefined} className="relative flex h-dvh min-h-dvh bg-[#06140e]/35 overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_80%_0%,rgba(0,169,103,0.09),transparent_35%)]">
      {!isOnboardingFlow && <Sidebar />}

      <div className="relative flex-1 flex min-w-0 flex-col min-h-0 bg-transparent overflow-hidden">
        {/* During onboarding one slim bar replaces the app navigation. */}
        {showAdminOnboardingGuide && <OnboardingBar variant={hasOwnStepper ? "compact" : "full"} />}
        <main className={`flex-1 min-w-0 overflow-y-auto overscroll-contain scroll-smooth ${isOnboardingFlow ? "pb-0" : "pb-[88px] lg:pb-0"}`}>
          {!isOnboardingFlow && <SubscriptionBanner />}
          {pathname === "/dashboard" && <ResumeSetupBanner />}
          {/* The AI setup screen explains itself; other steps get a short guide. */}
          {showAdminOnboardingGuide && !hasOwnStepper && <OnboardingHint />}
          {children}
        </main>
      </div>

      {!isOnboardingFlow && <MobileBottomNav />}
      <OnboardingCompletedModal open={showCompletionModal} onClose={closeCompletionModal} />
    </div>
    </MotionConfig>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, isLoading } = useAuth();
  const router = useRouter();

  const publicRoutes = ["/", "/login", "/register/select-package", "/register", "/forgot-password", "/verify-email", "/payment", "/custom-solution", "/privacy-policies"];
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/payment") ||
    pathname.startsWith("/custom-solution") ||
    pathname.startsWith("/privacy-policies");

  useEffect(() => {
    if (!isLoading && !admin && !isPublicRoute) router.replace("/login");
  }, [admin, isLoading, isPublicRoute, router]);

  useEffect(() => {
    const isAuthPage = pathname === "/" || pathname === "/login" || pathname === "/register/select-package" || pathname === "/register";
    if (!isLoading && admin && isAuthPage) {
      if (admin.role === "audito_admin") {
        router.replace("/admin-panel/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [admin, isLoading, pathname, router]);

  useEffect(() => {
    if (isLoading || !admin) return;
    // audito_admin has no onboarding
    if (admin.role === "audito_admin") return;
    const onboardingDone = !!admin.onboarding_completed || !!admin.onboarding_skipped;
    if (onboardingDone && pathname.startsWith("/onboarding")) {
      router.replace("/dashboard");
      return;
    }
    // Payments and billing stay reachable during onboarding, e.g. to add departments from the AI setup.
    const adminExemptRoutes = ["/onboarding", "/profile", "/settings/organization", "/settings/billing", "/payment", "/organization", "/structure", "/users", "/checklists", "/audits"];
    const userExemptRoutes = ["/onboarding", "/profile", "/settings/organization"];
    const exemptRoutes = admin.role === "admin" ? adminExemptRoutes : userExemptRoutes;
    const isExempt = exemptRoutes.some((r) => pathname.startsWith(r));
    if (!onboardingDone && !isExempt) router.replace("/onboarding");
  }, [admin, isLoading, pathname, router]);

  if (isPublicRoute) return <>{children}</>;

  return (
    <Suspense fallback={null}>
      <OnboardingProvider>
        <AppShell>{children}</AppShell>
      </OnboardingProvider>
    </Suspense>
  );
}
