export const COMPANY_ENTRY_LEVELS = [
  { type: "Company", minimumLevels: 5, label: "Company", description: "Start with the full company hierarchy." },
  { type: "Cluster", minimumLevels: 4, label: "Cluster", description: "Start at a cluster of factories." },
  { type: "Factory", minimumLevels: 3, label: "Factory", description: "Start at a factory." },
  { type: "Unit", minimumLevels: 3, label: "Unit", description: "Start at a unit." },
  { type: "Department", minimumLevels: 3, label: "Department", description: "Start directly with a department." },
] as const;

export const FREE_COMPANY_LEVELS = 3;

/** 1 audit line = 1 token; a package includes at least this many line tokens. */
export const MIN_AUDIT_LINES = 100;

export function hierarchySelectionLabel(levels: number) {
  return levels === 5 ? "Levels 1–5 · Company" : levels === 4 ? "Levels 1–4 · Cluster" : "Levels 1–3 · Department, Unit, Factory";
}

export function snapshotHierarchyLabel(snapshot: Record<string, unknown>) {
  const version = Number(snapshot.pricing_version);
  const levels = Number(snapshot.company_levels);
  if (version === 3) return hierarchySelectionLabel(levels);
  if (version === 2) return hierarchySelectionLabel(levels + 1);
  return `${levels} company levels`;
}

export type CompanyEntryType = typeof COMPANY_ENTRY_LEVELS[number]["type"];

export function canRegisterPackageEntry(type: CompanyEntryType, selectedLevels: number) {
  const entry = COMPANY_ENTRY_LEVELS.find((item) => item.type === type);
  return Boolean(entry && Number.isSafeInteger(selectedLevels) && selectedLevels <= 5 && selectedLevels >= entry.minimumLevels);
}
