# Manual database migrations

Apply migrations in filename order before deploying the application code that
depends on them.

## Organization Users

1. Back up the database.
2. Apply `20260731_organization_users.sql`.
3. Apply `20260801_rename_organization_users_to_organization_users.sql`.
4. Verify that every active row in `organization_users` has at least one row in
   `organization_user_scopes`.
5. Deploy the backend and frontend together.

If a database is created from the updated `auditov3.sql` snapshot, these two
historical migrations are not required because that snapshot already contains
the final `organization_users` and `organization_user_scopes` schema.

Verification query:

```sql
SELECT ou.organization_user_id, ou.email
FROM organization_users ou
LEFT JOIN organization_user_scopes ous
  ON ous.organization_user_id = ou.organization_user_id
 AND ous.is_active = TRUE
WHERE ou.is_active = TRUE
GROUP BY ou.organization_user_id, ou.email
HAVING COUNT(ous.scope_id) = 0;
```

The result should be empty unless an old user intentionally had no entity
assignment. The application retains a legacy single-assignment fallback, but
new Organization Users must always have at least one scope.

Existing identifier values are retained, but the table, primary identifier
column, foreign-key columns, application role, models, and routes use
`organization_user` terminology after the second migration.

The rename migration also converts existing refresh-token metadata and
notification recipient roles. Already-issued JWTs continue to work because the
application normalizes the legacy role until those tokens expire.

## Manual payment approval

Apply `20260802_manual_payment_approval.sql` before deploying the manual-payment
approval workflow. It adds the review state and immutable reviewer timestamps
used by the customer payment page and the Audito Admin payment queue.

Set `PAYMENT_MODE=manual_approval` (or leave it unset) while payments are being
verified manually. When the payment gateway is ready, set
`PAYMENT_MODE=gateway`; existing gateway checkout and callback settlement will
then become the active customer flow without removing the approval history.

`PAYMENT_CONTACT_EMAIL` is optional and defaults to `hi@audito.cloud`.
