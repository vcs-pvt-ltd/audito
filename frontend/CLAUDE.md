# Frontend rules (Next.js 16, React 19, TS, Tailwind 4)

## Constraints
- Production build is a **static export** (`output: 'export'`, `trailingSlash: true`, `images.unoptimized`). No server actions, route handlers, middleware or runtime SSR. Dynamic data is fetched client-side from the Express API.
- The same pages ship in the Android auditor app (`NEXT_PUBLIC_APP_TARGET=android`, dist `android-web/`). Do not use APIs unavailable in a WebView without a guard (`lib/native/platform.ts` `isNativeApp()`), and keep auditor pages (`my-audits`, `my-caps`, `my-learning`, `ai-site-scan`, `profile`, dashboard) working offline-tolerant and mobile-sized. Allowed route list is in `lib/native/routes.ts`.

## Structure
- Pages: `src/app/<area>/.../page.tsx`. Large screens are split into `ClientPage.tsx` / `content.tsx`; follow that pattern instead of making `page.tsx` bigger (several files are already 60-80KB; do not add to them, extract components/hooks).
- Components: feature folders under `src/components/`; shared primitives in `components/ui` (Button, IconButton, Input, Modal, Table) and `components/shared`. Reuse these before creating new ones.
- State: React context in `src/context` (Auth, Execution, Landing, Onboarding, UiFeedback). No global store library.
- API: always go through `src/lib/api.ts` (handles auth header, 401 -> `auth:expired`, native token refresh, friendly network errors). Never call `fetch` on the API directly in components. API base comes from `lib/apiConfig.ts` (never hard-code URLs).
- Types: put shared types near use or in `src/types`; avoid `any` in new code (api.ts currently returns `any`).

## Styling
Tailwind utility classes only; no CSS modules. Reuse the existing palette/spacing used in `components/ui` and `components/layout`. Support mobile widths (there is a `MobileBottomNav`). Use `lucide-react` for icons and `framer-motion` sparingly.

## Auth in UI
`AuthContext` holds the user and role. Gate pages by role in the page/layout (admin, auditor, organization_user, audito_admin) but remember UI gating is cosmetic; the backend must enforce access.

## Checks before finishing
`npx tsc --noEmit`, `npm run lint`, `npm run build`. No unit-test setup exists yet; adding one (Vitest + Testing Library) needs user approval.
