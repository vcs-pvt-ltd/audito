"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { dashboardApi, orgTreeApi, DashboardFilters } from "@/lib/api";

import AdminDashboard from "./AdminDashboard";
import AuditorDashboard from "./AuditorDashboard";
import EntityHeadDashboard from "./EntityHeadDashboard";

interface DashboardOverview {
  scope: {
    role: string;
    account_type: string | null;
    entity_type: string | null;
    entity_code: string | null;
    label: string;
  };
  summaries: any;
  charts: any;
  notices: any[];
  lists: any;
}

function defaultFilters(): DashboardFilters {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 5);
  from.setDate(1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    status: "all",
    audit_type: "all",
    entity_code: "all",
    audit_code: "all",
  };
}

export default function DashboardPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [orgTree, setOrgTree] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  useEffect(() => {
    // org-tree is only available to admin role — skip for auditor / entity_head
    if (!accessToken || !admin || admin.role !== "admin") return;
    orgTreeApi.getTree(accessToken).then((res) => {
      if (res.success && res.data) setOrgTree(res.data);
    });
  }, [accessToken, admin]);

  useEffect(() => {
    if (!accessToken || !admin) return;
    let alive = true;
    setLoading(true);
    setError(null);
    dashboardApi.overview(accessToken, filters).then((res) => {
      if (!alive) return;
      if (res.success && res.data) {
        setOverview(res.data as DashboardOverview);
      } else {
        setError(res.message || "Failed to load dashboard.");
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [accessToken, admin, filters]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent pt-14 lg:pt-0">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary-400 border-t-transparent" />
      </div>
    );
  }
  if (!admin) return null;

  const renderDashboard = () => {
    if (!overview) return null;
    switch (admin.role) {
      case "admin":
        return (
          <AdminDashboard
            overview={overview as any}
            admin={admin}
            orgTree={orgTree}
            filters={filters}
            onFiltersChange={setFilters}
          />
        );
      case "auditor":
        return <AuditorDashboard overview={overview as any} admin={admin} />;
      case "entity_head":
        return (
          <EntityHeadDashboard
            overview={overview as any}
            admin={admin}
            orgTree={orgTree}
            filters={filters}
            onFiltersChange={setFilters}
          />
        );
      default:
        return <div className="text-white p-8">Role view not implemented.</div>;
    }
  };

  return (
    <div className="h-full bg-transparent">
      <main className="xl:h-full xl:overflow-hidden p-5 pt-20 lg:p-6 lg:pt-6 overflow-y-auto xl:overflow-y-visible pb-28 xl:pb-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && !overview ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary-400 border-t-transparent" />
          </div>
        ) : overview ? (
          <div className="relative h-full">
            {loading && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-2xl pointer-events-none">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              </div>
            )}
            {renderDashboard()}
          </div>
        ) : null}
      </main>
    </div>
  );
}