# Database rules (PostgreSQL 18)

Owned by the `migrations` thread (`.claude/agents/migrations.md`: file format, column conventions, new-table template, grants, table ownership map). Every database change goes through it.

- `audito.sql` is the baseline dump (~500KB, ~80 tables, schema `public`). **Read-only reference. Never edit it.**
- New changes: one file per change in `migrations/new/`, named `YYYYMMDD_short_description.sql`. Existing: `20261008_*` (backfill manual payment notifications, company sections timezone/logo, drop plan tables, link security columns).
- **Never edit a migration once it has been applied anywhere.** Not sure if applied? Ask the user.
- Make migrations idempotent and re-runnable: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, guarded `DO $$` blocks for constraints. Wrap multi-step changes in `BEGIN; ... COMMIT;`.
- Destructive changes (DROP, column removal, type change, data deletion) need explicit user approval and a rollback note in a comment at the top of the file.
- Conventions seen in the schema: surrogate `id` plus public code columns (`*_id` strings generated in `utils/codeGenerator.js`), `is_active` flags for soft delete, `created_at`/`updated_at` timestamps without time zone. Add indexes for foreign keys and for `entity_code`-style scoping columns used in WHERE clauses.
- The app role must be granted privileges on new tables (see `connectDB` check in `config/db.js` and `.env.example` notes on `DATABASE_MIGRATION_URL`); include `GRANT` statements when the project uses a separate owner role.
- **KNOWN GAP:** no migration runner or applied-migrations table exists (`npm run migrate` references a missing `migrate.js`). Do not create one without approval; give the user the SQL and the `psql -f` command instead.
- Seeds: none found in the repo. Never put real customer data or credentials in seed files.
- Never run SQL against a database yourself. Validate by reading and by `psql --set ON_ERROR_STOP=1 -f` only when the user asks.
