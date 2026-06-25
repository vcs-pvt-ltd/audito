"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditFirmLearningApi } from "@/lib/api";
import { Plus, ArrowLeft } from "lucide-react";
import { Button, IconButton, Input, Textarea } from "@/components/ui";

export default function CreateFieldVisitPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useUiFeedback();

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
        You don't have permission to access this page.
      </div>
    );
  }

  const handleCreate = async () => {
    if (!accessToken) return;

    setError(null);
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.location_name.trim()) { setError("Location name is required."); return; }
    if (!form.start_date) { setError("Start date & time is required."); return; }
    if (!form.end_date) { setError("End date & time is required."); return; }
    if (form.end_date <= form.start_date) { setError("End date must be after start date."); return; }

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

    toast("Field visit created successfully.", "success");
    router.push("/learning/field-visits");
  };

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto">
      <div className="flex items-center gap-3">
        <IconButton bordered onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </IconButton>
        <div>
          <h1 className="text-xl font-bold text-white">Create Field Visit</h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
            Create a field visit and assign it to auditors later.
          </p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Title"
              required
              placeholder="e.g. Factory Floor Safety Inspection"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="Location Name"
              required
              placeholder="e.g. Main Warehouse, Block A"
              value={form.location_name}
              onChange={(e) => setForm((p) => ({ ...p, location_name: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="Address"
              placeholder="Full street address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="Latitude"
              type="number"
              step="any"
              placeholder="e.g. 37.7749"
              value={form.latitude}
              onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="Longitude"
              type="number"
              step="any"
              placeholder="e.g. -122.4194"
              value={form.longitude}
              onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="Start Date / Time"
              required
              type="datetime-local"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="End Date / Time"
              required
              type="datetime-local"
              value={form.end_date}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            />
          </div>

          <div className="md:col-span-2">
            <Textarea
              label="Notes"
              rows={3}
              placeholder="Additional notes or instructions for auditors..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
        </div>

        {error && (
          <div className="border border-red-500/20 bg-red-500/10 rounded-xl p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button leftIcon={<Plus size={16}/>} loading={saving} onClick={handleCreate}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
