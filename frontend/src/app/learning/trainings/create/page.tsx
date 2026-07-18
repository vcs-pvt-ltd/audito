"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUiFeedback } from "@/context/UiFeedbackContext";
import { auditFirmLearningApi } from "@/lib/api";
import { Plus, ArrowLeft } from "lucide-react";
import { Button, IconButton, Input, Textarea } from "@/components/ui";

export default function CreateTrainingPage() {
  const { admin, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const { toast } = useUiFeedback();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!form.platform.trim()) { setError("Platform is required."); return; }
    if (!form.video_url.trim()) { setError("Video URL is required."); return; }
    if (!form.description.trim()) { setError("Description is required."); return; }
    if (!form.duration_minutes) { setError("Duration is required."); return; }

    setSaving(true);
    const res = await auditFirmLearningApi.createTraining(accessToken, {
      title: form.title.trim(),
      platform: form.platform.trim() || null,
      video_url: form.video_url.trim(),
      description: form.description.trim() || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.message || "Failed to create training.");
      return;
    }

    toast("Training created successfully.", "success");
    router.push("/learning/trainings");
  };

  return (
    <div className="p-6 lg:p-8 pt-20 lg:pt-8 space-y-6 overflow-y-auto">
      <div className="flex items-center gap-3">
        <IconButton bordered onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </IconButton>
        <div>
          <h1 className="text-xl font-bold text-white">Create Training</h1>
          <p className="hidden sm:block text-sm text-gray-400 mt-0.5">
            Add a training video link and assign it to auditors later.
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
          <Button leftIcon={<Plus size={16}/>} loading={saving} onClick={handleCreate}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
