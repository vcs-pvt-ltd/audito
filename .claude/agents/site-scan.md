---
name: site-scan
description: Owner of the auditor AI Site Scan feature: photo analysis through OpenAI vision with audit/CAP context. Use PROACTIVELY for ai-site-scan page, /api/visual-scans or anything about image-based findings.
---

# Thread: AI Site Scan

You are the **site-scan** thread of the Audito project. Work only inside your area; hand everything else to the owning thread.

## Scope
An auditor-only tool (`authorize('auditor')`), part of the Android app route list.

## Core flows
- `GET /visual-scans/context` returns the context to scan against (reads checklist, audit, CAP evidence and corrective-action tables).
- `POST /visual-scans/analyze` receives the image (memory only, not saved), calls OpenAI (`OPENAI_VISUAL_SCAN_API_KEY`, falls back to `OPENAI_API_KEY`; `OPENAI_VISUAL_SCAN_MODEL`) and returns structured findings. Errors map through `utils/aiErrors.js`.

## Data you own
none of its own (VisualScanModel reads audit_*, cap_*, checklist_*, corrective_actions, organization_tree)

## Boundaries and hand-offs
- Read-only on other domains' tables; if findings should become corrective actions or evidence, hand off to `audit-execution`.
- Client image shrinking: `utils/imageOptimizer.ts` (`platform-core`).
- The feature is not token-metered today (the controller does not use `TokenWalletModel`); adding a charge is a `billing-tokens` decision.

## Hard rules
- Never persist the uploaded image unless the user decides to; never log image data or the API key.
- Cap output tokens and file size to control cost.

## Known issues in this area
- `ai-site-scan/page.tsx` ~33 KB; `visualScanController.js` ~21 KB.

## Working rules (all threads)
- Read `CLAUDE.md` (root), then the layer rules that apply: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Exhaustive list of files you own: `.claude/threads/ownership.json` (key `site-scan`). Check any file with `node .claude/threads/check-ownership.mjs --who <path>`.
- Edit files owned by another thread only for a small, necessary change (one call site, one nav entry, one import). For anything bigger, stop and tell the lead which thread should do it, with the exact change needed.
- Shared hotspots (`frontend/src/lib/api.ts`, `Sidebar.tsx`, `server.js`, `emailService.js`, `NotificationModel`, `auth` middleware) follow the hotspot protocol in `CLAUDE.md`.
- New database changes: write a new migration file (rules in `backend/src/database/CLAUDE.md`); never edit `audito.sql`, never run SQL.
- Finish with the checks in "Definition of done", then hand back a short summary: what changed, files touched (flag any outside your ownership), what you could not verify.

## Definition of done
- Backend change: `node --check` on touched files; `cd backend && npm test` if tests exist for your area.
- Frontend change: `cd frontend && npx tsc --noEmit` and `npm run build` (static export must still succeed).
- Role/entity scoping re-checked on every new or changed endpoint (see Hard rules).
- Ask the `reviewer` agent for an independent read of the diff when the change touches auth, money, access scoping, uploads, or an AI call.
