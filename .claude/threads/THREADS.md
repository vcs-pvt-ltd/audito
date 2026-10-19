# Audito threads (v3): how it works, routing, workflows, growth

A **thread** is an area of ownership: a set of files, tables and rules with one agent in `.claude/agents/<name>.md`. Every file has exactly one owner (`ownership.json`, checked by `node .claude/threads/check-ownership.mjs`). The cut follows the code: one thread per bounded context that has its own tables, API area and pages. Two **process threads** own no files: `git-sync` (commit + push after every finished task) and `reviewer` (read-only review).

## The threads

| Layer | Thread | One-line scope |
|---|---|---|
| Foundation | `platform` | server skeleton, db layer, helpers, email, layout/Sidebar, UI kit, `api.ts` plumbing, dependencies |
| Foundation | `migrations` | every DB change as a file in `backend/src/database/migrations/new/`, table ownership map (never runs SQL) |
| Foundation | `release` | tests, CI, deploy, docs, hygiene, security hardening, PRs to `main` |
| Tenant | `accounts` | sign-up, login, tokens, OTP, registration form, quote registration, authorize middleware |
| Tenant | `organizations` | hierarchy, org tree, cross-org links, access scoping, org info |
| Tenant | `workforce` | invite/manage auditors and organization users, scopes, auditor profile |
| Tenant | `learning` | trainings, field visits, evaluation papers, My Learning |
| Audit | `checklist-authoring` | checklist types, questions/options, scoring, Excel import |
| Audit | `ai-studio` | OpenAI document-to-draft: checklist AI, org AI setup, onboarding journey, site scan |
| Audit | `audit-scheduling` | create/assign/cancel/compare audits, token quote, auditor rating |
| Audit | `audit-fieldwork` | execution, answers, evidence, corrective actions raised, report/PDF |
| Audit | `corrective-actions` | CAPs, responses, follow-up audits, CAP PDF |
| Business | `billing` | package pricing + registration package builder, payments, promos, tokens, limits |
| Business | `insights` | dashboards, notices, notifications, timezone/help settings |
| Business | `staff-console` | `audito_admin` back-office |
| Business | `marketing-site` | landing, contact/quote requests, landing assistant, privacy page |
| Client | `android-app` | Capacitor app, native shell, route allow-list |
| Process | `git-sync` | commit exactly the task's files and push the current branch to GitHub |
| Process | `reviewer` | read-only independent review (never edits) |

## Routing: keyword -> lead thread

| If the prompt mentions | Lead |
|---|---|
| login, password, OTP, verify email, token expired, role check, register form, quote registration, switch account | accounts |
| entity, company/cluster/factory/unit/department/section, customer/buying office/supplier, audit firm/branch, org tree, link, who can see | organizations |
| invite, users page, auditor/organization user, scope, qualifications, certificates, auditor profile | workforce |
| training, field visit, evaluation paper, my learning | learning |
| checklist, question, option, scoring, Excel template | checklist-authoring |
| AI generate, AI setup, upload audit sheet, onboarding, site scan, prompt, OpenAI | ai-studio |
| assign audit, schedule, cancel/restore audit, comparison, rate auditor | audit-scheduling |
| execute audit, answer, evidence, complete audit, audit report/PDF | audit-fieldwork |
| CAP, corrective action plan, follow-up audit, CAP report | corrective-actions |
| package, price, pricing version, package builder, payment, Sampath, promo, token, wallet, limit | billing |
| dashboard, chart, KPI, notice, notification, bell, timezone, help | insights |
| admin panel, approve payment, contact messages, quote review, privacy policy editor | staff-console |
| landing, hero, features, pricing section, contact form, assistant, privacy page | marketing-site |
| APK, Android, Capacitor, works in app | android-app |
| new column/table/index, migration, data fix, backfill | migrations |
| tests, CI, deploy, README, rate limiting, lint, PR to main | release |
| shared component, Sidebar, `api.ts` plumbing, npm package, email template | platform |
| commit, push, sync GitHub | git-sync |

If the prompt names a screen, find its route under `frontend/src/app`, then `--who <file>` for the owner. If it changes data, the **table owner** (see `migrations.md`) is the lead.

## Run order when several threads are involved
`migrations` -> backend of the domain thread -> `platform` plumbing (`api.ts`, `Sidebar`, `server.js`) -> frontend of the domain thread -> `android-app` (if an auditor page) -> checks -> `reviewer` -> `git-sync`.

## Workflows that cross threads
- **Sign-up to first audit:** marketing-site (landing, pricing) -> billing (`register/start` package builder) -> accounts (`register`, verify email) -> billing (payment, approval via staff-console) -> ai-studio (onboarding, AI setup) -> organizations (published hierarchy) -> checklist-authoring -> workforce (invite auditors) -> audit-scheduling.
- **Quoted account:** marketing-site (quote request) -> staff-console (review, send link) -> accounts (`register/quote`) -> billing (quoted_account payment).
- **Audit lifecycle:** audit-scheduling (assign, reserve tokens via billing) -> audit-fieldwork (execute, evidence, complete, consume tokens) -> corrective-actions (CAP, follow-up audit) -> insights (dashboards, notifications).
- **Payment:** billing (checkout / gateway callback) -> staff-console (manual approval) -> billing (settlement, wallet) -> insights (notification).
- **Cross-organization audit:** organizations (accepted link) -> audit-scheduling -> audit-fieldwork.
- **Android auditor flow:** accounts (native token storage) -> audit-fieldwork / corrective-actions / learning / ai-studio / insights pages -> android-app (allow-list, files).
- **Schema change:** migrations (file) -> owning thread (model) -> reviewer -> git-sync (commit says the user must apply the file).

## Sanctioned cross-thread access
- Anyone calls `NotificationModel` (insights), `TokenWalletModel`, `SubscriptionModel`, `limitsEnforcer` (billing), `accessHelper`, `orgLookup` (organizations), `emailService`, `codeGenerator`, `recordDeletionService` (platform), and reads `AuditorModel`/`OrganizationUserModel` (workforce).
- Writes to a table owned by another thread go through that thread's model, never inline SQL. Existing violations to shrink, not extend: `adminController` (staff-console), `organizationAiSetupController` (writes org tables), `authController` (writes `auditors`/`organization_users`), `recordDeletionService`, `DashboardModel`/`VisualScanModel` reads (allowed, read-only).
- Shared files with split ownership: `checklistController` (AI handlers belong to ai-studio), `CorrectiveActionsViewer` and `components/report/pdfEvidence.ts` (audit-fieldwork, used by corrective-actions), `components/registration/**` (billing, used by accounts' `register/page.tsx` and marketing-site's `PricingSection`).

## Reserved ideas (create a thread only when its trigger happens)
| Idea | Trigger |
|---|---|
| `integrations` (webhooks, public API, ERP/SSO) | first external integration or API-key table |
| `reporting` (cross-audit analytics, exports, scheduled reports) | reports get their own tables or pages beyond audit/CAP PDFs and dashboards |
| `scheduler` (background jobs: reminders, expiries, cleanups) | first recurring job is actually wired (today none runs; `subscriptionReminderService` is unused) |
| `i18n` (languages) | a second UI language is requested |
| `support-desk` (tickets, in-app help center) | help moves beyond a static page into data |
| `mobile-app` (extend `android-app` to iOS) | an iOS build is requested: rename the thread, do not add a parallel one |

## Growth protocol
A new idea first extends an existing thread. A new thread needs **all** of: own tables or API area, own pages, distinct rules, repeated future work. To add one: entry in `ownership.json` (move paths out of the old owner), new `.claude/agents/<name>.md` (copy a similar agent), row in the tables above and in `CLAUDE.md`, table rows in `migrations.md`, then run the check until OK.
