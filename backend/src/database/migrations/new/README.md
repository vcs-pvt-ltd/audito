# Pending migrations (`migrations/new/`)

Inventory kept by the `migrations` thread. There is no migration runner and no
applied-migrations table, so **which files have run where is tracked only in the
table at the bottom**. Update it whenever you apply a file.

Baseline: `../../audito.sql` is a `pg_dump` **custom-format** archive (PostgreSQL
18.6, 83 tables, owner `postgres`, DML grants to `dilan`). Restore it with
`pg_restore`, not `psql`. It contains table data, so use `--schema-only` for any
non-production copy.

## Files and run order

Run in this order (alphabetical order also works: none of the files depends on
another). Apply each with:

```bash
psql "$DATABASE_MIGRATION_URL" --set ON_ERROR_STOP=1 -f backend/src/database/migrations/new/<file>.sql
```

| # | File | What it does | Changes data? | Safe to rerun | Depends on |
|---|---|---|---|---|---|
| 1 | `20261008_link_security_columns_postgresql.sql` | Adds `organization_links.verification_key_hash` and `verification_key_verified_at`. | No | Yes (`ADD COLUMN IF NOT EXISTS`) | Baseline. **No-op on a database restored from the current `audito.sql`**: both columns are already in it. Only matters for databases created before the baseline. |
| 2 | `20261008_company_sections_timezone_logo.sql` | Adds `company_sections.timezone` and `organization_logo` (`varchar(255)`, `audito_ci`). Fixes "column timezone does not exist" for Section workspaces. | No | Yes (`ADD COLUMN IF NOT EXISTS`) | Baseline. **Needed** on a baseline restore: the columns are missing there. |
| 3 | `20261008_backfill_manual_payment_notifications.sql` | Inserts the `audito_admin` in-app notifications that failed when MySQL-style `0` was written to boolean `user_notifications.is_read`: one per (pending payment with `manual_approval_status = 'requested'`) x (active, verified `audito_admin`). | Yes, inserts only | Yes (deterministic `notification_id`/`notification_key`, `NOT EXISTS` + unique `notification_key`, `ON CONFLICT DO NOTHING`) | Baseline tables `payment_transactions`, `admins`, `user_notifications` (id default from `user_notifications_id_seq`). Inserts nothing on an empty database. |
| 4 | `20261008_drop_plan_tables.sql` | **Destructive.** Drops `plan_settings`, `plan_entry_prices`, `custom_solution_requests`, `link_credit_applications`, `link_billing_credits`, `subscriptions` (and with them their sequences and `*_touch_updated_at` triggers) in one transaction. | **Yes, deletes tables and rows** | Yes (`DROP TABLE IF EXISTS`) | Baseline. No other baseline table has a foreign key to these six. Run last, as the table owner, **after a backup** if the plan history matters. |

### Notes on file 4 (`drop_plan_tables`)

- Rollback is only a restore from backup (e.g. `pg_restore --table=subscriptions ...`
  from a dump taken before the drop). The header says "back up first" but has no
  explicit rollback line, and its `DROP` statements are not `public.`-qualified.
  Both are style gaps only; it works with the default `search_path`. If it has
  **not** been applied anywhere yet it can still be corrected; if it has, leave it.
- Code that still names the dropped tables is dead, not mounted or required:
  `models/PlanSettingsModel.js`, `models/CustomSolutionModel.js`,
  `models/LinkBillingCreditModel.js`, `routes/billingCreditRoutes.js` (not in
  `server.js`), `services/subscriptionReminderService.js` (not required anywhere).
  Removal belongs to `billing` and needs the user's say-so.

## Applied status (fill in; unknown to Claude)

| File | Local dev | Staging | Production |
|---|---|---|---|
| `20261008_link_security_columns_postgresql.sql` | ? | ? | ? |
| `20261008_company_sections_timezone_logo.sql` | ? | ? | ? |
| `20261008_backfill_manual_payment_notifications.sql` | ? | ? | ? |
| `20261008_drop_plan_tables.sql` | ? | ? | ? |

Once a file is marked applied anywhere it must never be edited; fix forward with
a new file.
