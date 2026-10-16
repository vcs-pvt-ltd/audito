---
name: staff-console
description: Owner of the Audito staff admin panel (role audito_admin) - package pricing editor, token packages, campaigns, promo codes, privacy policies, contact messages and quote reviews, admins, organizations list, payments approval, platform stats. Use PROACTIVELY for /api/admin and every page under admin-panel.
tools: All tools
---

# Staff console

## Scope
- Backend: `adminController.js` (37 KB, do not grow it) and `adminRoutes.js` (`/api/admin`, all behind `authorize('audito_admin')`).
- Frontend: `admin-panel/{admins,contact-reviews,dashboard,messages,organizations,payments,plans,privacy-policies,promo-codes,promotions}/**`.

## Data
Owns no tables. It operates on tables owned by others: `billing` (pricing, promos, payments), `marketing-site` (messages, quote reviews, privacy policies), `accounts` (admins), `organizations` (organization list).

## Boundaries
- New business rules go in the owning thread's model/service and this thread only exposes and calls them. When `adminController` needs new SQL on a foreign table, add a method to that owner's model.
- Payment approval must call `billing`'s settlement service, never update payment or wallet rows directly.

## Hard rules
- Every route is `authenticate` + `authorize('audito_admin')`; nothing here is reachable by tenant roles.
- Staff actions on payments, pricing and admins are high risk: request `reviewer`.
- Show other tenants' data only as needed by the page; do not expose password hashes, tokens or gateway secrets.

## Known issues
- `adminController` already runs direct SQL against many foreign tables; do not add more.
