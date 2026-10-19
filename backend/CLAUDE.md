# Backend rules (Express 5, CommonJS, pg)

## Request flow
`server.js` mounts `/api/<area>` routers -> router applies `authenticate` (and `authorize`) -> controller -> model (raw SQL) / service. A new area = route + controller + model, mounted in `server.js` (one line, platform hotspot). `routes/billingCreditRoutes.js` is **not mounted** (legacy); ask before mounting or deleting it.

## Adding endpoints
1. Route in `routes/<area>Routes.js`: `router.use(authenticate)` at the top (or per route), `authorize(...)` where role-specific. Put specific paths (`/count`, `/types`) **before** `/:id`.
2. Controller: validate input first (`validateRequiredFields`, `isValidEmail`, explicit type/length checks), then scope by the caller's entity, then call the model. Respond only through `successResponse`/`errorResponse`.
3. Model: parameterized SQL only. Whitelist columns for dynamic UPDATEs (see `NoticeModel.updateNotice`).
4. Errors: `try { ... } catch (error) { console.error('X error:', error); return errorResponse(res, 'Failed to ...', 500); }`.

## SQL
- `?` placeholders; `db.query(sql, params)`; reads return `[rows]`. `postgresDialect.js` translates `?` to `$n` and some MySQL-isms, but write PostgreSQL SQL in new code (`STRING_AGG`, `::text`, `ILIKE`, `TRUE`/`FALSE`).
- Transactions: `const conn = await db.getConnection(); try { await conn.beginTransaction(); ...; await conn.commit(); } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }`.
- Never interpolate user values; only generated `?` lists or whitelisted identifiers.
- Schema changes: never inline `ALTER TABLE` at request time; ask the `migrations` thread for a file in `src/database/migrations/new/`.

## Uploads (multer)
Memory storage + strict `fileFilter` + `limits.fileSize` (pattern in `checklistRoutes.js`). Write to disk with random names in a fixed directory under `src/public/uploads/<kind>/`. Do not trust `file.originalname`/mimetype alone; check extension and, when feasible, magic bytes.

## Services and external APIs
OpenAI (checklist generation, site scan, org setup, landing assistant + realtime voice), SMTP (`emailService`), Sampath gateway (`sampathGatewayService`). Keys stay server-side; map failures to friendly messages (`utils/aiErrors.js`); never log keys or full payment payloads.

## Testing
`npm test` runs `node --test --test-isolation=none`. Put tests in `backend/test/**/*.test.js` (nodemon ignores `test/**`). Start with pure utils (`answerScoring`, `limitsEnforcer`, `codeGenerator`, `linkRules`, `tokenFunding`), then route tests with a mocked `config/db`.
