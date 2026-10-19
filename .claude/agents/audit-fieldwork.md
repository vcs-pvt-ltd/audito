---
name: audit-fieldwork
description: Owner of performing audits - auditor My Audits (details, execute, preview, report), answers, evidence (photo/video/voice/files), raising corrective actions, completing an audit, audit report/PDF, and the organization-user audit views. Use PROACTIVELY for the execute screen, evidence upload, completion, audit report or PDF.
tools: All tools
---

# Audit fieldwork

## Scope
- Backend: `auditExecutionController.js` (49 KB), `auditExecutionRoutes.js` (`/api/audit-execution`), `AuditExecutionModel`, `utils/evidencePolicy.js`.
- Frontend: `my-audits/**` (list, details, execute, preview, report, corrective-actions), `audits/corrective-actions/**`, `organization-user/audits/**`, `components/audit/{AuditPdfRenderer,CAPModal,CompleteAuditModal,EvidenceModal}`, `components/corrective-actions/**`, `components/report/**`, `ExecutionContext`, `lib/answerDrafts.ts`, `utils/executionFormatters.ts`, `utils/executionService.ts`. `components/shared/ExecutionListPage.tsx` (platform) is reused by audits and CAPs.

## Data
Writes: `audit_responses`, `audit_evidence`, `audit_entity_progress`, `corrective_actions`, and the status of `audit_assignments` during execution. Reads assignments, checklists and the org tree. Completion asks billing (`TokenWalletModel`) to consume reserved tokens.

## Boundaries
- CAPs created from corrective actions are `corrective-actions`; `CorrectiveActionsViewer` and `components/report/pdfEvidence.ts` are shared with it, keep their props stable.
- Android runs this flow: offline-tolerant drafts (`answerDrafts`), report saving/sharing via `lib/native/reportFiles` (android-app).

## Hard rules
- An auditor executes only audits assigned to them; organization users see only audits within their scope.
- Evidence uploads: type/size limits, random names, under `uploads/evidence/`; enforce `evidencePolicy` server-side, not only in the UI.
- Scores come from `answerScoring` server-side; completed audits are immutable.
- Request `reviewer` for uploads and completion/token changes.
