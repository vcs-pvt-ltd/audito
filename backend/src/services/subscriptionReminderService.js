const { db } = require('../config/db');
const NotificationModel = require('../models/NotificationModel');
const { sendSubscriptionExpiryReminderEmail } = require('./emailService');

const REMINDER_DAYS = [7, 3, 1];

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}

async function sendReminderForDay(daysLeft) {
  const [subscriptions] = await db.query(
    `SELECT s.subscription_id, s.root_entity_code, s.plan_name, s.end_date,
            a.admin_id, a.first_name, a.last_name, a.email
     FROM subscriptions s
     INNER JOIN admins a ON a.entity_code = s.root_entity_code AND a.role = 'admin'
     WHERE s.is_active = 1
       AND a.is_active = 1
       AND a.email IS NOT NULL
       AND DATE(s.end_date) = DATE_ADD(CURDATE(), INTERVAL ? DAY)`,
    [daysLeft]
  );

  for (const subscription of subscriptions) {
    const notificationKey = `subscription_expiry:${subscription.subscription_id}:${subscription.admin_id}:${daysLeft}`;
    if (await NotificationModel.hasNotificationKey(notificationKey)) continue;

    const adminName = `${subscription.first_name || ''} ${subscription.last_name || ''}`.trim() || 'Administrator';
    try {
      await sendSubscriptionExpiryReminderEmail(subscription.email, adminName, {
        planName: subscription.plan_name,
        endDate: subscription.end_date,
        daysLeft,
      });
      await NotificationModel.createIfNotExists({
        recipient_user_code: subscription.admin_id,
        recipient_role: 'admin',
        created_by_entity_code: subscription.root_entity_code,
        type: 'subscription_expiry',
        title: `Plan expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
        message: `Your ${subscription.plan_name} plan expires on ${formatDate(subscription.end_date)}. Renew now to avoid service interruption.`,
        notify_date: new Date(),
        notification_key: notificationKey,
      });
    } catch (error) {
      // No notification key is stored when email delivery fails, so a later run can retry.
      console.error(`Subscription reminder failed for ${subscription.subscription_id}:`, error.message);
    }
  }
}

async function runSubscriptionExpiryReminders() {
  for (const daysLeft of REMINDER_DAYS) await sendReminderForDay(daysLeft);
}

function startSubscriptionReminderScheduler() {
  const intervalMs = Number(process.env.SUBSCRIPTION_REMINDER_INTERVAL_MS || 6 * 60 * 60 * 1000);
  void runSubscriptionExpiryReminders();
  const timer = setInterval(() => void runSubscriptionExpiryReminders(), Math.max(intervalMs, 60 * 60 * 1000));
  timer.unref?.();
}

module.exports = { runSubscriptionExpiryReminders, startSubscriptionReminderScheduler };
