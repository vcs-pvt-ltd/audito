"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { adminApi, type AdminUser } from "@/lib/api";
import {
  Shield, Plus, X, Loader2, RefreshCw, CheckCircle2, XCircle, Trash2, UserPlus, Search, MailCheck, Clock,
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

export default function AdminsPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "verified" | "pending">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && (!admin || admin.role !== "audito_admin")) {
      router.replace("/login");
    }
  }, [isLoading, admin, router]);

  const loadAdmins = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const params: { role?: string; is_active?: string; search?: string } = {};
      if (filter === "active") params.is_active = "true";
      if (filter === "inactive") params.is_active = "false";
      if (search.trim()) params.search = search.trim();

      const res = await adminApi.listAdmins(accessToken, params);
      if (res.success && res.data) {
        setAdmins(res.data as AdminUser[]);
      } else {
        setError((res as any).message || "Failed to load admins.");
        toast((res as any).message || "Failed to load admins.", "error");
      }
    } catch {
      setError("Failed to load admins.");
      toast("Failed to load admins.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadAdmins();
  }, [accessToken]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setCreateError("All fields are required.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const res = await adminApi.createAdmin(accessToken, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim().toLowerCase(),
      });
      if (res.success) {
        toast("Invitation sent. They will receive an email to set their password.", "success");
        setShowCreate(false);
        setForm({ first_name: "", last_name: "", email: "" });
        await loadAdmins();
      } else {
        const errMsg = (res as any).message || "Failed to send invitation.";
        setCreateError(errMsg);
        toast(errMsg, "error");
      }
    } catch {
      setCreateError("Failed to send invitation.");
      toast("Failed to send invitation.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (adminId: string) => {
    if (!accessToken) return;
    const target = admins.find((a) => a.admin_id === adminId);
    const action = target?.is_active ? "deactivate" : "activate";
    const confirmed = await confirm({
      title: `${action === "deactivate" ? "Deactivate" : "Activate"} Admin`,
      message: `Are you sure you want to ${action} "${target?.first_name} ${target?.last_name}"?`,
      confirmText: action === "deactivate" ? "Deactivate" : "Activate",
      variant: action === "deactivate" ? "warning" : "info",
    });
    if (!confirmed) return;

    setTogglingId(adminId);
    try {
      const res = await adminApi.toggleAdminStatus(accessToken, adminId);
      if (res.success) {
        toast(`Admin ${action}d successfully.`, "success");
        setAdmins((prev) =>
          prev.map((a) => (a.admin_id === adminId ? { ...a, is_active: !a.is_active } : a))
        );
      } else {
        toast((res as any).message || `Failed to ${action} admin.`, "error");
      }
    } catch {
      toast(`Failed to ${action} admin.`, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (adminId: string) => {
    if (!accessToken) return;
    const target = admins.find((a) => a.admin_id === adminId);
      if (target?.admin_id === admin?.id) {
      toast("You cannot delete your own account.", "error");
      return;
    }
    const confirmed = await confirm({
      title: "Delete Admin",
      message: `Are you sure you want to permanently delete "${target?.first_name} ${target?.last_name}"? This action cannot be undone.`,
      confirmText: "Delete",
      variant: "error",
    });
    if (!confirmed) return;

    setDeletingId(adminId);
    try {
      const res = await adminApi.deleteAdmin(accessToken, adminId);
      if (res.success) {
        toast("Admin deleted successfully.", "success");
        setAdmins((prev) => prev.filter((a) => a.admin_id !== adminId));
      } else {
        toast((res as any).message || "Failed to delete admin.", "error");
      }
    } catch {
      toast("Failed to delete admin.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAdmins();
  };

  const filtered = admins.filter((a) => {
    if (filter === "active") return a.is_active;
    if (filter === "inactive") return !a.is_active;
    if (filter === "verified") return a.is_verified;
    if (filter === "pending") return !a.is_verified;
    return true;
  });
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  const activeCount = admins.filter((a) => a.is_active).length;
  const inactiveCount = admins.filter((a) => !a.is_active).length;
  const verifiedCount = admins.filter((a) => a.is_verified).length;
  const pendingCount = admins.filter((a) => !a.is_verified).length;

  if (isLoading || !admin) return <Loading />;

  return (
    <div className="min-h-screen p-5 pt-20 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={22} className="text-secondary-400" /> Admins
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage admin and audito_admin accounts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={loadAdmins}
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
            leftIcon={<UserPlus size={16} />}
          >
            Invite Admin
          </Button>
        </div>
      </div>

      {/* Search + filter tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all"
            />
          </div>
          <Button type="submit" variant="secondary" size="md">
            Search
          </Button>
        </form>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: "all", label: "All", count: admins.length },
            { key: "active", label: "Active", count: activeCount },
            { key: "inactive", label: "Inactive", count: inactiveCount },
            { key: "verified", label: "Verified", count: verifiedCount },
            { key: "pending", label: "Pending", count: pendingCount },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f.key
                  ? "bg-secondary-500 text-primary-950 font-bold"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
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
          icon={Shield}
          title="No admins found"
          message="Click 'Invite Admin' to send the first invitation."
        />
      ) : (
        <>
          <Table>
            <THead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Created</Th>
              <Th>Verified</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </THead>
            <TBody>
              {pageItems.map((adm) => (
                <Tr key={adm.admin_id}>
                  <Td>
                    <span className="text-white text-sm font-medium">
                      {adm.first_name} {adm.last_name}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-gray-400 text-sm">{adm.email}</span>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      adm.role === 'audito_admin'
                        ? 'bg-secondary-500/10 border border-secondary-500/30 text-secondary-400'
                        : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                    }`}>
                      {adm.role === 'audito_admin' ? 'Audito Admin' : 'Admin'}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-gray-400 text-xs">
                      {new Date(adm.created_at).toLocaleDateString()}
                    </span>
                  </Td>
                  <Td>
                    {adm.is_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <MailCheck size={10} /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                        <Clock size={10} /> Pending
                      </span>
                    )}
                  </Td>
                  <Td>
                    {adm.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
                        <XCircle size={10} /> Inactive
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <IconButton
                        onClick={() => handleToggleStatus(adm.admin_id)}
                        disabled={togglingId === adm.admin_id || deletingId === adm.admin_id || adm.admin_id === admin?.id}
                        tone={adm.is_active ? "warning" : "info"}
                        title={adm.is_active ? "Deactivate Admin" : "Activate Admin"}
                      >
                        {togglingId === adm.admin_id ? (
                          <Loader2 size={16} className="animate-spin text-amber-500" />
                        ) : (
                          <XCircle size={16} />
                        )}
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(adm.admin_id)}
                        disabled={togglingId === adm.admin_id || deletingId === adm.admin_id || adm.admin_id === admin?.id}
                        tone="danger"
                        title="Delete Admin"
                      >
                        {deletingId === adm.admin_id ? (
                          <Loader2 size={16} className="animate-spin text-red-500" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </IconButton>
                    </div>
                  </Td>
                </Tr>
              ))}
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

      {/* Modal for creating an admin */}
      {showCreate && (
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="Invite Admin"
          icon={<Shield className="text-secondary-400" />}
          size="md"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                required
                value={form.first_name}
                onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                placeholder="e.g. John"
              />
              <Input
                label="Last Name"
                required
                value={form.last_name}
                onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                placeholder="e.g. Doe"
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="admin@example.com"
            />
            <p className="text-xs text-gray-500">
              An invitation email will be sent. They will set their own password after verifying their email.
            </p>

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
                Send Invitation
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
