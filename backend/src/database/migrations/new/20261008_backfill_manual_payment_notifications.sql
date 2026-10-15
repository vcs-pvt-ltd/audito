-- Repair in-app admin notifications omitted when MySQL-style 0 was rejected
-- by PostgreSQL's boolean user_notifications.is_read column.
-- Safe to rerun: existing notification keys are left unchanged.

INSERT INTO public.user_notifications (
  notification_id,
  recipient_user_code,
  recipient_role,
  created_by_entity_code,
  type,
  title,
  message,
  notification_key,
  is_read
)
SELECT
  'NOTI-' || LEFT(MD5(payment.payment_transaction_id || ':' || admin.admin_id), 15),
  admin.admin_id,
  'audito_admin',
  payment.root_entity_code,
  'manual_payment_approval_requested',
  'Payment approval requested',
  COALESCE(NULLIF(payment.org_name, ''), 'An organization') ||
    ' requested approval for ' || payment.plan_name || ' (' || payment.billing_cycle || ').',
  'manual-payment:' || payment.payment_transaction_id || ':' || admin.admin_id,
  FALSE
FROM public.payment_transactions AS payment
JOIN public.admins AS admin
  ON admin.role = 'audito_admin'
 AND admin.is_active = TRUE
 AND admin.is_verified = TRUE
WHERE payment.status = 'pending'
  AND payment.manual_approval_status = 'requested'
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_notifications AS notification
    WHERE notification.notification_key =
      'manual-payment:' || payment.payment_transaction_id || ':' || admin.admin_id
  )
ON CONFLICT DO NOTHING;
