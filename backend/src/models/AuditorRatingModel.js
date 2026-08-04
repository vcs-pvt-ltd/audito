const { db } = require('../config/db');

const AuditorRatingModel = {
  async findByAuditId(auditId) {
    const [rows] = await db.query(
      `SELECT auditor_rating_id, audit_id, auditor_id, rated_by_admin_id, stars, comment, created_at, updated_at
         FROM auditor_audit_ratings
        WHERE audit_id = ?
        LIMIT 1`,
      [auditId]
    );
    return rows[0] || null;
  },

  async upsert({ auditor_rating_id, audit_id, auditor_id, rated_by_admin_id, stars, comment }) {
    const existing = await this.findByAuditId(audit_id);
    if (existing) {
      await db.query(
        `UPDATE auditor_audit_ratings
            SET auditor_id = ?, rated_by_admin_id = ?, stars = ?, comment = ?
          WHERE audit_id = ?`,
        [auditor_id, rated_by_admin_id, stars, comment || null, audit_id]
      );
      return this.findByAuditId(audit_id);
    }

    await db.query(
      `INSERT INTO auditor_audit_ratings
         (auditor_rating_id, audit_id, auditor_id, rated_by_admin_id, stars, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [auditor_rating_id, audit_id, auditor_id, rated_by_admin_id, stars, comment || null]
    );
    return this.findByAuditId(audit_id);
  },

  async getSummariesByAuditorIds(auditorIds) {
    const ids = [...new Set((auditorIds || []).filter(Boolean))];
    if (!ids.length) return new Map();

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT rating.auditor_id,
              ROUND(AVG(rating.stars), 1) AS average_rating,
              COUNT(*) AS rating_count
         FROM auditor_audit_ratings rating
         INNER JOIN audit_assignments audit ON audit.audit_id = rating.audit_id
        WHERE rating.auditor_id IN (${placeholders})
          AND LOWER(audit.status) = 'completed'
        GROUP BY rating.auditor_id`,
      ids
    );

    return new Map(rows.map((row) => [String(row.auditor_id), row]));
  },
};

module.exports = AuditorRatingModel;
