# Audito: project router

Multi-tenant audit management SaaS. Organizations (**Company**, **Customer**, **Audit Firm**) model their structure, admins plan audits from checklists, auditors execute them on the web and in an Android app, organization users follow up with corrective action plans (CAPs), the Audito team runs a back-office, and usage is paid with subscriptions and tokens.

- Backend `backend/`: Express 5, CommonJS, raw SQL on PostgreSQL 18 (`?` placeholders), JWT auth. Rules: `backend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Frontend `frontend/`: Next.js 16 static export, React 19, TypeScript, Tailwind 4. Rules: `frontend/CLAUDE.md`.
- Android auditor app: Capacitor wrapper of the same pages (`frontend/android`, `frontend/scripts/android`).
- External: OpenAI (checklist AI, org setup AI, site scan, landing assistant), Sampath Bank gateway, SMTP.
- Roles: `admin` (organization administrator), `auditor`, `organization_user`, `audito_admin` (Audito staff).

## Threads (areas of ownership)

Every file belongs to exactly one thread (`.claude/threads/ownership.json`). Each thread has an agent in `.claude/agents/<name>.md` with its scope, flows, tables, boundaries and hard rules. Read the agent file before working in that area.

| Thread (agent) | Owns | Typical prompt |
|---|---|---|
| `platform` | server skeleton, db layer, helpers, email service, Sidebar, UI kit, `api.ts`, dependencies | "new shared component", "add npm package" |
| `schema` | migrations, indexes, grants, table ownership map | "add a column", "review migration" |
| `release` | tests, CI, lint/build, deploy, README, security hardening | "set up tests", "rate limiting", "deploy" |
| `accounts` | sign-up, login, tokens, passwords/OTP, quote registration, authorize middleware, account profile | "login fails", "add a role check", "registration form" |
| `organizations` | entity hierarchy, org tree, cross-organization links, access scope, organization info | "add a Section", "link a supplier", "who can see this entity" |
| `workforce` | invite/manage auditors and organization users, scopes, auditor profile | "invite flow", "users page", "auditor qualifications" |
| `learning` | trainings, field visits, evaluation papers, My Learning | "evaluation paper", "assign training" |
| `checklist-authoring` | checklist types, questions/options, scoring, Excel import | "question editor", "scoring options" |
| `ai-studio` | all OpenAI document-to-draft (checklist AI, org AI setup, site scan), onboarding journey | "AI setup upload", "onboarding step", "scan result format" |
| `audit-scheduling` | create/assign/cancel/compare audits, token quote, auditor rating | "assign audit", "audit list filter" |
| `audit-fieldwork` | auditor execution, answers, evidence, completion, audit report/PDF | "execute screen", "evidence upload", "report PDF" |
| `corrective-actions` | CAPs, follow-up audits, CAP responses/PDF | "CAP status", "follow-up audit" |
| `billing` | packages, subscriptions, payments, promo, tokens, limits | "payment callback", "token wallet", "promo code" |
| `insights` | dashboards, notices, notifications, timezone/help settings | "dashboard widget", "notification bell" |
| `staff-console` | Audito admin panel (`audito_admin`) | "admin panel page", "approve payment UI" |
| `marketing-site` | landing page, contact/quote requests, landing AI assistant, privacy page | "landing section", "assistant answer" |
| `android-app` | Android app build, native shell, route allow-list | "APK build", "works in app?" |
| `reviewer` | read-only independent review of any change (never edits) | "review this diff" |

## How to route a prompt

1. Name the **primary thing** the prompt changes (its data table, API route or page). That decides the **lead thread**. Use `.claude/threads/THREADS.md` (keyword table and workflows) if unsure; `node .claude/threads/check-ownership.mjs --who <file>` tells you the owner of any file.
2. If it also needs changes elsewhere, list **supporting threads** and run them in this order: `schema` -> backend of the domain thread -> `platform` plumbing (`api.ts`, `Sidebar`) -> frontend of the domain thread -> `reviewer`.
3. Say the plan in one line before starting: `Lead: billing. Support: database, platform. Review: reviewer.`
4. Hand each thread only the files it owns. A thread that finds it needs a bigger change in someone else's area stops and reports the exact change, instead of editing.

## Shared hotspots (many threads touch them; follow these)

| File | Rule |
|---|---|
| `frontend/src/lib/api.ts` | Edit only your own `xxxApi` block (`authApi`, `auditApi`, `capApi`, ...). Shared plumbing at the top belongs to `platform`. |
| `frontend/src/components/layout/Sidebar.tsx` | Add only your own menu item(s) per role; do not restructure. |
| `backend/src/server.js` | Add only your router `require` + `app.use('/api/...')` line. |
| `backend/src/services/emailService.js` | Add a new function/template; never change existing ones. |
| `NotificationModel`, `accessHelper`, `orgLookup`, `middleware/auth.js`, `TokenWalletModel`, `SubscriptionModel` | Used by many threads. Keep signatures backward compatible; list all callers (`grep -rn`) before changing and ask `reviewer`. |
| `backend/src/database/audito.sql` | Never edit. New schema = new file in `migrations/new/`. |
| Files over ~50 KB (`authController`, `checklistController`, `adminController`, `api.ts`, `Sidebar`, `ai-setup/page.tsx`, ...) | Do not make them bigger; extract helpers/components. |

## New idea protocol (the thread structure grows with the product)

1. **Classify**: (a) extends one existing thread -> that thread leads; (b) touches several -> lead + supporting threads (see routing step 2); (c) a **new bounded area**.
2. A new thread is justified only if **all** are true: it has its own data (tables) or its own API area, its own pages, a distinct set of rules, and it will be worked on repeatedly. Otherwise extend an existing thread. Do not create a thread for one-off tasks or just because a feature is "big".
3. To create one: add an entry to `.claude/threads/ownership.json` (with its paths, moving them out of the old owner), create `.claude/agents/<name>.md` (copy a similar agent), add a row to the table above and to `THREADS.md`, and run `node .claude/threads/check-ownership.mjs` until it says OK.
4. Possible future threads and their triggers are listed in `.claude/threads/THREADS.md` ("Reserved ideas"). Do not create them early.
5. Every new file added to the repo must fall under an existing pattern; if the check reports an unowned file, assign it before finishing.

## Definition of done (every thread)

- Backend: `node --check` on touched files; `cd backend && npm test` when tests exist.
- Frontend: `cd frontend && npx tsc --noEmit` and `npm run build`.
- New/changed endpoint: `authenticate` + role check + entity scoping + input validation + parameterized SQL.
- New schema: migration file reviewed against `backend/src/database/CLAUDE.md`; nothing run against a database by the agent.
- `node .claude/threads/check-ownership.mjs` reports OK.
- High-risk areas (auth, payments/tokens, access scoping, uploads, AI calls, migrations): `reviewer` pass.

## Never, in any thread

Never read, print or commit `.env` files or keys. Never run SQL against a database. Never edit applied migrations or `audito.sql`. Never delete files without the user's say-so (dead code is listed in the agents' "Known issues"). Never install a dependency without approval.
