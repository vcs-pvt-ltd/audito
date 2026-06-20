"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { checklistApi, type ChecklistTypePayload } from "@/lib/api";
import { useUiFeedback } from "@/context/UiFeedbackContext";

import {
  Plus,
  RefreshCw,
  FileCheck,
  Pencil,
  Trash2,
  Lock,
  X,
  Check,
  Tag,
} from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";

interface ChecklistType {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  checklist_count?: number;
}

// ─── Modal ────────────────────────────────────────────────────────

function TypeModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ChecklistTypePayload) => Promise<void>;
  initial: ChecklistType | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setError("");
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-white font-semibold">
            {initial ? "Edit Checklist Type" : "New Checklist Type"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Safety Inspection"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of this checklist type..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/20 transition-all resize-none"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all disabled:opacity-60"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-primary-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check size={14} />
              )}
              {initial ? "Save Changes" : "Create Type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

export default function ChecklistTypesPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const { confirm, toast } = useUiFeedback();
  const router = useRouter();

  const [types, setTypes] = useState<ChecklistType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ChecklistType | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  const fetchTypes = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    const res = await checklistApi.listTypes(accessToken);
    if (res.success && res.data) {
      const data = res.data as { types: ChecklistType[] };
      setTypes(data.types || []);
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const totalPages = Math.ceil(types.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return types.slice(start, start + pageSize);
  }, [types, currentPage, pageSize]);

  const handleSubmit = async (data: ChecklistTypePayload) => {
    if (!accessToken) return;
    if (editItem) {
      const res = await checklistApi.updateType(accessToken, editItem.id, data);
      if (!res.success) throw new Error(res.message || "Failed to update.");
      toast("Checklist type updated successfully.", "success");
    } else {
      const res = await checklistApi.createType(accessToken, data);
      if (!res.success) throw new Error(res.message || "Failed to create.");
      toast("Checklist type created successfully.", "success");
    }
    fetchTypes();
  };

  const handleDelete = async (id: number, name: string, usageCount = 0) => {
    if (!accessToken) return;
    // Safety net: a type in use by checklists can't be deleted (backend 403).
    if (usageCount > 0) {
      toast(
        `"${name}" is used by ${usageCount} checklist${usageCount === 1 ? "" : "s"} and cannot be deleted. Remove or reassign those checklists first.`,
        "warning"
      );
      return;
    }
    const ok = await confirm({
      title: "Deactivate Checklist Type",
      message: `Deactivate checklist type "${name}"?`,
      confirmText: "Deactivate",
      variant: "warning",
    });
    if (!ok) return;
    setDeleting(id);
    const res = await checklistApi.deactivateType(accessToken, id);
    setDeleting(null);
    if (res.success) {
      toast("Checklist type deactivated successfully.", "success");
      fetchTypes();
    } else {
      toast(res.message || "Failed to deactivate checklist type.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-transparent flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="h-screen bg-transparent flex">

      <main className="flex-1 p-6 lg:p-8 pt-20 lg:pt-8 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <FileCheck size={22} className="text-secondary-400" />
              Checklist Types
            </h1>
            <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
              Define categories to classify your checklists
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTypes}
              className="p-2.5 rounded-lg text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => { setEditItem(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
            >
              <Plus size={16} />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:block">Add Type</span>
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : types.length === 0 ? (
          <div className="glass rounded-xl p-14 text-center">
            <Tag size={36} className="text-gray-600 mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No checklist types yet</p>
            <p className="text-gray-400 text-sm mb-6">
              Create types to categorise your checklists (e.g. Safety, Quality, Compliance).
            </p>
            <button
              onClick={() => { setEditItem(null); setModalOpen(true); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
            >
              <Plus size={16} />
              Add Type
            </button>
          </div>
        ) : (
          <>
            <div className="glass rounded-xl overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-12">#</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Description</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((t, index) => {
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-400 text-sm">{itemIndex}</td>
                        <td className="px-4 py-3 text-white font-medium">{t.name}</td>
                      
                        <td className="px-4 py-3 text-gray-400 max-w-xs">
                          <span className="line-clamp-2">{t.description || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              t.is_active
                                ? "bg-secondary-500/15 text-secondary-400"
                                : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {t.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditItem(t); setModalOpen(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                            {(t.checklist_count ?? 0) > 0 ? (
                              <button
                                onClick={() => handleDelete(t.id, t.name, t.checklist_count ?? 0)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                                title={`Used by ${t.checklist_count} checklist${t.checklist_count === 1 ? "" : "s"}. Click for details.`}
                              >
                                <Lock size={15} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDelete(t.id, t.name, t.checklist_count ?? 0)}
                                disabled={deleting === t.id}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                title="Deactivate"
                              >
                                {deleting === t.id ? (
                                  <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              {paginated.map((t, index) => {
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div key={t.id} className="glass rounded-xl border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">#{itemIndex}</p>
                        <h3 className="text-sm font-semibold text-white truncate">{t.name}</h3>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description || "-"}</p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.is_active
                            ? "bg-secondary-500/15 text-secondary-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditItem(t); setModalOpen(true); }}
                        className="p-2 rounded-lg text-gray-400 hover:text-secondary-400 hover:bg-secondary-500/10 transition-all"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      {(t.checklist_count ?? 0) > 0 ? (
                        <button
                          onClick={() => handleDelete(t.id, t.name, t.checklist_count ?? 0)}
                          className="p-2 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                          title={`Used by ${t.checklist_count} checklist${t.checklist_count === 1 ? "" : "s"}. Tap for details.`}
                        >
                          <Lock size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(t.id, t.name, t.checklist_count ?? 0)}
                          disabled={deleting === t.id}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                          title="Deactivate"
                        >
                          {deleting === t.id ? (
                            <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={types.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}

        <TypeModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
          initial={editItem}
        />
      </main>
    </div>
  );
}
