"use client";

/**
 * /checklists/[id] — View & Edit existing checklist
 * Reuses the create page component with the id param.
 */
import CreateChecklistPage from "../create/page";

export default function ChecklistDetailsClientPage() {
  return <CreateChecklistPage readOnly />;
}
