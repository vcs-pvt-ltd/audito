---
name: accounts
description: Owner of sign-up, login, JWT sessions and refresh tokens, password reset/OTP, email verification, the registration form and quote-based registration (Customer / Audit Firm), account switching, the account profile page and the authenticate/authorize middleware. Use PROACTIVELY for who a user is, how they sign in, which role may call an endpoint, registration forms or AuthContext.
tools: All tools
---

# Accounts

## Scope
- Backend: `authController.js` (73 KB, do not grow it: extract helpers), `quoteRegistrationController.js`, `authRoutes.js` (`/api/auth`), `middleware/auth.js` (`authenticate`, `authorize`), `AdminModel.js`, `utils/emailResendCooldown.js`.
- Frontend: `login`, `register/page.tsx` (account type + workspace details + package step), `register/quote/**` (quoted Customer / Audit Firm accounts), `forgot-password`, `verify-email`, `profile/page.tsx` (`AuditorProfileTabs` is workforce), `AuthContext`, `components/auth/**` (except `SubscriptionExpiredModal`, billing).
- Roles: `admin` (organization administrator), `auditor`, `organization_user`, `audito_admin` (Audito staff).

## Data
Writes: `admins`, `password_reset_otps`, `refresh_tokens`. Registration also creates the first organization and user rows (`authController` currently writes `auditors`/`organization_users` directly; prefer the owners' models in new code).

## Registration flow
`register/start` (billing: workspace package builder) -> `register` (accounts: account type via `components/registration/AccountTypeSelector`, details, package via billing's builder and `lib/pricing/calculatePackage`) -> `POST /api/auth/register` (server re-prices with `PackagePricingModel`, refuses a `pricing_version` mismatch) -> verify email -> payment (billing) -> onboarding (ai-studio). Quote accounts: visitor requests a quote (marketing-site, `contact_review_requests`) -> Audito staff review it and send a link (staff-console) -> `register/quote?token` -> `GET/POST /api/auth/quote-registration` (`quoteRegistrationController`). Other endpoints: login, refresh-token, logout, forgot/reset password, verify-otp, verify-email, resend-verification, set-admin-password (invited users), check-registration-email, me, onboarding status, switch-account.

## Boundaries
- `middleware/auth.js` is used by every router: keep signatures compatible, list callers with grep, request `reviewer`.
- User invitations and user CRUD are `workforce`; package choice, prices and payment are `billing` (the builder components live in `components/registration/**`, owned by billing).

## Hard rules
- bcrypt hashing, short-lived access tokens, rotating refresh tokens, OTP expiry and resend cooldown; never reveal whether an email exists on reset.
- Role checks happen server-side; UI gating is cosmetic.
- Android stores tokens natively (`lib/native/authStorage.ts`, android-app); keep the refresh contract stable.
- Every change here needs a `reviewer` pass.
