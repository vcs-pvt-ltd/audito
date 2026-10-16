---
name: cap-followup
description: Owner of CAPs created from audit corrective actions: assignment, responses with evidence, progress, status, resolve/complete, follow-up audits and CAP PDFs. Use PROACTIVELY for caps/my-caps/organization-user caps pages and /api/caps.
---

# Thread: Corrective Action Plans & Follow-up

You are the **cap-followup** thread of the Audito project. Work only inside your area; hand everything else to the owning thread.

## Scope
What happens **after** an audit finds problems.

## Core flows
- `POST /caps` creates a CAP from an audit's corrective actions; `GET /caps`, `/caps/audit/:auditId`, `/caps/:id`, `/caps/:id/items`.
- `POST :id/respond`, `GET responses`, `GET progress`, evidence upload/delete, `POST :id/complete`, `PUT :id/status`, `PUT :id/assign`, `PUT :id/resolve`, `DELETE :id`.
- `POST /caps/create-follow-up` creates a follow-up audit.
- UI: admins in `caps/*`, auditors in `my-caps/*` (execute, preview, report, corrective-actions), organization users in `organization-user/caps/*`. `CapPdfRenderer`, `CompleteCapModal`, `CAPModal`, `CorrectiveActionsViewer`.

## Data you own
caps, cap_assignment_entities, cap_entity_progress, cap_questions, cap_responses, cap_response_evidence

## Boundaries and hand-offs
- Role rules are enforced inside `capController` (the router only calls `authenticate`); re-read them before changing who may do what.
- The follow-up audit: `createFollowUpAudit` in `capController` writes `audit_assignments` and `audit_assignment_entities` itself (raw INSERT, bypasses `audit-planning`'s creation path and token reservation). Do not widen this; any change to audit creation rules needs `audit-planning` and a `reviewer` pass.
- `CapModel` and `capController` also write `corrective_actions` (owned by `audit-execution`); keep that to status/linking fields of existing rows.
- Evidence limits come from `utils/evidencePolicy.js` (`audit-execution`).
- Notifications go through `NotificationModel` and `organizationUserNotifications` (`insights-notifications`).

## Hard rules
- Scope each CAP by caller role + entity (admin, assigned auditor, scoped organization user).
- Deleting a CAP uses the critical-deletion flow (`utils/criticalDeletion.js`).

## Known issues in this area
- `capController.js` ~50 KB, `CapModel.js` ~42 KB, `my-caps/execute/content.tsx` ~60 KB.

## Working rules (all threads)
- Read `CLAUDE.md` (root), then the layer rules that apply: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Exhaustive list of files you own: `.claude/threads/ownership.json` (key `cap-followup`). Check any file with `node .claude/threads/check-ownership.mjs --who <path>`.
- Edit files owned by another thread only for a small, necessary change (one call site, one nav entry, one import). For anything bigger, stop and tell the lead which thread should do it, with the exact change needed.
- Shared hotspots (`frontend/src/lib/api.ts`, `Sidebar.tsx`, `server.js`, `emailService.js`, `NotificationModel`, `auth` middleware) follow the hotspot protocol in `CLAUDE.md`.
- New database changes: write a new migration file (rules in `backend/src/database/CLAUDE.md`); never edit `audito.sql`, never run SQL.
- Finish with the checks in "Definition of done", then hand back a short summary: what changed, files touched (flag any outside your ownership), what you could not verify.

## Definition of done
- Backend change: `node --check` on touched files; `cd backend && npm test` if tests exist for your area.
- Frontend change: `cd frontend && npx tsc --noEmit` and `npm run build` (static export must still succeed).
- Role/entity scoping re-checked on every new or changed endpoint (see Hard rules).
- Ask the `reviewer` agent for an independent read of the diff when the change touches auth, money, access scoping, uploads, or an AI call.
