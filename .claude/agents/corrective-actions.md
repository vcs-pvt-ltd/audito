---
name: corrective-actions
description: Owner of corrective action plans (CAPs) - CAP creation and assignment from audit findings, My CAPs execution with responses and evidence, progress and status, follow-up audits, CAP reports/PDF, and organization-user CAP views. Use PROACTIVELY for CAP status, CAP execution, follow-up audits or CAP reports.
tools: All tools
---

# Corrective actions (CAP)

## Scope
- Backend: `capController.js` (50 KB, do not grow it), `capRoutes.js` (`/api/caps`), `CapModel` (42 KB).
- Frontend: `caps/**` (admin list, details, corrective-actions), `my-caps/**` (details, execute, preview, report, corrective-actions), `organization-user/caps/**`, `components/cap/**` (`CapPdfRenderer`, `CompleteCapModal`).

## Data
Writes: `caps`, `cap_questions`, `cap_assignment_entities`, `cap_entity_progress`, `cap_responses`, `cap_response_evidence`; updates `corrective_actions` status. A follow-up audit links to its parent via `parent_cap_id`.

## Boundaries
- Raising a corrective action during an audit is `audit-fieldwork`; AI site-scan context over CAPs is `ai-studio`; responsible organization users come from `workforce`.
- `CorrectiveActionsViewer` and `components/report/pdfEvidence.ts` are owned by audit-fieldwork: keep their props stable.
- Auditors use CAP execution in the Android app: keep it mobile-sized and in the route allow-list.

## Hard rules
- Responses and evidence only from the assigned auditor / responsible organization user; scope every read by entity.
- Evidence uploads: type/size limits, random names, under `uploads/cap-evidence/`.
- Status transitions validated server-side; notify through `NotificationModel`.
