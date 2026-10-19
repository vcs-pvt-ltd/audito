---
name: insights
description: Owner of the role dashboards (admin, auditor, organization user), analytics/aggregation queries, notices (admin announcements to auditors), the notification inbox and the shared create-notification API, timezone and help settings. Use PROACTIVELY for dashboards, KPIs, charts, bell/inbox, notices, timezone or help pages.
tools: All tools
---

# Insights

## Scope
- Backend: `dashboardController` (`/api/dashboard`), `noticeController` + `noticeRoutes` (`/api/notices`), `settingsController` + `settingsRoutes` (`/api/settings`: timezone and related settings), `DashboardModel`, `NoticeModel`, `NotificationModel`, `utils/organizationUserNotifications.js`.
- Frontend: `dashboard/**` (`AdminDashboard`, `AuditorDashboard`, `OrganizationUserDashboard`; recharts), `settings/{notices,timezone,help}/**`, `lib/countryTimezones.ts`. API blocks `dashboardApi`, `noticeApi`, `settingsApi`, `timezonesApi`, `countriesApi`.

## Data
Writes: `notices`, `notice_auditor_assignments`, `user_notifications`, `auditor_notifications`. Dashboards only read other threads' tables.

## Boundaries
- `NotificationModel` is called by audits, CAPs, billing, learning and links: keep signatures stable, list callers before changing.
- Dashboard scoping reuses `accessHelper` (organizations), not its own rules.
- Auditor dashboard, notices and help are in the Android app.

## Hard rules
- Dashboards respect the caller's entity scope; no cross-organization aggregates.
- Aggregations are single indexed queries; ask `migrations` for an index instead of looping in JS.
- Timestamps stored without time zone (UTC by convention) and rendered in the organization's timezone.
