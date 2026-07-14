/**
 * Audit Model
 *
 * Handles audit_assignments and audit_assignment_entities tables.
 */

const { db } = require('../config/db');

const AuditModel = {

  // ── ASSIGNMENTS ──────────────────────────────────────────────────

   async create({ audit_id, checklist_id, title, audit_type, assigned_auditor_id,
                  assigned_firm_code, assigned_org_tree_id, budget, currency, num_workers, start_date, end_date, notes, created_by, status }) {
    await db.query(
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

  async addEntities(audit_id, entities) {
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
    const values = unique.map((e, i) => [ids[i], audit_id, e.org_tree_id || null, e.entity_code, e.entity_type]);
    await db.query(
      `INSERT INTO audit_assignment_entities (audit_assignment_entity_id, audit_id, org_tree_id, entity_code, entity_type)
       VALUES ?`,
      [values]
    );
  },

  async findById(audit_id) {
    const [rows] = await db.query(
      `SELECT aa.*, c.name AS checklist_name,
              c.time_period_value, c.time_period_unit,
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

  async listForEntityHead(orgTreeId) {
    const { getEntityHeadOrgTreeScope } = require('../utils/accessHelper');
    const scopeIds = await getEntityHeadOrgTreeScope(orgTreeId);
    if (!scopeIds.length) return [];
    const ph = scopeIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT DISTINCT aa.audit_id, aa.audit_id AS audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_id, aa.assigned_firm_code,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.checklist_id = aa.checklist_id
       INNER JOIN audit_assignment_entities aae ON aae.audit_id = aa.audit_id
       WHERE aae.org_tree_id IN (${ph}) 
         AND aa.is_active = TRUE 
         AND aae.is_active = TRUE
         AND aa.status != 'cancelled'
       ORDER BY aa.start_date ASC`,
      scopeIds
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
    await db.query(
      'DELETE FROM audit_assignment_entities WHERE audit_id = ?',
      [audit_id]
    );
    if (entities.length) await this.addEntities(audit_id, entities);
  },

  async delete(audit_id) {
    await db.query(
      'UPDATE audit_assignments SET is_active = FALSE WHERE audit_id = ?',
      [audit_id]
    );
  },
};

module.exports = AuditModel;
