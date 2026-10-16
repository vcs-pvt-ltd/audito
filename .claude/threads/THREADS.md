# Audito threads: how it works, workflows, routing, growth

## What a "thread" is here

A thread is an **area of ownership**, not a running process. It consists of three things that live in the repo:

1. an entry in `ownership.json` (which files belong to it),
2. an agent file `.claude/agents/<name>.md` (what the area is, its flows, tables, boundaries, rules, known issues),
3. a row in the root `CLAUDE.md` routing table.

Agents do not remember earlier sessions; **the files are the memory**. Keep them accurate and every new session, whether it is a subagent or a fresh Claude Code window, starts with the same knowledge.

Why threads are vertical (database + API + UI of one feature) and not horizontal (frontend agent, backend agent): almost every real request crosses layers. Layer-only agents hand work back and forth constantly. The layer rules already exist in `backend/CLAUDE.md`, `frontend/CLAUDE.md` and `backend/src/database/CLAUDE.md` and apply to all threads.

## Using threads in Claude Code

- **Automatic**: describe the task. Claude matches it to an agent description and delegates, or you name it: "Use the billing-tokens agent to ...".
- **Parallel work**: only for threads whose files do not overlap (check `ownership.json`). Give each its own git branch/worktree and its own Claude Code window, and start the window with "Act as the `<name>` thread: read `.claude/agents/<name>.md` first." Never run two threads on the same file at once.
- **After the work**: ask `reviewer` for an independent read of the diff when the change touches auth, money, access scoping, uploads, AI or migrations.

## Cross-thread workflows (who does what, in order)

**W1 Sign-up to a working workspace (Company package)**
Precondition: a privacy policy must be **published** (`backoffice-admin` -> `public-site` model), otherwise `/auth/register` answers 503.
`public-site` (pricing, contact) -> `identity-access` (register, verify email) -> `billing-tokens` (checkout, settlement, subscription + token grant; in manual mode `backoffice-admin` approves) -> `setup-onboarding` (journey, AI or manual) -> `org-structure` + `people-users` + `checklists` + `audit-planning` (the journey steps).

**W2 Quote flow (Customer and Audit Firm accounts)**
`public-site` (`/landing/contact-review`) -> `backoffice-admin` (quote + email with one-time link) -> `identity-access` (`/auth/quote-registration`) -> `billing-tokens` (payment).

**W3 Audit lifecycle**
`checklists` -> `audit-planning` (assign, token quote/reservation via `billing-tokens`) -> `audit-execution` (start, answer, evidence, complete, report) -> corrective actions -> `cap-followup` (CAP, responses, resolve) -> optional follow-up audit back in `audit-planning` -> rating by admin (`audit-planning`). Notifications at each step via `insights-notifications`.

**W4 Cross-organization link**
`org-structure` (request, key verification, approve) -> `billing-tokens` (`tokenFunding`: requester's wallet joins the approver's token pool) -> `org-structure` access scope (`accessHelper`) changes what `audit-planning`, `cap-followup` and `insights-notifications` can show.

**W5 People**
`people-users` (invite) -> `platform-core` emailService (invitation email) -> `people-users` (verify, set password) -> `identity-access` (login) -> scope from `org-structure`.

**W6 AI features**
Checklist AI (`checklists`), organization setup AI (`setup-onboarding`), site scan (`site-scan`), landing assistant (`public-site`). All use OpenAI keys server-side, errors through `utils/aiErrors.js`, no private data logged.

**W7 Android**
Auditor pages are owned by feature threads; the app shell, route allow-list and build belong to `mobile-android`. A new auditor page: feature thread builds it mobile-first, then adds the route to `lib/native/routes.ts`.

## Cross-thread database writes that exist today (verified in the code)

A thread normally writes only its own tables. These writes into another thread's tables already exist; treat them as the sanctioned exceptions and flag any new ones in review.

| Code (owner) | Writes into (owner) | Why / rule |
|---|---|---|
| `AuditExecutionModel` (audit-execution) | `audit_assignments.status` (audit-planning) | plan -> in_progress -> completed. Status only. |
| `capController.createFollowUpAudit` (cap-followup) | `audit_assignments`, `audit_assignment_entities` (audit-planning) | Raw INSERT; skips token reservation. Open question for the user. |
| `capController`, `CapModel` (cap-followup) | `corrective_actions` (audit-execution) | Link/status fields of existing rows only. |
| `authController` (identity-access) | `auditors`, `organization_users` (people-users) | Password / verification state only. |
| `adminController` (backoffice-admin) | `admins` (identity-access) | Staff account management. |
| `organizationAiSetupController` (setup-onboarding) | entity tables + `organization_tree` (org-structure) | Publishing an AI setup. Prefer calling org-structure models. |
| `PrivacyPolicyModel` (public-site) | `privacy_policy_agreements` | Now owned by public-site, no longer an exception. |
| `TokenWalletModel` (billing-tokens) | `audit_question_instances` | Now owned by billing-tokens (billing snapshot), no longer an exception. |
| `recordDeletionService` (platform-core) | audits, CAPs, ratings, corrective actions, notifications | Cascade delete. Any new table that points at an audit or CAP must be added here (review it in the migration). |

## Keyword routing (when the prompt does not name an area)

| If the prompt mentions | Lead thread |
|---|---|
| login, token, password, OTP, role, permission, register, verify email | identity-access |
| Company/Cluster/Factory/Unit/Department/Section, Buying Office, Supplier, Branch, hierarchy, org tree, link request, logo, entity | org-structure |
| invite, user list, auditor account, organization user, scope, experience, qualification | people-users |
| onboarding, setup, upload audit sheet, draft, publish setup | setup-onboarding |
| checklist, question, option, Excel template, AI questions, checklist type | checklists |
| assign audit, audit list, schedule, compare audits, rating, cancel audit | audit-planning |
| execute audit, answer, evidence, photo/video upload, complete, report, PDF | audit-execution |
| CAP, corrective action, follow-up audit, resolve | cap-followup |
| training, field visit, evaluation paper, My Learning | learning |
| site scan, photo analysis, vision | site-scan |
| price, package, payment, Sampath, subscription, promo, campaign, token, wallet, ledger, limit | billing-tokens |
| dashboard, chart, KPI, notice, notification, bell, timezone, help page | insights-notifications |
| admin panel, audito_admin, approve payment, quote review, contact review | backoffice-admin |
| landing, hero, contact form, assistant chat/voice, privacy policy page | public-site |
| APK, Android, Capacitor, WebView, native | mobile-android |
| Sidebar, shared component, button/modal, `api.ts`, npm package, email sending, server.js | platform-core |
| table, column, index, migration, grant, SQL | database |
| test, CI, lint, build fails, deploy, README, rate limiting, security audit | quality-release |

When two rows match, the lead is the thread that owns the **data or endpoint being changed**; the other becomes a supporting thread.

## Reserved ideas (do NOT create until the trigger is real)

| Possible thread | Create it when | Until then |
|---|---|---|
| `reports-analytics` | exports, scheduled reports or cross-audit analytics need their own tables/endpoints/pages | `insights-notifications` (dashboards) and `audit-planning` (comparison) |
| `integrations-api` | public API keys, webhooks, SSO/SCIM or third-party connectors are added | `identity-access` / `platform-core` |
| `messaging-channels` | email/SMS/push preferences and delivery tracking grow beyond `emailService` | `insights-notifications` + `platform-core` |
| `mobile-ios` | an iOS app is started | `mobile-android` patterns |
| `payments-gateway` (split from `billing-tokens`) | a second gateway/currency or subscription renewal automation makes `billing-tokens` too large to hold in one head | `billing-tokens` |
| `localization` | more than one UI language | `platform-core` |
| `evidence-library` | evidence needs to be searched, reused or retained independently of one audit | `audit-execution` |

## Cleanup candidates found while mapping (nothing was deleted; ask the user)

- `routes/billingCreditRoutes.js` (not mounted) and `LinkBillingCreditModel.js`: `org-structure`.
- `models/LearningModel.js`, `models/PlanSettingsModel.js`, `models/CustomSolutionModel.js`: no references found: `learning`, `billing-tokens`, `public-site`.
- `startSubscriptionReminderScheduler` never called: `billing-tokens` (and `platform-core` to wire it).
- `npm run migrate`, `db:convert`, `db:verify`, `db:access` point to files that do not exist: `database`.
- No tests/CI/README; `npm run lint` likely broken on Next 16: `quality-release`.
- No rate limiting on auth/public endpoints: `quality-release` with `identity-access` and `public-site`.
