const { db } = require('../config/db');
const { generateTableId } = require('../utils/codeGenerator');

const NotificationModel = {
  async create({
    auditor_notification_id,
    auditor_id,
    created_by_entity_code,
    type,
    title,
    message,
    audit_id = null,
    notify_date = null,
    notification_key = null,
  }) {
    if (!auditor_notification_id) {
      auditor_notification_id = await generateTableId('auditor_notifications', 'auditor_notification_id', 'ANOT', 5);
    }
    await db.query(
      `INSERT INTO auditor_notifications
         (auditor_notification_id, auditor_id, created_by_entity_code, type, title, message, audit_id, notify_date, notification_key, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        auditor_notification_id,
        auditor_id,
        created_by_entity_code,
        type,
        title,
        message,
        audit_id,
        notify_date,
        notification_key,
      ]
    );
    return auditor_notification_id;
  },

  async createIfNotExists(payload) {
    if (!payload.notification_key) {
      return this.create(payload);
    }
    const [rows] = await db.query(
      `SELECT auditor_notification_id FROM auditor_notifications WHERE notification_key = ? LIMIT 1`,
      [payload.notification_key]
    );
    if (rows.length) return rows[0].auditor_notification_id;
    return this.create(payload);
  },

  async listForAuditor(createdByEntityCode, auditorId) {
    const [rows] = await db.query(
      `SELECT auditor_notification_id, type, title, message, audit_id, notify_date, created_at, is_read
       FROM auditor_notifications
       WHERE is_active = TRUE
         AND created_by_entity_code = ?
         AND auditor_id = ?
         AND (
           (type = 'audit_start' AND DATE(notify_date) = CURDATE())
           OR
           (type <> 'audit_start' AND (notify_date IS NULL OR DATE(notify_date) <= CURDATE()))
         )
       ORDER BY created_at DESC`,
      [createdByEntityCode, auditorId]
    );
    return rows;
  },

  async deleteByAuditForOtherAuditors(auditId, keepAuditorId) {
    await db.query(
      `DELETE FROM auditor_notifications
       WHERE audit_id = ?
         AND auditor_id <> ?
         AND type IN ('audit_assigned', 'audit_start')`,
      [auditId, keepAuditorId]
    );
  },

  async markReadStateForAuditor(auditor_notification_id, auditorId, isRead) {
    await db.query(
      `UPDATE auditor_notifications
       SET is_read = ?
       WHERE auditor_notification_id = ? AND auditor_id = ?`,
      [isRead ? 1 : 0, auditor_notification_id, auditorId]
    );
  },

  async deleteForAuditor(auditor_notification_id, auditorId) {
    await db.query(
      `DELETE FROM auditor_notifications
       WHERE auditor_notification_id = ? AND auditor_id = ?`,
      [auditor_notification_id, auditorId]
    );
  },

};

module.exports = NotificationModel;
