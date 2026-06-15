const { db } = require('../config/db');

const NotificationModel = {
  async create({
    auditor_code,
    created_by_entity_code,
    type,
    title,
    message,
    audit_id = null,
    notify_date = null,
    notification_key = null,
  }) {
    const [res] = await db.query(
      `INSERT INTO auditor_notifications
         (auditor_code, created_by_entity_code, type, title, message, audit_id, notify_date, notification_key, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        auditor_code,
        created_by_entity_code,
        type,
        title,
        message,
        audit_id,
        notify_date,
        notification_key,
      ]
    );
    return res.insertId;
  },

  async createIfNotExists(payload) {
    if (!payload.notification_key) {
      return this.create(payload);
    }
    const [rows] = await db.query(
      `SELECT id FROM auditor_notifications WHERE notification_key = ? LIMIT 1`,
      [payload.notification_key]
    );
    if (rows.length) return rows[0].id;
    return this.create(payload);
  },

  async listForAuditor(createdByEntityCode, auditorCode) {
    const [rows] = await db.query(
      `SELECT id, type, title, message, audit_id, notify_date, created_at, is_read
       FROM auditor_notifications
       WHERE is_active = TRUE
         AND created_by_entity_code = ?
         AND auditor_code = ?
         AND (
           (type = 'audit_start' AND DATE(notify_date) = CURDATE())
           OR
           (type <> 'audit_start' AND (notify_date IS NULL OR DATE(notify_date) <= CURDATE()))
         )
       ORDER BY created_at DESC`,
      [createdByEntityCode, auditorCode]
    );
    return rows;
  },

  async deleteByAuditForOtherAuditors(auditId, keepAuditorCode) {
    await db.query(
      `DELETE FROM auditor_notifications
       WHERE audit_id = ?
         AND auditor_code <> ?
         AND type IN ('audit_assigned', 'audit_start')`,
      [Number(auditId), keepAuditorCode]
    );
  },

  async markReadStateForAuditor(id, auditorCode, isRead) {
    await db.query(
      `UPDATE auditor_notifications
       SET is_read = ?
       WHERE id = ? AND auditor_code = ?`,
      [isRead ? 1 : 0, Number(id), auditorCode]
    );
  },

  async deleteForAuditor(id, auditorCode) {
    await db.query(
      `DELETE FROM auditor_notifications
       WHERE id = ? AND auditor_code = ?`,
      [Number(id), auditorCode]
    );
  },

};

module.exports = NotificationModel;
