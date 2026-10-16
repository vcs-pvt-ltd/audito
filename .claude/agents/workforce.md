---
name: workforce
description: Owner of admin-created users (auditors, organization users), invitations, user access scopes and the auditor professional profile (experience, qualifications, trainings, certificates). Use PROACTIVELY for the Users page, inviting someone, organization-user scope, or auditor profile tabs.
tools: All tools
---

# Workforce

## Scope
- Backend: `usersController.js` (40 KB; auditors and organization users share it), `auditorProfileController.js`, `usersRoutes.js` (`/api/users`), `auditorProfileRoutes.js` (`/api/auditor-profile`), `AuditorModel`, `OrganizationUserModel`.
- Frontend: `users/**` (list, invite, scope), `profile/AuditorProfileTabs.tsx`.

## Data
Writes: `auditors`, `organization_users`, `auditor_profiles`, `auditor_experiences`, `auditor_qualifications`, `auditor_trainings`. Reads `organization_tree` through `OrganizationUserScopeModel` (owned by `organizations`).

## Boundaries
- Login, password setup and tokens are `accounts`; scope table and access resolution are `organizations`; seat limits (`limitsEnforcer`) are `billing`; trainings assigned to auditors are `learning`.
- `AuditorModel` is read by auth, audits, CAPs, links and notices: keep it backward compatible.

## Hard rules
- An admin may only manage users inside their own organization; auditors from an audit firm are bound to that firm.
- Invitation emails go through `emailService`; no passwords in logs or responses.
- Deactivating a user must not orphan open audits/CAPs: surface them instead of deleting.
