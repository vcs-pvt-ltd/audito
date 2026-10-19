---
name: staff-console
description: Owner of the Audito staff admin panel (role audito_admin) - package pricing editor, token packages, promotions, promo codes, privacy policies, contact messages and quote reviews, Audito admins, organizations list, payment approval and platform stats. Use PROACTIVELY for /api/admin and every page under admin-panel.
tools: All tools
---

# Staff console

## Scope
- Backend: `adminController.js` (38 KB, do not grow it) and `adminRoutes.js` (`/api/admin`, all behind `authorize('audito_admin')`).
- Frontend: `admin-panel/{dashboard,admins,organizations,payments,plans,promotions,promo-codes,messages,contact-reviews,privacy-policies}/**`. API block `adminApi`.

## Data
Owns no tables. Operates on tables owned by billing (pricing, token packages, promos, payments), marketing-site (messages, quote reviews, privacy policies), accounts (admins) and organizations (organization list).

## Boundaries
- New business rules go in the owning thread's model/service; this thread exposes and calls them. When `adminController` needs new SQL on a foreign table, add a method to that owner's model.
- Payment approval calls billing's settlement service; never update payment or wallet rows directly.
- Approving a quote review sends the quote-registration link (accounts flow).

## Hard rules
- Every route is `authenticate` + `authorize('audito_admin')`; nothing here is reachable by tenant roles.
- Staff actions on payments, pricing and admins are high risk: request `reviewer`.
- Never expose password hashes, tokens or gateway secrets.

## Known issues
- `adminController` already runs direct SQL against many foreign tables; do not add more.
