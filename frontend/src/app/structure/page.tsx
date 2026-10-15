"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";


const FIRST_TAB: Record<string, string> = {
  Customer: "buying-office",
  Company: "cluster",
  "Audit Firm": "branch",
};

const FIRST_TAB_BY_ENTITY: Record<string, string> = {
  Customer: "buying-office",
  "Buying Office": "supplier",
  Company: "cluster",
  Cluster: "factory",
  Factory: "unit",
  Unit: "department",
  Department: "section",
  "Audit Firm": "branch",
  "Audit Firm Company": "branch",
  Branch: "audit-firm-department",
};

export default function SetupStructureIndex() {
  const { admin, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading && admin) {
      const normalized = admin.account_type === "Audit Firm Company" ? "Audit Firm" : admin.account_type;
      const accountType = normalized as keyof typeof FIRST_TAB | null;
      const first = (admin.entity_type ? FIRST_TAB_BY_ENTITY[admin.entity_type] : undefined)
        || (accountType ? FIRST_TAB[accountType] : undefined);
      const isOnboarding = searchParams.get("onboarding") === "1";
      const isManual = searchParams.get("manual") === "1";
      if (first) {
        const params = new URLSearchParams({ type: first });
        if (isOnboarding) params.set("onboarding", "1");
        if (isManual) params.set("manual", "1");
        router.replace(`/structure/list?${params.toString()}`);
      } else if (isOnboarding && isManual) {
        router.replace("/organization?manual=1&onboarding=1");
      } else {
        router.replace("/overview");
      }
    }
    if (!isLoading && !admin) {
      router.push("/login");
    }
  }, [isLoading, admin, router, searchParams]);

  return (
    <div className="h-screen bg-transparent flex">

      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    </div>
  );
}
