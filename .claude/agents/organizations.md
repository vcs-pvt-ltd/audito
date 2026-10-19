---
name: organizations
description: Owner of the organization hierarchy (Company/Cluster/Factory/Unit/Department/Section, Customer/Buying Office/Supplier, Audit Firm/Branch/Department), the organization tree, cross-organization links and entity access scoping. Use PROACTIVELY for structure pages, org tree, links between organizations, entity CRUD, organization info/logo/timezone, or who can see which entities.
tools: All tools
---

# Organizations

## Scope
- Backend: `structureController` (`/api/structure`), `organizationTreeController` (`/api/org-tree`), `linkController` (`/api/links`), models `CompanyModel`, `CustomerModel`, `AuditFirmModel`, `OrganizationTreeModel`, `LinkModel`, `OrganizationUserScopeModel`, `config/organizationHierarchy.js`, `utils/accessHelper.js`, `orgLookup.js`, `linkRules.js`.
- Frontend: `structure/**`, `links/**`, `settings/organization/**`, `organization/page.tsx`, `components/structure/**`, `components/organization/**` (logo crop), `lib/organizationLogo.ts`, `lib/previewHierarchy.ts`, `utils/treeHelpers.ts`.

## Data
Writes: `companies`, `company_clusters`, `company_factories`, `company_units`, `company_departments`, `company_sections`, `customers`, `customer_buying_offices`, `customer_suppliers`, `audit_firm_companies`, `audit_firm_company_branches`, `audit_firm_company_departments`, `organization_tree`, `organization_links` (incl. verification key hash), `organization_user_scopes`. Public codes: `COMP-`, `CC-`, `COMPF-`, `CU-`, `CD-`, `CUST-`, `CBO-`, `SUP-`, `AFC-`, `AFCB-`, `LINK-`.

## Boundaries
- `accessHelper`, `orgLookup` and `OrganizationTreeModel` are read by audits, CAPs, dashboards, scans and users: keep signatures compatible, grep callers, request `reviewer`.
- Users inside scopes are `workforce`; entity-count limits come from billing (`limitsEnforcer`); AI-built hierarchies are drafted by `ai-studio` and published (today `organizationAiSetupController` writes these tables directly; new code should call your models).

## Hard rules
- Every query is scoped by the caller's entity and access scope; never trust entity codes or ids from the client.
- Cross-organization data is exposed only through accepted links (`linkRules`), with the verification key flow intact.
- Deleting an entity must check dependent audits/CAPs (platform deletion helpers, `CriticalDeleteModal`).
- New columns on the entity tables go to every level consistently (see `20261008_company_sections_timezone_logo.sql`): ask `migrations`.
