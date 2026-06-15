/**
 * Audit Model
 *
 * Handles audit_assignments and audit_assignment_entities tables.
 */

const { db } = require('../config/db');

const AuditModel = {

  // ── ASSIGNMENTS ──────────────────────────────────────────────────

   async create({ audit_code, checklist_id, title, audit_type, assigned_auditor_code,
                  assigned_firm_code, assigned_org_tree_id, budget, currency, num_workers, start_date, end_date, notes, created_by, status }) {
    const [res] = await db.query(
      `INSERT INTO audit_assignments
         (audit_code, checklist_id, title, audit_type, assigned_auditor_code,
          assigned_firm_code, assigned_org_tree_id, budget, currency, num_workers, start_date, end_date, notes, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [audit_code, checklist_id, title, audit_type,
       assigned_auditor_code || null, assigned_firm_code || null, assigned_org_tree_id || null,
       budget || null, currency || '$', num_workers || null,
       start_date, end_date, notes || null, created_by, status || 'Plan']
    );
    return res.insertId;
  },

  async addEntities(assignment_id, entities) {
    if (!entities.length) return;
    // Deduplicate by (entity_code, entity_type, org_tree_id)
    // This allows the same entity to be stored multiple times if it appears in different org tree branches.
    const seen = new Set();
    const unique = [];
    for (const e of entities) {
      const key = `${e.entity_code}|${e.entity_type}|${e.org_tree_id ?? 'null'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(e);
      }
    }
    const values = unique.map(e => [assignment_id, e.org_tree_id || null, e.entity_code, e.entity_type]);
    await db.query(
      `INSERT INTO audit_assignment_entities (assignment_id, org_tree_id, entity_code, entity_type)
       VALUES ?`,
      [values]
    );
  },

  async findById(id) {
    const [rows] = await db.query(
      `SELECT aa.*, c.name AS checklist_name,
              c.time_period_value, c.time_period_unit,
              c.budget AS checklist_budget, c.currency AS checklist_currency, c.num_workers AS checklist_num_workers
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.id = aa.checklist_id
       WHERE aa.id = ? AND aa.is_active = TRUE`,
      [id]
    );
    return rows[0] || null;
  },

  async findByCode(audit_code) {
    const [rows] = await db.query(
      `SELECT aa.*, c.name AS checklist_name,
              c.time_period_value, c.time_period_unit
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.id = aa.checklist_id
       WHERE aa.audit_code = ? AND aa.is_active = TRUE`,
      [audit_code]
    );
    return rows[0] || null;
  },

  async list(created_by) {
    const codes = Array.isArray(created_by) ? created_by : [created_by];
    const ph = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT aa.id, aa.audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_code, aa.assigned_firm_code,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.id AS checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.id = aa.checklist_id
       WHERE aa.created_by IN (${ph}) AND aa.is_active = TRUE
       ORDER BY aa.created_at DESC`,
      codes
    );
    return rows;
  },

  async listForAuditor(auditor_code) {
    const [rows] = await db.query(
      `SELECT aa.id, aa.audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_code, aa.assigned_firm_code,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.id AS checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.id = aa.checklist_id
       WHERE aa.assigned_auditor_code = ? 
         AND aa.is_active = TRUE
         AND aa.status != 'cancelled'
       ORDER BY aa.start_date ASC`,
      [auditor_code]
    );
    return rows;
  },

  async listAssignedToFirm(firm_code) {
    const [rows] = await db.query(
      `SELECT aa.id, aa.audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_code, aa.assigned_firm_code, aa.assigned_org_tree_id,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.id AS checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.id = aa.checklist_id
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
      `SELECT DISTINCT aa.id, aa.audit_code, aa.title, aa.audit_type, aa.status,
              aa.start_date, aa.end_date, aa.budget, aa.currency, aa.num_workers,
              aa.assigned_auditor_code, aa.assigned_firm_code,
              aa.created_at, aa.audit_mode, aa.parent_audit_id, aa.completed_at,
              c.name AS checklist_name, c.id AS checklist_id
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.id = aa.checklist_id
       INNER JOIN audit_assignment_entities aae ON aae.assignment_id = aa.id
       WHERE aae.org_tree_id IN (${ph}) 
         AND aa.is_active = TRUE 
         AND aae.is_active = TRUE
         AND aa.status != 'cancelled'
       ORDER BY aa.start_date ASC`,
      scopeIds
    );
    return rows;
  },

  async getEntities(assignment_id) {
    const [rows] = await db.query(
      `SELECT org_tree_id, entity_code, entity_type
       FROM audit_assignment_entities
       WHERE assignment_id = ? AND is_active = TRUE`,
      [assignment_id]
    );
    return rows;
  },

  async getWithEntities(id) {
    const assignment = await this.findById(id);
    if (!assignment) return null;
    assignment.entities = await this.getEntities(id);
    return assignment;
  },

  async update(id, { title, audit_type, assigned_auditor_code, assigned_firm_code, assigned_org_tree_id,
                     budget, currency, num_workers, start_date, end_date, notes, status }) {
    await db.query(
      `UPDATE audit_assignments
       SET title = ?, audit_type = ?, assigned_auditor_code = ?,
           assigned_firm_code = ?, assigned_org_tree_id = ?, budget = ?, currency = ?, num_workers = ?,
           start_date = ?, end_date = ?, notes = ?, status = ?
       WHERE id = ?`,
      [title, audit_type,
       assigned_auditor_code || null, assigned_firm_code || null, assigned_org_tree_id || null,
       budget || null, currency || '$', num_workers || null,
       start_date, end_date, notes || null, status || 'pending', id]
    );
  },

  async updateAssignedAuditor(id, { assigned_auditor_code, assigned_org_tree_id }) {
    await db.query(
      'UPDATE audit_assignments SET assigned_auditor_code = ?, assigned_org_tree_id = ? WHERE id = ? AND is_active = TRUE',
      [assigned_auditor_code || null, assigned_org_tree_id || null, id]
    );
  },

  async updateEntities(assignment_id, entities) {
    await db.query(
      'DELETE FROM audit_assignment_entities WHERE assignment_id = ?',
      [assignment_id]
    );
    if (entities.length) await this.addEntities(assignment_id, entities);
  },

  async delete(id) {
    await db.query(
      'UPDATE audit_assignments SET is_active = FALSE WHERE id = ?',
      [id]
    );
  },
};

module.exports = AuditModel;
