"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type CustomSolutionRequest } from "@/lib/api";
import {
  Puzzle, RefreshCw, Eye, DollarSign, Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import Loading from "@/components/shared/Loading";
import EmptyState from "@/components/shared/EmptyState";
import TablePagination from "@/components/shared/TablePagination";
import {
  Button,
  IconButton,
  Modal,
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
} from "@/components/ui";

function StatusBadge({ status }: { status: CustomSolutionRequest["status"] }) {
  const config: Record<string, { icon: any; label: string; cls: string }> = {
    pending: { icon: Clock, label: "Pending", cls: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" },
    priced: { icon: DollarSign, label: "Priced", cls: "bg-blue-500/10 border-blue-500/30 text-blue-400" },
    accepted: { icon: CheckCircle2, label: "Accepted", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
    rejected: { icon: XCircle, label: "Rejected", cls: "bg-red-500/10 border-red-500/30 text-red-400" },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${c.cls}`}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

export default function CustomSolutionsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { toast } = useUiFeedback();
  const router = useRouter();
  const [requests, setRequests] = useState<CustomSolutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "priced" | "accepted" | "rejected">("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedReq, setSelectedReq] = useState<CustomSolutionRequest | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceForm, setPriceForm] = useState({ assigned_price: "", assigned_billing_cycle: "Monthly" as "Monthly" | "Yearly", admin_notes: "" });
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState("");

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  const loadRequests = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const params = filter !== "all" ? { status: filter } : undefined;
      const res = await adminApi.listCustomSolutions(accessToken, params);
      if (res.success && res.data) {
        setRequests(res.data as CustomSolutionRequest[]);
      } else {
        setError((res as any).message || "Failed to load custom solutions.");
        toast((res as any).message || "Failed to load custom solutions.", "error");
      }
    } catch {
      setError("Failed to load custom solutions.");
      toast("Failed to load custom solutions.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadRequests();
  }, [accessToken, filter]);

  const handleAssignPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedReq) return;
    const price = parseFloat(priceForm.assigned_price);
    if (!price || price <= 0) {
      setPriceError("Please enter a valid price.");
      return;
    }
    setPricing(true);
    setPriceError("");
    try {
      const res = await adminApi.assignCustomSolutionPrice(accessToken, selectedReq.request_id, {
        assigned_price: price,
        assigned_billing_cycle: priceForm.assigned_billing_cycle,
        admin_notes: priceForm.admin_notes || undefined,
      });
      if (res.success) {
        toast("Price assigned and notification sent.", "success");
        setShowPriceModal(false);
        setSelectedReq(null);
        setPriceForm({ assigned_price: "", assigned_billing_cycle: "Monthly", admin_notes: "" });
        loadRequests();
      } else {
        setPriceError((res as any).message || "Failed to assign price.");
        toast((res as any).message || "Failed to assign price.", "error");
      }
    } catch {
      setPriceError("Failed to assign price.");
      toast("Failed to assign price.", "error");
    } finally {
      setPricing(false);
    }
  };

  const openPriceModal = (req: CustomSolutionRequest) => {
    setSelectedReq(req);
    setPriceForm({ assigned_price: "", assigned_billing_cycle: "Monthly", admin_notes: "" });
    setPriceError("");
    setShowPriceModal(true);
  };

  const filtered = requests;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const filterTabs = [
    { key: "all" as const, label: "All" },
    { key: "pending" as const, label: "Pending" },
    { key: "priced" as const, label: "Priced" },
    { key: "accepted" as const, label: "Accepted" },
    { key: "rejected" as const, label: "Rejected" },
  ];

  const filterCounts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    priced: requests.filter((r) => r.status === "priced").length,
    accepted: requests.filter((r) => r.status === "accepted").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  if (isLoading || (!admin || admin.role !== "audito_admin")) return <Loading />;

  return (
    <div className="space-y-6 p-5 pt-20 lg:p-8 lg:pt-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Custom Solutions</h1>
          <p className="text-sm text-gray-400 mt-1">Review and price custom solution requests from organizations.</p>
        </div>
        <IconButton onClick={loadRequests} tone="secondary" aria-label="Refresh">
          <RefreshCw size={16} />
        </IconButton>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.key
                ? "bg-secondary-500/20 text-secondary-400 border border-secondary-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">{filterCounts[tab.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto text-red-400 mb-3" size={40} />
          <p className="text-red-400">{error}</p>
          <Button onClick={loadRequests} variant="secondary" className="mt-4">Retry</Button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="No custom solution requests"
          message={filter === "all" ? "Organizations will appear here when they request a custom plan." : `No ${filter} requests found.`}
        />
      ) : (
        <>
          <div className="hidden md:block">
          <Table>
            <THead>
              <Th>Organization</Th>
              <Th>Account Type</Th>
              <Th>Requested</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </THead>
            <TBody>
              {paginated.map((req) => (
                <Tr key={req.request_id}>
                  <Td>
                    <div>
                      <p className="font-medium text-white text-sm">{req.org_name}</p>
                      <p className="text-xs text-gray-500">{req.org_email}</p>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs text-gray-300">{req.entity_type}</span>
                  </Td>
                  
                  <Td>
                    <span className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</span>
                  </Td>
                  <Td><StatusBadge status={req.status} /></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        size="sm"
                        tone="secondary"
                        onClick={() => setSelectedReq(req)}
                        aria-label="View details"
                      >
                        <Eye size={14} />
                      </IconButton>
                      {req.status === "pending" && (
                        <IconButton
                          size="sm"
                          tone="info"
                          onClick={() => openPriceModal(req)}
                          aria-label="Assign price"
                        >
                          <DollarSign size={14} />
                        </IconButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          </div>
          <div className="space-y-3 md:hidden">
            {paginated.map((req) => (
              <article key={req.request_id} className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-lg shadow-black/10">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-400">Custom solution</p><h2 className="mt-1 truncate text-sm font-semibold text-white">{req.org_name}</h2><p className="mt-1 truncate text-xs text-gray-400">{req.org_email}</p></div>
                  <StatusBadge status={req.status} />
                </div>
                <div className="grid grid-cols-2 gap-px border-y border-white/[0.08] bg-white/[0.08] text-xs"><div className="min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Account type</p><p className="mt-1 truncate text-gray-200">{req.entity_type}</p></div><div className="min-w-0 bg-[#08251a]/60 px-3 py-2.5"><p className="text-[10px] uppercase tracking-wide text-gray-500">Requested</p><p className="mt-1 truncate text-gray-200">{new Date(req.created_at).toLocaleDateString()}</p></div></div>
                <div className="flex justify-end gap-2 p-3"><IconButton size="sm" tone="secondary" onClick={() => setSelectedReq(req)} aria-label="View details"><Eye size={14} /></IconButton>{req.status === "pending" && <IconButton size="sm" tone="info" onClick={() => openPriceModal(req)} aria-label="Assign price"><DollarSign size={14} /></IconButton>}</div>
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
        </>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!selectedReq && !showPriceModal}
        onClose={() => setSelectedReq(null)}
        title="Custom Solution Request"
        icon={<Puzzle />}
        size="lg"
      >
        {selectedReq && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Organization</p>
                <p className="text-sm font-medium text-white">{selectedReq.org_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</p>
                <p className="text-sm text-gray-300">{selectedReq.org_email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Entity Type</p>
                <p className="text-sm text-gray-300">{selectedReq.entity_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
                <StatusBadge status={selectedReq.status} />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Requested Features</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Company Levels", value: selectedReq.max_company_levels },
                  { label: "Departments", value: selectedReq.max_departments },
                  { label: "Audits", value: selectedReq.max_audits },
                  { label: "Checklists", value: selectedReq.max_checklists },
                  { label: "Auditors", value: selectedReq.max_auditors },
                ].map((f) => (
                  <div key={f.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-white">{f.value}</p>
                    <p className="text-[10px] text-gray-500 uppercase">{f.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3">
                <div className={`flex items-center gap-2 text-xs ${selectedReq.allow_auditor_eval ? "text-secondary-400" : "text-gray-500"}`}>
                  <div className={`w-3 h-3 rounded-full ${selectedReq.allow_auditor_eval ? "bg-secondary-500" : "bg-white/20"}`} />
                  Auditor Evaluation
                </div>
                <div className={`flex items-center gap-2 text-xs ${selectedReq.allow_company_to_company ? "text-secondary-400" : "text-gray-500"}`}>
                  <div className={`w-3 h-3 rounded-full ${selectedReq.allow_company_to_company ? "bg-secondary-500" : "bg-white/20"}`} />
                  Company-to-Company
                </div>
              </div>
            </div>

            {selectedReq.assigned_price && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Assigned Price</p>
                <p className="text-lg font-bold text-white">${selectedReq.assigned_price} <span className="text-sm font-normal text-gray-400">/ {selectedReq.assigned_billing_cycle?.toLowerCase()}</span></p>
                {selectedReq.admin_notes && (
                  <p className="text-xs text-gray-400 mt-2 italic">{selectedReq.admin_notes}</p>
                )}
              </div>
            )}

            {selectedReq.status === "pending" && (
              <div className="border-t border-white/10 pt-4">
                <Button onClick={() => openPriceModal(selectedReq)} leftIcon={<DollarSign size={16} />} className="w-full">
                  Assign Price
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Price Assignment Modal */}
      <Modal
        open={showPriceModal}
        onClose={() => { setShowPriceModal(false); setSelectedReq(null); }}
        title="Assign Price"
        icon={<DollarSign />}
        size="md"
      >
        <form onSubmit={handleAssignPrice} className="space-y-4">
          {priceError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{priceError}</div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Price (USD) <span className="text-red-400">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={priceForm.assigned_price}
                onChange={(e) => setPriceForm((prev) => ({ ...prev, assigned_price: e.target.value }))}
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Billing Cycle <span className="text-red-400">*</span></label>
            <select
              value={priceForm.assigned_billing_cycle}
              onChange={(e) => setPriceForm((prev) => ({ ...prev, assigned_billing_cycle: e.target.value as "Monthly" | "Yearly" }))}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-secondary-500/50 transition-colors"
            >
              <option value="Monthly" className="bg-[#0c2218]">Monthly</option>
              <option value="Yearly" className="bg-[#0c2218]">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Admin Notes (optional)</label>
            <textarea
              value={priceForm.admin_notes}
              onChange={(e) => setPriceForm((prev) => ({ ...prev, admin_notes: e.target.value }))}
              placeholder="Internal notes about this pricing..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowPriceModal(false); setSelectedReq(null); }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={pricing}
              disabled={pricing}
              leftIcon={<DollarSign size={16} />}
              className="flex-1"
            >
              Assign & Notify
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
