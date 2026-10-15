import type { QuestionPayload } from "@/lib/api";

export const CHECKLIST_AI_CONTEXT_KEY = "audito:checklist-ai:context:v1";
export const CHECKLIST_AI_BUILDER_KEY = "audito:checklist-ai:builder:v1";
export const CHECKLIST_AI_RESULT_KEY = "audito:checklist-ai:result:v1";

export interface ChecklistAiQuestionDraft {
  id: string;
  entity_code: string;
  org_tree_id: string | null;
  entity_type: string;
  entity_name: string;
  question_text: string;
  answer_type: QuestionPayload["answer_type"];
  options: Array<{ text: string; marks: string }>;
}

export interface ChecklistAiWorkspaceContext {
  returnUrl: string;
  checklistName: string;
  checklistType: string;
  existingQuestions: string[];
}

export interface ChecklistAiBuilderSnapshot {
  returnUrl: string;
  step: number;
  formData: Record<string, string>;
  questions: ChecklistAiQuestionDraft[];
}

export interface ChecklistAiWorkspaceResult {
  returnUrl: string;
  questions: ChecklistAiQuestionDraft[];
  createdAt: number;
}

export function readSessionJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function writeSessionJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

export function clearChecklistAiWorkspace(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CHECKLIST_AI_CONTEXT_KEY);
  window.sessionStorage.removeItem(CHECKLIST_AI_BUILDER_KEY);
  window.sessionStorage.removeItem(CHECKLIST_AI_RESULT_KEY);
}
