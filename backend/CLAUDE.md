# Backend rules (Express 5, CommonJS, pg)

## Request flow
`server.js` mounts `/api/<area>` routers -> router applies `authenticate` (and `authorize`) -> controller -> model (raw SQL) / service. Add a new area by creating route + controller + model and mounting it in `server.js`. Note `routes/billingCreditRoutes.js` is **not mounted** (dead code); ask before mounting or deleting it.

## Adding endpoints
1. Route in `routes/<area>Routes.js`: `router.use(authenticate)` at the top, `authorize(...)` where role-specific. Put specific paths (`/count`, `/types`) **before** `/:id`.
2. Controller: validate input first (`validateRequiredFields`, `isValidEmail`, explicit type/length checks), then scope by the caller's entity, then call the model. Return only through `successResponse`/`errorResponse`.
3. Model: parameterized SQL only. Whitelist columns for dynamic UPDATEs (see `NoticeModel.updateNotice`).
4. Errors: `try { ... } catch (error) { console.error('X error:', error); return errorResponse(res, 'Failed to ...', 500); }`.

## SQL
- `?` placeholders; `db.query(sql, params)`; reads return `[rows]`. Dialect translator handles `?` to `$n`, so write PostgreSQL-compatible SQL (`STRING_AGG`, `::text`, `ILIKE`).
- Transactions: `const conn = await db.getConnection(); try { await conn.beginTransaction(); ...; await conn.commit(); } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }`.
- Never interpolate user values; only generated `?` lists or whitelisted identifiers.

## Uploads (multer)
Use memory storage + strict `fileFilter` + `limits.fileSize` (existing pattern in `checklistRoutes.js`). When writing to disk use random names and a fixed directory under `src/public/uploads/<kind>/`. Do not trust `file.originalname`/mimetype alone; check extension and, when feasible, magic bytes.

## Services and external APIs
OpenAI calls (checklist generation, site scan, org setup, landing assistant), SMTP (`emailService`), Sampath gateway (`sampathGatewayService`). Keep keys server-side, handle failures with friendly messages (`utils/aiErrors.js`), and never log keys or full payment payloads.

## Testing
`npm test` runs `node --test`. Put tests in `backend/test/**/*.test.js` (nodemon already ignores `test/**`). Prefer unit tests on pure utils (`answerScoring`, `limitsEnforcer`, `codeGenerator`, `linkRules`) and route tests with a mocked `config/db`.
