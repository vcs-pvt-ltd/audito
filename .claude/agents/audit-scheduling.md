---
name: audit-scheduling
description: Owner of planning audits - create/assign audits to auditors and entities, token quote and reservation request, cancel/restore, audit list and details for admins, audit comparison and auditor rating. Use PROACTIVELY for assign audit, audit list filters, scheduling, comparison or rating auditors.
tools: All tools
---

# Audit scheduling

## Scope
- Backend: `auditController.js` (58 KB, do not grow it), `auditRoutes.js` (`/api/audits`), `AuditModel`, `AuditorRatingModel`.
- Frontend: `audits/**` (list, assign, assign/create, details, comparison; `audits/corrective-actions` is audit-fieldwork), `components/audit/AuditorRatingModal.tsx`, `lib/auditSchedule.ts`.

## Data
Writes: `audit_assignments`, `audit_assignment_entities`, `auditor_audit_ratings`. Token reservations (and the `audit_question_instances` snapshot) go only through `TokenWalletModel` (billing). Deletion goes through `recordDeletionService` (platform).

## Boundaries
- Execution of an assigned audit is `audit-fieldwork`; checklist content is `checklist-authoring`; auditors and entities are `workforce`/`organizations`.
- Assignment status values are shared with fieldwork and CAPs: agree with them before adding a state.

## Hard rules
- The server computes the token quote and reserves tokens atomically with the assignment (one transaction); cancel/restore releases or re-reserves consistently. Request `reviewer` on any change.
- Assign only entities and auditors inside the caller's scope; cross-organization audits follow link rules.
- Notify via `NotificationModel`; never insert into `user_notifications` directly.
