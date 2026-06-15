/**
 * Unified Execution Service
 * Provides common functions for both Audit and CAP workflows
 */

import { TreeNode } from "./treeHelpers";

/**
 * Format file size for display
 */
export function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format time display
 */
export function fmtTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Get media origin URL
 */
export function getMediaOrigin(): string {
  return process.env.NEXT_PUBLIC_MEDIA_URL || 
    (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "");
}

/**
 * Get evidence file URL
 */
export function getEvidenceUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) return filePath;
  const p = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `${getMediaOrigin()}${p}`;
}

/**
 * Infer evidence kind from file type, name, or path
 */
export function inferEvidenceKind(
  fileType: unknown,
  fileName: unknown,
  filePath: unknown
): "image" | "video" | "audio" {
  const ft = String(fileType || "").toLowerCase();
  if (ft === "image" || ft === "video" || ft === "audio") return ft;

  const name = String(fileName || filePath || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return "image";
  if (/\.(mp4|webm|mov|mkv|avi|m4v)$/.test(name)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|webm)$/.test(name)) return "audio";

  return "image"; // Fallback
}

/**
 * Normalize selected option IDs from various formats
 */
export function normalizeSelectedOptionIds(selected_option_ids: unknown): number[] {
  if (selected_option_ids == null) return [];

  if (Array.isArray(selected_option_ids)) {
    return selected_option_ids
      .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
      .filter((n) => Number.isFinite(n));
  }

  if (typeof selected_option_ids === "number") return [selected_option_ids];

  if (typeof selected_option_ids !== "string") return [];

  const raw = selected_option_ids.trim();
  if (!raw) return [];

  // Stored as JSON (preferred)
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
        .filter((n) => Number.isFinite(n));
    }
    if (typeof parsed === "number") return [parsed];
    if (typeof parsed === "string") {
      const n = parseInt(parsed, 10);
      return Number.isFinite(n) ? [n] : [];
    }
  } catch {
    // fallthrough
  }

  // Stored as comma-separated list or single value
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
  }

  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? [n] : [];
}

/**
 * Compress image file
 */
export async function compressImage(
  file: File,
  maxWidth = 1280,
  quality = 0.7
): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width,
        h = img.height;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(new File([blob], file.name, { type: "image/jpeg" }));
          else resolve(file);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

/**
 * Build breadcrumb navigation from step history
 */
export interface BreadcrumbNode {
  label: string;
  goTo: () => void;
}

/**
 * Create progress key from entity code and org tree id
 */
export function progressKey(entityCode: string, orgTreeId: number | null | undefined): string {
  return `${entityCode}__${orgTreeId ?? "null"}`;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(answered: number, total: number): number {
  return total > 0 ? Math.round((answered / total) * 100) : 0;
}
