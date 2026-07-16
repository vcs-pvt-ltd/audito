"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import SubscriptionBanner from "@/components/layout/SubscriptionBanner";
import { useAuth } from "@/context/AuthContext";
import { OnboardingProvider, useOnboarding } from "@/context/OnboardingContext";
import OnboardingCompletedModal from "@/components/onboarding/OnboardingCompletedModal";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide";
import OnboardingGuideMobile from "@/components/onboarding/OnboardingGuideMobile";
import OnboardingTopProgress from "@/components/onboarding/OnboardingTopProgress";

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin } = useAuth();
  const { isActive, steps, currentStep, showCompletionModal, closeCompletionModal } = useOnboarding();

  const isOnboardingUrl = pathname.startsWith("/onboarding") || searchParams.get("onboarding") === "1";
  const isOnboardingFlow = (admin?.role === "admin" && isActive) || isOnboardingUrl;

  useEffect(() => {
    if (!isActive || admin?.role !== "admin") return;
    const step = steps[currentStep];
    if (!step) return;
    if (pathname === "/onboarding") {
      router.replace(`${step.href}?onboarding=1`);
    }
  }, [isActive, steps, currentStep, pathname, router, admin?.role]);

  const showAdminOnboardingGuide = isOnboardingFlow && admin?.role === "admin";

  return (
    <div className="relative flex h-dvh min-h-dvh bg-[#06140e]/35 overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_80%_0%,rgba(0,169,103,0.09),transparent_35%)]">
      {showAdminOnboardingGuide ? (
        /* Desktop sidebar — lg+ only */
        <aside className="hidden lg:block w-[344px] xl:w-[368px] shrink-0 border-r border-white/10 bg-primary-950/50 backdrop-blur-md overflow-hidden">
          <OnboardingGuide />
        </aside>
      ) : (
        !isOnboardingFlow && <Sidebar />
      )}

      <div className="relative flex-1 flex min-w-0 flex-col min-h-0 bg-transparent overflow-hidden">
        {showAdminOnboardingGuide && <OnboardingTopProgress />}
        <main className={`flex-1 min-w-0 overflow-y-auto overscroll-contain scroll-smooth ${showAdminOnboardingGuide ? "pb-[228px] lg:pb-0" : "pb-[88px] lg:pb-0"}`}>
          {!isOnboardingFlow && <SubscriptionBanner />}
          {children}
        </main>
      </div>

      {/* Mobile bottom panel — only mounted during onboarding, hidden on lg+ */}
      {showAdminOnboardingGuide && <OnboardingGuideMobile />}

      {!isOnboardingFlow && <MobileBottomNav />}
      <OnboardingCompletedModal open={showCompletionModal} onClose={closeCompletionModal} />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, isLoading } = useAuth();
  const router = useRouter();

  const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/verify-email", "/payment", "/custom-solution", "/privacy-policies"];
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
    const isAuthPage = pathname === "/" || pathname === "/login" || pathname === "/register";
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
    const adminExemptRoutes = ["/onboarding", "/profile", "/settings/organization", "/organization", "/structure", "/users", "/checklists", "/audits"];
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
