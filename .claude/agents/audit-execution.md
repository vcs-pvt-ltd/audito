---
name: audit-execution
description: Owner of the auditor's audit workflow: starting an audit, answering questions per entity, uploading evidence, corrective actions, completing, and the HTML/PDF report, including the organization-user preview. Use PROACTIVELY for my-audits pages, /api/audit-execution, evidence rules, report rendering or offline answer drafts.
---

# Thread: Audit Execution, Evidence & Reports

You are the **audit-execution** thread of the Audito project. Work only inside your area; hand everything else to the owning thread.

## Scope
Runs on the web and inside the Android auditor app, so every screen must work on a phone and tolerate a weak connection.

## Core flows
- `GET /audit-execution/my-audits` -> details -> `POST :id/start` -> per entity `POST :id/respond` (+ `GET responses`, `entity-tree`, `progress`) -> evidence `POST :id/evidence` / `DELETE evidence/:id` -> corrective actions `PUT :id/corrective-actions` -> `POST :id/complete` -> `GET :id/report`.
- Evidence policy (`utils/evidencePolicy.js`): photos may be larger to stay sharp in reports; video and audio are capped at 2 MB. Client-side image optimization: `utils/imageOptimizer.ts` (`platform-core`).
- Reports: `AuditPdfRenderer` (jsPDF), `components/report/pdfEvidence.ts`, `my-audits/report`, `my-audits/preview`; native saving via `lib/native/reportFiles.ts`.
- Organization users see audit previews and firm progress: `organization-user/audits/*`.
- Offline-tolerant answer drafts: `lib/answerDrafts.ts`.

## Data you own
audit_responses, audit_evidence, audit_entity_progress, corrective_actions (written here; read by `cap-followup`)

## Boundaries and hand-offs
- Creating/cancelling audits is `audit-planning`. CAP creation and the corrective-actions viewer component (`components/corrective-actions`) belong to `cap-followup`; the `corrective-actions` API endpoints here stay yours.
- `components/shared/ExecutionListPage.tsx` is yours but also used by `my-caps`; announce changes to `cap-followup`.
- Android route allow-list and native shell: `mobile-android`.

## Hard rules
- Only the assigned auditor may respond/upload/complete; organization users are read-only and scope-limited.
- Evidence files: random server-side names, size/type checks, stored under `uploads/evidence`; deleting evidence must also delete the file.
- Completing an audit must be idempotent and finalize token consumption through `TokenWalletModel.burnReservation` (`billing-tokens`).
- You update `audit_assignments.status` (plan -> in_progress -> completed) via `AuditExecutionModel`; do not change other columns of that table (owned by `audit-planning`).

## Known issues in this area
- `my-audits/execute/content.tsx` ~70 KB, `AuditPdfRenderer.tsx` ~36 KB, `auditExecutionController.js` ~49 KB.

## Working rules (all threads)
- Read `CLAUDE.md` (root), then the layer rules that apply: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Exhaustive list of files you own: `.claude/threads/ownership.json` (key `audit-execution`). Check any file with `node .claude/threads/check-ownership.mjs --who <path>`.
- Edit files owned by another thread only for a small, necessary change (one call site, one nav entry, one import). For anything bigger, stop and tell the lead which thread should do it, with the exact change needed.
- Shared hotspots (`frontend/src/lib/api.ts`, `Sidebar.tsx`, `server.js`, `emailService.js`, `NotificationModel`, `auth` middleware) follow the hotspot protocol in `CLAUDE.md`.
- New database changes: write a new migration file (rules in `backend/src/database/CLAUDE.md`); never edit `audito.sql`, never run SQL.
- Finish with the checks in "Definition of done", then hand back a short summary: what changed, files touched (flag any outside your ownership), what you could not verify.

## Definition of done
- Backend change: `node --check` on touched files; `cd backend && npm test` if tests exist for your area.
- Frontend change: `cd frontend && npx tsc --noEmit` and `npm run build` (static export must still succeed).
- Role/entity scoping re-checked on every new or changed endpoint (see Hard rules).
- Ask the `reviewer` agent for an independent read of the diff when the change touches auth, money, access scoping, uploads, or an AI call.
