---
name: billing
description: Owner of money and limits - Company package pricing and the registration package builder, quoted accounts, payments (manual approval and Sampath gateway), saved payment methods, promo codes and campaigns, token wallets/lots/ledger/reservations/reloads, package limits, and the payment/billing pages. Use PROACTIVELY for anything involving prices, packages, payments, tokens, limits or the payment page. High risk - always request a reviewer pass.
tools: All tools
---

# Billing

## Model (current)
A workspace's package is its **paid registration payment** in `payment_transactions`; the payment's pricing snapshot holds the purchased limits (`SubscriptionModel.getActivePackage` / `limitsFromSnapshot`). Two purchase types: `company_package` (priced by levels/clusters/companies/departments/lines, `packageHierarchy.packageLimits`) and `quoted_account` (Customer / Audit Firm, `quotedAccountLimits`). Packages are permanent; usage is paid with **tokens** (wallet, lots, reservations per audit). The old plan model (Basic/Pro/Elite, `subscriptions`, `plan_*`) was removed by `20261008_drop_plan_tables.sql`.

## Scope
- Backend: `paymentController` (`/api/payments`), `tokenController` (`/api/tokens`), models `PackagePricingModel` (`RULES.pricing_version`, `departmentChargeCents`), `PaymentModel`, `PaymentMethodModel` (encrypted gateway token), `SubscriptionModel` (package + limits from payments), `PromoCodeModel`, `PromotionCampaignModel`, `TokenWalletModel` (32 KB), `TokenReloadPackageModel`, `config/packageHierarchy.js`, services `paymentSettlementService`, `promoCheckoutService`, `sampathGatewayService`, utils `limitsEnforcer`, `tokenFunding`. Legacy: `LinkBillingCreditModel`, `PlanSettingsModel`, `billingCreditRoutes` (not mounted), `subscriptionReminderService` (unused).
- Frontend: `register/start/**` (workspace package builder page), `register/select-package/**`, `components/registration/**` (WorkspacePackageBuilder, LevelLadder, DepartmentStepper, SelectionSummary, PackageCard, AccountTypeSelector, ...), `lib/pricing/calculatePackage.ts` (+ `.test.ts`), `lib/registration/{usePackageState,workspaceOptions}.ts`, `payment/**`, `settings/billing/**`, `components/billing/**`, `components/pricing/**`, `LimitReachedModal`, `SubscriptionExpiredModal`, `SubscriptionBanner`, `lib/planLimits.ts`, `lib/packageHierarchy.ts`. API blocks `packagePricingApi`, `paymentApi`, `tokenApi`.

## Data
Writes: `payment_transactions`, `payment_gateway_events`, `payment_fulfillments`, `payment_methods`, `package_pricing_settings`, `promo_codes`, `promotion_campaigns`, `token_wallets`, `token_lots`, `token_ledger_entries`, `token_reservations`, `token_reservation_allocations`, `token_reload_packages`, `audit_question_instances`.

## Boundaries
- Wallet changes only through `TokenWalletModel`; audits request reservations, never write token tables. `SubscriptionModel` and `limitsEnforcer` are called by many threads: keep signatures compatible, grep callers.
- Staff editing of prices/promos and manual payment approval run in `staff-console` and must call your models/services.
- `register/page.tsx` (accounts) and `PricingSection` (marketing-site) consume your builder and `calculatePackage`.

## Hard rules
- Client price = preview only. The server re-prices every registration/payment; keep `lib/pricing/calculatePackage.ts` `PRICING_VERSION` equal to `PackagePricingModel.RULES.pricing_version` and `DEPARTMENT_RULE` equal to `departmentChargeCents` (change both sides together; registration is refused on a version mismatch).
- `calculatePackage.ts` stays import-free so `npm test` (node --test) runs; update its test with every pricing change.
- Payment callbacks verified (HMAC) and idempotent (`payment_gateway_events`, `payment_fulfillments`); settlement and wallet movements in one transaction. `PAYMENT_MODE` switches manual approval vs gateway.
- Never log card data, gateway secrets, saved-method tokens or full payloads.
- Ask before mounting or deleting the legacy files.
