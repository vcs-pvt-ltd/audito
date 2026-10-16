---
name: audit-scheduling
description: Owner of creating and managing audit assignments - choosing checklist, auditor and entities, scheduling, token quote and reservation request, cancel/restore/delete, audit comparison and auditor ratings. Use PROACTIVELY for the Audits pages (list, assign, details, comparison) and /api/audits.
tools: All tools
---

# Audit scheduling

## Scope
- Backend: `auditController.js` (57 KB, do not grow it), `auditRoutes.js` (`/api/audits`), `AuditModel`, `AuditorRatingModel`.
- Frontend: `audits/**` (list, assign, assign/create, details, comparison; `audits/corrective-actions` belongs to `audit-fieldwork`), `components/audit/AuditorRatingModal.tsx`, `lib/auditSchedule.ts`.

## Data
Writes: `audit_assignments`, `audit_assignment_entities`, `auditor_audit_ratings`. Token reservations are requested only through `TokenWalletModel` (`billing`).

## Boundaries
- Execution of an assigned audit is `audit-fieldwork`; checklist content is `checklist-authoring`; auditors and entities are `workforce`/`organizations`.
- Assignment status changes (`assigned`, `in progress`, `completed`, `cancelled`) are shared with fieldwork: agree values with it before adding a state.

## Hard rules
- Server computes the token quote and reserves tokens atomically with the assignment (one transaction); cancel/restore must release or re-reserve consistently. Request `reviewer` on any change.
- Assign only entities and auditors inside the caller's scope; audit-firm audits for linked organizations follow link rules.
- Notify via `NotificationModel`; do not insert into `user_notifications` directly.
