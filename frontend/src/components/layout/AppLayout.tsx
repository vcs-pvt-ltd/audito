"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
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
  const { isActive, steps, currentStep, showCompletionModal, closeCompletionModal } = useOnboarding();

  const isOnboardingFlow = isActive || pathname.startsWith("/onboarding") || searchParams.get("onboarding") === "1";

  useEffect(() => {
    if (!isActive) return;
    const step = steps[currentStep];
    if (!step) return;
    if (pathname === "/onboarding") {
      router.replace(`${step.href}?onboarding=1`);
    }
  }, [isActive, steps, currentStep, pathname, router]);

  return (
    <div className="flex h-screen bg-transparent overflow-hidden">
      {isOnboardingFlow ? (
        /* Desktop sidebar — lg+ only */
        <aside className="hidden lg:block w-[360px] shrink-0 border-r border-white/10 bg-primary-950/50 backdrop-blur-md overflow-hidden">
          <OnboardingGuide />
        </aside>
      ) : (
        <Sidebar />
      )}

      <div className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
        {isOnboardingFlow && <OnboardingTopProgress />}
        <main className={`flex-1 overflow-y-auto scroll-smooth ${isOnboardingFlow ? "pb-[280px] lg:pb-0" : "pb-[88px] lg:pb-0"}`}>
          {children}
        </main>
      </div>

      {/* Mobile bottom panel — only mounted during onboarding, hidden on lg+ */}
      {isOnboardingFlow && <OnboardingGuideMobile />}

      {!isOnboardingFlow && <MobileBottomNav />}
      <OnboardingCompletedModal open={showCompletionModal} onClose={closeCompletionModal} />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, isLoading } = useAuth();
  const router = useRouter();

  const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/verify-email"];
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/forgot-password");

  useEffect(() => {
    if (!isLoading && !admin && !isPublicRoute) router.replace("/login");
  }, [admin, isLoading, isPublicRoute, router]);

  useEffect(() => {
    const isAuthPage = pathname === "/" || pathname === "/login" || pathname === "/register";
    if (!isLoading && admin && isAuthPage) router.replace("/dashboard");
  }, [admin, isLoading, pathname, router]);

  useEffect(() => {
    if (isLoading || !admin) return;
    const isAdmin = admin.role === "admin";
    const onboardingDone = !!admin.onboarding_completed || !!admin.onboarding_skipped;
    const exemptRoutes = ["/onboarding", "/profile", "/settings/organization", "/organization", "/structure", "/users", "/checklists", "/audits"];
    const isExempt = exemptRoutes.some((r) => pathname.startsWith(r));
    if (isAdmin && !onboardingDone && !isExempt) router.replace("/onboarding");
  }, [admin, isLoading, pathname, router]);

  if (isPublicRoute) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#053B36]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <OnboardingProvider>
        <AppShell>{children}</AppShell>
      </OnboardingProvider>
    </Suspense>
  );
}