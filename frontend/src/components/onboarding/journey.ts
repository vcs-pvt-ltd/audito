import type { StepItem } from "@/context/OnboardingContext";

/** Why Continue is unavailable on a step, shown next to the action. */
export function blockedReason(step: StepItem | undefined, { pathname, isLastEntityType, isLastStep }: { pathname: string; isLastEntityType: boolean; isLastStep: boolean }) {
  if (!step) return "";
  if (isLastStep) return step.key === "audits" ? "Assign your first audit to finish setup." : "Complete the required steps to finish setup.";
  switch (step.key) {
    case "entities": return isLastEntityType ? "Add at least one entity to continue." : "";
    case "organization-setup": return pathname === "/organization" ? "Save your organization structure to continue." : "Finish this step on the page to continue.";
    case "auditors": return "Add at least one auditor to continue.";
    case "checklists": return "Create a checklist to continue.";
    case "audits": return "Assign your first audit to continue.";
    default: return "Complete this step to continue.";
  }
}

export type JourneyItem = { key: string; title: string; description: string; optional?: boolean; state: "done" | "next" | "upcoming" };

// Steps as shown on the welcome page. Before a setup method is chosen, the
// organization and checklist steps are presented as one, as both methods cover them.
export function journeyPreview(steps: StepItem[], { method, combinedAvailable }: { method: "ai" | "manual" | null; combinedAvailable: boolean }): JourneyItem[] {
  const shown = steps.filter(step => method || !combinedAvailable || step.key !== "checklists");
  const organization = method === "manual"
    ? { title: "Arrange your organization", description: "Place each area under the one it reports to." }
    : method === "ai"
      ? { title: combinedAvailable ? "Organization and checklist" : "Organization structure", description: combinedAvailable ? "Upload your audit sheet and review what Audito prepares." : "Upload a document and review what Audito prepares." }
      : { title: combinedAvailable ? "Organization and checklist" : "Organization structure", description: `Use AI with ${combinedAvailable ? "your audit sheet" : "a document"}, or set it up yourself.` };
  const labels: Record<string, { title: string; description: string }> = {
    entities: { title: "Create your areas", description: "Add the areas your organization has." },
    "organization-setup": organization,
    auditors: { title: "Add auditors", description: "Invite the people who carry out audits." },
    "organization-users": { title: "Invite organization users", description: "Give your team access to their areas." },
    checklists: { title: "Create a checklist", description: "Write the questions for your audits." },
    audits: { title: "Assign your first audit", description: "Pick a checklist, an auditor and a date." },
  };
  const next = shown.findIndex(step => step.state !== "done" && !step.optional);
  return shown.map((step, index) => ({
    key: step.key,
    ...(labels[step.key] || { title: step.title, description: step.description }),
    optional: step.optional,
    state: step.state === "done" ? "done" : index === next ? "next" : "upcoming",
  }));
}
