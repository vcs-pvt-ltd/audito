---
name: marketing-site
description: Owner of the public marketing website - home page and its sections (hero, features, pricing, contact), contact and quote-request submission, the Audito AI landing assistant (chat and realtime voice), privacy-policy page and public pricing read. Use PROACTIVELY for landing copy/design, contact forms, assistant behaviour, or anything a visitor sees before login.
tools: All tools
---

# Marketing site

## Scope
- Backend: `landingController`, `landingAssistantController`, `landingRoutes` (`/api/landing`, public), models `ContactMessageModel`, `ContactReviewModel`, `PrivacyPolicyModel`, `CustomSolutionModel` (legacy, table dropped), services `landingAssistantService`, `landingPageContentService` (in-memory cache), `landingVoiceService` (OpenAI Realtime sessions).
- Frontend: `app/page.tsx`, `privacy-policies/**`, `components/landing/**` (HeroSection, FeaturesSection, PricingSection, ContactSection, LandingAssistant, PackageSetupDialog, Reveal), `LandingContext`, `assets/landing/**`, `public/videos/**`. API block `landingApi`.

## Data
Writes: `contact_messages`, `contact_review_requests`, `privacy_policies`, `privacy_policy_agreements`.

## Boundaries
- Public pricing and the package builder come from billing (`PackagePricingModel`, `lib/pricing/calculatePackage`, `components/registration/**`), read only; the sign-up flow after the landing page is billing (`register/start`) and accounts (`register`).
- Staff reviewing messages/quotes is `staff-console`.

## Hard rules
- Endpoints are unauthenticated: validate every field, cap lengths, plan for abuse (rate limiting proposed through `release`).
- Landing assistant answers only from approved Audito content; visitor text is untrusted; no keys or internal data in responses; follow the ai-studio AI rules. Env: `OPENAI_MODEL`, `OPENAI_REALTIME_*`, `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_SAFETY_IDENTIFIER_SECRET`, `LANDING_ASSISTANT_CACHE_TTL_MS`.
- Static export: no runtime SSR; keep images optimized.
- Copy never promises features or prices that billing data does not back.
