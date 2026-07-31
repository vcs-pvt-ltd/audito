/**
 * Audit Model
 *
 * Handles audit_assignments and audit_assignment_entities tables.
 */

const { db } = require('../config/db');

const AuditModel = {

  // ── ASSIGNMENTS ──────────────────────────────────────────────────

   async create({ audit_id, checklist_id, title, audit_type, assigned_auditor_id,
                  assigned_firm_code, assigned_org_tree_id, budget, currency, num_workers, start_date, end_date, notes, created_by, status }, executor = db) {
    await executor.query(
      `INSERT INTO audit_assignments
         (audit_id, checklist_id, title, audit_type, assigned_auditor_id,
          assigned_firm_code, assigned_org_tree_id, budget, currency, num_workers, start_date, end_date, notes, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [audit_id, checklist_id, title, audit_type,
       assigned_auditor_id || null, assigned_firm_code || null, assigned_org_tree_id || null,
       budget || null, currency || '$', num_workers || null,
       start_date, end_date, notes || null, created_by, status || 'Plan']
    );
    return audit_id;
  },

  async addEntities(audit_id, entities, executor = db) {
    if (!entities.length) return;
    const seen = new Set();
    const unique = [];
    for (const e of entities) {
      const key = `${e.entity_code}|${e.entity_type}|${e.org_tree_id || 'null'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(e);
      }
    }
    const { generateAuditAssignmentEntityIds } = require('../utils/codeGenerator');
    const ids = await generateAuditAssignmentEntityIds(unique.length);
    // A large checklist can target hundreds or thousands of entity instances.
    // Keep each INSERT comfortably below MySQL packet and placeholder limits.
    const INSERT_BATCH_SIZE = 200;
    for (let start = 0; start < unique.length; start += INSERT_BATCH_SIZE) {
      const batch = unique.slice(start, start + INSERT_BATCH_SIZE);
      const values = batch.map((e, offset) => [
        ids[start + offset],
        audit_id,
        e.org_tree_id || null,
        e.entity_code,
        e.entity_type,
      ]);
      await executor.query(
        `INSERT INTO audit_assignment_entities (audit_assignment_entity_id, audit_id, org_tree_id, entity_code, entity_type)
         VALUES ?`,
        [values]
      );
    }
  },

  async findById(audit_id) {
    const [rows] = await db.query(
      `SELECT aa.*, c.name AS checklist_name,
              c.time_period_value, c.time_period_unit, c.media_path AS checklist_media_path,
              c.budget AS checklist_budget, c.currency AS checklist_currency, c.num_workers AS checklist_num_workers
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.checklist_id = aa.checklist_id
       WHERE aa.audit_id = ? AND aa.is_active = TRUE`,
      [audit_id]
    );
    return rows[0] || null;
  },

  async findByCode(audit_id) {
    const [rows] = await db.query(
      `SELECT aa.*, c.name AS checklist_name,
              c.time_period_value, c.time_period_unit
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.checklist_id = aa.checklist_id
       WHERE aa.audit_id = ? AND aa.is_active = TRUE`,
      [audit_id]
    );
    return rows[0] || null;
  },

  async list(created_by) {
    const codes = Array.isArray(created_by) ? created_by : [created_by];
    const ph = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT aa.audit_id, aa.audit_id AS audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_id, aa.assigned_firm_code,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.checklist_id = aa.checklist_id
       WHERE aa.created_by IN (${ph}) AND aa.is_active = TRUE
       ORDER BY aa.created_at DESC`,
      codes
    );
    return rows;
  },

  async listForAuditor(auditor_code) {
    const [rows] = await db.query(
      `SELECT aa.audit_id, aa.audit_id AS audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_id, aa.assigned_firm_code,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.checklist_id = aa.checklist_id
       WHERE aa.assigned_auditor_id = ? 
         AND aa.is_active = TRUE
         AND aa.status != 'cancelled'
       ORDER BY aa.start_date ASC`,
      [auditor_code]
    );
    return rows;
  },

  async listAssignedToFirm(firm_code) {
    const [rows] = await db.query(
      `SELECT aa.audit_id, aa.audit_id AS audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_id, aa.assigned_firm_code, aa.assigned_org_tree_id,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.checklist_id = aa.checklist_id
       WHERE aa.assigned_firm_code = ? AND aa.is_active = TRUE AND aa.status != 'cancelled'
       ORDER BY aa.start_date ASC`,
      [firm_code]
    );
    return rows;
  },

  async listForOrganizationUser(scopeOrOrgTreeId, assignedEntityCode) {
    const {
      getOrganizationUserOrgTreeScope,
      getOrganizationUserEntityCodeScope,
    } = require('../utils/accessHelper');
    const isResolvedScope = scopeOrOrgTreeId
      && typeof scopeOrOrgTreeId === 'object'
      && Array.isArray(scopeOrOrgTreeId.orgTreeIds);
    const scopeIds = isResolvedScope
      ? scopeOrOrgTreeId.orgTreeIds
      : await getOrganizationUserOrgTreeScope(scopeOrOrgTreeId);
    const entityCodeScope = isResolvedScope
      ? (scopeOrOrgTreeId.entityCodes || [])
      : (scopeIds.length ? [] : await getOrganizationUserEntityCodeScope(assignedEntityCode));
    if (!scopeIds.length && !entityCodeScope.length) return [];

    const conditions = [];
    const scopeValues = [];
    if (scopeIds.length) {
      conditions.push(`aae.org_tree_id IN (${scopeIds.map(() => '?').join(',')})`);
      scopeValues.push(...scopeIds);
    }
    if (entityCodeScope.length) {
      conditions.push(`(aae.org_tree_id IS NULL AND aae.entity_code IN (${entityCodeScope.map(() => '?').join(',')}))`);
      scopeValues.push(...entityCodeScope);
    }
    const [rows] = await db.query(
      `SELECT DISTINCT aa.audit_id, aa.audit_id AS audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_id, aa.assigned_firm_code,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.checklist_id = aa.checklist_id
       INNER JOIN audit_assignment_entities aae ON aae.audit_id = aa.audit_id
       WHERE (${conditions.join(' OR ')})
         AND aa.is_active = TRUE 
         AND aae.is_active = TRUE
         AND aa.status != 'cancelled'
       ORDER BY aa.start_date ASC`,
      scopeValues
    );
    return rows;
  },

  /**
   * Completed audits that can be compared. Access is limited to audits created
   * by the caller's accessible organizations or assigned to their audit firm.
   */
  async listComparisonCandidates({ accessibleCodes = [], firmCode = null }) {
    const conditions = [];
    const params = [];
    if (accessibleCodes.length) {
      conditions.push(`aa.created_by IN (${accessibleCodes.map(() => '?').join(',')})`);
      params.push(...accessibleCodes);
    }
    if (firmCode) {
      conditions.push('aa.assigned_firm_code = ?');
      params.push(firmCode);
    }
    if (!conditions.length) return [];

    const [rows] = await db.query(
      `SELECT aa.audit_id, aa.checklist_id, aa.title, aa.audit_type, aa.start_date, aa.end_date,
              aa.completed_at, c.name AS checklist_name,
              COALESCE(scores.marks_obtained, 0) AS marks_obtained,
              COALESCE(scores.total_marks, 0) AS total_marks
         FROM audit_assignments aa
         INNER JOIN checklists c ON c.checklist_id = aa.checklist_id
         LEFT JOIN (
           SELECT r.audit_id,
                  SUM(COALESCE(r.marks_obtained, 0)) AS marks_obtained,
                  SUM(COALESCE(q.total_marks, 0)) AS total_marks
             FROM audit_responses r
             INNER JOIN checklist_questions q ON q.checklist_question_id = r.checklist_question_id
            WHERE r.status = 'answered'
            GROUP BY r.audit_id
         ) scores ON scores.audit_id = aa.audit_id
        WHERE aa.is_active = TRUE
          AND aa.status = 'completed'
          AND (${conditions.join(' OR ')})
        ORDER BY c.name ASC, COALESCE(aa.completed_at, aa.end_date, aa.created_at) DESC`,
      params
    );
    return rows;
  },

  /**
   * Returns entity-level comparison input. Question identifiers are used only
   * inside the server join and are never returned to the client.
   */
  async getComparisonResponseRows(auditIds) {
    if (!auditIds.length) return [];
    const placeholders = auditIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT r.audit_id, r.entity_code, r.org_tree_id, q.entity_type,
              r.marks_obtained, q.total_marks,
              (
                SELECT COUNT(*)
                  FROM corrective_actions action_item
                 WHERE action_item.audit_response_id = r.audit_response_id
              ) AS corrective_action_count,
              (
                SELECT COUNT(*)
                  FROM corrective_actions action_item
                 WHERE action_item.audit_response_id = r.audit_response_id
                   AND action_item.status NOT IN ('resolved', 'verified', 'closed')
              ) AS open_corrective_action_count
         FROM audit_responses r
         INNER JOIN checklist_questions q
           ON q.checklist_question_id = r.checklist_question_id
        WHERE r.audit_id IN (${placeholders})
        ORDER BY q.entity_type, r.org_tree_id, r.entity_code`,
      auditIds
    );
    return rows;
  },

  async getEntities(audit_id) {
    const [rows] = await db.query(
      `SELECT org_tree_id, entity_code, entity_type
       FROM audit_assignment_entities
       WHERE audit_id = ? AND is_active = TRUE`,
      [audit_id]
    );
    return rows;
  },

  async getWithEntities(id) {
    const assignment = await this.findById(id);
    if (!assignment) return null;
    assignment.entities = await this.getEntities(id);
    return assignment;
  },

  async update(audit_id, { title, audit_type, assigned_auditor_id, assigned_firm_code, assigned_org_tree_id,
                     budget, currency, num_workers, start_date, end_date, notes, status }) {
    await db.query(
      `UPDATE audit_assignments
       SET title = ?, audit_type = ?, assigned_auditor_id = ?,
           assigned_firm_code = ?, assigned_org_tree_id = ?, budget = ?, currency = ?, num_workers = ?,
           start_date = ?, end_date = ?, notes = ?, status = ?
       WHERE audit_id = ?`,
      [title, audit_type,
       assigned_auditor_id || null, assigned_firm_code || null, assigned_org_tree_id || null,
       budget || null, currency || '$', num_workers || null,
       start_date, end_date, notes || null, status || 'pending', audit_id]
    );
  },

  async updateAssignedAuditor(audit_id, { assigned_auditor_id, assigned_org_tree_id }) {
    await db.query(
      'UPDATE audit_assignments SET assigned_auditor_id = ?, assigned_org_tree_id = ? WHERE audit_id = ? AND is_active = TRUE',
      [assigned_auditor_id || null, assigned_org_tree_id || null, audit_id]
    );
  },

  async updateEntities(audit_id, entities) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        'DELETE FROM audit_assignment_entities WHERE audit_id = ?',
        [audit_id]
      );
      if (entities.length) await this.addEntities(audit_id, entities, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async delete(audit_id) {
    await db.query(
      'DELETE FROM audit_assignments WHERE audit_id = ?',
      [audit_id]
    );
  },
};

module.exports = AuditModel;
