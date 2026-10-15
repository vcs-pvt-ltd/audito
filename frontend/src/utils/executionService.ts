/**
 * Unified Execution Service
 * Provides common functions for both Audit and CAP workflows
 */

import { TreeNode } from "./treeHelpers";
import { mediaOrigin, mediaUrl } from "@/lib/apiConfig";

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
  return mediaOrigin();
}

/**
 * Get evidence file URL
 */
export function getEvidenceUrl(filePath: string): string {
  return mediaUrl(filePath);
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
export function normalizeSelectedOptionIds(selected_option_ids: unknown): string[] {
  if (selected_option_ids == null) return [];

  if (Array.isArray(selected_option_ids)) {
    return selected_option_ids.map((v) => String(v).trim()).filter(Boolean);
  }

  if (typeof selected_option_ids === "number") return [String(selected_option_ids)];

  if (typeof selected_option_ids !== "string") return [];

  const raw = selected_option_ids.trim();
  if (!raw) return [];

  // Stored as JSON (preferred)
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    }
    if (typeof parsed === "number" || typeof parsed === "string") return [String(parsed).trim()];
  } catch {
    // fallthrough
  }

  // Stored as comma-separated list or single value
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [raw.trim()];
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
export function progressKey(entityCode: string, orgTreeId: string | null | undefined): string {
  return `${entityCode}__${orgTreeId ?? "null"}`;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(answered: number, total: number): number {
  return total > 0 ? Math.round((answered / total) * 100) : 0;
}
