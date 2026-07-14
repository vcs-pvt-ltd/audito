const { db } = require('../config/db');
const { generateNoticeId } = require('../utils/codeGenerator');

const NoticeModel = {
  async createNotice({ notice_id, title, message, notice_date, assign_to_all, created_by_admin_id, created_by_entity_code }) {
    const id = notice_id || await generateNoticeId();
    await db.query(
      `INSERT INTO notices (notice_id, title, message, notice_date, assign_to_all, created_by_admin_id, created_by_entity_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, title, message, notice_date, assign_to_all ? 1 : 0, created_by_admin_id, created_by_entity_code]
    );
    return id;
  },

  async getNoticeById(notice_id) {
    const [rows] = await db.query('SELECT * FROM notices WHERE notice_id = ? AND is_active = TRUE', [notice_id]);
    return rows[0] || null;
  },

  async listByAdmin(entityCodes) {
    const codes = Array.isArray(entityCodes) ? entityCodes : [entityCodes];
    const ph = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT n.*, 
              GROUP_CONCAT(a.auditor_id) AS assigned_auditor_ids,
              COUNT(DISTINCT a.notice_auditor_assignment_id) AS assigned_count
       FROM notices n
       LEFT JOIN notice_auditor_assignments a ON n.notice_id = a.notice_id
       WHERE n.created_by_entity_code IN (${ph}) AND n.is_active = TRUE
       GROUP BY n.notice_id
       ORDER BY n.notice_date DESC, n.created_at DESC`,
      codes
    );

    return rows.map((row) => ({
      ...row,
      assign_to_all: !!row.assign_to_all,
      assigned_auditor_ids: row.assigned_auditor_ids ? String(row.assigned_auditor_ids).split(',') : [],
      assigned_count: Number(row.assigned_count || 0),
    }));
  },

  async updateNotice(notice_id, fields) {
    const allowed = ['title', 'message', 'notice_date', 'assign_to_all'];
    const updates = [];
    const values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        updates.push(`\`${key}\` = ?`);
        values.push(key === 'assign_to_all' ? (value ? 1 : 0) : value);
      }
    }
    if (!updates.length) return false;
    values.push(notice_id);
    await db.query(`UPDATE notices SET ${updates.join(', ')} WHERE notice_id = ?`, values);
    return true;
  },

  async deactivateNotice(notice_id) {
    await db.query('UPDATE notices SET is_active = FALSE WHERE notice_id = ?', [notice_id]);
  },

  async assignAuditors(notice_id, auditor_ids) {
    await db.query('DELETE FROM notice_auditor_assignments WHERE notice_id = ?', [notice_id]);
    if (!Array.isArray(auditor_ids) || auditor_ids.length === 0) {
      return;
    }

    const values = [];
    const placeholders = auditor_ids.map(() => '(?, ?)').join(', ');
    for (const auditor_id of auditor_ids) {
      values.push(notice_id, auditor_id);
    }

    await db.query(
      `INSERT INTO notice_auditor_assignments (notice_id, auditor_id) VALUES ${placeholders}`,
      values
    );
  },

  async getNoticesForAuditor(createdByEntityCode, auditorId) {
    const [rows] = await db.query(
      `SELECT DISTINCT n.*
       FROM notices n
       LEFT JOIN notice_auditor_assignments a ON n.notice_id = a.notice_id
       WHERE n.is_active = TRUE
         AND n.created_by_entity_code = ?
         AND (n.assign_to_all = TRUE OR a.auditor_id = ?)
       ORDER BY n.notice_date DESC, n.created_at DESC`,
      [createdByEntityCode, auditorId]
    );
    return rows.map((row) => ({
      ...row,
      assign_to_all: !!row.assign_to_all,
    }));
  }
};

module.exports = NoticeModel;
