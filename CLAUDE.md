# Audito: project router

Multi-tenant audit management SaaS. Organizations (**Company**, **Customer**, **Audit Firm**) model their structure, admins plan audits from checklists, auditors execute them on the web and in an Android app, organization users follow up with corrective action plans (CAPs), auditors train through Learning, the Audito team runs a back-office, and usage is paid with permanent packages plus tokens.

- Backend `backend/`: Express 5, CommonJS, raw SQL on PostgreSQL 18 (`?` placeholders), JWT auth. Rules: `backend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Frontend `frontend/`: Next.js 16 static export, React 19, TypeScript, Tailwind 4. Rules: `frontend/CLAUDE.md`.
- Android auditor app: Capacitor wrapper of the same pages (`frontend/android`, `frontend/scripts/android`).
- External: OpenAI (checklist AI, org setup AI, site scan, landing assistant chat/voice), Sampath Bank gateway, SMTP.
- Roles: `admin` (organization administrator), `auditor`, `organization_user`, `audito_admin` (Audito staff).
- GitHub: `origin` = https://github.com/vcs-pvt-ltd/audito.git; integration branch `Dev` (each task on its own branch, PR into `Dev`), production branch `main` (PR from `Dev` on request).

## Threads (areas of ownership)

Every file belongs to exactly one thread (`.claude/threads/ownership.json`). Each thread has an agent in `.claude/agents/<name>.md` with its scope, data, boundaries and hard rules. Read the agent file before working in that area. Full routing table, workflows and reserved ideas: `.claude/threads/THREADS.md`.

| Thread (agent) | Owns | Typical prompt |
|---|---|---|
| `platform` | server skeleton, db layer, helpers, email service, Sidebar, UI kit, `api.ts` plumbing, dependencies | "new shared component", "add npm package" |
| `migrations` | new DB change files in `backend/src/database/migrations/new/`, baseline, grants, indexes, table map | "add a column", "new table", "data fix" |
| `release` | tests, CI, lint/build, deploy, README, security hardening, PRs to `main` | "set up tests", "rate limiting", "deploy" |
| `accounts` | sign-up, login, tokens, passwords/OTP, registration form, quote registration, authorize middleware | "login fails", "add a role check" |
| `organizations` | entity hierarchy, org tree, cross-organization links, access scope, organization info | "add a Section field", "link a supplier" |
| `workforce` | invite/manage auditors and organization users, scopes, auditor profile | "invite flow", "auditor qualifications" |
| `learning` | trainings, field visits, evaluation papers, My Learning | "evaluation paper", "assign training" |
| `checklist-authoring` | checklist types, questions/options, scoring, Excel import | "question editor", "scoring options" |
| `ai-studio` | OpenAI document-to-draft (checklist AI, org AI setup, site scan), onboarding journey | "AI setup upload", "onboarding step" |
| `audit-scheduling` | create/assign/cancel/compare audits, token quote, auditor rating | "assign audit", "audit list filter" |
| `audit-fieldwork` | auditor execution, answers, evidence, completion, audit report/PDF | "execute screen", "evidence upload" |
| `corrective-actions` | CAPs, follow-up audits, CAP responses/PDF | "CAP status", "follow-up audit" |
| `billing` | package pricing + registration package builder, payments, promos, tokens, limits | "price per department", "token wallet" |
| `insights` | dashboards, notices, notifications, timezone/help settings | "dashboard widget", "notification bell" |
| `staff-console` | Audito admin panel (`audito_admin`) | "admin panel page", "approve payment UI" |
| `marketing-site` | landing page, contact/quote requests, landing AI assistant, privacy page | "landing section", "assistant answer" |
| `android-app` | Android app build, native shell, route allow-list | "APK build", "works in app?" |
| `git-sync` | (process) commits the finished task's files on its task branch, pushes it and opens a PR into `Dev` | runs automatically at the end of every code task |
| `reviewer` | (process) read-only independent review of any change | "review this diff" |

## Working in the Audito Project (Projects view)

The user talks only in the Project's **Overview** session, which coordinates. For every prompt, Overview picks the lead agent (routing below), says the one-line plan, and sends the task to the **working thread** (session) that groups that agent. There are 7 working threads: reuse the open session for that thread, start one only when none exists, and name it exactly as below so the Threads pane stays readable. The agent files in `.claude/agents/` and `ownership.json` stay the per-area rules: a working thread follows the rules of the agent(s) whose files it touches. Bugs go to the working thread that groups the owner of the file (`check-ownership.mjs --who <file>`). Questions that change nothing can be answered in Overview directly.

| Working thread (session name) | Groups these agents |
|---|---|
| GitHub Sync | `git-sync` (remote/auth, branches, PR flow, `.gitignore`, repo hygiene) |
| Platform & Release | `platform`, `release` (build, deploy, docs), `android-app` |
| Database & Migrations | `migrations` |
| Code Review & Security | `reviewer`, `release` (security hardening) |
| QA & Testing | `release` (tests, CI, lint/type checks) |
| Audit Workflow | `organizations`, `workforce`, `checklist-authoring`, `audit-scheduling`, `audit-fieldwork`, `corrective-actions`, `learning`, `insights` |
| Commercial & Onboarding | `accounts`, `billing`, `ai-studio`, `staff-console`, `marketing-site` |

## How to route a prompt

1. Name the **primary thing** the prompt changes (its data table, API route or page). That decides the **lead thread**. Use the keyword table in `THREADS.md` if unsure; `node .claude/threads/check-ownership.mjs --who <file>` tells you the owner of any file.
2. If it also needs changes elsewhere, list **supporting threads** in this order: `migrations` -> backend of the domain thread -> `platform` plumbing (`api.ts`, `Sidebar`, `server.js`) -> frontend of the domain thread -> `android-app` (auditor pages) -> checks -> `reviewer` -> `git-sync`.
3. Say the plan in one line before starting: `Lead: billing. Support: migrations, platform. Review: reviewer. Sync: git-sync.`
4. Each thread edits only files it owns. A thread that needs a bigger change in someone else's area stops and reports the exact change instead of editing. Small tasks can be done directly in the main session following the lead agent's rules; use the agent (subagent) for larger or parallel work.
5. Questions that change nothing (explain, investigate) need no `git-sync`.

## Database changes
Every schema or data change is a new file written by the `migrations` thread in `backend/src/database/migrations/new/YYYYMMDD_short_description.sql`, in the existing style (header comment with why + "Safe to rerun", `public.` qualified, idempotent, `audito_ci` collation, indexes, grants). Nothing is run against a database by Claude: the user applies the file with `psql`.

## GitHub sync (branch per task, PR into Dev)
`origin` = https://github.com/vcs-pvt-ltd/audito.git. `Dev` is the integration branch, `main` is production.
1. Every task that changes files works on **its own branch cut from the latest `Dev`** (`<thread>/<short-task>`, or the worktree branch the app created).
2. At the end, after the definition of done passes, run `git-sync` with the thread name, a one-line summary and the exact list of changed files. It commits only those files, pushes **that branch** to `origin` and gives the user the PR link into `Dev` (`gh pr create --base Dev`, or the compare URL `https://github.com/vcs-pvt-ltd/audito/compare/Dev...<branch>?expand=1` when `gh` is not available).
3. The user (or a reviewer) merges the PR into `Dev`. Nobody pushes straight to `Dev`.
4. `Dev` -> `main` only through a PR the user asks for (`release`, run by Platform & Release).

Never push `main` or `Dev` directly, never force-push, never rewrite pushed history, never commit `.env`, zips, uploads or build output, and leave the user's other uncommitted work alone. If checks failed, do not sync; report instead. The user can say "don't push" for a task to keep the commit local.

## Shared hotspots (many threads touch them)

| File | Rule |
|---|---|
| `frontend/src/lib/api.ts` | Edit only your own `xxxApi` block. Shared plumbing at the top belongs to `platform`. |
| `frontend/src/components/layout/Sidebar.tsx` | Add only your own menu item(s) per role; do not restructure. |
| `backend/src/server.js` | Add only your router `require` + `app.use('/api/...')` line. |
| `backend/src/services/emailService.js` | Add a new function/template; never change existing ones. |
| `NotificationModel`, `accessHelper`, `orgLookup`, `middleware/auth.js`, `TokenWalletModel`, `SubscriptionModel`, `limitsEnforcer` | Used by many threads. Keep signatures backward compatible; grep all callers before changing and ask `reviewer`. |
| `frontend/src/lib/pricing/calculatePackage.ts` <-> `PackagePricingModel.js` | `PRICING_VERSION` and the department rule must match on both sides (billing). |
| `backend/src/database/audito.sql` | Never edit. New schema = new file in `migrations/new/`. |
| Files over ~50 KB (`checklistController`, `onboardingDraftService`, `authController`, `organizationAiSetupController`, `auditController`, `learningController`, `api.ts`, `Sidebar`, `organization/ai-setup/page.tsx`) | Do not make them bigger; extract helpers/components. |

## New idea protocol (the structure grows with the product)

1. **Classify**: (a) extends one existing thread -> that thread leads; (b) touches several -> lead + supporting threads (routing step 2); (c) a **new bounded area**.
2. A new thread is justified only if **all** are true: its own data (tables) or API area, its own pages, a distinct set of rules, and it will be worked on repeatedly. Otherwise extend an existing thread. No threads for one-off tasks or just because a feature is "big".
3. To create one: add it to `.claude/threads/ownership.json` (moving paths out of the old owner), create `.claude/agents/<name>.md` (copy a similar agent), add a row here and in `THREADS.md`, add its tables to `migrations.md`, and run `node .claude/threads/check-ownership.mjs` until it says OK. Tell the user the new thread and why.
4. Reserved future threads and their triggers are in `THREADS.md`. Do not create them early.
5. Every new file must fall under an existing pattern; if the check reports an unowned file, assign it before finishing.

## Definition of done (every thread)

- Backend: `node --check` on touched files; `cd backend && npm test` when tests exist.
- Frontend: `cd frontend && npx tsc --noEmit` and `npm run build`; `npm test` when pricing or other tested code changed.
- New/changed endpoint: `authenticate` + role check + entity scoping + input validation + parameterized SQL.
- New schema: migration file from `migrations`, reviewed; nothing run against a database.
- `node .claude/threads/check-ownership.mjs` reports OK.
- High-risk areas (auth, payments/tokens, access scoping, uploads, AI calls, migrations): `reviewer` pass.
- Then `git-sync` (task branch -> push -> PR into `Dev`).

## Never, in any thread

Never read, print or commit `.env` files or keys. Never run SQL against a database. Never edit applied migrations or `audito.sql`. Never delete files without the user's say-so (dead code is listed in the agents' "Known issues"). Never install a dependency without approval. Never force-push, and never push directly to `main` or `Dev` (task branch + PR only).
