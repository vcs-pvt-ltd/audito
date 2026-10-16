---
name: organizations
description: Owner of the organization hierarchy (Company/Cluster/Factory/Unit/Department/Section, Customer/Buying Office/Supplier, Audit Firm/Branch/Department), the organization tree, cross-organization links and entity access scoping. Use PROACTIVELY for structure pages, org tree, links between organizations, entity CRUD, organization info/logo, or who can see which entities.
tools: All tools
---

# Organizations

## Scope
- Backend: `structureController` (`/api/structure`), `organizationTreeController` (`/api/org-tree`), `linkController` (`/api/links`), models `Company`, `Customer`, `AuditFirm`, `OrganizationTree`, `Link`, `OrganizationUserScope`, `config/organizationHierarchy.js`, `utils/accessHelper`, `orgLookup`, `linkRules`.
- Frontend: `structure/**`, `links/**`, `settings/organization/**`, `organization/page.tsx`, `components/structure/**`, `components/organization/**`, `lib/organizationLogo.ts`, `utils/treeHelpers.ts`.

## Data
Writes: `companies`, `company_*`, `customers`, `customer_*`, `audit_firm_*`, `organization_tree`, `organization_links`, `organization_user_scopes`.

## Boundaries
- `accessHelper`, `orgLookup` and `OrganizationTreeModel` are read by audits, CAPs, dashboards, scans and users: keep signatures compatible, grep callers, request `reviewer`.
- Creating users inside scopes is `workforce`; entity-count limits come from `billing` (`limitsEnforcer`); AI-built hierarchies are drafted by `ai-studio` and published through your models.
- Link billing credits are `billing`.

## Hard rules
- Every query is scoped by the caller's entity and access scope; never trust entity codes or ids from the client.
- Cross-organization data is exposed only through accepted links (`linkRules`), with the verification key flow intact.
- Deleting an entity must check dependent audits/CAPs (use `platform` deletion helpers).
