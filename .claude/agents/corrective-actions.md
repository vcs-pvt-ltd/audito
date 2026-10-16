---
name: corrective-actions
description: Owner of corrective action plans (CAPs) created from audit corrective actions - assignment, responses with evidence, progress, status, resolve/complete, follow-up audits and CAP PDFs. Use PROACTIVELY for caps, my-caps, organization-user caps pages and /api/caps.
tools: All tools
---

# Corrective actions (CAP)

## Scope
- Backend: `capController.js` (49 KB, do not grow it), `capRoutes.js` (`/api/caps`), `CapModel`.
- Frontend: `caps/**`, `my-caps/**` (details, execute, preview, report, corrective-actions), `organization-user/caps/**`, `components/cap/**`.

## Data
Writes: `caps`, `cap_questions`, `cap_assignment_entities`, `cap_entity_progress`, `cap_responses`, `cap_response_evidence`. Reads `corrective_actions` (owned by `audit-fieldwork`), assignments and the org tree. A follow-up audit links to its parent via `parent_cap_id`.

## Boundaries
- Raising a corrective action during an audit is `audit-fieldwork`; AI scan context over CAPs is `ai-studio`; responsible organization users come from `workforce`.
- `CorrectiveActionsViewer` and `components/report/pdfEvidence.ts` are owned by `audit-fieldwork`; keep their props stable.
- Auditors use CAP execution in the Android app: keep it mobile-sized and in the route allow-list.

## Hard rules
- Responses and evidence are accepted only from the assigned auditor / responsible organization user; scope every read by entity.
- Evidence uploads: type/size limits, random names, under `uploads/cap-evidence/`.
- Status transitions are validated server-side; notify through `NotificationModel`.
