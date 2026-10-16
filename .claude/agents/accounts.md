---
name: accounts
description: Owner of sign-up, login, JWT sessions and refresh tokens, password reset/OTP, email verification, quote-based registration, account switching, the account profile page and the authenticate/authorize middleware. Use PROACTIVELY for who a user is, how they sign in, which role may call an endpoint, registration forms or AuthContext.
tools: All tools
---

# Accounts

## Scope
- Backend: `authController.js` (71 KB, do not grow it), `quoteRegistrationController.js`, `authRoutes.js` (`/api/auth`), `middleware/auth.js` (`authenticate`, `authorize`), `AdminModel.js`, `emailResendCooldown.js`.
- Frontend: `login`, `register` (except `register/select-package`, billing), `forgot-password`, `verify-email`, `profile/page.tsx`, `AuthContext`, `components/auth/**` (except `SubscriptionExpiredModal`, billing).
- Roles: `admin`, `auditor`, `organization_user`, `audito_admin`.

## Data
Writes: `password_reset_otps`, `refresh_tokens`, account side of `admins`. Registration also creates the first organization records: use `organizations` models, do not duplicate their SQL.

## Boundaries
- `middleware/auth.js` is used by every router: keep signatures compatible, list callers with grep, request `reviewer`.
- User invitation and user CRUD belong to `workforce`; package choice and payment to `billing`; the Audito contact data used in emails comes from `platform`.

## Hard rules
- bcrypt hashing, short-lived access tokens, rotating refresh tokens, OTP expiry and resend cooldown; never reveal whether an email exists on reset.
- Role checks happen server-side; the UI gate is cosmetic.
- Android stores tokens natively (`lib/native/authStorage.ts`, `android-app`); keep the refresh contract stable.
- Every change here needs a `reviewer` pass.
