/**
 * Unsaved audit and CAP answers kept in this browser until they are saved.
 *
 * While an auditor answers, each changed question is written here, so a
 * refresh, a closed tab or a lost connection does not lose the work. Saving
 * the question (or discarding the change) removes its draft. A draft records
 * the saved answer it started from; when the saved answer has since changed
 * (for example saved from another device), the draft is dropped instead of
 * overwriting newer work.
 */

export type AnswerValues = {
  answerText: string;
  selectedOptions: string[];
  freeTextMarks: number;
  remarks: string;
  capRequired: boolean;
};

type StoredDraft = { values: AnswerValues; basedOn: string; savedAt: number };

const PREFIX = "audito_answer_draft:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Storage key for one question of one audit or CAP, entity and area. */
export function answerDraftKey(kind: "audit" | "cap", ...parts: Array<string | number | null | undefined>) {
  return `${PREFIX}${kind}:${parts.map((part) => String(part ?? "")).join(":")}`;
}

// A stable description of a saved answer, to tell whether it changed since a draft began.
function fingerprint(values: AnswerValues) {
  return JSON.stringify([values.answerText || "", [...(values.selectedOptions || [])].map(String).sort(), Number(values.freeTextMarks || 0), values.remarks || "", Boolean(values.capRequired)]);
}

/** The unsaved answer for this question, if it still applies to the saved answer. */
export function readAnswerDraft(key: string, saved: AnswerValues): AnswerValues | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft;
    if (!draft?.values || draft.basedOn !== fingerprint(saved) || Date.now() - Number(draft.savedAt || 0) > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return { ...draft.values, selectedOptions: (draft.values.selectedOptions || []).map(String) };
  } catch {
    return null;
  }
}

export function writeAnswerDraft(key: string, values: AnswerValues, saved: AnswerValues) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ values, basedOn: fingerprint(saved), savedAt: Date.now() } satisfies StoredDraft));
  } catch { /* storage full or blocked: the answer is still on screen */ }
}

export function clearAnswerDraft(key: string) {
  try { window.localStorage.removeItem(key); } catch { /* nothing stored */ }
}

/** Removes drafts older than MAX_AGE_MS, e.g. from audits that were never finished. */
export function pruneAnswerDrafts() {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index--) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      try {
        const draft = JSON.parse(window.localStorage.getItem(key) || "null") as StoredDraft | null;
        if (!draft || Date.now() - Number(draft.savedAt || 0) > MAX_AGE_MS) window.localStorage.removeItem(key);
      } catch { window.localStorage.removeItem(key); }
    }
  } catch { /* storage unavailable */ }
}
