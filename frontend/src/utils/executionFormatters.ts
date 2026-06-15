// Common formatting utilities for both audit and CAP execution

export const ENTITY_TYPE_COLORS: Record<string, string> = {
  Customer: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Buying Office": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Company: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Cluster: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  Factory: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  Unit: "bg-green-500/20 text-green-300 border-green-500/30",
  Department: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  Section: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Audit Firm": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  "Audit Firm Company": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  Branch: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function calculateProgress(answered: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((answered / total) * 100);
}
