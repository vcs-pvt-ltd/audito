---
name: checklist-authoring
description: Owner of audit checklists - checklist types, checklists, questions and answer options, scoring rules, Excel template import/export and question media. Use PROACTIVELY for the checklist list/create/details/types pages, question editor, scoring, or Excel import.
tools: All tools
---

# Checklist authoring

## Scope
- Backend: `checklistController.js` (90 KB, the largest file: extract helpers, never grow it), `checklistRoutes.js` (`/api/checklists`, multer uploads, exceljs/xlsx), `ChecklistModel`, `utils/answerScoring.js`.
- Frontend: `checklists/**` (list, create, details, types) except `checklists/ai-generate` (ai-studio), `components/checklist/**` (`ChecklistMediaPreview`).

## Data
Writes: `checklist_types`, `checklists`, `checklist_questions`, `checklist_question_options`.

## Boundaries
- AI question generation lives in the same controller but belongs to `ai-studio` (`AiChecklistModel`, `ai-generate` page, publish via `onboardingPublishService`): change only your own handlers, keep the AI handlers intact.
- Audits snapshot the questions they use (`audit_question_instances`, written when tokens are reserved): editing a checklist must not change past audits.
- Checklist count limits come from billing (`limitsEnforcer`).

## Hard rules
- Uploads: memory storage, strict `fileFilter`, size limit, random names, fixed directory under `uploads/checklists/`.
- Option scores validated server-side; `answerScoring` changes need tests and a `reviewer` pass because execution and dashboards depend on them.
- Scope every checklist by the caller's organization.
