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
  Search,
} from "lucide-react";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import { Button, IconButton, Modal, Table, THead, Th, TBody, Tr, Td, Input, Textarea } from "@/components/ui";

interface ChecklistType {
  checklist_type_id: string;
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={initial ? "Edit Checklist Type" : "New Checklist Type"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Safety Inspection"
        />
        <Textarea
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Brief description of this checklist type..."
          className="resize-none"
        />

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth loading={saving} leftIcon={<Check size={14} />}>
            {initial ? "Save Changes" : "Create Type"}
          </Button>
        </div>
      </form>
    </Modal>
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredTypes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return types;
    return types.filter((type) => `${type.name} ${type.description || ""}`.toLowerCase().includes(query));
  }, [types, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredTypes.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTypes.slice(start, start + pageSize);
  }, [filteredTypes, currentPage, pageSize]);

  const handleSubmit = async (data: ChecklistTypePayload) => {
    if (!accessToken) return;
    if (editItem) {
      const res = await checklistApi.updateType(accessToken, editItem.checklist_type_id, data);
      if (!res.success) throw new Error(res.message || "Failed to update.");
      toast("Checklist type updated successfully.", "success");
    } else {
      const res = await checklistApi.createType(accessToken, data);
      if (!res.success) throw new Error(res.message || "Failed to create.");
      toast("Checklist type created successfully.", "success");
    }
    fetchTypes();
  };

  const handleDelete = async (id: string, name: string, usageCount = 0) => {
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
      title: "Delete Checklist Type",
      message: `Delete checklist type "${name}"?`,
      confirmText: "Delete",
      variant: "warning",
    });
    if (!ok) return;
    setDeleting(id);
    const res = await checklistApi.deactivateType(accessToken, id);
    setDeleting(null);
    if (res.success) {
      toast("Checklist type deleted successfully.", "success");
      fetchTypes();
    } else {
      toast(res.message || "Failed to delete checklist type.", "error");
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
            <IconButton bordered size="lg" onClick={fetchTypes} title="Refresh">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </IconButton>
            <Button onClick={() => { setEditItem(null); setModalOpen(true); }} leftIcon={<Plus size={16} />}>
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:block">Add Type</span>
            </Button>
          </div>
        </div>

        {!loading && types.length > 0 && (
          <div className="mb-6 max-w-lg">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <Search size={14} className="text-gray-500" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search checklist types..."
                className="w-full bg-transparent text-sm text-gray-200 outline-none placeholder:text-gray-600"
              />
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-secondary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : types.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No checklist types yet"
            message="Create types to categorise your checklists (e.g. Safety, Quality, Compliance)."
            action={(
              <button
                onClick={() => { setEditItem(null); setModalOpen(true); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-secondary-500 text-primary-950 hover:bg-secondary-400 transition-all"
              >
                <Plus size={16} />
                Add Type
              </button>
            )}
          />
        ) : filteredTypes.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center">
            <Search size={36} className="mx-auto mb-4 text-gray-600" />
            <p className="font-medium text-white">No matching checklist types</p>
            <p className="mt-1 text-sm text-gray-400">Try a different name or description.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <Th className="w-12">#</Th>
                  <Th>Name</Th>
                  <Th>Description</Th>
                  <Th>Created At</Th>
                  <Th align="right">Actions</Th>
                </THead>
                <TBody>
                  {paginated.map((t, index) => {
                    const itemIndex = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <Tr key={t.checklist_type_id}>
                        <Td className="text-gray-400 text-sm">{itemIndex}</Td>
                        <Td className="text-white font-medium">{t.name}</Td>
                        <Td className="text-gray-400 max-w-xs">
                          <span className="line-clamp-2">{t.description || "—"}</span>
                        </Td>
                        <Td className="text-gray-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton tone="secondary" onClick={() => { setEditItem(t); setModalOpen(true); }} title="Edit">
                              <Pencil size={15} />
                            </IconButton>
                            {(t.checklist_count ?? 0) > 0 ? (
                              <IconButton tone="warning" onClick={() => handleDelete(t.checklist_type_id, t.name, t.checklist_count ?? 0)} title={`Used by ${t.checklist_count} checklist${t.checklist_count === 1 ? "" : "s"}. Click for details.`}>
                                <Lock size={15} />
                              </IconButton>
                            ) : (
                              <IconButton tone="danger" onClick={() => handleDelete(t.checklist_type_id, t.name, t.checklist_count ?? 0)} disabled={deleting === t.checklist_type_id} title="Delete">
                                {deleting === t.checklist_type_id ? (
                                  <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 size={15} />
                                )}
                              </IconButton>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            <div className="md:hidden space-y-3">
              {paginated.map((t, index) => {
                const itemIndex = (currentPage - 1) * pageSize + index + 1;
                return (
                  <div key={t.checklist_type_id} className="glass rounded-xl border border-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">#{itemIndex}</p>
                        <h3 className="text-sm font-semibold text-white truncate">{t.name}</h3>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description || "-"}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">Created {new Date(t.created_at).toLocaleDateString()}</p>
                    <div className="mt-3 flex items-center justify-end gap-1">
                      <IconButton size="md" tone="secondary" onClick={() => { setEditItem(t); setModalOpen(true); }} title="Edit">
                        <Pencil size={15} />
                      </IconButton>
                      {(t.checklist_count ?? 0) > 0 ? (
                        <IconButton size="md" tone="warning" onClick={() => handleDelete(t.checklist_type_id, t.name, t.checklist_count ?? 0)} title={`Used by ${t.checklist_count} checklist${t.checklist_count === 1 ? "" : "s"}. Tap for details.`}>
                          <Lock size={15} />
                        </IconButton>
                      ) : (
                        <IconButton size="md" tone="danger" onClick={() => handleDelete(t.checklist_type_id, t.name, t.checklist_count ?? 0)} disabled={deleting === t.checklist_type_id} title="Delete">
                          {deleting === t.checklist_type_id ? (
                            <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </IconButton>
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
              totalItems={filteredTypes.length}
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
