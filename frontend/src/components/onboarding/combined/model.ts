import type { OnboardingDraft, OnboardingQuestion, OrganizationAiDraftNode } from "@/lib/api";

export const DURATION_UNITS = ["days", "weeks", "months", "years"] as const;
// Same choices as the checklist create page.
export const CURRENCIES = ["$", "€", "£", "¥", "₹", "AED", "SAR"] as const;
const validDuration = (value: number | null, unit: string) => Number.isInteger(value) && (value as number) > 0 && (DURATION_UNITS as readonly string[]).includes(unit);

/** Every checklist detail is required; mirrors validateChecklist on the backend. */
export function checklistDetailIssues(c: OnboardingDraft["checklist"]) {
  return [
    !c.name.trim() && "Enter a checklist name.",
    !c.description.trim() && "Enter a checklist description.",
    !c.checklist_type_id && "Choose a checklist type.",
    !validDuration(c.time_period_value, c.time_period_unit) && "Enter the audit duration and its unit.",
    !validDuration(c.repeat_duration_value, c.repeat_duration_unit) && "Enter how often the audit repeats and its unit.",
    (c.budget === null || c.budget === undefined || c.budget < 0 || Math.abs(c.budget * 100 - Math.round(c.budget * 100)) > 1e-6) && "Enter the budget (0 or more, up to 2 decimals).",
    !(Number.isInteger(c.num_workers) && (c.num_workers as number) >= 1) && "Enter the number of workers (at least 1).",
  ].filter(Boolean) as string[];
}

export const STEPS = [
  { title: "Upload", short: "Upload" },
  { title: "Organization", short: "Organization" },
  { title: "Questions", short: "Questions" },
  { title: "Save", short: "Save" },
] as const;

export const ROOT_AREA = "__root__";
/** Every question applies to an area; one without a known area applies to the whole organization. */
export const areaOfQuestion = (q: OnboardingQuestion, areaIds: Set<string>) => (q.node_id && areaIds.has(q.node_id) ? q.node_id : ROOT_AREA);

// Mirrors ALLOWED_CHILDREN in backend/src/config/organizationHierarchy.js.
export const PARENTS: Record<string, string[]> = {
  Cluster: ["Company"], Factory: ["Company", "Cluster"], Unit: ["Factory"], Department: ["Company", "Factory", "Unit"], Section: ["Department"],
  "Buying Office": ["Customer"], Supplier: ["Buying Office"],
  Branch: ["Audit Firm Company"], "Audit Firm Department": ["Branch"],
};
const LEVEL: Record<string, number> = {
  Customer: 0, "Buying Office": 1, Supplier: 2,
  Company: 0, Cluster: 1, Factory: 2, Unit: 3, Department: 4, Section: 5,
  "Audit Firm Company": 0, Branch: 1, "Audit Firm Department": 2,
};
export const CHOICE_TYPES = new Set(["single_option", "multiple_options", "dropdown"]);
// Same names as the checklist create page.
export const ANSWER_TYPES = [
  ["single_option", "Single Option"], ["multiple_options", "Multiple Options"], ["dropdown", "Drop Down"], ["free_text", "Free Text"],
] as const;

// Same rule as backend normalizeEntityName: ignore case, spaces and leading zeros.
export const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/0+(\d)/g, "$1");

// Same rules as backend namesLookSame (utils/nameNormalizer.js).
function singularWord(word: string) {
  if (word.length <= 3 || /^\d+$/.test(word)) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ss|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}
const nameWords = (name: string) => name.toLowerCase().replace(/&/g, " and ").split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  .map(word => (/^\d+$/.test(word) ? String(Number(word)) : singularWord(word)));
// One letter missing ("Cuting" / "Cutting"); a changed letter ("Press" / "Dress") does not count.
function oneLetterMissing(a: string, b: string) {
  if (Math.abs(a.length - b.length) !== 1 || a[0] !== b[0]) return false;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  for (let index = 0; index < long.length; index++) if (long.slice(0, index) + long.slice(index + 1) === short) return true;
  return false;
}
/** Whether two area names look the same: "Sample" / "Samples", "Cuting" / "Cutting". "Line 1" / "Line 2" and "Press" / "Dress" differ. */
export function namesLookSame(a: string, b: string) {
  const x = nameWords(a), y = nameWords(b);
  if (!x.length || !y.length) return false;
  if (x.join("") === y.join("")) return true;
  if (x.length !== y.length) return false;
  let differences = 0;
  for (let index = 0; index < x.length; index++) {
    if (x[index] === y[index]) continue;
    if (++differences > 1 || x[index].length < 5 || y[index].length < 5 || /\d/.test(x[index] + y[index]) || !oneLetterMissing(x[index], y[index])) return false;
  }
  return differences === 1;
}
export const validMark = (mark: number | null) => typeof mark === "number" && Number.isFinite(mark) && mark >= 0 && mark <= 10 && Math.abs(mark * 100 - Math.round(mark * 100)) < 1e-6;
export const childTypesOf = (parentType: string) => Object.keys(PARENTS).filter(type => PARENTS[type].includes(parentType));
export const isChangedRecord = (node: OrganizationAiDraftNode) => Boolean(node.source_edge_id) && (node.name !== node.baseline_name || (node.parent_id || null) !== (node.baseline_parent_id || null));
export const isUnplacedRecord = (node: OrganizationAiDraftNode) => Boolean(node.source_entity_code && !node.source_edge_id);
export const pointsToCheck = (q: OnboardingQuestion) => q.selected && (q.details_origin === "default" || q.details_origin === "suggested");
export const lacksAnswers = (q: OnboardingQuestion) => q.selected && (!q.answer_type || (CHOICE_TYPES.has(q.answer_type) && q.options.some(o => !validMark(o.marks))));

export function reachableTypes(root: string) {
  const reachable = (target: string, seen = new Set<string>()): boolean => {
    if (target === root) return true;
    if (seen.has(target)) return false;
    seen.add(target);
    return (PARENTS[target] || []).some(parent => reachable(parent, new Set(seen)));
  };
  return Object.keys(PARENTS).filter(type => type !== root && reachable(type));
}

// Mirrors the server checks in onboardingDraftService.validateChecklist so the
// user sees every problem before saving instead of one error at a time.
export function findQuestionIssues(questions: OnboardingQuestion[], areaIds: Set<string>) {
  const issues = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const q of questions) {
    if (!q.selected) continue;
    const list: string[] = [];
    if (!q.question_text.trim()) list.push("Enter the question text.");
    const key = `${areaOfQuestion(q, areaIds)}|${normalize(q.question_text)}`;
    if (q.question_text.trim() && seen.has(key)) list.push("This question is repeated for the same area.");
    seen.add(key);
    if (!q.answer_type) list.push("Choose an answer type.");
    else if (q.answer_type !== "free_text") {
      const total = q.options.reduce((sum, o) => sum + (validMark(o.marks) ? o.marks as number : 0), 0);
      if (q.options.length < 2 || q.options.length > 5) list.push("Add 2–5 answers.");
      if (q.options.some(o => !o.option_text.trim())) list.push("Every answer needs text.");
      if (new Set(q.options.map(o => normalize(o.option_text))).size !== q.options.length) list.push("Answers must be different.");
      if (q.options.some(o => !validMark(o.marks))) list.push("Enter points from 0 to 10 for every answer.");
      else if (Math.abs(total - 10) > 0.01) list.push(`Points total ${Math.round(total * 100) / 100}. They must total 10.`);
    }
    if (list.length) issues.set(q.id, list);
  }
  return issues;
}

export function findNodeIssues(nodes: OrganizationAiDraftNode[], root: string) {
  const issues = new Map<string, string>();
  const seen = new Set<string>();
  const byId = new Map(nodes.map(n => [n.id, n]));
  for (const node of nodes) {
    if (node.is_removed) continue;
    const key = `${node.entity_type}|${normalize(node.name)}|${node.parent_id || ""}`;
    const parentType = node.parent_id ? byId.get(node.parent_id)?.entity_type : root;
    // A new area with nearly the same name as another of its type in the same place.
    const lookalike = !node.source_entity_code && nodes.find(other => other.id !== node.id && !other.is_removed && other.entity_type === node.entity_type
      && (other.parent_id || "") === (node.parent_id || "") && other.name.trim() && namesLookSame(other.name, node.name));
    if (!node.name.trim()) issues.set(node.id, "Enter a name.");
    else if (seen.has(key)) issues.set(node.id, "Another area with this name already reports to the same place.");
    else if (lookalike && normalize(lookalike.name) !== normalize(node.name)) issues.set(node.id, `Looks the same as "${lookalike.name}". Rename it or remove one.`);
    else if (!parentType || !PARENTS[node.entity_type]?.includes(parentType)) issues.set(node.id, "Choose where this area reports.");
    else if (!node.source_edge_id) {
      const preferred = preferredParentChoices(nodes, node, root);
      if (preferred.length === 1) issues.set(node.id, `Place this area under ${preferred[0].name} (${preferred[0].entity_type}).`);
      else if (preferred.length > 1) issues.set(node.id, `Choose which ${preferred[0].entity_type.toLowerCase()} this area reports to.`);
    }
    seen.add(key);
  }
  return issues;
}

export function preferredParentChoices(nodes: OrganizationAiDraftNode[], node: OrganizationAiDraftNode, root: string) {
  const active = nodes.filter(item => !item.is_removed);
  const byId = new Map(active.map(item => [item.id, item]));
  const parentType = node.parent_id ? byId.get(node.parent_id)?.entity_type : root;
  const currentLevel = LEVEL[parentType || ""];
  if (currentLevel === undefined) return [];
  const below = (candidateId: string, ancestorId: string | null) => {
    if (!ancestorId) return true;
    const seen = new Set<string>();
    for (let cursor = byId.get(candidateId); cursor && !seen.has(cursor.id); cursor = byId.get(cursor.parent_id || "")) {
      if (cursor.parent_id === ancestorId) return true;
      seen.add(cursor.id);
    }
    return false;
  };
  const candidates = active.filter(candidate => candidate.id !== node.id && PARENTS[node.entity_type]?.includes(candidate.entity_type)
    && LEVEL[candidate.entity_type] > currentLevel && below(candidate.id, node.parent_id || null) && !below(candidate.id, node.id));
  const deepest = Math.max(-1, ...candidates.map(candidate => LEVEL[candidate.entity_type]));
  return candidates.filter(candidate => LEVEL[candidate.entity_type] === deepest);
}

// Every node with all of its descendants.
export function branchOf(nodes: OrganizationAiDraftNode[], id: string) {
  const ids = new Set([id]);
  let added = true;
  while (added) {
    added = false;
    for (const node of nodes) if (node.parent_id && ids.has(node.parent_id) && !ids.has(node.id)) { ids.add(node.id); added = true; }
  }
  return ids;
}

export type ProgressInfo = { stage: string; done: number; total: number };
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
