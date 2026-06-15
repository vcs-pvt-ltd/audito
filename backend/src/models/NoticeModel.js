const { db } = require('../config/db');

const NoticeModel = {
  async createNotice({ title, message, notice_date, assign_to_all, created_by_admin_id, created_by_entity_code }) {
    const [result] = await db.query(
      `INSERT INTO notices (title, message, notice_date, assign_to_all, created_by_admin_id, created_by_entity_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, message, notice_date, assign_to_all ? 1 : 0, created_by_admin_id, created_by_entity_code]
    );
    return result.insertId;
  },

  async getNoticeById(id) {
    const [rows] = await db.query('SELECT * FROM notices WHERE id = ? AND is_active = TRUE', [id]);
    return rows[0] || null;
  },

  async listByAdmin(entityCode) {
    const [rows] = await db.query(
      `SELECT n.*, 
              GROUP_CONCAT(a.auditor_code) AS assigned_auditor_codes,
              COUNT(DISTINCT a.id) AS assigned_count
       FROM notices n
       LEFT JOIN notice_auditor_assignments a ON n.id = a.notice_id
       WHERE n.created_by_entity_code = ? AND n.is_active = TRUE
       GROUP BY n.id
       ORDER BY n.notice_date DESC, n.created_at DESC`,
      [entityCode]
    );

    return rows.map((row) => ({
      ...row,
      assign_to_all: !!row.assign_to_all,
      assigned_auditor_codes: row.assigned_auditor_codes ? String(row.assigned_auditor_codes).split(',') : [],
      assigned_count: Number(row.assigned_count || 0),
    }));
  },

  async updateNotice(id, fields) {
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
    values.push(id);
    await db.query(`UPDATE notices SET ${updates.join(', ')} WHERE id = ?`, values);
    return true;
  },

  async deactivateNotice(id) {
    await db.query('UPDATE notices SET is_active = FALSE WHERE id = ?', [id]);
  },

  async assignAuditors(notice_id, auditor_codes) {
    await db.query('DELETE FROM notice_auditor_assignments WHERE notice_id = ?', [notice_id]);
    if (!Array.isArray(auditor_codes) || auditor_codes.length === 0) {
      return;
    }

    const values = [];
    const placeholders = auditor_codes.map(() => '(?, ?)').join(', ');
    for (const auditor_code of auditor_codes) {
      values.push(notice_id, auditor_code);
    }

    await db.query(
      `INSERT INTO notice_auditor_assignments (notice_id, auditor_code) VALUES ${placeholders}`,
      values
    );
  },

  async getNoticesForAuditor(createdByEntityCode, auditorCode) {
    const [rows] = await db.query(
      `SELECT DISTINCT n.*
       FROM notices n
       LEFT JOIN notice_auditor_assignments a ON n.id = a.notice_id
       WHERE n.is_active = TRUE
         AND n.created_by_entity_code = ?
         AND (n.assign_to_all = TRUE OR a.auditor_code = ?)
       ORDER BY n.notice_date DESC, n.created_at DESC`,
      [createdByEntityCode, auditorCode]
    );
    return rows.map((row) => ({
      ...row,
      assign_to_all: !!row.assign_to_all,
    }));
  }
};

module.exports = NoticeModel;
