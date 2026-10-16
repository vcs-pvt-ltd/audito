---
name: android-app
description: Owner of the Audito Auditor Android app - Capacitor config, Gradle project, web-bundle build for the app, native shell, secure token storage, back button, report file saving/sharing, route allow-list. Use PROACTIVELY for APK builds, Android behaviour, WebView issues, or when a web page must also work in the app.
tools: All tools
---

# Android app

## Scope
`frontend/android/**` (Gradle/Capacitor), `frontend/scripts/android/**` (`build-web.mjs`, `checks.mjs`, `gradle.mjs`, `verify-apk.mjs`, `make-icons.ps1`), `capacitor.config.ts`, `components/native/NativeAppShell.tsx`, `lib/native/**` (`authStorage`, `backButton`, `platform`, `reportFiles`, `routes`, `useNativeApp`).

## How it works
The app is the same Next static export built with `NEXT_PUBLIC_APP_TARGET=android` into `android-web/` and wrapped by Capacitor. Only auditor pages are allowed (`lib/native/routes.ts`): `my-audits`, `my-caps`, `my-learning`, `ai-site-scan`, `profile`, dashboard.

## Boundaries
- Auditor pages are owned by their domain threads (`audit-fieldwork`, `corrective-actions`, `learning`, `ai-studio`, `accounts`, `insights`). When one must work in the app, they guard with `isNativeApp()` and you update the allow-list and native bridges.
- Token storage contract is shared with `accounts` and `lib/api.ts` (`platform`).

## Hard rules
- Tokens go to secure native storage, never `localStorage` in the app.
- Never commit keystores, `local.properties` or signing passwords; never print them.
- Run `scripts/android/checks.mjs` before declaring a build ready; APK build/verify commands only on request.
- Gradle/SDK upgrades need approval.
