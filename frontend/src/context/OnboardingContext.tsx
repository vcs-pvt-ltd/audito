"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi, auditApi, checklistApi, orgTreeApi, usersApi, organizationAiSetupApi } from "@/lib/api";

type StepState = "done" | "pending";
type OrganizationSetupMethod = "ai" | "manual" | null;

export interface StepItem {
  key: string;
  title: string;
  description: string;
  instructions: string[];
  href: string;
  state: StepState;
  optional?: boolean;
}

interface OnboardingCounts {
  entities: number;
  auditors: number;
  organizationUsers: number;
  checklists: number;
  audits: number;
}

interface OnboardingContextType {
  loading: boolean;
  busy: boolean;
  /** True once saved progress has been read from this browser. */
  hydrated: boolean;
  isActive: boolean;
  organizationSetupMethod: OrganizationSetupMethod;
  counts: OnboardingCounts;
  entityOrder: Array<{ slug: string; label: string; level: number }>;
  startOnboarding: () => void;
  stopOnboardingLocal: () => void;
  started: boolean;
  setStarted: (v: boolean) => void;
  steps: StepItem[];
  currentStep: number;
  setCurrentStep: (v: number) => void;
  doneCount: number;
  progressPct: number;
  allDone: boolean;
  canGoBack: boolean;
  canGoNext: boolean;
  canEnterStep: (index: number) => boolean;
  nextRecommendedStep: number;
  goNext: () => void;
  goBack: () => void;
  openCurrentStep: () => void;
  goToStep: (index: number) => void;
  refreshProgress: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resumeOnboarding: () => Promise<void>;
  showCompletionModal: boolean;
  closeCompletionModal: (href?: string) => void;
  totalSteps: number;
}

// level mirrors backend org_level. excludeEntityTypes hides an item for admins
// registered AS that entity — needed when two entities share an org_level
// (Buying Office & Supplier are both 7) and level alone can't distinguish them.
const ENTITY_ORDER: Record<string, Array<{ slug: string; label: string; level: number; excludeEntityTypes?: string[] }>> = {
  Company: [
    { slug: "cluster", label: "Cluster", level: 4 },
    { slug: "factory", label: "Factory", level: 3 },
    { slug: "unit", label: "Unit", level: 2 },
    { slug: "department", label: "Department", level: 1 },
    { slug: "section", label: "Section", level: 0 },
  ],
  Customer: [
    { slug: "buying-office", label: "Buying Office", level: 7 },
    { slug: "supplier", label: "Supplier", level: 6, excludeEntityTypes: ["Supplier"] },
  ],
  "Audit Firm": [
    { slug: "branch", label: "Branch", level: 3 },
    { slug: "audit-firm-department", label: "Audit Firm Department", level: 1 },
  ],
};

const ORGANIZATION_USER_ORDER: Record<string, Array<{ slug: string; label: string; userType: string; entitySlug: string }>> = {
  Company: [
    { slug: "organization-users", label: "Organization Users", userType: "Organization User", entitySlug: "" },
  ],
  Customer: [
    { slug: "organization-users", label: "Organization Users", userType: "Organization User", entitySlug: "" },
  ],
  "Audit Firm": [
    { slug: "organization-users", label: "Organization Users", userType: "Organization User", entitySlug: "" },
  ],
};

const Ctx = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { admin, accessToken, refreshMe } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [organizationSetupMethod, setOrganizationSetupMethod] = useState<OrganizationSetupMethod>(null);

  const [structureCount, setStructureCount] = useState(0);
  const [orgDone, setOrgDone] = useState(false);
  const [entityCount, setEntityCount] = useState(0);
  const [organizationUserCount, setOrganizationUserCount] = useState(0);
  const [auditorCount, setAuditorCount] = useState(0);
  const [checklistCount, setChecklistCount] = useState(0);
  const [combinedSetupDone, setCombinedSetupDone] = useState(false);
  const [auditCount, setAuditCount] = useState(0);

  const filteredEntityOrder = useMemo(() => {
    const accountType = admin?.account_type || "";
    const orgLevel = admin?.org_level ?? 0;
    const entityType = admin?.entity_type || "";
    return (ENTITY_ORDER[accountType] || []).filter(it =>
      orgLevel > it.level && !it.excludeEntityTypes?.includes(entityType)
    );
  }, [admin?.account_type, admin?.org_level, admin?.entity_type]);

  const organizationUserOrder = useMemo(() => {
    const accountType = admin?.account_type || "";
    const orgLevel = admin?.org_level ?? 0;
    const entityType = admin?.entity_type || "";
    const base = ORGANIZATION_USER_ORDER[accountType] || [];
    return base.filter(it => {
      const entityConfig = (ENTITY_ORDER[accountType] || []).find(e => e.slug === it.entitySlug);
      if (!entityConfig) return true;
      if (entityConfig.excludeEntityTypes?.includes(entityType)) return false;
      return orgLevel > entityConfig.level;
    });
  }, [admin?.account_type, admin?.org_level, admin?.entity_type]);

  const refreshProgress = useCallback(async () => {
    if (!accessToken || !admin || admin.role !== "admin") return;
    const busyTimer = setTimeout(() => setBusy(true), 500);
    try {
      const order = filteredEntityOrder;
      const organizationUserLevels = organizationUserOrder;

      const [treeRes, auditorsRes, checklistRes, auditRes, setupRes, ...restRes] = await Promise.all([
        orgTreeApi.getTree(accessToken),
        usersApi.list(accessToken, "Auditor"),
        checklistApi.list(accessToken),
        auditApi.list(accessToken),
        organizationAiSetupApi.completion(accessToken),
        ...order.map((t) => orgTreeApi.listEntities(accessToken, t.label)),
        ...organizationUserLevels.map((h) => usersApi.list(accessToken, h.userType)),
      ]);

      const entityRes = restRes.slice(0, order.length);
      const organizationUsersRes = restRes.slice(order.length);

      setStructureCount(order.length);
      setCombinedSetupDone(Boolean(setupRes.success && setupRes.data?.completed));

      if (treeRes.success && treeRes.data) {
        const tree = (treeRes.data as any).tree;
        setOrgDone(!!tree && Array.isArray(tree.children) && tree.children.length > 0);
      } else setOrgDone(false);

      const totalEntities = entityRes.reduce((sum, r) => sum + ((r.success && r.data) ? (((r.data as any).items || []).length) : 0), 0);
      setEntityCount(totalEntities);

      const totalOrganizationUsers = organizationUsersRes.reduce((sum, r) => sum + ((r.success && r.data) ? (((r.data as any).users || []).length) : 0), 0);
      setOrganizationUserCount(totalOrganizationUsers);

      setAuditorCount(auditorsRes.success && auditorsRes.data ? (((auditorsRes.data as any).users || []).length) : 0);
      setChecklistCount(checklistRes.success && checklistRes.data ? (((checklistRes.data as any).checklists || []).length) : 0);
      setAuditCount(auditRes.success && auditRes.data ? (((auditRes.data as any).audits || []).length) : 0);

    } finally {
      clearTimeout(busyTimer);
      setBusy(false);
      setLoading(false);
    }
  }, [accessToken, admin, filteredEntityOrder, organizationUserOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = window.localStorage.getItem("audito_onboarding_active") === "1";
    const step = Number(window.localStorage.getItem("audito_onboarding_step") || "0");
    const savedMethod = window.localStorage.getItem("audito_onboarding_organization_method");
    setIsActive(active);
    setStarted(active);
    setOrganizationSetupMethod(savedMethod === "ai" || savedMethod === "manual" ? savedMethod : null);
    if (!Number.isNaN(step)) setCurrentStep(step);
    setHydrated(true);
  }, []);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentType = searchParams.get("type");
  const searchKey = searchParams.toString();
  const isManualOrganizationSetup = searchParams.get("manual") === "1" || organizationSetupMethod === "manual";
  const isAdmin = admin?.role === "admin";

  useEffect(() => {
    if (typeof window === "undefined") return;

    let method: OrganizationSetupMethod | undefined;
    if (pathname === "/organization/setup-choice") method = null;
    else if (searchParams.get("manual") === "1") method = "manual";
    else if (pathname.startsWith("/organization/ai-setup")) method = "ai";

    if (method === undefined) return;
    setOrganizationSetupMethod(method);
    if (method) window.localStorage.setItem("audito_onboarding_organization_method", method);
    else window.localStorage.removeItem("audito_onboarding_organization_method");
  }, [pathname, searchKey, searchParams]);

  const steps = useMemo<StepItem[]>(() => {
    if (!isAdmin) return [];

    const order = filteredEntityOrder;
    const organizationUserLevels = organizationUserOrder;

    const baseSteps: StepItem[] = [];
    // A saved combined setup keeps the guided order even when browser storage
    // was cleared or the admin continues on another device.
    const combinedAi = (organizationSetupMethod === "ai" || (combinedSetupDone && organizationSetupMethod !== "manual"))
      && admin?.account_type !== "Audit Firm";

    // Manual setup creates reusable entity records before mapping them. AI setup
    // creates and maps the required entities as part of one organization mission.
    if (order.length > 0 && organizationSetupMethod === "manual") {
      baseSteps.push({
        key: "entities",
        title: "Create Entities",
        description: "Add the areas your organization has, such as factories or departments. You arrange them in the next step.",
        instructions: [
          "Add the entities of this type that you use",
          "Leave a type empty if your organization does not have it",
          "Add at least one entity in total"
        ],
        href: "/structure?manual=1",
        state: entityCount > 0 ? "done" : "pending",
      });
    }

    if (order.length > 0 || combinedAi) {
      baseSteps.push({
        key: "organization-setup",
        title: "Set Up Organization",
        description: organizationSetupMethod === "manual"
          ? "Place each entity under the area it reports to, then save your organization structure."
          : organizationSetupMethod === "ai" || combinedAi
            ? "Upload your audit sheet, review what Audito prepared, then save your organization and checklist."
          : "Choose how to set up your organization: with AI from a document, or by yourself.",
        instructions: organizationSetupMethod === "manual"
          ? [
              "Place each entity under the correct parent",
              "Check the complete structure",
              "Save the structure to continue"
            ]
          : organizationSetupMethod === "ai" || combinedAi
            ? [
                combinedAi ? "Upload your existing audit sheet" : "Upload a document or describe your organization",
                combinedAi ? "Review your organization and checklist" : "Correct the suggestion with AI or by hand",
                combinedAi ? "Confirm the checklist details and save" : "Review and apply the final structure"
              ]
          : [
              "Choose AI setup or manual setup",
              "Review the organization structure",
              "Save it before adding your team"
            ],
        // Once the AI setup is saved it does not run again; the organization page shows the result.
        href: combinedAi ? (combinedSetupDone ? "/organization" : "/organization/ai-setup?onboarding=1") : "/organization/setup-choice",
        state: (combinedAi ? combinedSetupDone || (orgDone && checklistCount > 0) : orgDone) ? "done" : "pending",
      });
    }

    const checklistStep = (fromAiSetup: boolean): StepItem => ({
      key: "checklists",
      title: "Create Checklist",
      description: fromAiSetup
        ? "Your AI setup creates this checklist from your audit sheet. Open it to check the questions, or create another checklist."
        : "Create the questions your auditors answer during an audit.",
      instructions: fromAiSetup
        ? ["Open the checklist made from your audit sheet", "Check its questions and the areas they apply to", "Create another checklist if you need one"]
        : ["Enter the checklist name and details", "Set scoring and how often it repeats", "Add questions and choose where they apply"],
      href: "/checklists",
      state: checklistCount > 0 ? "done" : "pending",
    });
    // The AI setup makes the checklist together with the organization, so it comes next.
    if (admin?.account_type !== "Audit Firm" && combinedAi) baseSteps.push(checklistStep(true));

    // Mission 3: Auditors (Everyone can have auditors)
    baseSteps.push({
      key: "auditors",
      title: "Create Auditors",
      description: "Add the people who carry out your audits. Each auditor gets an invitation to sign in.",
      instructions: ["Add at least one auditor", "Check their email address", "They receive an invitation to sign in"],
      href: "/users/list?type=auditors",
      state: auditorCount > 0 ? "done" : "pending",
    });

    // Mission 4: Organization Users
    if (organizationUserLevels.length > 0) {
      baseSteps.push({
        key: "organization-users",
        title: "Create Organization Users",
        description: "Invite people who need to see audit results, and choose the areas they can see.",
        instructions: [
          "Add an organization user",
          "Choose the areas they can see",
          "Pick one area only, or the area and everything below it"
        ],
        href: `/users/list?type=${organizationUserLevels[0].slug}`,
        state: organizationUserCount > 0 ? "done" : "pending",
        optional: true,
      });
    }

    // Mission 5: Checklists (skipped for Audit Firms; after the organization for AI setup)
    if (admin?.account_type !== "Audit Firm" && !combinedAi) baseSteps.push(checklistStep(false));
    // Mission 6: Audits
    if (admin?.account_type !== "Audit Firm") {
      baseSteps.push({
        key: "audits",
        title: "Assign First Audit",
        description: "Choose a checklist, an auditor and a date to schedule your first audit.",
        instructions: ["Choose New audit and pick a checklist", "Choose the areas and the auditor", "Set the audit dates"],
        href: "/audits",
        state: auditCount > 0 ? "done" : "pending",
      });
    }

    return baseSteps;
  }, [isAdmin, admin?.account_type, filteredEntityOrder, organizationUserOrder, entityCount, orgDone, combinedSetupDone, organizationUserCount, auditorCount, checklistCount, auditCount, organizationSetupMethod]);

  useEffect(() => {
    if (!isActive) return;
    const stepIdx = steps.findIndex(s => {
      if (s.key === "organization-setup") return pathname.startsWith("/organization");
      if (s.key === "entities") return pathname.startsWith("/structure");
      if (s.key === "organization-users") {
        return pathname.startsWith("/users/list") && currentType !== "auditors";
      }
      if (s.key === "auditors") {
        return pathname.startsWith("/users/list") && currentType === "auditors";
      }
      return pathname.startsWith(s.href);
    });

    if (stepIdx !== -1 && stepIdx !== currentStep) {
      setCurrentStep(stepIdx);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("audito_onboarding_step", String(stepIdx));
      }
    }
  }, [pathname, searchKey, currentType, steps, currentStep, isActive]);

  useEffect(() => {
    if (isActive) {
      void refreshProgress();
    }
  }, [pathname, isActive, refreshProgress]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      void refreshProgress();
    }, 10000);
    return () => clearInterval(interval);
  }, [isActive, refreshProgress]);

  const doneCount = useMemo(() => steps.filter((s) => s.state === "done").length, [steps]);
  const allDone = useMemo(() => steps.filter(s => !s.optional).every(s => s.state === "done"), [steps]);
  const progressPct = Math.round((doneCount / Math.max(steps.length, 1)) * 100);

  const nextPending = steps.findIndex((s) => s.state === "pending" && !s.optional);
  const nextRecommendedStep = nextPending === -1 ? Math.max(steps.length - 1, 0) : nextPending;

  const canEnterStep = useCallback((index: number) => {
    if (index === 0) return true;
    const prev = steps[index - 1];
    if (prev && prev.state !== "done" && !prev.optional) {
      return index <= nextRecommendedStep;
    }
    return true;
  }, [steps, nextRecommendedStep]);

  const goNext = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    if (step.key === "entities") {
      const order = filteredEntityOrder;
      const currentIndex = order.findIndex(o => o.slug === currentType);

      if (currentIndex !== -1 && currentIndex < order.length - 1) {
        const nextSlug = order[currentIndex + 1].slug;
        router.push(`/structure/list?type=${nextSlug}&manual=1&onboarding=1`);
        return;
      }

      if (currentIndex === order.length - 1) {
        setCurrentStep(currentStep + 1);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("audito_onboarding_step", String(currentStep + 1));
        }
        router.push("/organization?manual=1&onboarding=1");
        return;
      }
    }

    if (step.key === "organization-users") {
      const order = organizationUserOrder;
      const currentIndex = order.findIndex(o => o.slug === currentType);

      if (currentIndex !== -1 && currentIndex < order.length - 1) {
        const nextSlug = order[currentIndex + 1].slug;
        router.push(`/users/list?type=${nextSlug}&onboarding=1`);
        return;
      }
    }

    const next = Math.min(steps.length - 1, currentStep + 1);
    if (next === currentStep) return;
    setCurrentStep(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("audito_onboarding_step", String(next));
    }
    const s = steps[next];
    if (s) router.push(`${s.href}${s.href.includes("?") ? "&" : "?"}onboarding=1`);
  }, [currentStep, currentType, steps, router, filteredEntityOrder, organizationUserOrder, isManualOrganizationSetup, pathname]);

  const goBack = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    if (step.key === "organization-setup" && isManualOrganizationSetup && pathname === "/organization") {
      const lastEntity = filteredEntityOrder[filteredEntityOrder.length - 1];
      const entityStepIndex = steps.findIndex((item) => item.key === "entities");
      if (entityStepIndex !== -1) {
        setCurrentStep(entityStepIndex);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("audito_onboarding_step", String(entityStepIndex));
        }
      }
      router.push(lastEntity
        ? `/structure/list?type=${lastEntity.slug}&manual=1&onboarding=1`
        : "/organization/setup-choice?onboarding=1");
      return;
    }

    if (step.key === "entities") {
      const order = filteredEntityOrder;
      const currentIndex = order.findIndex(o => o.slug === currentType);

      if (currentIndex > 0) {
        const prevSlug = order[currentIndex - 1].slug;
        router.push(`/structure/list?type=${prevSlug}&manual=1&onboarding=1`);
        return;
      }

      if (currentIndex === 0) {
        router.push("/organization/setup-choice?onboarding=1");
        return;
      }
    }

    if (step.key === "organization-users") {
      const order = organizationUserOrder;
      const currentIndex = order.findIndex(o => o.slug === currentType);

      if (currentIndex > 0) {
        const prevSlug = order[currentIndex - 1].slug;
        router.push(`/users/list?type=${prevSlug}&onboarding=1`);
        return;
      }
    }

    const prevIdx = currentStep - 1;
    if (prevIdx < 0) return;

    setCurrentStep(prevIdx);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("audito_onboarding_step", String(prevIdx));
    }

    const prevStep = steps[prevIdx];
    if (prevStep.key === "entities") {
      const order = filteredEntityOrder;
      if (order.length > 0) {
        const lastSlug = order[order.length - 1].slug;
        router.push(`/structure/list?type=${lastSlug}&onboarding=1`);
        return;
      }
    }

    if (prevStep.key === "organization-users") {
      const order = organizationUserOrder;
      if (order.length > 0) {
        const lastSlug = order[order.length - 1].slug;
        router.push(`/users/list?type=${lastSlug}&onboarding=1`);
        return;
      }
    }

    router.push(`${prevStep.href}${prevStep.href.includes("?") ? "&" : "?"}onboarding=1`);
  }, [currentStep, currentType, steps, router, filteredEntityOrder, organizationUserOrder, isManualOrganizationSetup, pathname]);

  const canGoBack = useMemo(() => {
    if (steps[currentStep]?.key === "organization-setup" && isManualOrganizationSetup
      && pathname === "/organization") return true;
    if (currentStep > 0) return true;

    // Within first step (Entities)
    if (steps[0]?.key === "entities") {
      const order = filteredEntityOrder;
      const currentIndex = order.findIndex(o => o.slug === currentType);
      return currentIndex >= 0;
    }

    return false;
  }, [currentStep, currentType, filteredEntityOrder, steps, isManualOrganizationSetup, pathname]);

  const canGoNext = useMemo(() => {
    const step = steps[currentStep];
    if (!step) return false;

    if (step.key === "organization-setup") {
      if (pathname === "/organization/setup-choice" || pathname.startsWith("/organization/ai-setup")) return false;
      if (pathname === "/organization" && !orgDone) return false;
    }

    // Within Entities, we can go next if there are more sub-levels
    if (step.key === "entities") {
      const order = filteredEntityOrder;
      const currentIndex = order.findIndex(o => o.slug === currentType);
      if (currentIndex !== -1 && currentIndex < order.length - 1) return true;
      if (currentIndex === order.length - 1) return entityCount > 0;
    }

    // Within Organization Users
    if (step.key === "organization-users") {
      const order = organizationUserOrder;
      const currentIndex = order.findIndex(o => o.slug === currentType);
      if (currentIndex !== -1 && currentIndex < order.length - 1) return true;
    }

    // Standard mission navigation
    return currentStep < steps.length - 1 && canEnterStep(currentStep + 1);
  }, [currentStep, currentType, steps, canEnterStep, filteredEntityOrder, organizationUserOrder, pathname, orgDone, entityCount]);

  const openCurrentStep = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;
    router.push(`${step.href}${step.href.includes("?") ? "&" : "?"}onboarding=1`);
  }, [steps, currentStep, router]);

  // Opens any step the journey allows, for example from the onboarding bar.
  const goToStep = useCallback((index: number) => {
    const target = steps[index];
    if (!target || !canEnterStep(index)) return;
    setCurrentStep(index);
    if (typeof window !== "undefined") window.localStorage.setItem("audito_onboarding_step", String(index));
    router.push(`${target.href}${target.href.includes("?") ? "&" : "?"}onboarding=1`);
  }, [steps, canEnterStep, router]);

  const skipOnboarding = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true);
    const res = await authApi.updateOnboarding(accessToken, "skip");
    setBusy(false);
    if (res.success) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("audito_onboarding_active");
        window.localStorage.removeItem("audito_onboarding_step");
        window.localStorage.removeItem("audito_onboarding_organization_method");
      }
      setIsActive(false);
      await refreshMe();
      router.replace("/dashboard");
    }
  }, [accessToken, refreshMe, router]);

  // Reopens setup after it was skipped. Only the status flags reset; everything
  // created so far is kept and counted again.
  const resumeOnboarding = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true);
    const res = await authApi.updateOnboarding(accessToken, "reset");
    setBusy(false);
    if (res.success) {
      await refreshMe();
      router.push("/onboarding");
    }
  }, [accessToken, refreshMe, router]);

  const completeOnboarding = useCallback(async () => {
    if (!accessToken || !allDone) return;
    setBusy(true);
    const res = await authApi.updateOnboarding(accessToken, "complete");
    setBusy(false);
    if (res.success) {
      setShowCompletionModal(true);
      await refreshMe();
    }
  }, [accessToken, allDone, refreshMe]);

  const closeCompletionModal = useCallback((href = "/dashboard") => {
    setShowCompletionModal(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("audito_onboarding_active");
      window.localStorage.removeItem("audito_onboarding_step");
      window.localStorage.removeItem("audito_onboarding_organization_method");
    }
    setIsActive(false);
    router.replace(href);
  }, [router]);

  const startOnboarding = useCallback(() => {
    setIsActive(true);
    setStarted(true);
    setCurrentStep(nextRecommendedStep);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("audito_onboarding_active", "1");
      window.localStorage.setItem("audito_onboarding_step", String(nextRecommendedStep));
    }
    const step = steps[nextRecommendedStep];
    if (step) router.push(`${step.href}${step.href.includes("?") ? "&" : "?"}onboarding=1`);
  }, [nextRecommendedStep, steps, router]);

  const stopOnboardingLocal = useCallback(() => {
    setIsActive(false);
    setStarted(false);
    setOrganizationSetupMethod(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("audito_onboarding_active");
      window.localStorage.removeItem("audito_onboarding_step");
      window.localStorage.removeItem("audito_onboarding_organization_method");
    }
  }, []);

  const counts = useMemo<OnboardingCounts>(() => ({
    entities: entityCount, auditors: auditorCount, organizationUsers: organizationUserCount, checklists: checklistCount, audits: auditCount,
  }), [entityCount, auditorCount, organizationUserCount, checklistCount, auditCount]);

  return (
    <Ctx.Provider
      value={{
        loading, busy, hydrated, started, setStarted, steps, currentStep, setCurrentStep,
        isActive, organizationSetupMethod, counts, entityOrder: filteredEntityOrder, startOnboarding, stopOnboardingLocal,
        doneCount, progressPct, allDone, canGoBack, canGoNext, canEnterStep, nextRecommendedStep,
        goNext, goBack, openCurrentStep, goToStep, refreshProgress, completeOnboarding, skipOnboarding, resumeOnboarding,
        showCompletionModal, closeCompletionModal, totalSteps: steps.length
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

export { ENTITY_ORDER, ORGANIZATION_USER_ORDER };
