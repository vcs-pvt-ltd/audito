# Audito threads (v2): how it works, routing, workflows, growth

A **thread** is an area of ownership: a set of files, tables and rules with one agent in `.claude/agents/<name>.md`. Every file has exactly one owner (`ownership.json`, checked by `node .claude/threads/check-ownership.mjs`). The cut follows the code: one thread per bounded context that has its own tables, API area and pages.

## The 17 threads (+ reviewer)

| Layer | Thread | One-line scope |
|---|---|---|
| Foundation | `platform` | server skeleton, db layer, helpers, email, layout/Sidebar, UI kit, `api.ts` |
| Foundation | `schema` | migrations, indexes, grants, table ownership map (never runs SQL) |
| Foundation | `release` | tests, CI, deploy, docs, hygiene, security hardening |
| Tenant | `accounts` | sign-up, login, tokens, OTP, quote registration, authorize middleware |
| Tenant | `organizations` | hierarchy, org tree, cross-org links, access scoping, org info |
| Tenant | `workforce` | invite/manage auditors and organization users, scopes, auditor profile |
| Tenant | `learning` | trainings, field visits, evaluation papers, My Learning |
| Audit | `checklist-authoring` | checklist types, questions/options, scoring, Excel import |
| Audit | `ai-studio` | all OpenAI document-to-draft: checklist AI, org AI setup, site scan, onboarding journey |
| Audit | `audit-scheduling` | create/assign/cancel/compare audits, token quote, auditor rating |
| Audit | `audit-fieldwork` | execution, answers, evidence, corrective actions raised, report/PDF |
| Audit | `corrective-actions` | CAPs, responses, follow-up audits, CAP PDF |
| Business | `billing` | packages, subscriptions, payments, promos, tokens, limits |
| Business | `insights` | dashboards, notices, notifications, timezone/help settings |
| Business | `staff-console` | `audito_admin` back-office |
| Business | `marketing-site` | landing, contact/quote requests, landing assistant, privacy page |
| Client | `android-app` | Capacitor app, native shell, route allow-list |
| Review | `reviewer` | read-only independent review (never edits) |

## Routing: keyword -> lead thread

| If the prompt mentions | Lead |
|---|---|
| login, password, OTP, verify email, token expired, role check, register | accounts |
| entity, company/cluster/factory/unit/department/section, supplier, buying office, audit firm branch, org tree, link, who can see | organizations |
| invite, users page, auditor/organization user, scope, qualifications, certificates | workforce |
| training, field visit, evaluation paper, my learning | learning |
| checklist, question, option, scoring, Excel template | checklist-authoring |
| AI generate, AI setup, upload audit sheet, onboarding, site scan, prompt, OpenAI | ai-studio |
| assign audit, schedule, cancel/restore audit, comparison, rate auditor | audit-scheduling |
| execute audit, answer, evidence, complete audit, audit report/PDF | audit-fieldwork |
| CAP, corrective action plan, follow-up audit, CAP report | corrective-actions |
| payment, Sampath, subscription, package price, promo, token, wallet, limit | billing |
| dashboard, chart, KPI, notice, notification, bell, timezone, help | insights |
| admin panel, approve payment, contact messages, privacy policy editor | staff-console |
| landing, hero, pricing section, contact form, assistant, privacy page | marketing-site |
| APK, Android, Capacitor, works in app | android-app |
| new column/table/index, migration | schema |
| tests, CI, deploy, README, rate limiting, lint | release |
| shared component, Sidebar, `api.ts`, npm package, email template | platform |

If the prompt names a screen, find its route under `frontend/src/app`, then `--who <file>` for the owner. If it changes data, the **table owner** (see `schema.md`) is the lead.

## Run order when several threads are involved
`schema` -> backend of the domain thread -> `platform` plumbing (`api.ts`, `Sidebar`) -> frontend of the domain thread -> `reviewer`.

## Workflows that cross threads
- **Onboarding to first audit:** accounts (register) -> billing (package, payment) -> ai-studio (onboarding, AI setup) -> organizations (publishes hierarchy) -> checklist-authoring -> workforce (invite auditors) -> audit-scheduling.
- **Audit lifecycle:** audit-scheduling (assign, reserve tokens via billing) -> audit-fieldwork (execute, evidence, complete) -> corrective-actions (CAP, follow-up audit) -> insights (dashboards, notifications).
- **Payment:** billing (checkout/gateway callback) -> staff-console (manual approval) -> billing (settlement, wallet) -> insights (notification).
- **Cross-organization audit:** organizations (accepted link) -> audit-scheduling -> audit-fieldwork -> billing (link credits).
- **Android auditor flow:** accounts (native token storage) -> audit-fieldwork / corrective-actions / learning / ai-studio pages -> android-app (allow-list, files).

## Sanctioned cross-thread access
- Anyone calls `NotificationModel` (insights), `TokenWalletModel`, `SubscriptionModel`, `limitsEnforcer` (billing), `accessHelper`, `orgLookup` (organizations), `emailService` (platform), and reads `AuditorModel`/`OrganizationUserModel`.
- Writes to a table owned by another thread go through that thread's model, never inline SQL. Existing violations to shrink, not extend: `adminController` (staff-console), `recordDeletionService` (platform), `usersController` count queries, `DashboardModel` reads (allowed, read-only).
- Shared files with split ownership: `checklistController` (AI handlers belong to ai-studio), `CorrectiveActionsViewer` and `components/report/pdfEvidence.ts` (audit-fieldwork, used by corrective-actions).

## Reserved ideas (create a thread only when its trigger happens)
| Idea | Trigger |
|---|---|
| `integrations` (webhooks, public API, ERP/SSO) | first external integration or API key table |
| `reporting` (cross-audit analytics, exports, scheduled reports) | reports leave `audit-fieldwork`/`insights` and get their own tables or pages |
| `i18n` (languages) | second UI language is requested |
| `support-desk` (tickets, in-app help center) | help moves beyond a static page into data |
| `iOS app` (extend `android-app` into `mobile-app`) | an iOS build is requested |

## Growth protocol
A new idea first extends an existing thread. A new thread needs **all** of: own tables or API area, own pages, distinct rules, repeated future work. To add one: entry in `ownership.json` (move paths out of the old owner), new `.claude/agents/<name>.md`, row in the tables above and in `CLAUDE.md`, then run the check until OK.
