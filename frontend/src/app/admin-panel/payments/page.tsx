"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type AdminPayment } from "@/lib/api";
import {
  ShieldCheck, RefreshCw, Loader2, Search, CheckCircle2, XCircle, Clock,
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

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
        <CheckCircle2 size={10} /> Paid
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
        <Clock size={10} /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
      <XCircle size={10} /> {status}
    </span>
  );
}

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

export default function PaymentsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "other">("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  const loadPayments = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.listPayments(accessToken);
      if (res.success && res.data) {
        setPayments(res.data as AdminPayment[]);
      } else {
        setError((res as any).message || "Failed to load payments.");
        toast((res as any).message || "Failed to load payments.", "error");
      }
    } catch {
      setError("Failed to load payments.");
      toast("Failed to load payments.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadPayments();
  }, [accessToken]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const filtered = payments.filter((p) => {
    if (filter === "paid") return p.status === "paid";
    if (filter === "pending") return p.status === "pending";
    if (filter === "other") return p.status !== "paid" && p.status !== "pending";
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (p.org_name && p.org_name.toLowerCase().includes(q)) ||
        (p.admin_email && p.admin_email.toLowerCase().includes(q)) ||
        (p.admin_first_name && `${p.admin_first_name} ${p.admin_last_name}`.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const paidCount = payments.filter((p) => p.status === "paid").length;
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  if (isLoading || (!admin || admin.role !== "audito_admin")) return <Loading />;

  return (
    <div className="space-y-6 min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={22} className="text-secondary-400" /> Payments
          </h1>
          <p className="text-sm text-gray-400 mt-1">All payment transactions across the platform.</p>
        </div>
        <Button
          onClick={loadPayments}
          disabled={loading}
          variant="secondary"
          size="md"
          leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by organization, admin, or email..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: "all" as const, label: "All", count: payments.length },
            { key: "paid" as const, label: "Paid", count: paidCount },
            { key: "pending" as const, label: "Pending", count: pendingCount },
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
          <Button onClick={loadPayments} variant="secondary">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No payments found"
          message="Payment transactions will appear here once users start paying."
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
              <Th>Amount</Th>
              <Th>Invoice</Th>
              <Th>Status</Th>
              <Th>Date</Th>
            </THead>
            <TBody>
              {paginated.map((p) => (
                <Tr key={p.transaction_id}>
                  <Td>
                    <div>
                      <p className="text-sm text-gray-300">{p.org_name_resolved || p.org_name || "-"}</p>
                    </div>
                  </Td>
                                    <Td><span className="text-xs text-gray-400">{p.entity_type || "-"}</span></Td>

                  <Td>
                    <div>
                      {p.admin_first_name ? (
                        <p className="text-sm text-gray-300">{p.admin_first_name} {p.admin_last_name}</p>
                      ) : (
                        <p className="text-sm text-gray-500">-</p>
                      )}
                      {p.admin_email && <p className="text-xs text-gray-500">{p.admin_email}</p>}
                    </div>
                  </Td>
                  <Td><PlanBadge plan={p.plan_name} /></Td>
                  <Td><span className="text-xs text-gray-400">{p.billing_cycle}</span></Td>
                  <Td>
                    <span className="text-sm font-semibold text-white">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </span>
                  </Td>
                  <Td><span className="text-xs text-gray-500">{p.invoice_number || "-"}</span></Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td><span className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span></Td>
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
