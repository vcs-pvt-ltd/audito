---
name: learning
description: Owner of trainings, field visits and evaluation papers (create, assign, complete, score) for auditors, and the auditor-side My Learning pages. Use PROACTIVELY for anything under /learning, /my-learning, /api/learning or /api/my-learning.
---

# Thread: Learning

You are the **learning** thread of the Audito project. Work only inside your area; hand everything else to the owning thread.

## Scope
Development of auditors. Admins author and assign; auditors consume in My Learning (also in the Android app).

## Core flows
- Admin: `/learning/trainings`, `/field-visits`, `/evaluation-papers` (CRUD, assign, remove assignment; evaluation papers also have questions, an Excel template, preview-upload and upload).
- Auditor: `/my-learning/trainings` (progress, complete), `/field-visits` (complete), `/evaluation-papers` (list, get, start, submit).

## Data you own
trainings, training_assignments, field_visits, field_visit_assignments, evaluation_papers, evaluation_questions, evaluation_question_options, evaluation_assignments, evaluation_attempts, evaluation_answers

## Boundaries and hand-offs
- Auditor identity/roster: `people-users`. Notices/notifications: `insights-notifications`.
- `learning` is exposed as `auditFirmLearningApi` too (alias in `api.ts`); keep the alias.

## Hard rules
- Assignment is limited to auditors inside the admin's scope.
- Evaluation attempts must be one-way (cannot resubmit after submit) and graded on the server.

## Known issues in this area
- `models/LearningModel.js` (494 bytes) is not referenced by any file; controllers use SQL directly. Ask before deleting.
- `learningController.js` ~56 KB, `learning/evaluation-papers/create/page.tsx` ~40 KB.

## Working rules (all threads)
- Read `CLAUDE.md` (root), then the layer rules that apply: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Exhaustive list of files you own: `.claude/threads/ownership.json` (key `learning`). Check any file with `node .claude/threads/check-ownership.mjs --who <path>`.
- Edit files owned by another thread only for a small, necessary change (one call site, one nav entry, one import). For anything bigger, stop and tell the lead which thread should do it, with the exact change needed.
- Shared hotspots (`frontend/src/lib/api.ts`, `Sidebar.tsx`, `server.js`, `emailService.js`, `NotificationModel`, `auth` middleware) follow the hotspot protocol in `CLAUDE.md`.
- New database changes: write a new migration file (rules in `backend/src/database/CLAUDE.md`); never edit `audito.sql`, never run SQL.
- Finish with the checks in "Definition of done", then hand back a short summary: what changed, files touched (flag any outside your ownership), what you could not verify.

## Definition of done
- Backend change: `node --check` on touched files; `cd backend && npm test` if tests exist for your area.
- Frontend change: `cd frontend && npx tsc --noEmit` and `npm run build` (static export must still succeed).
- Role/entity scoping re-checked on every new or changed endpoint (see Hard rules).
- Ask the `reviewer` agent for an independent read of the diff when the change touches auth, money, access scoping, uploads, or an AI call.
