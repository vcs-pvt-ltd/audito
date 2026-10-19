# Build and deploy

How Audito is built and run today. Env files are listed by **name only**; their
values live outside git (`backend/.env`, `frontend/.env`, `frontend/.env.android`
are ignored). The Android app has its own section in the root `README.md`.

> **Open question:** where production runs (host, how the backend process is
> kept alive, how files are uploaded) is not recorded in the repository. The
> only hint is `frontend/public/.htaccess`, written for Apache static hosting on
> Hostinger. Fill in "Production" below once confirmed.

## Overview

| Part | Runtime | Output | Config |
| --- | --- | --- | --- |
| Backend API | Node.js, Express 5 (`backend/src/server.js`) | long-running process on `PORT` | `backend/.env` |
| Database | PostgreSQL 18+ | schema from `backend/src/database/audito.sql` + `migrations/new/*.sql`, applied by hand with `psql` | `DATABASE_URL` or `DB_*` |
| Website | Next.js 16 static export | `frontend/out/` (plain HTML/JS/CSS) | `frontend/.env` (`NEXT_PUBLIC_*`, baked in at build time) |
| Android app | Capacitor 8 wrapper of the same pages | `frontend/android-web/` then APK/AAB | `frontend/.env.android` |

## Backend

```bash
cd backend
npm install
npm start          # node src/server.js
npm run dev        # nodemon, for local work
```

- `server.js` loads `backend/.env` (dotenv), connects to PostgreSQL first and
  only then listens on `PORT` (default `5000`). The startup check refuses to run
  when the app role cannot read `public.admins`.
- Uploaded files are written under `backend/src/public/uploads/` and served at
  `/uploads`; AI setup source files go to `backend/storage/`. Both must sit on
  persistent disk on the server and be backed up.
- CORS allows `FRONTEND_URL`, `http://localhost:3000`, `http://localhost:3001`
  and `https://localhost` (Android WebView). Production `FRONTEND_URL` must be
  the exact website origin.
- There is no build step: deploy the `backend/` source plus `npm install
  --omit=dev` on the server. (`nodemon` is currently a runtime dependency.)
- `npm run migrate`, `db:convert`, `db:verify`, `db:access` point to scripts
  that are not in the repository and will fail.

### Backend environment variables (names only)

Template: `backend/.env.example`. Variables read by the code:

| Area | Names |
| --- | --- |
| Server | `PORT`, `FRONTEND_URL`, `PUBLIC_API_URL` |
| Database | `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; `DB_POOL_SIZE`, `DB_TIMEZONE` (set `TZ` to the same value) |
| Migrations (owner role, not the app) | `DATABASE_MIGRATION_URL` or `DB_MIGRATION_USER`, `DB_MIGRATION_PASSWORD` |
| Auth | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `LINK_KEY_SECRET` |
| Email (SMTP) | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `SMTP_SECURE` |
| Contact details | `AUDITO_CONTACT_EMAIL`, `AUDITO_WHATSAPP_NUMBER`, `PAYMENT_CONTACT_EMAIL` |
| Payments | `PAYMENT_MODE` (`manual_approval` until the gateway is live), `PAYMENT_TOKEN_ENCRYPTION_KEY`, `SAMPATH_*` (see the example file) |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_CHECKLIST_*`, `OPENAI_ORGANIZATION_SETUP_*`, `OPENAI_VISUAL_SCAN_*`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, `OPENAI_TRANSCRIPTION_MODEL`, `OPENAI_SAFETY_IDENTIFIER_SECRET`, `LANDING_ASSISTANT_CACHE_TTL_MS` |

`backend/.env.example` is missing the Auth, Email and Contact names above and
the `OPENAI_ORGANIZATION_SETUP_*` group; add them (names only) when the example
is next updated.

## Database

Claude never runs SQL. A person applies changes with `psql`:

1. New database: `backend/src/database/audito.sql` (baseline; never edited).
2. Then every file in `backend/src/database/migrations/new/` in date order.
   Each file is idempotent ("Safe to rerun").

Use an owner role for schema changes and a separate, least-privilege app role
in `DB_USER` / `DATABASE_URL` for the running backend.

## Website (static export)

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000, talks to NEXT_PUBLIC_API_URL
npm run build      # NODE_ENV=production -> output: 'export' -> frontend/out/
npm run lint       # ESLint 9 flat config (eslint.config.mjs)
npx tsc --noEmit   # type check
```

- `next.config.js` switches to `output: 'export'` in production builds, with
  `trailingSlash: true` and unoptimized images. No server code ships: no API
  routes, middleware or SSR.
- `NEXT_PUBLIC_API_URL` (must end in `/api`) and `NEXT_PUBLIC_MEDIA_URL` are
  read **at build time** from `frontend/.env`. Changing the API address means
  rebuilding. Without them the site uses `http://localhost:8081/api`, so local
  backends usually run with `PORT=8081`.
- Deploy: upload the contents of `frontend/out/` to the web root.
  `frontend/public/.htaccess` (copied into `out/`) handles trailing slashes,
  `index.html` per folder, the 404 page, gzip, caching and basic headers on
  Apache. It skips `/api/`, so the API can share the domain behind a proxy.

## Android app

See the root `README.md`. Summary: `npm run android:apk` (debug), release AAB
via Gradle with signing kept outside the repository. Release is blocked until
the application ID, signing owner, production API URL and destination are
decided.

## Production

| Item | Value |
| --- | --- |
| Website host | _to confirm_ (`.htaccess` suggests Hostinger, Apache) |
| Backend host and process manager | _to confirm_ |
| Database host | _to confirm_ |
| Public URLs (`FRONTEND_URL`, API) | _to confirm_ |
| Who deploys, and how (FTP, panel, SSH) | _to confirm_ |
| Upload/storage backups | _to confirm_ |

## Release checklist

1. Branch off `Dev`, open a PR into `Dev`; `main` only by request.
2. Checks: `node --check` on touched backend files, `cd backend && npm test`,
   `cd frontend && npx tsc --noEmit && npm run build && npm test`,
   `node .claude/threads/check-ownership.mjs`.
3. Apply new migration files with `psql` before deploying the backend that
   needs them.
4. Deploy backend, restart the process, then upload the new `frontend/out/`.
