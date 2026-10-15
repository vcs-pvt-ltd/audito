"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useNativeBackHandler } from "@/lib/native/backButton";

/** Star rating (1–5) with optional private feedback for a completed audit's auditor. */
export default function AuditorRatingModal({
  open,
  rating,
  auditTitle,
  onClose,
  onSave,
}: {
  open: boolean;
  rating: { stars: number; comment?: string | null } | null;
  /** Shown under the title when the dialog is opened from a list. */
  auditTitle?: string;
  onClose: () => void;
  onSave: (stars: number, comment: string) => Promise<{ success: boolean; message?: string }>;
}) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStars(Number(rating?.stars || 0));
    setComment(rating?.comment || "");
    setError("");
  }, [open, rating]);

  // Android app: back closes this dialog.
  useNativeBackHandler(() => { onClose(); return true; }, open);

  if (!open) return null;

  const submit = async () => {
    if (stars < 1 || stars > 5) {
      setError("Select a rating between 1 and 5 stars.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await onSave(stars, comment.trim());
    setSaving(false);
    if (!result.success) setError(result.message || "Unable to save the auditor rating.");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auditor-rating-title">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#08251a] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary-400">Completed audit</p>
            <h2 id="auditor-rating-title" className="mt-1 text-xl font-bold text-white">Rate Auditor</h2>
            {auditTitle && <p className="mt-1 truncate text-sm font-medium text-gray-200">{auditTitle}</p>}
            <p className="mt-1 text-sm text-gray-400">Your rating helps track auditor performance for this workspace.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/[0.06] hover:text-white" aria-label="Close rating dialog">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-300">Rating</p>
          <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Auditor rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={stars === value}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                onClick={() => setStars(value)}
                className={`rounded-lg p-1.5 transition ${value <= stars ? "text-secondary-400" : "text-gray-600 hover:text-secondary-300"}`}
              >
                <Star size={30} fill={value <= stars ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-semibold text-gray-300">Feedback <span className="font-normal text-gray-500">(optional)</span></span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 2000))}
            rows={4}
            placeholder="Add private feedback about the audit work..."
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-secondary-500/50"
          />
          <span className="mt-1 block text-right text-[10px] text-gray-600">{comment.length}/2000</span>
        </label>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button loading={saving} onClick={() => void submit()}>{rating ? "Update Rating" : "Save Rating"}</Button>
        </div>
      </div>
    </div>
  );
}
