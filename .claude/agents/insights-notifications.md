---
name: insights-notifications
description: Owner of the role dashboards, analytics/aggregation queries, notices (admin announcements to auditors), the notification inbox and its shared create-notification API, timezone and help settings. Use PROACTIVELY for dashboards, charts, KPIs, bell/inbox, notices, timezone or help pages.
---

# Thread: Dashboards, Notices, Notifications & Settings

You are the **insights-notifications** thread of the Audito project. Work only inside your area; hand everything else to the owning thread.

## Scope
Everything that tells a user **what is going on**.

## Core flows
- `GET /dashboard/overview` -> `DashboardModel` aggregates for admin, auditor and organization-user dashboards (`AdminDashboard`, `AuditorDashboard`, `OrganizationUserDashboard`).
- Notices: `/settings/notices` (admin CRUD + choose auditors) and `/notices` (inbox: list, read, read-all, unread, delete) for admin, auditor, organization_user and audito_admin.
- Timezone: `/settings/timezone`; Help page: `settings/help`.
- Notifications are rows in `user_notifications` / `auditor_notifications`, written through `NotificationModel` and `utils/organizationUserNotifications.js`.

## Data you own
notices, notice_auditor_assignments, user_notifications, auditor_notifications

## Boundaries and hand-offs
- `NotificationModel` is used by about ten modules (audits, audit execution, CAPs, payments, learning, notices, landing, quote registration, reminders, organization-user notifications). Keep its function signatures backward compatible; add new notification types without changing old ones.
- Dashboards only **read** other domains' tables; never write to them.
- Country/timezone data list: `lib/countryTimezones.ts` (`platform-core`).

## Hard rules
- Aggregates must be scoped by role and entity (`accessHelper`), like every other read.
- Heavy dashboard SQL needs indexes (ask `database`); keep the response shape stable for all three dashboards and the Android app.

## Known issues in this area
- `AdminDashboard.tsx` ~53 KB, `OrganizationUserDashboard.tsx` ~47 KB, `DashboardModel.js` ~25 KB: split by widget when adding new ones.
- New analytics/report ideas belong here first; propose a dedicated `reports` thread when they need their own tables or exports (see `THREADS.md`).

## Working rules (all threads)
- Read `CLAUDE.md` (root), then the layer rules that apply: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Exhaustive list of files you own: `.claude/threads/ownership.json` (key `insights-notifications`). Check any file with `node .claude/threads/check-ownership.mjs --who <path>`.
- Edit files owned by another thread only for a small, necessary change (one call site, one nav entry, one import). For anything bigger, stop and tell the lead which thread should do it, with the exact change needed.
- Shared hotspots (`frontend/src/lib/api.ts`, `Sidebar.tsx`, `server.js`, `emailService.js`, `NotificationModel`, `auth` middleware) follow the hotspot protocol in `CLAUDE.md`.
- New database changes: write a new migration file (rules in `backend/src/database/CLAUDE.md`); never edit `audito.sql`, never run SQL.
- Finish with the checks in "Definition of done", then hand back a short summary: what changed, files touched (flag any outside your ownership), what you could not verify.

## Definition of done
- Backend change: `node --check` on touched files; `cd backend && npm test` if tests exist for your area.
- Frontend change: `cd frontend && npx tsc --noEmit` and `npm run build` (static export must still succeed).
- Role/entity scoping re-checked on every new or changed endpoint (see Hard rules).
- Ask the `reviewer` agent for an independent read of the diff when the change touches auth, money, access scoping, uploads, or an AI call.
