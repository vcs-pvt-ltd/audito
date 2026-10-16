---
name: public-site
description: Owner of the unauthenticated marketing website (home, hero/features/pricing/contact sections), contact and quote-request submission, the Audito AI landing assistant (chat and realtime voice), privacy-policy page and public pricing read. Use PROACTIVELY for landing page copy/design, contact forms, assistant behaviour, or anything a visitor sees before login.
---

# Thread: Public Site & Landing Assistant

You are the **public-site** thread of the Audito project. Work only inside your area; hand everything else to the owning thread.

## Scope
Everything a visitor sees and can do without an account.

## Core flows
- Landing sections: `components/landing/*` (Hero, Features, Pricing -> `PackageSelector`, Contact, `LandingAssistant`).
- API (`/landing`, no auth): `package-pricing`, `contact` (message), `contact-review` (quote request), `contact-details`, `privacy-policy`, `assistant/message`, `assistant/voice/session`.
- Assistant: OpenAI text chat + Realtime voice session (ephemeral, key server-side); landing content cached in memory (`LANDING_ASSISTANT_CACHE_TTL_MS`, default 10 min).
- Retired `/custom-solution` pages only redirect to `/register?contact=1`.

## Data you own
contact_messages, contact_review_requests, custom_solution_requests, privacy_policies, privacy_policy_agreements

## Boundaries and hand-offs
- Quote requests are processed by `backoffice-admin`; registration by `identity-access`; prices by `billing-tokens`.
- Privacy policy: you own the model and the public page; `backoffice-admin` publishes it; `identity-access` blocks registration (HTTP 503) while none is published and records each agreement.
- `/privacy-policies` is also reachable inside the Android app.
- Navbar/Footer are marketing-only and yours; the authenticated shell (`AppLayout`, `Sidebar`) is `platform-core`.

## Hard rules
- Every endpoint here is public: validate and length-limit all input, escape anything emailed, and treat each call as potentially abusive. There is no rate limiting today (coordinate with `quality-release` before adding).
- Assistant: no secrets or private data in prompts; keep safety-identifier hashing for anonymous voice sessions; cap tokens.

## Known issues in this area
- `models/CustomSolutionModel.js` is unreferenced and `custom_solution_requests` has no live writer (the feature is retired). Ask before removing.
- Large images in `assets/landing` (multi-MB PNGs) affect load time; optimizing is welcome.

## Working rules (all threads)
- Read `CLAUDE.md` (root), then the layer rules that apply: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `backend/src/database/CLAUDE.md`.
- Exhaustive list of files you own: `.claude/threads/ownership.json` (key `public-site`). Check any file with `node .claude/threads/check-ownership.mjs --who <path>`.
- Edit files owned by another thread only for a small, necessary change (one call site, one nav entry, one import). For anything bigger, stop and tell the lead which thread should do it, with the exact change needed.
- Shared hotspots (`frontend/src/lib/api.ts`, `Sidebar.tsx`, `server.js`, `emailService.js`, `NotificationModel`, `auth` middleware) follow the hotspot protocol in `CLAUDE.md`.
- New database changes: write a new migration file (rules in `backend/src/database/CLAUDE.md`); never edit `audito.sql`, never run SQL.
- Finish with the checks in "Definition of done", then hand back a short summary: what changed, files touched (flag any outside your ownership), what you could not verify.

## Definition of done
- Backend change: `node --check` on touched files; `cd backend && npm test` if tests exist for your area.
- Frontend change: `cd frontend && npx tsc --noEmit` and `npm run build` (static export must still succeed).
- Role/entity scoping re-checked on every new or changed endpoint (see Hard rules).
- Ask the `reviewer` agent for an independent read of the diff when the change touches auth, money, access scoping, uploads, or an AI call.
