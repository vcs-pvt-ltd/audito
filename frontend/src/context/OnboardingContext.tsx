"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { authApi, auditApi, checklistApi, orgTreeApi, usersApi } from "@/lib/api";

type StepState = "done" | "pending";

interface StepItem {
  key: string;
  title: string;
  description: string;
  instructions: string[];
  href: string;
  state: StepState;
  optional?: boolean;
}

interface OnboardingContextType {
  loading: boolean;
  busy: boolean;
  isActive: boolean;
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
  refreshProgress: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  showCompletionModal: boolean;
  closeCompletionModal: () => void;
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

const HEAD_ORDER: Record<string, Array<{ slug: string; label: string; userType: string; entitySlug: string }>> = {
  Company: [
    { slug: "cluster-heads", label: "Cluster Heads", userType: "Cluster Head", entitySlug: "cluster" },
    { slug: "factory-heads", label: "Factory Heads", userType: "Factory Head", entitySlug: "factory" },
    { slug: "unit-heads", label: "Unit Heads", userType: "Unit Head", entitySlug: "unit" },
    { slug: "department-heads", label: "Department Heads", userType: "Department Head", entitySlug: "department" },
    { slug: "section-heads", label: "Section Heads", userType: "Section Head", entitySlug: "section" },
  ],
  Customer: [
    { slug: "buying-office-heads", label: "Buying Office Heads", userType: "Buying Office Head", entitySlug: "buying-office" },
    { slug: "supplier-heads", label: "Supplier Heads", userType: "Supplier Head", entitySlug: "supplier" },
  ],
  "Audit Firm": [
    { slug: "branch-heads", label: "Branch Heads", userType: "Branch Head", entitySlug: "branch" },
    { slug: "audit-firm-department-heads", label: "Department Heads", userType: "Audit Firm Department Head", entitySlug: "audit-firm-department" },
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

  const [structureCount, setStructureCount] = useState(0);
  const [orgDone, setOrgDone] = useState(false);
  const [entityCount, setEntityCount] = useState(0);
  const [headCount, setHeadCount] = useState(0);
  const [auditorCount, setAuditorCount] = useState(0);
  const [checklistCount, setChecklistCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);

  const filteredEntityOrder = useMemo(() => {
    const accountType = admin?.account_type || "";
    const orgLevel = admin?.org_level ?? 0;
    const entityType = admin?.entity_type || "";
    return (ENTITY_ORDER[accountType] || []).filter(it =>
      orgLevel > it.level && !it.excludeEntityTypes?.includes(entityType)
    );
  }, [admin?.account_type, admin?.org_level, admin?.entity_type]);

  const filteredHeadOrder = useMemo(() => {
    const accountType = admin?.account_type || "";
    const orgLevel = admin?.org_level ?? 0;
    const entityType = admin?.entity_type || "";
    const base = HEAD_ORDER[accountType] || [];
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
      const headLevels = filteredHeadOrder;

      const [treeRes, auditorsRes, checklistRes, auditRes, ...restRes] = await Promise.all([
        orgTreeApi.getTree(accessToken),
        usersApi.list(accessToken, "Auditor"),
        checklistApi.list(accessToken),
        auditApi.list(accessToken),
        ...order.map((t) => orgTreeApi.listEntities(accessToken, t.label)),
        ...headLevels.map((h) => usersApi.list(accessToken, h.userType)),
      ]);

      const entityRes = restRes.slice(0, order.length);
      const headsRes = restRes.slice(order.length);

      setStructureCount(order.length);

      if (treeRes.success && treeRes.data) {
        const tree = (treeRes.data as any).tree;
        setOrgDone(!!tree && Array.isArray(tree.children) && tree.children.length > 0);
      } else setOrgDone(false);

      const totalEntities = entityRes.reduce((sum, r) => sum + ((r.success && r.data) ? (((r.data as any).items || []).length) : 0), 0);
      setEntityCount(totalEntities);

      const totalHeads = headsRes.reduce((sum, r) => sum + ((r.success && r.data) ? (((r.data as any).users || []).length) : 0), 0);
      setHeadCount(totalHeads);

      setAuditorCount(auditorsRes.success && auditorsRes.data ? (((auditorsRes.data as any).users || []).length) : 0);
      setChecklistCount(checklistRes.success && checklistRes.data ? (((checklistRes.data as any).checklists || []).length) : 0);
      setAuditCount(auditRes.success && auditRes.data ? (((auditRes.data as any).audits || []).length) : 0);

    } finally {
      clearTimeout(busyTimer);
      setBusy(false);
      setLoading(false);
    }
  }, [accessToken, admin, filteredEntityOrder, filteredHeadOrder]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = window.localStorage.getItem("audito_onboarding_active") === "1";
    const step = Number(window.localStorage.getItem("audito_onboarding_step") || "0");
    setIsActive(active);
    setStarted(active);
    if (!Number.isNaN(step)) setCurrentStep(step);
  }, []);

  const pathname = usePathname();
  const isAdmin = admin?.role === "admin";

  const steps = useMemo<StepItem[]>(() => {
    if (!isAdmin) return [];

    const order = filteredEntityOrder;
    const headLevels = filteredHeadOrder;

    const baseSteps: StepItem[] = [];

    // Mission 1: Entities (if any below us)
    if (order.length > 0) {
      baseSteps.push({
        key: "entities",
        title: "Create Entities",
        description: `Add your organization units (${order.map(o => o.label).slice(0, 2).join(", ")}...).`,
        instructions: [
          "Navigate through different entity levels",
          "Create at least one entity to proceed",
          "One entity is enough to complete this mission"
        ],
        href: `/structure/list?type=${order[0].slug}`,
        state: entityCount > 0 ? "done" : "pending",
      });
    }

    // Mission 2: Org Mapping (only if we can have children)
    if (order.length > 0) {
      baseSteps.push({
        key: "org-mapping",
        title: "Organization Mapping",
        description: "Link your entities to define the reporting hierarchy.",
        instructions: ["Open organization tree", "Link parent-child entities", "Establish the data flow"],
        href: "/organization",
        state: orgDone ? "done" : "pending",
      });
    }

    // Mission 3: Auditors (Everyone can have auditors)
    baseSteps.push({
      key: "auditors",
      title: "Create Auditors",
      description: "Add the personnel who will perform the actual audits.",
      instructions: ["Add at least one auditor", "Assign to the relevant firm/branch", "Ensure they receive their invite"],
      href: "/users/list?type=auditors",
      state: auditorCount > 0 ? "done" : "pending",
    });

    // Mission 4: Entity Heads (if any below us)
    if (admin?.account_type !== "Audit Firm") {
      if (headLevels.length > 0) {
        baseSteps.push({
          key: "entity-heads",
          title: "Assign Entity Heads",
          description: "Invite users to manage your specific organizational units.",
          instructions: [
            "Add users for different head roles",
            "Assign each user to their respective entity",
            "One head assignment is enough to complete this mission"
          ],
          href: `/users/list?type=${headLevels[0].slug}`,
          state: headCount > 0 ? "done" : "pending",
          optional: true,
        });
      }
    }

    // Mission 5: Checklists (Optional or skipped for Audit Firms)
    if (admin?.account_type !== "Audit Firm") {
      baseSteps.push({
        key: "checklists",
        title: "Create Checklist",
        description: "Design your first audit questionnaire.",
        instructions: [
          "Enter basic checklist details",
          "Configure scoring and repeat settings",
          "Add questions and assign them to entities"
        ],
        href: "/checklists",
        state: checklistCount > 0 ? "done" : "pending",
      });
    }
    // Mission 6: Audits
    if (admin?.account_type !== "Audit Firm") {
      baseSteps.push({
        key: "audits",
        title: "Assign First Audit",
        description: "Finalize your setup by launching your first audit mission.",
        instructions: ["Select a checklist template", "Choose target entities and auditors", "Set the audit timeline"],
        href: "/audits",
        state: auditCount > 0 ? "done" : "pending",
      });
    }

    return baseSteps;
  }, [isAdmin, filteredEntityOrder, filteredHeadOrder, entityCount, orgDone, headCount, auditorCount, checklistCount, auditCount]);

  useEffect(() => {
    if (!isActive) return;
    const stepIdx = steps.findIndex(s => {
      const url = new URL(s.href, "http://x");
      const sType = url.searchParams.get("type");
      const currentType = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;

      if (s.key === "entities") return pathname.startsWith("/structure/list");
      if (s.key === "entity-heads") {
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
  }, [pathname, steps, currentStep, isActive]);

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
      const currentSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;
      const currentIndex = order.findIndex(o => o.slug === currentSlug);

      if (currentIndex !== -1 && currentIndex < order.length - 1) {
        const nextSlug = order[currentIndex + 1].slug;
        router.push(`/structure/list?type=${nextSlug}&onboarding=1`);
        return;
      }
    }

    if (step.key === "entity-heads") {
      const order = filteredHeadOrder;
      const currentSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;
      const currentIndex = order.findIndex(o => o.slug === currentSlug);

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
  }, [currentStep, steps, router, admin?.account_type, pathname]);

  const goBack = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;

    if (step.key === "entities") {
      const order = filteredEntityOrder;
      const currentSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;
      const currentIndex = order.findIndex(o => o.slug === currentSlug);

      if (currentIndex > 0) {
        const prevSlug = order[currentIndex - 1].slug;
        router.push(`/structure/list?type=${prevSlug}&onboarding=1`);
        return;
      }
    }

    if (step.key === "entity-heads") {
      const order = filteredHeadOrder;
      const currentSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;
      const currentIndex = order.findIndex(o => o.slug === currentSlug);

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

    if (prevStep.key === "entity-heads") {
      const order = filteredHeadOrder;
      if (order.length > 0) {
        const lastSlug = order[order.length - 1].slug;
        router.push(`/users/list?type=${lastSlug}&onboarding=1`);
        return;
      }
    }

    router.push(`${prevStep.href}${prevStep.href.includes("?") ? "&" : "?"}onboarding=1`);
  }, [currentStep, steps, router, admin?.account_type]);

  const canGoBack = useMemo(() => {
    if (currentStep > 0) return true;

    // Within first step (Entities)
    if (steps[0]?.key === "entities") {
      const order = filteredEntityOrder;
      const currentSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;
      const currentIndex = order.findIndex(o => o.slug === currentSlug);
      return currentIndex > 0;
    }

    return false;
  }, [currentStep, admin?.account_type, steps]);

  const canGoNext = useMemo(() => {
    const step = steps[currentStep];
    if (!step) return false;

    // Within Entities, we can go next if there are more sub-levels
    if (step.key === "entities") {
      const order = filteredEntityOrder;
      const currentSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;
      const currentIndex = order.findIndex(o => o.slug === currentSlug);
      if (currentIndex !== -1 && currentIndex < order.length - 1) return true;
    }

    // Within Entity Heads
    if (step.key === "entity-heads") {
      const order = filteredHeadOrder;
      const currentSlug = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("type") : null;
      const currentIndex = order.findIndex(o => o.slug === currentSlug);
      if (currentIndex !== -1 && currentIndex < order.length - 1) return true;
    }

    // Standard mission navigation
    return currentStep < steps.length - 1 && canEnterStep(currentStep + 1);
  }, [currentStep, steps, canEnterStep, pathname, admin?.account_type]);

  const openCurrentStep = useCallback(() => {
    const step = steps[currentStep];
    if (!step) return;
    router.push(`${step.href}${step.href.includes("?") ? "&" : "?"}onboarding=1`);
  }, [steps, currentStep, router]);

  const skipOnboarding = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true);
    const res = await authApi.updateOnboarding(accessToken, "skip");
    setBusy(false);
    if (res.success) {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("audito_onboarding_active");
        window.localStorage.removeItem("audito_onboarding_step");
      }
      setIsActive(false);
      await refreshMe();
      router.replace("/dashboard");
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

  const closeCompletionModal = useCallback(() => {
    setShowCompletionModal(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("audito_onboarding_active");
      window.localStorage.removeItem("audito_onboarding_step");
    }
    setIsActive(false);
    router.replace("/dashboard");
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
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("audito_onboarding_active");
      window.localStorage.removeItem("audito_onboarding_step");
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        loading, busy, started, setStarted, steps, currentStep, setCurrentStep,
        isActive, startOnboarding, stopOnboardingLocal,
        doneCount, progressPct, allDone, canGoBack, canGoNext, canEnterStep, nextRecommendedStep,
        goNext, goBack, openCurrentStep, refreshProgress, completeOnboarding, skipOnboarding,
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

export { ENTITY_ORDER, HEAD_ORDER };
