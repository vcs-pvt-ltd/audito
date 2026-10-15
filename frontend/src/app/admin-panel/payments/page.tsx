"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type AdminPayment } from "@/lib/api";
import { snapshotHierarchyLabel } from "@/lib/packageHierarchy";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ShieldCheck, RefreshCw, Loader2, Search, CheckCircle2, XCircle, Clock, Download, X, Calendar, ChevronDown, SlidersHorizontal,
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

function StatusBadge({ status, manualApprovalStatus }: { status: string; manualApprovalStatus?: string }) {
  if (status === "pending" && manualApprovalStatus === "requested") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
        <Clock size={10} /> Approval requested
      </span>
    );
  }
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
      {plan === "Package" ? "Company package" : plan}
    </span>
  );
}

function isTokenReload(payment: AdminPayment) {
  return payment.purpose === "token_reload";
}

function paymentTypeLabel(payment: AdminPayment) {
  if (isTokenReload(payment)) return "Token reload";
  if (payment.plan_name === "Package") return "Company package";
  return "Registration";
}

function PackageBreakdown({ payment }: { payment: AdminPayment }) {
  if (payment.plan_name !== "Package" || !payment.pricing_snapshot) return null;
  const snapshot = typeof payment.pricing_snapshot === "string" ? JSON.parse(payment.pricing_snapshot) : payment.pricing_snapshot;
  return <div className="mt-1 text-[11px] leading-5 text-gray-400">
    {snapshotHierarchyLabel(snapshot)} · {String(snapshot.departments)} departments · {String(snapshot.lines_per_audit)} audit lines<br />
    ${Number(snapshot.company_level_charge).toFixed(2)} levels + ${Number(snapshot.department_charge).toFixed(2)} departments + ${Number(snapshot.line_charge).toFixed(2)} lines<br />
    {String(snapshot.additional_tokens)} extra tokens · {String(snapshot.total_tokens)} total · ${Number(snapshot.token_unit_price).toFixed(2)}/token
  </div>;
}

function tokenAllocationLabel(payment: AdminPayment) {
  const purchased = Number(payment.token_quantity || 0);
  const bonus = Number(payment.bonus_token_quantity || 0);
  if (purchased + bonus <= 0) return "No token allocation";
  return `${purchased.toLocaleString()} tokens${bonus > 0 ? ` + ${bonus.toLocaleString()} bonus` : ""}`;
}

function TokenAllocation({ payment }: { payment: AdminPayment }) {
  const purchased = Number(payment.token_quantity || 0);
  const bonus = Number(payment.bonus_token_quantity || 0);
  if (purchased + bonus <= 0) return <span className="text-xs text-gray-500">No token allocation</span>;
  return (
    <div>
      <p className="text-sm font-semibold text-white">{purchased.toLocaleString()} tokens</p>
      <p className="mt-0.5 text-[11px] text-gray-500">
        {bonus > 0 ? `+${bonus.toLocaleString()} bonus` : "No bonus"}
        {payment.token_unit_price != null ? ` · ${payment.currency} ${Number(payment.token_unit_price).toLocaleString(undefined, { maximumFractionDigits: 4 })}/token` : ""}
      </p>
    </div>
  );
}

function PaymentTypeBadge({ payment }: { payment: AdminPayment }) {
  const isReload = isTokenReload(payment);
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${isReload ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-secondary-500/30 bg-secondary-500/10 text-secondary-300"}`}>{paymentTypeLabel(payment)}</span>;
}

function reportDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function FilterDate({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-[11px] text-gray-400">{label}</span><div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3"><Calendar size={13} className="shrink-0 text-gray-500" /><input type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="h-10 w-full bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]" /></div></label>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] text-gray-400">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white focus:border-secondary-500/50 focus:outline-none">{children}</select></label>;
}

export default function PaymentsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast, confirm } = useUiFeedback();
  const router = useRouter();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "pending" | "approval" | "other">("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"registration" | "token_reload">("registration");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");

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
  }, [activeTab, filter, planFilter, search, filterStartDate, filterEndDate]);

  const filtered = payments.filter((p) => {
    if (activeTab === "registration" && isTokenReload(p)) return false;
    if (activeTab === "token_reload" && !isTokenReload(p)) return false;
    if (filter === "paid" && p.status !== "paid") return false;
    if (filter === "pending" && p.status !== "pending") return false;
    if (filter === "approval" && !(p.status === "pending" && p.manual_approval_status === "requested")) return false;
    if (filter === "other" && (p.status === "paid" || p.status === "pending")) return false;
    if (planFilter === "package" && p.plan_name !== "Package") return false;
    if (planFilter === "legacy" && (p.plan_name === "Package" || isTokenReload(p))) return false;
    const createdDate = new Date(p.created_at).getTime();
    if (filterStartDate && createdDate < new Date(`${filterStartDate}T00:00:00`).getTime()) return false;
    if (filterEndDate && createdDate > new Date(`${filterEndDate}T23:59:59.999`).getTime()) return false;
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

  const openReportModal = () => {
    setReportStartDate(filterStartDate);
    setReportEndDate(filterEndDate);
    setIsReportModalOpen(true);
  };

  const activeFilterCount = [filterStartDate, filterEndDate, planFilter !== "all", filter !== "all"].filter(Boolean).length;
  const registrationApprovalCount = payments.filter((payment) => !isTokenReload(payment) && payment.status === "pending" && payment.manual_approval_status === "requested").length;
  const reloadApprovalCount = payments.filter((payment) => isTokenReload(payment) && payment.status === "pending" && payment.manual_approval_status === "requested").length;
  const resetFilters = () => {
    setSearch("");
    setFilterStartDate("");
    setFilterEndDate("");
    setPlanFilter("all");
    setFilter("all");
  };

  const approvePayment = async (payment: AdminPayment) => {
    if (!accessToken || approvingId) return;
    const accepted = await confirm({
      title: "Approve this payment?",
      message: `Confirm that Audito has received and verified ${payment.currency} ${Number(payment.amount).toLocaleString()} from ${payment.org_name_resolved || payment.org_name || "this organization"}. Approval will ${isTokenReload(payment) ? `reload ${tokenAllocationLabel(payment)}.` : payment.plan_name === "Package" ? `activate the Company package and grant ${tokenAllocationLabel(payment)}.` : `apply the ${payment.plan_name} workspace plan and grant ${tokenAllocationLabel(payment)}.`}`,
      confirmText: "Approve payment",
      cancelText: "Cancel",
      variant: "warning",
    });
    if (!accepted) return;

    setApprovingId(payment.transaction_id);
    const res = await adminApi.approvePayment(accessToken, payment.transaction_id);
    if (res.success) {
      toast(isTokenReload(payment) ? "Payment approved and tokens reloaded." : "Payment approved and initial tokens granted.", "success");
      await loadPayments();
    } else {
      toast(res.message || "Failed to approve payment.", "error");
    }
    setApprovingId(null);
  };

  const downloadReport = () => {
    if (!reportStartDate || !reportEndDate) {
      toast("Select both a start date and an end date for the report.", "error");
      return;
    }
    if (reportStartDate > reportEndDate) {
      toast("The end date must be on or after the start date.", "error");
      return;
    }

    const rangeStart = new Date(`${reportStartDate}T00:00:00`).getTime();
    const rangeEnd = new Date(`${reportEndDate}T23:59:59.999`).getTime();
    const reportPayments = payments.filter((payment) => {
      if (activeTab === "registration" && isTokenReload(payment)) return false;
      if (activeTab === "token_reload" && !isTokenReload(payment)) return false;
      const createdAt = new Date(payment.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt >= rangeStart && createdAt <= rangeEnd;
    });

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const totalByCurrency = reportPayments.reduce<Record<string, number>>((totals, payment) => {
      totals[payment.currency] = (totals[payment.currency] || 0) + Number(payment.amount || 0);
      return totals;
    }, {});
    const total = Object.entries(totalByCurrency).map(([currency, amount]) => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join("  •  ") || "0.00";

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("Audito Payment Report", 36, 42);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${reportStartDate} to ${reportEndDate}`, 36, 59);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 36, 59, { align: "right" });

    autoTable(doc, {
      startY: 76,
      head: [["Invoice", "Organization", "Account Type", "Admin", "Admin Email", "Purchase", "Payment Type", "Token Allocation", "Amount", "Currency", "Date"]],
      body: reportPayments.map((payment) => [
        payment.invoice_number || "-",
        payment.org_name_resolved || payment.org_name || "",
        payment.entity_type || "",
        [payment.admin_first_name, payment.admin_last_name].filter(Boolean).join(" "),
        payment.admin_email || "",
        payment.plan_name,
        paymentTypeLabel(payment),
        tokenAllocationLabel(payment),
        Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        payment.currency,
        reportDate(payment.paid_at || payment.created_at),
      ]),
      margin: { left: 28, right: 28 },
      styles: { fontSize: 6.8, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    const finalY = (doc as any).lastAutoTable?.finalY || 76;
    const pageHeight = doc.internal.pageSize.getHeight();
    const totalY = finalY + 22 > pageHeight - 28 ? 42 : finalY + 22;
    if (totalY === 42) doc.addPage();
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Total: ${total}`, 36, totalY);
    doc.save(`audito-payment-report-${reportStartDate}-to-${reportEndDate}.pdf`);
    setIsReportModalOpen(false);
    toast(`${reportPayments.length} payment ${reportPayments.length === 1 ? "record" : "records"} downloaded as PDF.`, "success");
  };

  if (isLoading || (!admin || admin.role !== "audito_admin")) return <Loading />;

  return (
    <div className="space-y-6 min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={22} className="text-secondary-400" /> Payments
          </h1>
          <p className="text-sm text-gray-400 mt-1">Approve registrations and token reloads, then review the complete payment trail.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openReportModal} disabled={loading} size="md" leftIcon={<Download size={15} />}>Download report</Button>
          <Button onClick={loadPayments} disabled={loading} variant="secondary" size="md" leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} aria-label="Refresh payments" />
        </div>
      </div>

      <div role="tablist" aria-label="Payment types" className="flex w-full gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-fit">
        <button type="button" role="tab" aria-selected={activeTab === "registration"} onClick={() => setActiveTab("registration")} className={`relative flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${activeTab === "registration" ? "bg-secondary-500/15 text-secondary-300" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"}`}>
          Registration
          {registrationApprovalCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-primary-950 bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{registrationApprovalCount > 99 ? "99+" : registrationApprovalCount}</span>}
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "token_reload"} onClick={() => setActiveTab("token_reload")} className={`relative flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${activeTab === "token_reload" ? "bg-sky-500/15 text-sky-300" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"}`}>
          Token reload
          {reloadApprovalCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-primary-950 bg-red-500 px-1 text-[10px] font-bold leading-none text-white">{reloadApprovalCount > 99 ? "99+" : reloadApprovalCount}</span>}
        </button>
      </div>

      <section className="glass overflow-hidden rounded-xl">
        <div className="flex items-center gap-2 p-3 md:hidden">
          <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payments..." className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-secondary-500/50 focus:outline-none" /></div>
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all ${filtersOpen || activeFilterCount > 0 ? "border-secondary-500/30 bg-secondary-500/10 text-secondary-400" : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"}`}><SlidersHorizontal size={13} />{activeFilterCount > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary-400 px-1 text-[9px] font-bold text-primary-950">{activeFilterCount}</span>}<ChevronDown size={12} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} /></button>
          <Button variant="secondary" size="sm" onClick={resetFilters} className="h-10 shrink-0">Reset</Button>
        </div>
        {filtersOpen && <div className="flex flex-col gap-2.5 border-t border-white/[0.06] px-3 pb-3 pt-3 md:hidden">
          <div className="grid grid-cols-2 gap-2.5">
            <FilterDate label="Start date" value={filterStartDate} max={filterEndDate || undefined} onChange={setFilterStartDate} />
            <FilterDate label="End date" value={filterEndDate} min={filterStartDate || undefined} onChange={setFilterEndDate} />
          </div>
          <div>
            <FilterSelect label="Purchase" value={planFilter} onChange={setPlanFilter}><option value="all">All purchases</option><option value="package">Company packages</option><option value="legacy">Legacy plans</option></FilterSelect>
          </div>
          <FilterSelect label="Status" value={filter} onChange={(value) => setFilter(value as "all" | "paid" | "pending" | "approval" | "other")}><option value="all">All statuses</option><option value="approval">Approval requested</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="other">Other</option></FilterSelect>
        </div>}
        <div className="hidden grid-cols-4 gap-2.5 p-3 sm:p-4 md:grid xl:grid-cols-6 sm:gap-4">
          <div className="relative"><label className="mb-1 block text-[11px] text-gray-400">Search</label><Search size={14} className="absolute left-3 top-[31px] text-gray-500" /><input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search payments..." className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-secondary-500/50 focus:outline-none" /></div>
          <FilterDate label="Start date" value={filterStartDate} max={filterEndDate || undefined} onChange={setFilterStartDate} />
          <FilterDate label="End date" value={filterEndDate} min={filterStartDate || undefined} onChange={setFilterEndDate} />
          <FilterSelect label="Purchase" value={planFilter} onChange={setPlanFilter}><option value="all">All purchases</option><option value="package">Company packages</option><option value="legacy">Legacy plans</option></FilterSelect>
          <FilterSelect label="Status" value={filter} onChange={(value) => setFilter(value as "all" | "paid" | "pending" | "approval" | "other")}><option value="all">All statuses</option><option value="approval">Approval requested</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="other">Other</option></FilterSelect>
          <div className="flex items-end"><Button variant="secondary" fullWidth onClick={resetFilters}>Reset</Button></div>
        </div>
      </section>

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="payment-report-title">
          <button type="button" className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" aria-label="Close report dialog" onClick={() => setIsReportModalOpen(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.14] bg-[#0b2118] shadow-2xl shadow-black/50">
            <div className="h-1 bg-gradient-to-r from-secondary-500 to-secondary-300" />
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><h2 id="payment-report-title" className="text-lg font-semibold text-white">Download payment report</h2><p className="mt-1 text-sm leading-relaxed text-gray-400">Choose the transaction date range to include in the PDF.</p></div>
                <button type="button" onClick={() => setIsReportModalOpen(false)} aria-label="Close" className="rounded-lg p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1.5 block text-xs font-medium text-gray-300">Start date</span><input type="date" value={reportStartDate} max={reportEndDate || undefined} onChange={(event) => setReportStartDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-sm text-white [color-scheme:dark] focus:border-secondary-500/50 focus:outline-none" /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-medium text-gray-300">End date</span><input type="date" value={reportEndDate} min={reportStartDate || undefined} onChange={(event) => setReportEndDate(event.target.value)} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/15 px-3 text-sm text-white [color-scheme:dark] focus:border-secondary-500/50 focus:outline-none" /></label>
              </div>
              <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setIsReportModalOpen(false)}>Cancel</Button><Button onClick={downloadReport} disabled={!reportStartDate || !reportEndDate} leftIcon={<Download size={15} />}>Download PDF</Button></div>
            </div>
          </div>
        </div>
      )}

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
          title={activeTab === "registration" ? "No registration payments found" : "No token reload payments found"}
          message={activeTab === "registration" ? "Registration payments will appear here once a workspace completes its first payment." : "Token reload payments will appear here once a workspace purchases a reload package."}
        />
      ) : (
        <>
          <div role="tabpanel" aria-label={activeTab === "registration" ? "Registration payments" : "Token reload payments"}>
          <div className="hidden md:block">
          <Table>
            <THead>
                            <Th>Invoice</Th>

              <Th>Organization</Th>
              <Th>Account Type</Th>
              <Th>Admin</Th>
              
              <Th>Purchase</Th>
              <Th>Token allocation</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th>Date</Th>
              <Th>Action</Th>
            </THead>
            <TBody>
              {paginated.map((p) => (
                <Tr key={p.transaction_id}>
                                    <Td><span className="text-xs text-gray-500">{p.invoice_number || "-"}</span></Td>

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
                  <Td><TokenAllocation payment={p} /><PackageBreakdown payment={p} /></Td>
                  <Td>
                    <span className="text-sm font-semibold text-white">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </span>
                  </Td>
                  <Td><StatusBadge status={p.status} manualApprovalStatus={p.manual_approval_status} /></Td>
                  <Td><span className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString()}</span></Td>
                  <Td>
                    {p.status === "pending" && p.manual_approval_status === "requested" ? (
                      <Button size="sm" disabled={Boolean(approvingId)} loading={approvingId === p.transaction_id} onClick={() => void approvePayment(p)}>Approve</Button>
                    ) : <span className="text-xs text-gray-600">-</span>}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {paginated.map((p) => (
              <article key={p.transaction_id} className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-lg shadow-black/10">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{p.invoice_number || "Payment transaction"}</p><h2 className="mt-1 truncate text-sm font-semibold text-white">{p.org_name_resolved || p.org_name || "Organization"}</h2><p className="mt-1 truncate text-xs text-gray-400">{p.admin_first_name ? `${p.admin_first_name} ${p.admin_last_name || ""}` : p.admin_email || "No admin"}</p></div>
                  <div className="flex shrink-0 flex-col items-end gap-2"><StatusBadge status={p.status} manualApprovalStatus={p.manual_approval_status} /><span className="text-sm font-semibold text-white">{p.currency} {Number(p.amount).toLocaleString()}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-px border-y border-white/[0.08] bg-white/[0.08] text-xs">
                  <div className="min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Purchase</p><div className="mt-1"><PlanBadge plan={p.plan_name} /></div></div>
                  <div className="min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Payment type</p><div className="mt-1"><PaymentTypeBadge payment={p} /></div></div>
                  <div className="col-span-2 min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Account · date</p><p className="mt-1 truncate text-gray-200">{p.entity_type || "—"} · {new Date(p.created_at).toLocaleDateString()}</p></div>
                </div>
                <div className="border-b border-white/[0.08] bg-[#08251a]/60 px-3 py-2.5 text-xs">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Token allocation</p><div className="mt-1"><TokenAllocation payment={p} /></div>
                  <PackageBreakdown payment={p} />
                </div>
                {p.status === "pending" && p.manual_approval_status === "requested" && (
                  <div className="p-3"><Button fullWidth disabled={Boolean(approvingId)} loading={approvingId === p.transaction_id} onClick={() => void approvePayment(p)}>Approve payment</Button></div>
                )}
              </article>
            ))}
          </div>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
          </div>
        </>
      )}
    </div>
  );
}
