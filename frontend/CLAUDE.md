# Frontend rules (Next.js 16, React 19, TS, Tailwind 4)

## Constraints
- Production build is a **static export** (`output: 'export'`, `trailingSlash: true`, `images.unoptimized`). No server actions, route handlers, middleware or runtime SSR. Data is fetched client-side from the Express API.
- The same pages ship in the Android auditor app (`NEXT_PUBLIC_APP_TARGET=android`, output `android-web/`). Guard WebView-unsafe APIs with `isNativeApp()` (`lib/native/platform.ts`) and keep auditor pages (`my-audits`, `my-caps`, `my-learning`, `ai-site-scan`, `profile`, `onboarding`, dashboard, notices, help) mobile-sized and offline-tolerant. Allowed routes: `lib/native/routes.ts` (android-app thread).

## Structure
- Pages: `src/app/<area>/.../page.tsx`. Large screens split into `ClientPage.tsx` / `content.tsx`; follow that pattern instead of growing `page.tsx` (several files are already 40-80 KB; extract components/hooks).
- Components: feature folders under `src/components/`; shared primitives in `components/ui` (Button, IconButton, Input, Modal, Table) and `components/shared`. Reuse them before creating new ones.
- State: React context in `src/context` (Auth, Execution, Landing, Onboarding, UiFeedback). No global store library.
- API: always through `src/lib/api.ts` (auth header, 401 -> `auth:expired`, native token refresh, friendly network errors); edit only your own `xxxApi` block. Base URL from `lib/apiConfig.ts`; never hard-code URLs or call `fetch` on the API in components.
- Types: near use or in `src/types`; avoid `any` in new code.
- Pure logic that needs tests goes in import-free `.ts` files with a sibling `*.test.ts` (pattern: `lib/pricing/calculatePackage.ts`).

## Styling
Tailwind utility classes and the theme tokens in `globals.css`; one CSS module exists (`components/onboarding/combined/OrganizationChart.module.css`), do not add more without reason. Support phone widths (`MobileBottomNav`). Icons from `lucide-react`; `framer-motion` sparingly; charts with `recharts`.

## Auth in UI
`AuthContext` holds the user and role. Gate pages by role (admin, auditor, organization_user, audito_admin), but UI gating is cosmetic; the backend enforces access.

## Checks before finishing
`npx tsc --noEmit`, `npm run build`, `npm test` (node --test on `src/**/*.test.ts`), `npm run lint` when touching many files.
