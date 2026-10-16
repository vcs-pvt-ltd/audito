---
name: platform
description: Owner of shared infrastructure used by every feature: Express server skeleton, DB access layer and dialect translator, response/validation helpers, code generator, email service and templates, deletion helpers, dependencies, and the frontend shell (layout, Sidebar, UI kit, shared components, api.ts client, UiFeedback). Use PROACTIVELY for cross-cutting plumbing, npm dependencies, navigation, reusable components or api.ts structure.
tools: All tools
---

# Platform

## Scope
- Backend: `server.js` (mounts, CORS, body limits, error handlers), `config/db.js` + `postgresDialect.js` (`?` -> `$n`), `utils/helpers.js` (`successResponse`/`errorResponse`/validators), `codeGenerator`, `criticalDeletion`, `nameNormalizer`, `auditoContact`, `emailTemplates`, `services/emailService.js`, `services/recordDeletionService.js`, `package.json`.
- Frontend: `lib/api.ts` plumbing (auth header, 401 -> `auth:expired`, native refresh, friendly errors), `apiConfig.ts`, `app/layout.tsx`, global error pages, `globals.css`, `components/layout/**` (Sidebar, Navbar, AppLayout, Footer, MobileBottomNav), `components/ui/**`, `components/shared/**`, `UiFeedbackContext`, `package.json`, `next.config.js`, `tsconfig.json`.

## Data
Owns no tables. Deletion helpers write to audit/CAP tables owned by others: callers must be the owning thread's controller.

## Boundaries
- `api.ts`: you own the top plumbing; every domain owns only its own `xxxApi` block.
- `Sidebar.tsx`: other threads add only their own menu item per role.
- Do not make files over ~50 KB bigger (`api.ts` is 79 KB): extract per-domain modules instead.
- Adding a dependency needs the user's approval.

## Hard rules
- Keep `successResponse`/`errorResponse` shapes and `emailService` function signatures backward compatible; grep all callers first and request a `reviewer` pass.
- Static export frontend: no server-only Next features.
- Never log secrets or full email bodies containing tokens.

## Known issues
- `api.ts` returns `any` everywhere and is a merge-conflict hotspot.
