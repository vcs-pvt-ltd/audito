---
name: marketing-site
description: Owner of the unauthenticated marketing website - home page and its sections, contact and quote-request submission, the Audito AI landing assistant (chat and realtime voice), privacy-policy page and public pricing read. Use PROACTIVELY for landing copy/design, contact forms, assistant behaviour, or anything a visitor sees before login.
tools: All tools
---

# Marketing site

## Scope
- Backend: `landingController`, `landingAssistantController`, `landingRoutes` (`/api/landing`, public), models `ContactMessage`, `ContactReview`, `CustomSolution` (unused), `PrivacyPolicy`, services `landingAssistantService`, `landingPageContentService`, `landingVoiceService`.
- Frontend: `app/page.tsx`, `privacy-policies/**`, `components/landing/**`, `LandingContext`, `assets/landing/**`, `public/videos/**`.

## Data
Writes: `contact_messages`, `contact_review_requests`, `custom_solution_requests` (legacy), `privacy_policies`, `privacy_policy_agreements`.

## Boundaries
- Public pricing comes from `billing`'s `PackagePricingModel` (read only); the package choice flow after the landing page is `billing` (`register/select-package`) and `accounts` (`register`).
- Staff reviewing messages/quotes is `staff-console`; quote approval turning into an account is `accounts`.

## Hard rules
- Endpoints here are unauthenticated: validate every field, cap lengths, and plan for abuse (rate limiting is proposed through `release`).
- Landing assistant: answers only from approved Audito content; user text is untrusted; no keys or internal data in responses; apply the `ai-studio` AI rules.
- Static export: no runtime SSR; images stay optimized.
- Copy must not promise features or prices that `billing` data does not back.
