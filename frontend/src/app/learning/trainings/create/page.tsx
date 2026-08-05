"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditFirmLearningApi } from "@/lib/api";
import { Plus, ArrowLeft } from "lucide-react";
import { Button, IconButton, Input, Textarea } from "@/components/ui";

export default function CreateTrainingPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editTrainingId = searchParams.get("edit");
  const isEdit = Boolean(editTrainingId);
  const { toast } = useUiFeedback();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingItem, setLoadingItem] = useState(Boolean(editTrainingId));
  const [editBlocked, setEditBlocked] = useState(false);

  const [form, setForm] = useState({
    title: "",
    platform: "",
    video_url: "",
    description: "",
    duration_minutes: "",
  });

  useEffect(() => {
    if (!isLoading && !admin) router.push("/login");
  }, [isLoading, admin, router]);

  useEffect(() => {
    if (!editTrainingId) {
      setLoadingItem(false);
      return;
    }
    if (!accessToken) return;

    let cancelled = false;
    const loadTraining = async () => {
      setLoadingItem(true);
      const result = await auditFirmLearningApi.getTrainingForEdit(accessToken, editTrainingId);
      if (cancelled) return;

      if (!result.success || !result.data) {
        setError(result.message || "This training cannot be edited.");
        setEditBlocked(true);
        setLoadingItem(false);
        return;
      }

      const training = (result.data as any).training ?? {};
      setForm({
        title: training.title ?? "",
        platform: training.platform ?? "",
        video_url: training.video_url ?? "",
        description: training.description ?? "",
        duration_minutes: training.duration_minutes != null ? String(training.duration_minutes) : "",
      });
      setLoadingItem(false);
    };

    void loadTraining();
    return () => { cancelled = true; };
  }, [accessToken, editTrainingId]);

  if (isLoading || !admin || loadingItem) return null;

  if (editBlocked) {
    return (
      <div className="p-6 lg:p-8 pt-20 lg:pt-8">
        <div className="max-w-md glass border border-white/10 rounded-2xl p-6 text-center">
          <h1 className="text-lg font-bold text-white">Training unavailable</h1>
          <p className="mt-2 text-sm text-gray-400">{error || "This training cannot be edited."}</p>
          <Button className="mt-6" onClick={() => router.push("/learning/trainings")}>Back to Trainings</Button>
        </div>
      </div>
    );
  }

  if (admin.role !== "admin") {
    return (
      <div className="p-6 pt-20 lg:pt-8 text-gray-300">
        You don't have permission to access this page.
      </div>
    );
  }

  const handleSave = async () => {
    if (!accessToken) return;

    setError(null);
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.platform.trim()) { setError("Platform is required."); return; }
    if (!form.video_url.trim()) { setError("Video URL is required."); return; }
    if (!form.description.trim()) { setError("Description is required."); return; }
    if (!form.duration_minutes) { setError("Duration is required."); return; }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      platform: form.platform.trim() || null,
      video_url: form.video_url.trim(),
      description: form.description.trim() || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
    };
    const res = isEdit && editTrainingId
      ? await auditFirmLearningApi.updateTraining(accessToken, editTrainingId, payload)
      : await auditFirmLearningApi.createTraining(accessToken, payload);
    setSaving(false);

    if (!res.success) {
      setError(res.message || `Failed to ${isEdit ? "update" : "create"} training.`);
      return;
    }

    toast(`Training ${isEdit ? "updated" : "created"} successfully.`, "success");
    router.push("/learning/trainings");
  };

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto">
      <div className="flex items-center gap-3">
        <IconButton bordered onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </IconButton>
        <div>
          <h1 className="text-xl font-bold text-white">{isEdit ? "Edit Training" : "Create Training"}</h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
            {isEdit ? "Update this training before assigning it to auditors." : "Add a training video link and assign it to auditors later."}
          </p>
        </div>
      </div>

      <div className="glass border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label="Title"
              required
              placeholder="e.g. Fire Safety Fundamentals"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="Platform"
              required
              placeholder="e.g. YouTube / Vimeo / Facebook"
              value={form.platform}
              onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value }))}
            />
          </div>

          <div>
            <Input
              label="Video URL"
              required
              placeholder="https://www.youtube.com/watch?v=..."
              value={form.video_url}
              onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
            />
          </div>
          
          <div>
            <Input
              label="Duration (minutes)"
              required
              type="number"
              placeholder="e.g. 45"
              value={form.duration_minutes}
              onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
            />
          </div>

          <div className="md:col-span-2">
            <Textarea
              label="Description"
              required
              rows={3}
              placeholder="Brief description of what this training covers..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

        </div>

        {error && (
          <div className="border border-red-500/20 bg-red-500/10 rounded-xl p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button leftIcon={<Plus size={16}/>} loading={saving} onClick={handleSave}>
            {saving ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create")}
          </Button>
        </div>
      </div>
    </div>
  );
}
