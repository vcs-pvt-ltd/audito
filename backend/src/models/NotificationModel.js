const { db } = require('../config/db');
const { generateNotificationId } = require('../utils/codeGenerator');

const NotificationModel = {
  async create({
    notification_id,
    recipient_user_code,
    recipient_role,
    // Backward-compatible input while remaining callers are being upgraded.
    auditor_id,
    created_by_entity_code = null,
    type,
    title,
    message = null,
    audit_id = null,
    notify_date = null,
    notification_key = null,
  }) {
    const recipientCode = recipient_user_code || auditor_id;
    const recipientRole = recipient_role || (auditor_id ? 'auditor' : null);
    if (!recipientCode || !recipientRole) throw new Error('A notification recipient and role are required.');

    const id = notification_id || await generateNotificationId();
    await db.query(
      `INSERT INTO user_notifications
         (notification_id, recipient_user_code, recipient_role, created_by_entity_code, type, title, message, audit_id, notify_date, notification_key, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, recipientCode, recipientRole, created_by_entity_code, type, title, message, audit_id, notify_date, notification_key]
    );
    return id;
  },

  async createIfNotExists(payload) {
    if (!payload.notification_key) return this.create(payload);
    const [rows] = await db.query(
      'SELECT notification_id FROM user_notifications WHERE notification_key = ? LIMIT 1',
      [payload.notification_key]
    );
    return rows.length ? rows[0].notification_id : this.create(payload);
  },

  async hasNotificationKey(notificationKey) {
    const [rows] = await db.query(
      'SELECT notification_id FROM user_notifications WHERE notification_key = ? LIMIT 1',
      [notificationKey]
    );
    return rows.length > 0;
  },

  async listForUser(userCode, userRole) {
    const [rows] = await db.query(
      `SELECT notification_id, recipient_role, type, title, message, audit_id, notify_date, created_at, is_read
       FROM user_notifications
       WHERE is_active = TRUE
         AND recipient_user_code = ?
         AND recipient_role = ?
         AND (
           (type = 'audit_start' AND DATE(notify_date) = CURDATE())
           OR
           (type <> 'audit_start' AND (notify_date IS NULL OR DATE(notify_date) <= CURDATE()))
         )
       ORDER BY created_at DESC`,
      [userCode, userRole]
    );
    return rows;
  },

  async deleteByAuditForOtherRecipients(auditId, keepRecipientCode) {
    await db.query(
      `DELETE FROM user_notifications
       WHERE audit_id = ?
         AND recipient_user_code <> ?
         AND type IN ('audit_assigned', 'audit_start')`,
      [auditId, keepRecipientCode]
    );
  },

  async markReadStateForUser(notificationId, userCode, userRole, isRead) {
    const [result] = await db.query(
      `UPDATE user_notifications
       SET is_read = ?
       WHERE notification_id = ? AND recipient_user_code = ? AND recipient_role = ?`,
      [isRead ? 1 : 0, notificationId, userCode, userRole]
    );
    return result.affectedRows > 0;
  },

  async markAllReadForUser(userCode, userRole) {
    await db.query(
      `UPDATE user_notifications
       SET is_read = 1
       WHERE recipient_user_code = ? AND recipient_role = ? AND is_active = TRUE AND is_read = 0`,
      [userCode, userRole]
    );
  },

  async deleteForUser(notificationId, userCode, userRole) {
    const [result] = await db.query(
      `DELETE FROM user_notifications
       WHERE notification_id = ? AND recipient_user_code = ? AND recipient_role = ?`,
      [notificationId, userCode, userRole]
    );
    return result.affectedRows > 0;
  },
};

module.exports = NotificationModel;
