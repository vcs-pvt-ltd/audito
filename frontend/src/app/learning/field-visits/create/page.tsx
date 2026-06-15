"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auditFirmLearningApi } from "@/lib/api";
import { Plus, ArrowLeft, ChevronLeft } from "lucide-react";

const inputCls =
  "w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-secondary-500/50 focus:ring-1 focus:ring-secondary-500/30 transition-all";

export default function CreateFieldVisitPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    location_name: "",
    address: "",
    latitude: "",
    longitude: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  if (isLoading || !admin) return null;

  if (admin.role !== "admin") {
    return (
      <div className="p-6 pt-20 lg:pt-8 text-gray-300">
        You don’t have permission to access this page.
      </div>
    );
  }

  const handleCreate = async () => {
    if (!accessToken) return;

    setError(null);
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    const res = await auditFirmLearningApi.createFieldVisit(accessToken, {
      title: form.title.trim(),
      location_name: form.location_name.trim() || null,
      address: form.address.trim() || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.message || "Failed to create field visit.");
      return;
    }

    router.push("/learning/field-visits");
  };

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
  <button
    onClick={() => router.back()}
    className="p-2 rounded-xl text-gray-400 hover:text-white border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all shrink-0"
  >
    <ArrowLeft size={18} />
  </button>
  <div>
    <h1 className="text-xl font-bold text-white">Create Field Visit</h1>
    <p className="hidden sm:block text-sm text-gray-400 mt-1">
      Create a field visit and assign it to auditors later.
    </p>
  </div>
</div>
       
      </div>

      <div className="glass border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Location Name</label>
            <input
              className={inputCls}
              value={form.location_name}
              onChange={(e) => setForm((p) => ({ ...p, location_name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Latitude</label>
            <input
              className={inputCls}
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Longitude</label>
            <input
              className={inputCls}
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date/Time</label>
            <input
              className={inputCls}
              type="datetime-local"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date/Time</label>
            <input
              className={inputCls}
              type="datetime-local"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              className={inputCls}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>

        {error ? (
          <div className="border border-red-500/20 bg-red-500/10 rounded-xl p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            disabled={saving}
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-secondary-500 text-primary-950 hover:bg-secondary-400 disabled:opacity-50"
          >
            <Plus size={16} />
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

