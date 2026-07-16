import type { LucideIcon } from "lucide-react";

/**
 * Standard empty-state card: a centered glass container with an icon, title,
 * optional message and optional action. Mirrors the checklists page design so
 * all "no data yet" views look consistent across the app.
 */
export default function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-8 text-center sm:p-12 lg:p-16">
      <Icon size={40} className="text-gray-600 mx-auto mb-4" />
      <p className="text-white font-medium mb-1">{title}</p>
      {message && <p className={`text-gray-400 text-sm ${action ? "mb-6" : ""}`}>{message}</p>}
      {action}
    </div>
  );
}
