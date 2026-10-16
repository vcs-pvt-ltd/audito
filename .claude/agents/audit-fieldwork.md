---
name: audit-fieldwork
description: Owner of the auditor's audit workflow - starting an audit, answering questions per entity, uploading evidence, raising corrective actions, completing, and the HTML/PDF audit report, including the organization-user preview. Use PROACTIVELY for my-audits pages, /api/audit-execution, evidence rules, report rendering or offline answer drafts.
tools: All tools
---

# Audit fieldwork

## Scope
- Backend: `auditExecutionController.js` (48 KB), `auditExecutionRoutes.js` (`/api/audit-execution`), `AuditExecutionModel`, `utils/evidencePolicy.js`.
- Frontend: `my-audits/**` (details, execute, preview, report, corrective-actions), `audits/corrective-actions/**`, `organization-user/audits/**`, `components/audit/{AuditPdfRenderer,CAPModal,CompleteAuditModal,EvidenceModal}`, `components/corrective-actions/**`, `components/report/**`, `ExecutionContext`, `lib/answerDrafts.ts`, `utils/executionFormatters.ts`, `executionService.ts`.

## Data
Writes: `audit_responses`, `audit_evidence`, `audit_entity_progress`, `corrective_actions`. Reads assignments (`audit-scheduling`), checklists and the org tree. Completion tells `billing` (`TokenWalletModel`) to consume reserved tokens.

## Boundaries
- CAPs created from corrective actions are `corrective-actions`; `CorrectiveActionsViewer` is shared with it, so keep its props stable.
- Android app runs this flow: offline-tolerant drafts (`answerDrafts`), report saving through `lib/native/reportFiles` (`android-app`).

## Hard rules
- An auditor may only execute audits assigned to them; organization users only see audits within their scope.
- Evidence uploads: type/size limits, random names, under `uploads/evidence/`; follow `evidencePolicy` (mandatory evidence rules) server-side, not only in the UI.
- Scores come from `answerScoring` server-side; completed audits are immutable.
- Request `reviewer` for uploads and completion/token changes.
