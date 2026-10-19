---
name: platform
description: Owner of shared infrastructure used by every feature - Express server skeleton, DB access layer and dialect translator, response/validation helpers, code generator, email service and templates, deletion helpers, npm dependencies, and the frontend shell (root layout, Sidebar, Navbar, MobileBottomNav, UI kit, shared components, api.ts plumbing, UiFeedback, global styles). Use PROACTIVELY for cross-cutting plumbing, dependencies, navigation, reusable components or api.ts structure.
tools: All tools
---

# Platform

## Scope
- Backend: `server.js` (router mounts, CORS, 1 MB body limits, `/uploads` static, 404/error handlers), `config/db.js` (pg pool, `db.query` returning `[rows]`, `getConnection` transactions, startup privilege check) + `config/postgresDialect.js` (`?` -> `$n`, MySQL-isms translated), `utils/helpers.js` (`successResponse`/`errorResponse`/validators), `codeGenerator.js` (public codes `PREFIX-00001`), `criticalDeletion.js`, `nameNormalizer.js`, `auditoContact.js`, `emailTemplates.js`, `services/emailService.js` (nodemailer/SMTP), `services/recordDeletionService.js`, `backend/package.json`.
- Frontend: `lib/api.ts` top plumbing (auth header, 401 -> `auth:expired`, native token refresh, friendly network errors), `lib/apiConfig.ts`, `lib/responseText.ts`, `lib/auditoContact.ts`, `app/layout.tsx`, `error.tsx`, `global-error.tsx`, `globals.css` (Tailwind 4 theme tokens), `components/layout/**` (AppLayout, Sidebar, Navbar, Footer, MobileBottomNav; `SubscriptionBanner` is billing), `components/ui/**` (Button, IconButton, Input, Modal, Table), `components/shared/**`, `CriticalDeleteModal`, `UiFeedbackContext`, `types/**`, `utils/imageOptimizer.ts`, `frontend/package.json`, `next.config.js`, `postcss.config.js`, `tsconfig.json`, shared logos/images.

## Data
Owns no tables. `recordDeletionService` deletes audit/CAP/notification rows owned by others; it is called only from the owning controllers (`auditController`, `capController`).

## Boundaries
- `api.ts` (81 KB): you own the plumbing at the top; each domain owns its own `xxxApi` block (`authApi`, `structureApi`, `orgTreeApi`, `organizationAiSetupApi`, `visualScanApi`, `linksApi`, `usersApi`, `checklistApi`, `auditApi`, `dashboardApi`, `auditExecutionApi`, `capApi`, `countriesApi`, `timezonesApi`, `settingsApi`, `noticeApi`, `auditorProfileApi`, `learningApi`, `myLearningApi`, `landingApi`, `packagePricingApi`, `paymentApi`, `tokenApi`, `adminApi`).
- `Sidebar.tsx` (52 KB): other threads add only their own menu item per role.
- `server.js`: a new area adds one `require` + one `app.use('/api/...')` line.
- New dependencies need the user's approval.

## Hard rules
- Keep `successResponse`/`errorResponse` shapes, `db` API and `emailService` function signatures backward compatible; grep all callers first and request a `reviewer` pass.
- Static export frontend: no server actions, route handlers, middleware or runtime SSR.
- Never log secrets or email bodies containing tokens/OTPs.
- Do not make files over ~50 KB bigger (`api.ts`, `Sidebar.tsx`): extract modules instead.

## Known issues
- `api.ts` returns `any` almost everywhere and is a merge-conflict hotspot; splitting it into per-domain files is a good future refactor (ask first).
- `codeGenerator.generateCode` uses MAX()+1 (race-prone under concurrency) and MySQL backtick/`UNSIGNED` syntax handled by the dialect translator.
