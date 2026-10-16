---
name: checklist-authoring
description: Owner of checklist types, checklists and their questions/options, scoring options, Excel template upload and question media. Use PROACTIVELY for the Checklists pages, question editing, scoring, or Excel import. AI generation of questions belongs to ai-studio.
tools: All tools
---

# Checklist authoring

## Scope
- Backend: `checklistController.js` (87 KB, the largest file: extract helpers, never grow it), `checklistRoutes.js` (`/api/checklists`, multer uploads), `ChecklistModel`, `utils/answerScoring.js`.
- Frontend: `checklists/**` (list, create, details, types) except `checklists/ai-generate`, `components/checklist/**`.

## Data
Writes: `checklist_types`, `checklists`, `checklist_questions`, `checklist_question_options`.

## Boundaries
- AI question generation is in the same controller but owned by `ai-studio` (`AiChecklistModel`, `ai-generate` page): the controller is a shared hotspot, change only your own handlers and keep the AI handlers intact.
- Checklists used by an audit are frozen into the audit; editing a published checklist must not change past audits (`audit-scheduling`/`audit-fieldwork` read them).
- Checklist count limits come from `billing`.

## Hard rules
- Uploads: memory storage, strict `fileFilter`, size limit, random names, fixed directory under `uploads/checklists/`.
- Option scores are validated server-side; `answerScoring` changes need tests and a `reviewer` pass because execution depends on them.
- Scope every checklist by the caller's organization.
