"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type PromoCode } from "@/lib/api";
import {
  Tag, Plus, X, Loader2, RefreshCw, CheckCircle2, XCircle, Copy, Check, Shuffle, Trash2, Ban,
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
  Input,
} from "@/components/ui";

function generateRandomCode(length = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function PromoCodesPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [form, setForm] = useState({
    code: "",
    discount_percentage: "",
    expires_at: "",
  });
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  const loadCodes = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.listPromoCodes(accessToken);
      if (res.success && res.data) {
        setCodes(res.data as PromoCode[]);
      } else {
        setError((res as any).message || "Failed to load promo codes.");
        toast((res as any).message || "Failed to load promo codes.", "error");
      }
    } catch {
      setError("Failed to load promo codes.");
      toast("Failed to load promo codes.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadCodes();
  }, [accessToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!form.code.trim()) {
      setCreateError("Code is required.");
      return;
    }
    const discount = parseFloat(form.discount_percentage);
    if (isNaN(discount) || discount <= 0 || discount > 100) {
      setCreateError("Discount must be between 1 and 100.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const payload: { code: string; discount_percentage: number; expires_at?: string } = {
        code: form.code.trim().toUpperCase(),
        discount_percentage: discount,
      };
      if (form.expires_at) payload.expires_at = form.expires_at;
      const res = await adminApi.createPromoCode(accessToken, payload);
      if (res.success) {
        toast("Promo code generated successfully.", "success");
        setShowCreate(false);
        setForm({ code: "", discount_percentage: "", expires_at: "" });
        await loadCodes();
      } else {
        const errMsg = (res as any).message || "Failed to create promo code.";
        setCreateError(errMsg);
        toast(errMsg, "error");
      }
    } catch {
      setCreateError("Failed to create promo code.");
      toast("Failed to create promo code.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!accessToken) return;
    const targetCode = codes.find((c) => c.promo_code_id === id)?.code || "";
    const confirmed = await confirm({
      title: "Deactivate Promo Code",
      message: `Are you sure you want to deactivate code "${targetCode}"? This action cannot be undone.`,
      confirmText: "Deactivate",
      variant: "warning",
    });
    if (!confirmed) return;

    setDeactivatingId(id);
    try {
      const res = await adminApi.deactivatePromoCode(accessToken, id);
      if (res.success) {
        toast("Promo code deactivated successfully.", "success");
        setCodes((prev) => prev.map((c) => (c.promo_code_id === id ? { ...c, is_active: false } : c)));
      } else {
        toast((res as any).message || "Failed to deactivate promo code.", "error");
      }
    } catch {
      setError("Failed to deactivate promo code.");
      toast("Failed to deactivate promo code.", "error");
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    const targetCode = codes.find((c) => c.promo_code_id === id)?.code || "";
    const confirmed = await confirm({
      title: "Delete Promo Code",
      message: `Are you sure you want to permanently delete code "${targetCode}"? This will completely remove it from the database.`,
      confirmText: "Delete",
      variant: "error",
    });
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const res = await adminApi.deletePromoCode(accessToken, id);
      if (res.success) {
        toast("Promo code deleted successfully.", "success");
        setCodes((prev) => prev.filter((c) => c.promo_code_id !== id));
      } else {
        setError((res as any).message || "Failed to delete promo code.");
        toast((res as any).message || "Failed to delete promo code.", "error");
      }
    } catch {
      setError("Failed to delete promo code.");
      toast("Failed to delete promo code.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const getStatus = (c: PromoCode) => {
    const isExpired = c.expires_at ? new Date(c.expires_at) < new Date() : false;
    if (!c.is_active) return { label: "Deactivated", type: "inactive" };
    if (isExpired) return { label: "Expired", type: "expired" };
    return { label: "Active", type: "active" };
  };

  const filtered = codes.filter((c) => {
    const status = getStatus(c);
    if (filter === "active") return status.type === "active";
    if (filter === "inactive") return status.type !== "active";
    return true;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  const activeCount = codes.filter((c) => getStatus(c).type === "active").length;
  const inactiveCount = codes.length - activeCount;

  if (isLoading || !admin) return <Loading />;

  return (
    <div className="min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tag size={22} className="text-secondary-400" /> Promo Codes
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Generate and manage discount codes for user registration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={loadCodes}
            disabled={loading}
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
          />
          <Button
            onClick={() => {
              setShowCreate(true);
              setCreateError("");
            }}
            size="md"
            leftIcon={<Plus size={16} />}
          >
            Generate Code
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(["all", "active", "inactive"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === f
                ? "bg-secondary-500 text-primary-950 font-bold"
                : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({
              f === "all" ? codes.length : f === "active" ? activeCount : inactiveCount
            })
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-secondary-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No promo codes found"
          message="Click 'Generate Code' to create your first promo code."
        />
      ) : (
        <>
          <Table>
            <THead>
              <Th>Code</Th>
              <Th>Discount</Th>
              <Th>CreatedAt</Th>
              <Th>ExpiryDate</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </THead>
            <TBody>
              {pageItems.map((promo) => {
                const status = getStatus(promo);
                return (
                  <Tr key={promo.promo_code_id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono font-bold tracking-widest text-sm">
                          {promo.code}
                        </span>
                        <IconButton
                          onClick={() => handleCopy(promo.code, promo.promo_code_id)}
                          tone="secondary"
                          size="sm"
                          title="Copy Promo Code"
                        >
                          {copiedId === promo.promo_code_id ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </IconButton>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-secondary-400 font-semibold text-sm">
                        {promo.discount_percentage}% Off
                      </span>
                    </Td>
                    <Td>
                      <span className="text-gray-400 text-xs">
                        {new Date(promo.created_at).toLocaleDateString()}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-gray-400 text-xs">
                        {promo.expires_at
                          ? new Date(promo.expires_at).toLocaleDateString()
                          : "Never"}
                      </span>
                    </Td>
                    <Td>
                      {status.type === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                          <XCircle size={10} /> {status.label}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        {status.type === "active" && (
                          <IconButton
                            onClick={() => handleDeactivate(promo.promo_code_id)}
                            disabled={deactivatingId === promo.promo_code_id || deletingId === promo.promo_code_id}
                            tone="warning"
                            title="Deactivate Promo Code"
                          >
                            {deactivatingId === promo.promo_code_id ? (
                              <Loader2 size={16} className="animate-spin text-amber-500" />
                            ) : (
                              <Ban size={16} />
                            )}
                          </IconButton>
                        )}
                        <IconButton
                          onClick={() => handleDelete(promo.promo_code_id)}
                          disabled={deactivatingId === promo.promo_code_id || deletingId === promo.promo_code_id}
                          tone="danger"
                          title="Delete Promo Code"
                        >
                          {deletingId === promo.promo_code_id ? (
                            <Loader2 size={16} className="animate-spin text-red-500" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </IconButton>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* Modal for creating a promo code */}
      {showCreate && (
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Generate Promo Code"
          icon={<Tag className="text-secondary-400" />}
          size="md"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. SAVE30"
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 font-mono tracking-widest uppercase transition-all"
                />
                <Button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, code: generateRandomCode() }))}
                  variant="secondary"
                  leftIcon={<Shuffle size={16} />}
                  title="Generate random code"
                />
              </div>
            </div>
            <Input
              label="Discount Percentage (%)"
              type="number"
              min={1}
              max={100}
              step={0.01}
              required
              value={form.discount_percentage}
              onChange={(e) => setForm((p) => ({ ...p, discount_percentage: e.target.value }))}
              placeholder="e.g. 20"
            />
            <div>
              <label className="block text-sm text-gray-400 mb-1.5 font-medium">
                Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 [color-scheme:dark] transition-all"
              />
            </div>

            {createError && <p className="text-xs text-red-400 mt-1">{createError}</p>}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Generate promo code
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
