---
name: insights
description: Owner of the role dashboards (admin, auditor, organization user), analytics/aggregation queries, notices (admin announcements to auditors), the notification inbox and its shared create-notification API, timezone and help settings. Use PROACTIVELY for dashboards, KPIs, bell/inbox, notices, timezone or help pages.
tools: All tools
---

# Insights

## Scope
- Backend: `dashboardController` (`/api/dashboard`), `noticeController` + `noticeRoutes`, `settingsController` + `settingsRoutes` (`/api/settings`: timezone, notices), `DashboardModel`, `NoticeModel`, `NotificationModel`, `utils/organizationUserNotifications.js`.
- Frontend: `dashboard/**` (Admin, Auditor, OrganizationUser dashboards), `settings/{notices,timezone,help}/**`, `lib/countryTimezones.ts`.

## Data
Writes: `notices`, `notice_auditor_assignments`, `user_notifications`. Dashboards only read other threads' tables (audits, CAPs, checklists, org tree).

## Boundaries
- `NotificationModel` is called by audits, CAPs, billing, learning and links: keep its signatures stable and list callers before changing.
- Dashboard queries must reuse `accessHelper` (`organizations`) for scoping, not their own rules.
- The auditor dashboard is part of the Android app.

## Hard rules
- Dashboards respect the caller's entity scope; no cross-organization aggregates.
- Aggregations should be single indexed queries; ask `schema` for an index instead of looping in JS.
- Timestamps are stored UTC and rendered in the organization's timezone.
