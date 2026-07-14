"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type RegisteredOrganization } from "@/lib/api";
import {
  Building2, RefreshCw, Loader2, Search, MailCheck, Clock, CheckCircle2, XCircle, Globe,
} from "lucide-react";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import TablePagination from "@/components/shared/TablePagination";
import {
  Button,
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
} from "@/components/ui";

function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, string> = {
    Basic: "bg-gray-500/10 border-gray-500/30 text-gray-400",
    Pro: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    Elite: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    Custom: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${config[plan] || config.Basic}`}>
      {plan}
    </span>
  );
}

export default function OrganizationsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [orgs, setOrgs] = useState<RegisteredOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "paid">("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  const loadOrgs = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.listOrganizations(accessToken);
      if (res.success && res.data) {
        setOrgs(res.data as RegisteredOrganization[]);
      } else {
        setError((res as any).message || "Failed to load organizations.");
        toast((res as any).message || "Failed to load organizations.", "error");
      }
    } catch {
      setError("Failed to load organizations.");
      toast("Failed to load organizations.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadOrgs();
  }, [accessToken]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const filtered = orgs.filter((o) => {
    if (filter === "active") return o.is_active;
    if (filter === "inactive") return !o.is_active;
    if (filter === "paid") return o.plan_name !== "Basic";
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.root_entity_code.toLowerCase().includes(q) ||
        (o.email && o.email.toLowerCase().includes(q)) ||
        (o.first_name && `${o.first_name} ${o.last_name}`.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const activeCount = orgs.filter((o) => o.is_active).length;
  const paidCount = orgs.filter((o) => o.plan_name !== "Basic").length;

  if (isLoading || (!admin || admin.role !== "audito_admin")) return <Loading />;

  return (
    <div className="space-y-6 min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 size={22} className="text-secondary-400" /> Registered Organizations
          </h1>
          <p className="text-sm text-gray-400 mt-1">All organizations that have registered on the platform.</p>
        </div>
        <Button
          onClick={loadOrgs}
          disabled={loading}
          variant="secondary"
          size="md"
          leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
        />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, email, or name..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: "all" as const, label: "All", count: orgs.length },
            { key: "active" as const, label: "Active", count: activeCount },
            { key: "paid" as const, label: "Paid Plans", count: paidCount },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f.key
                  ? "bg-secondary-500 text-primary-950"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-secondary-400" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={loadOrgs} variant="secondary">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No organizations found"
          message="Organizations will appear here after registration."
        />
      ) : (
        <>
          <Table>
            <THead>
              <Th>Organization</Th>
                            <Th>Account Type</Th>

              <Th>Admin</Th>
              <Th>Plan</Th>
              <Th>Billing</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
            </THead>
            <TBody>
              {paginated.map((org) => (
                <Tr key={org.root_entity_code}>
                  <Td>
                    <div>
                      {org.org_name ? (
                        <p className="text-sm text-gray-300">{org.org_name}</p>
                      ) : org.entity_type ? (
                        <p className="text-sm text-gray-300">{org.entity_type}</p>
                      ) : (
                        <p className="text-sm text-gray-500">-</p>
                      )}
                    </div>
                  </Td>
                                    <Td><span className="text-xs text-gray-400">{org.account_type || "-"}</span></Td>

                  <Td>
                    <div>
                      {org.first_name ? (
                        <p className="text-sm text-gray-300">{org.first_name} {org.last_name}</p>
                      ) : (
                        <p className="text-sm text-gray-500">-</p>
                      )}
                      {org.email && <p className="text-xs text-gray-500">{org.email}</p>}
                    </div>
                  </Td>
                  <Td><PlanBadge plan={org.plan_name} /></Td>
                  <Td>
                    <span className="text-xs text-gray-400">{org.billing_cycle}</span>
                  </Td>
                  <Td>
                    {org.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                        <XCircle size={10} /> Inactive
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-gray-500">{new Date(org.created_at).toLocaleDateString()}</span>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </>
      )}
    </div>
  );
}
