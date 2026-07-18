/**
 * CAP Model
 *
 * Handles caps, cap_assignment_entities, cap_entity_progress,
 * cap_questions, and cap_responses tables.
 */

const { db } = require('../config/db');

let capResponseStatusEnumCache = null;

async function getCapResponseStatusEnumValues() {
  if (Array.isArray(capResponseStatusEnumCache) && capResponseStatusEnumCache.length > 0) {
    return capResponseStatusEnumCache;
  }
  const [rows] = await db.query("SHOW COLUMNS FROM cap_responses LIKE 'status'");
  const type = rows?.[0]?.Type || '';
  const match = /^enum\((.*)\)$/i.exec(type);
  if (!match) return [];
  capResponseStatusEnumCache = match[1]
    .split(',')
    .map((v) => v.trim().replace(/^'/, '').replace(/'$/, ''))
    .filter(Boolean);
  return capResponseStatusEnumCache;
}

async function getCompatibleCapResponseStatus(desiredStatus) {
  const values = await getCapResponseStatusEnumValues();
  if (!values.length) return desiredStatus;
  if (values.includes(desiredStatus)) return desiredStatus;
  if (desiredStatus === 'completed' && values.includes('submitted')) return 'submitted';
  if (values.includes('plan')) return 'plan';
  if (values.includes('pending')) return 'pending';
  return values[0];
}

async function getParentCapIdByCapId(capId) {
  const [rows] = await db.query(`SELECT parent_cap_id FROM caps WHERE cap_id = ? LIMIT 1`, [capId]);
  return rows[0]?.parent_cap_id ?? null;
}

async function getParentCapIdByCapQuestionId(capQuestionId) {
  const [rows] = await db.query(
    `SELECT cq.parent_cap_id, cq.cap_id
       FROM cap_questions cq
      WHERE cq.cap_question_id = ?
      LIMIT 1`,
    [capQuestionId]
  );
  if (!rows.length) return null;
  if (rows[0].parent_cap_id !== null && rows[0].parent_cap_id !== undefined) return rows[0].parent_cap_id;
  return getParentCapIdByCapId(rows[0].cap_id);
}

// parseEvidenceFromResponseText legacy helper removed as we move to structured table


const CapModel = {

  // ── CAPS ─────────────────────────────────────────────────────────

  async createCap({ cap_id, audit_id, title, description, created_by, parent_cap_id }) {
    await db.query(
      `INSERT INTO caps (cap_id, audit_id, parent_cap_id, title, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'plan', ?)`,
      [cap_id, audit_id, parent_cap_id || null, title || null, description || null, created_by]
    );
    return { cap_id };
  },

  async listCapsByAudit(audit_id) {
    const [rows] = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id) AS total_questions,
              (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id AND cq.status = 'completed') AS completed_questions
         FROM caps c
        WHERE c.audit_id = ?
        ORDER BY c.parent_cap_id IS NULL DESC, c.created_at DESC`,
      [audit_id]
    );
    return rows;
  },

  async listSubCapsByParent(parent_cap_id) {
    const [rows] = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id) AS total_questions,
              (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id AND cq.status = 'completed') AS completed_questions
         FROM caps c
        WHERE c.parent_cap_id = ?
        ORDER BY c.created_at DESC`,
      [parent_cap_id]
    );
    return rows;
  },

  async listCapsForUser(user_code, { rootOnly = true } = {}) {
    const rootFilter = rootOnly ? 'AND c.parent_cap_id IS NULL' : '';
    const [rows] = await db.query(
      `SELECT c.*,
              aa.audit_id AS audit_code, aa.title AS audit_title,
               (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id) AS total_questions,
               (SELECT COUNT(*) FROM cap_responses cr JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id WHERE cq.cap_id = c.cap_id AND cr.status = 'completed') AS completed_questions
          FROM caps c
          JOIN audit_assignments aa ON aa.audit_id = c.audit_id
         WHERE (c.created_by = ? OR aa.assigned_auditor_id = ?) 
          AND aa.is_active = TRUE ${rootFilter}
        ORDER BY c.created_at DESC`,
      [user_code, user_code]
    );
    return rows;
  },

  async listCapsForEntityHead(orgTreeId, { rootOnly = true } = {}) {
    const { getEntityHeadOrgTreeScope } = require('../utils/accessHelper');
    const scopeIds = await getEntityHeadOrgTreeScope(orgTreeId);
    if (!scopeIds.length) return [];
    const ph = scopeIds.map(() => '?').join(',');
    const rootFilter = rootOnly ? 'AND c.parent_cap_id IS NULL' : '';
    const [rows] = await db.query(
      `SELECT DISTINCT c.*,
              aa.audit_id AS audit_code, aa.title AS audit_title,
               (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id) AS total_questions,
               (SELECT COUNT(*) FROM cap_responses cr JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id WHERE cq.cap_id = c.cap_id AND cr.status = 'completed') AS completed_questions
          FROM caps c
          JOIN audit_assignments aa ON aa.audit_id = c.audit_id
          INNER JOIN cap_assignment_entities cae ON cae.cap_id = c.cap_id
          WHERE cae.org_tree_id IN (${ph}) AND aa.is_active = TRUE AND cae.is_active = TRUE ${rootFilter}
         ORDER BY c.created_at DESC`,
      scopeIds
    );
    return rows;
  },

  async listCapsForAdmin(entityCodes, { rootOnly = true } = {}) {
    const rootFilter = rootOnly ? 'AND c.parent_cap_id IS NULL' : '';
    const codes = Array.isArray(entityCodes) ? entityCodes : [entityCodes];
    const ph = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT c.*,
              aa.audit_id AS audit_code, aa.title AS audit_title, aa.created_by AS owner_entity_code,
              (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id) AS total_questions,
              (SELECT COUNT(*) FROM cap_questions cq WHERE cq.cap_id = c.cap_id AND cq.status = 'completed') AS completed_questions
         FROM caps c
         JOIN audit_assignments aa ON aa.audit_id = c.audit_id
         WHERE aa.is_active = TRUE AND aa.created_by IN (${ph}) ${rootFilter}
        ORDER BY c.created_at DESC`,
      codes
    );
    return rows;
  },

  async getCapById(cap_id) {
    const [rows] = await db.query(
      `SELECT c.*, aa.audit_id AS audit_code, aa.title AS audit_title, aa.assigned_auditor_id
         FROM caps c
         JOIN audit_assignments aa ON aa.audit_id = c.audit_id
        WHERE c.cap_id = ?`,
      [cap_id]
    );
    return rows[0] || null;
  },

  async updateCapStatus(cap_id, status) {
    await db.query(
      `UPDATE caps SET status = ?, updated_at = NOW() WHERE cap_id = ?`,
      [status, cap_id]
    );
  },

  // ── CAP ASSIGNMENT ENTITIES ───────────────────────────────────────

  async addCapEntities(cap_id, entities) {
    // entities: [{entity_code, org_tree_id, entity_type}]
    const { generateCapAssignmentEntityIds } = require('../utils/codeGenerator');
    const parentCapId = await getParentCapIdByCapId(cap_id);
    const ids = await generateCapAssignmentEntityIds(entities.length);
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      await db.query(
        `INSERT INTO cap_assignment_entities (cap_assignment_entity_id, cap_id, parent_cap_id, entity_code, org_tree_id, entity_type, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE parent_cap_id = VALUES(parent_cap_id), entity_type = VALUES(entity_type), is_active = 1`,
        [ids[i], cap_id, parentCapId, e.entity_code, e.org_tree_id ?? null, e.entity_type || null]
      );
    }
  },

  async getCapEntities(cap_id) {
    const [rows] = await db.query(
      `SELECT * FROM cap_assignment_entities WHERE cap_id = ? AND is_active = 1`,
      [cap_id]
    );
    return rows;
  },

  /**
   * Seed a sub-CAP from its parent's cap-required findings only (not the full audit).
   */
  async seedSubCapFromParent(sub_cap_id, parent_cap_id, created_by) {
    const parentItems = await this.getCapCorrectiveActionItems(parent_cap_id);
    if (!parentItems.length) {
      const err = new Error('Parent CAP has no cap-required findings. Complete the parent CAP and mark required items first.');
      err.code = 'NO_PARENT_FINDINGS';
      throw err;
    }

    const [[subCap]] = await db.query('SELECT audit_id FROM caps WHERE cap_id = ?', [sub_cap_id]);
    const audit_id = subCap?.audit_id;
    if (!audit_id) {
      const err = new Error('Sub-CAP not found.');
      err.code = 'SUB_CAP_NOT_FOUND';
      throw err;
    }

    const { generateCorrectiveActionId } = require('../utils/codeGenerator');
    const parentCAs = await this.getCapCorrectiveActions(parent_cap_id);
    const caByCapResponseId = {};
    for (const ca of parentCAs) {
      if (ca.response_id) caByCapResponseId[ca.response_id] = ca;
    }

    const entityInstanceMap = new Map();
    const correctiveActionsForSub = [];

    for (const it of parentItems) {
      const orgTreeId = it.assigned_org_tree_id ?? null;
      const entityKey = `${it.entity_code}__${orgTreeId ?? 'null'}`;

      if (!entityInstanceMap.has(entityKey)) {
        const [parentEntRows] = await db.query(
          `SELECT entity_type FROM cap_assignment_entities
            WHERE cap_id = ? AND entity_code = ? AND (org_tree_id <=> ?) AND is_active = 1 LIMIT 1`,
          [parent_cap_id, it.entity_code, orgTreeId]
        );
        let entity_type = parentEntRows[0]?.entity_type || it.entity_type || '';
        if (!entity_type) {
          const [auditEntRows] = await db.query(
            `SELECT entity_type FROM audit_assignment_entities
              WHERE audit_id = ? AND entity_code = ? AND (org_tree_id <=> ?) AND is_active = 1 LIMIT 1`,
            [audit_id, it.entity_code, orgTreeId]
          );
          entity_type = auditEntRows[0]?.entity_type || '';
        }
        entityInstanceMap.set(entityKey, {
          entity_code: it.entity_code,
          org_tree_id: orgTreeId,
          entity_type,
        });
      }

      const saved = caByCapResponseId[it.response_id];
      const corrective_action_id = await generateCorrectiveActionId();
      await db.query(
        `INSERT INTO corrective_actions
           (corrective_action_id, audit_id, audit_response_id, cap_response_id, entity_code, checklist_question_id, org_tree_id, due_date, created_by)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        [
          corrective_action_id,
          audit_id,
          it.response_id,
          it.entity_code,
          it.question_id,
          orgTreeId,
          saved?.due_date || null,
          created_by,
        ]
      );

      correctiveActionsForSub.push({
        corrective_action_id,
        entity_code: it.entity_code,
        org_tree_id: orgTreeId,
        checklist_question_id: it.question_id,
      });
    }

    const entities = Array.from(entityInstanceMap.values());
    await this.addCapEntities(sub_cap_id, entities);
    await this.addCapQuestions(sub_cap_id, correctiveActionsForSub);

    const [counts] = await db.query(
      `SELECT entity_code, org_tree_id, COUNT(*) AS count
         FROM cap_questions WHERE cap_id = ? GROUP BY entity_code, org_tree_id`,
      [sub_cap_id]
    );
    const countMap = {};
    for (const row of counts) {
      countMap[`${row.entity_code}__${row.org_tree_id ?? 'null'}`] = row.count;
    }
    const { generateCapEntityProgressIds } = require('../utils/codeGenerator');
    const progressIds = await generateCapEntityProgressIds(entities.length);
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const k = `${e.entity_code}__${e.org_tree_id ?? 'null'}`;
      await this.initCapEntityProgress(progressIds[i], sub_cap_id, e.entity_code, e.org_tree_id ?? null, countMap[k] || 0);
    }

    return { entities: entities.length, questions: correctiveActionsForSub.length };
  },

  // ── CAP QUESTIONS ─────────────────────────────────────────────────

  /**
   * Add cap_questions from corrective_actions rows.
   * corrective_actions has: id, audit_id, response_id, entity_code, question_id
   */
  async addCapQuestions(cap_id, correctiveActions) {
    const parentCapId = await getParentCapIdByCapId(cap_id);
    const ids = [];
    for (const ca of correctiveActions) {
      const caOrg = ca.org_tree_id ?? null;
      const cap_question_id = `CQ-${cap_id}-${ca.corrective_action_id}`;
      if (caOrg !== null) {
        await db.query(
          `INSERT INTO cap_questions (cap_question_id, cap_id, parent_cap_id, corrective_action_id, entity_code, org_tree_id, checklist_question_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started')
           ON DUPLICATE KEY UPDATE parent_cap_id = VALUES(parent_cap_id), checklist_question_id = VALUES(checklist_question_id)`,
          [cap_question_id, cap_id, parentCapId, ca.corrective_action_id, ca.entity_code, caOrg, ca.checklist_question_id]
        );
        ids.push(cap_question_id);
        continue;
      }

      // For generic corrective actions (org_tree_id IS NULL), duplicate the question
      // for each assigned entity instance for this CAP so instance-specific execution shows it.
      const [entities] = await db.query(
        `SELECT org_tree_id FROM cap_assignment_entities WHERE cap_id = ? AND entity_code = ? AND is_active = 1`,
        [cap_id, ca.entity_code]
      );
      if (entities.length) {
        for (const ent of entities) {
          const cqid = `CQ-${cap_id}-${ca.corrective_action_id}${ent.org_tree_id ? '-' + ent.org_tree_id : ''}`;
          await db.query(
            `INSERT INTO cap_questions (cap_question_id, cap_id, parent_cap_id, corrective_action_id, entity_code, org_tree_id, checklist_question_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started')
             ON DUPLICATE KEY UPDATE parent_cap_id = VALUES(parent_cap_id), checklist_question_id = VALUES(checklist_question_id)`,
            [cqid, cap_id, parentCapId, ca.corrective_action_id, ca.entity_code, ent.org_tree_id ?? null, ca.checklist_question_id]
          );
          ids.push(cqid);
        }
      } else {
        // No specific assignment found; create a single generic question row with null org_tree_id
        const cqid = `CQ-${cap_id}-${ca.corrective_action_id}`;
        await db.query(
          `INSERT INTO cap_questions (cap_question_id, cap_id, parent_cap_id, corrective_action_id, entity_code, org_tree_id, checklist_question_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'not_started')
           ON DUPLICATE KEY UPDATE parent_cap_id = VALUES(parent_cap_id), checklist_question_id = VALUES(checklist_question_id)`,
          [cqid, cap_id, parentCapId, ca.corrective_action_id, ca.entity_code, null, ca.checklist_question_id]
        );
        ids.push(cqid);
      }
    }
    return ids;
  },

  async listCapQuestions(cap_id) {
    const [rows] = await db.query(
      `SELECT cq.*,
              q.question_text, q.answer_type, q.total_marks, q.order_index, q.entity_type AS question_entity_type,
              ca.audit_response_id, ca.responsible_entity_head_id, ca.responsible_person_name, ca.due_date,
              ca.description AS ca_description, ca.severity
         FROM cap_questions cq
         JOIN checklist_questions q ON q.checklist_question_id = cq.checklist_question_id
         JOIN corrective_actions ca ON ca.corrective_action_id = cq.corrective_action_id
        WHERE cq.cap_id = ?
        ORDER BY cq.entity_code, cq.org_tree_id, q.order_index`,
      [cap_id]
    );

    // Attach options
    for (const row of rows) {
      const [opts] = await db.query(
        `SELECT * FROM checklist_question_options WHERE checklist_question_id = ? ORDER BY order_index`,
        [row.checklist_question_id]
      );
      row.options = opts;
    }

    return rows;
  },

  async getCapQuestion(cap_question_id) {
    const [rows] = await db.query(
      `SELECT cq.*,
              q.question_text, q.answer_type, q.total_marks, q.order_index,
              ca.audit_response_id, ca.responsible_entity_head_id, ca.responsible_person_name, ca.due_date,
              ca.org_tree_id AS org_tree_id
         FROM cap_questions cq
         JOIN checklist_questions q ON q.checklist_question_id = cq.checklist_question_id
         JOIN corrective_actions ca ON ca.corrective_action_id = cq.corrective_action_id
        WHERE cq.cap_question_id = ?`,
      [cap_question_id]
    );
    return rows[0] || null;
  },

  async updateCapQuestionStatus(cap_question_id, status) {
    await db.query(
      `UPDATE cap_questions SET status = ? WHERE cap_question_id = ?`,
      [status, cap_question_id]
    );
  },

  // ── CAP ENTITY PROGRESS ───────────────────────────────────────────

  async initCapEntityProgress(cap_entity_progress_id, cap_id, entity_code, org_tree_id, total_questions) {
    const parentCapId = await getParentCapIdByCapId(cap_id);

    // Compute initial total_marks from checklist_questions joined to cap_questions
    const [[marksRow]] = await db.query(
      `SELECT COALESCE(SUM(q.total_marks), 0) AS total_marks
         FROM cap_questions cq
         JOIN checklist_questions q ON q.checklist_question_id = cq.checklist_question_id
        WHERE cq.cap_id = ? AND cq.entity_code = ? AND (cq.org_tree_id <=> ?)`,
      [cap_id, entity_code, org_tree_id ?? null]
    );
    const total_marks = Number(marksRow?.total_marks || 0);

    await db.query(
      `INSERT INTO cap_entity_progress (cap_entity_progress_id, cap_id, parent_cap_id, entity_code, org_tree_id, total_questions, total_marks, obtained_marks, answered_questions, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'not_started')
       ON DUPLICATE KEY UPDATE parent_cap_id = VALUES(parent_cap_id), total_questions = VALUES(total_questions), total_marks = VALUES(total_marks), status = VALUES(status)`,
      [cap_entity_progress_id, cap_id, parentCapId, entity_code, org_tree_id ?? null, total_questions, total_marks]
    );
  },

  async getCapProgress(cap_id) {
    const [rows] = await db.query(
      `SELECT * FROM cap_entity_progress WHERE cap_id = ? ORDER BY entity_code, org_tree_id`,
      [cap_id]
    );
    return rows;
  },

  async updateCapEntityProgress(cap_id, entity_code, org_tree_id, answered_questions, total_questions) {
    const status = answered_questions >= total_questions ? 'completed' : 'in_progress';

    // Compute total_marks from checklist_questions joined to cap_questions
    const [[marksRow]] = await db.query(
      `SELECT COALESCE(SUM(q.total_marks), 0) AS total_marks
         FROM cap_questions cq
         JOIN checklist_questions q ON q.checklist_question_id = cq.checklist_question_id
        WHERE cq.cap_id = ? AND cq.entity_code = ? AND (cq.org_tree_id <=> ?)`,
      [cap_id, entity_code, org_tree_id ?? null]
    );
    const total_marks = Number(marksRow?.total_marks || 0);

    // Compute obtained_marks from cap_responses joined to cap_questions
    const [[obtRow]] = await db.query(
      `SELECT COALESCE(SUM(cr.marks_obtained), 0) AS obtained_marks
         FROM cap_responses cr
         JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id
        WHERE cq.cap_id = ? AND cq.entity_code = ? AND (cq.org_tree_id <=> ?)`,
      [cap_id, entity_code, org_tree_id ?? null]
    );
    const obtained_marks = Number(obtRow?.obtained_marks || 0);

    await db.query(
      `UPDATE cap_entity_progress
          SET answered_questions = ?, total_marks = ?, obtained_marks = ?, status = ?, completed_at = ?
        WHERE cap_id = ? AND entity_code = ? AND (org_tree_id <=> ?)`,
      [
        answered_questions,
        total_marks,
        obtained_marks,
        status,
        status === 'completed' ? new Date() : null,
        cap_id,
        entity_code,
        org_tree_id ?? null,
      ]
    );
  },

  // ── CAP RESPONSES ─────────────────────────────────────────────────

  async upsertCapResponse({ cap_response_id, cap_question_id, response_text, selected_option_ids, marks_obtained, remarks, cap_required, status, responded_by }) {
    const statusValue = await getCompatibleCapResponseStatus(status || 'completed');
    const parentCapId = await getParentCapIdByCapQuestionId(cap_question_id);
    const [existing] = await db.query(
      `SELECT cap_response_id FROM cap_responses WHERE cap_question_id = ? LIMIT 1`,
      [cap_question_id]
    );

    if (!existing.length) {
      await db.query(
        `INSERT INTO cap_responses (cap_response_id, cap_question_id, parent_cap_id, response_text, selected_option_ids, marks_obtained, remarks, cap_required, status, responded_by, responded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          cap_response_id,
          cap_question_id,
          parentCapId,
          response_text || null,
          selected_option_ids ? JSON.stringify(selected_option_ids) : null,
          marks_obtained || 0,
          remarks || null,
          cap_required ? 1 : 0,
          statusValue,
          responded_by
        ]
      );
      return cap_response_id;
    }

    await db.query(
      `UPDATE cap_responses
          SET parent_cap_id = ?,
              response_text = ?, 
              selected_option_ids = ?, 
              marks_obtained = ?, 
              remarks = ?, 
              cap_required = ?, 
              status = ?, 
              responded_by = ?, 
              responded_at = NOW()
        WHERE cap_question_id = ?`,
      [
        parentCapId,
        response_text || null,
        selected_option_ids ? JSON.stringify(selected_option_ids) : null,
        marks_obtained || 0,
        remarks || null,
        cap_required ? 1 : 0,
        statusValue,
        responded_by,
        cap_question_id
      ]
    );
    return existing[0].cap_response_id;
  },

  async getCapResponses(cap_id) {
    const [rows] = await db.query(
      `SELECT cr.*
         FROM cap_responses cr
         JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id
        WHERE cq.cap_id = ?
        ORDER BY cr.cap_question_id`,
      [cap_id]
    );
    for (const row of rows) {
      const evidence = await this.getEvidence(row.cap_response_id);
      row.evidence = evidence;
      row.answer_text = row.response_text;
      try {
        row.selected_option_ids = row.selected_option_ids ? JSON.parse(row.selected_option_ids) : [];
      } catch {
        row.selected_option_ids = [];
      }
    }
    return rows;
  },

  async getCapResponsesByEntity(cap_id, entity_code, org_tree_id) {
    const [rows] = await db.query(
      `SELECT cr.*
         FROM cap_responses cr
         JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id
        WHERE cq.cap_id = ? AND cq.entity_code = ? AND (cq.org_tree_id <=> ?)`,
      [cap_id, entity_code, org_tree_id ?? null]
    );
    for (const row of rows) {
      const evidence = await this.getEvidence(row.cap_response_id);
      row.evidence = evidence;
      row.answer_text = row.response_text;
      try {
        row.selected_option_ids = row.selected_option_ids ? JSON.parse(row.selected_option_ids) : [];
      } catch {
        row.selected_option_ids = [];
      }
    }
    return rows;
  },

  // ── CAP EVIDENCE ──────────────────────────────────────────────────

  async addEvidence({ cap_response_evidence_id, cap_response_id, file_type, file_path, file_name, file_size, uploaded_by }) {
    const [responseRows] = await db.query(
      `SELECT parent_cap_id FROM cap_responses WHERE cap_response_id = ? LIMIT 1`,
      [cap_response_id]
    );
    const parentCapId = responseRows[0]?.parent_cap_id ?? null;
    await db.query(
      `INSERT INTO cap_response_evidence (cap_response_evidence_id, cap_response_id, parent_cap_id, file_type, file_path, file_name, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cap_response_evidence_id, cap_response_id, parentCapId, file_type, file_path, file_name, file_size, uploaded_by]
    );
    return cap_response_evidence_id;
  },

  async getEvidence(cap_response_id) {
    const [rows] = await db.query(
      `SELECT cap_response_evidence_id AS id, cap_response_evidence_id, cap_response_id,
              file_type, file_path, file_name, file_size, uploaded_by, created_at
         FROM cap_response_evidence
        WHERE cap_response_id = ?
        ORDER BY created_at`,
      [cap_response_id]
    );
    return rows;
  },

  async deleteEvidence(cap_response_evidence_id) {
    const [rows] = await db.query(
      `SELECT * FROM cap_response_evidence WHERE cap_response_evidence_id = ?`,
      [cap_response_evidence_id]
    );
    if (!rows.length) return null;
    await db.query(`DELETE FROM cap_response_evidence WHERE cap_response_evidence_id = ?`, [cap_response_evidence_id]);
    return rows[0];
  },

  async getCapCorrectiveActionItems(cap_id) {
    const [rows] = await db.query(
      `SELECT cr.cap_response_id AS response_id, cr.cap_question_id, cr.response_text AS answer_text, 
              cr.selected_option_ids, cr.remarks, cr.cap_required, cr.status, 
              cr.responded_by AS answered_by, cr.responded_at AS answered_at,
              cq.cap_id, cq.entity_code, cq.org_tree_id AS assigned_org_tree_id,
              cq.checklist_question_id AS question_id, q.question_text, q.order_index,
              cae.entity_type
         FROM cap_responses cr
         JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id
         JOIN checklist_questions q ON q.checklist_question_id = cq.checklist_question_id
         LEFT JOIN cap_assignment_entities cae ON cae.cap_id = cq.cap_id AND cae.entity_code = cq.entity_code AND (cae.org_tree_id <=> cq.org_tree_id)
         LEFT JOIN corrective_actions ca ON ca.corrective_action_id = cq.corrective_action_id
        WHERE cq.cap_id = ? AND cr.cap_required = 1`,
      [cap_id]
    );

    // Fetch entity heads using EntityHeadModel (same approach as audit corrective actions)
    const orgTreeIds = [...new Set(rows.map(r => r.assigned_org_tree_id).filter(Boolean))];
    const EntityHeadModel = require('./EntityHeadModel');
    const heads = await EntityHeadModel.findByOrgTreeIds(orgTreeIds);
    const headByOrgTreeId = {};
    for (const h of heads) headByOrgTreeId[h.assigned_org_tree_id] = h;

    for (const it of rows) {
      const head = it.assigned_org_tree_id ? headByOrgTreeId[it.assigned_org_tree_id] : null;
      it.responsible_entity_head = head
        ? {
            user_code: head.entity_head_id,
            first_name: head.first_name,
            last_name: head.last_name,
            email: head.email,
          }
        : null;
    }
    return rows;
  },

  async getCapCorrectiveActions(cap_id) {
    const [rows] = await db.query(
      `SELECT corrective_action_id AS id, cap_response_id AS response_id,
              entity_code, checklist_question_id AS question_id, org_tree_id,
              due_date, created_at, updated_at
         FROM corrective_actions WHERE cap_response_id IN (
         SELECT cr.cap_response_id FROM cap_responses cr JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id WHERE cq.cap_id = ?
       )`,
      [cap_id]
    );
    return rows;
  },

  async saveCapCorrectiveActions(cap_id, actions, created_by) {
    const [[cap]] = await db.query(`SELECT audit_id FROM caps WHERE cap_id = ?`, [cap_id]);
    const audit_id = cap.audit_id;
    const { generateCorrectiveActionId } = require('../utils/codeGenerator');

    for (const a of actions) {
      // CAP and response codes are both long; combining them exceeds the
      // corrective_actions.corrective_action_id VARCHAR(20) limit. Reuse the
      // existing corrective action for this CAP response, or generate the
      // standard compact CA ID for a new record.
      const [existing] = await db.query(
        `SELECT corrective_action_id
           FROM corrective_actions
          WHERE cap_response_id = ?
          LIMIT 1`,
        [a.response_id]
      );
      const corrective_action_id = existing[0]?.corrective_action_id || await generateCorrectiveActionId();
      await db.query(
         `INSERT INTO corrective_actions 
           (corrective_action_id, audit_id, audit_response_id, cap_response_id, entity_code, checklist_question_id, org_tree_id, due_date, created_by)
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
          due_date = VALUES(due_date),
          updated_at = NOW()`,
        [
          corrective_action_id,
          audit_id, 
          a.response_id, // cap_response_id
          a.entity_code, 
          a.checklist_question_id || a.question_id, 
          a.assigned_org_tree_id ?? null, 
          a.due_date || null, 
          created_by
        ]
      );
    }
    return true;
  },

  // ── ENTITY TREE (reuse corrective_actions data) ──────────────────

  async getCapEntityTree(cap_id) {
    const [entities] = await db.query(
      `SELECT entity_code, entity_type, org_tree_id FROM cap_assignment_entities WHERE cap_id = ? AND is_active = 1`,
      [cap_id]
    );
    if (!entities.length) return null;

    const [[cap]] = await db.query(
      `SELECT aa.created_by
         FROM caps c
         JOIN audit_assignments aa ON aa.audit_id = c.audit_id
        WHERE c.cap_id = ?
        LIMIT 1`,
      [cap_id]
    );
    const auditRootCode = cap?.created_by || null;

    const assignedCodes = entities.map(e => e.entity_code);
    const codePlaceholders = assignedCodes.map(() => '?').join(',');

    // Prefer edge-id based traversal when org_tree_id is present.
    // This preserves uniqueness when the same entity_code is reused under multiple parents.
    const assignedEdgeIds = Array.from(
      new Set(
        entities
          .map(e => e.org_tree_id)
          .filter(v => v !== null && v !== undefined)
          .map(v => parseInt(v, 10))
          .filter(v => !Number.isNaN(v))
      )
    );

    let pathCodes = new Set(assignedCodes);
    let pathEdges = [];

    if (auditRootCode && assignedEdgeIds.length) {
      const edgePH = assignedEdgeIds.map(() => '?').join(',');
      const [rows] = await db.query(
        `WITH RECURSIVE path AS (
           SELECT org_tree_id, parent_code, parent_type, child_code, child_type, root_entity_code, parent_edge_id
             FROM organization_tree
            WHERE org_tree_id IN (${edgePH})
              AND root_entity_code = ?
              AND is_active = TRUE
           UNION ALL
           SELECT ot.org_tree_id, ot.parent_code, ot.parent_type, ot.child_code, ot.child_type, ot.root_entity_code, ot.parent_edge_id
             FROM organization_tree ot
             INNER JOIN path p ON ot.org_tree_id = p.parent_edge_id
            WHERE ot.root_entity_code = ?
              AND ot.is_active = TRUE
         )
         SELECT DISTINCT org_tree_id, parent_code, parent_type, child_code, child_type, root_entity_code, parent_edge_id
           FROM path`,
        [...assignedEdgeIds, auditRootCode, auditRootCode]
      );
      for (const row of rows) {
        pathCodes.add(row.parent_code);
        pathCodes.add(row.child_code);
        pathEdges.push(row);
      }
    }

    // Fallback: code-based traversal (less precise when entity_code is reused)
    if (pathEdges.length === 0 && auditRootCode) {
      const [rows] = await db.query(
        `WITH RECURSIVE path AS (
           SELECT org_tree_id, parent_code, parent_type, child_code, child_type, root_entity_code, parent_edge_id
             FROM organization_tree
            WHERE child_code IN (${codePlaceholders})
              AND root_entity_code = ?
              AND is_active = TRUE
           UNION ALL
           SELECT ot.org_tree_id, ot.parent_code, ot.parent_type, ot.child_code, ot.child_type, ot.root_entity_code, ot.parent_edge_id
             FROM organization_tree ot
             INNER JOIN path p ON ot.child_code = p.parent_code
            WHERE ot.root_entity_code = ?
              AND ot.is_active = TRUE
         )
         SELECT DISTINCT org_tree_id, parent_code, parent_type, child_code, child_type, root_entity_code, parent_edge_id
           FROM path`,
        [...assignedCodes, auditRootCode, auditRootCode]
      );
      for (const row of rows) {
        pathCodes.add(row.parent_code);
        pathCodes.add(row.child_code);
        pathEdges.push(row);
      }
    }

    if (pathEdges.length === 0) {
      const [rows] = await db.query(
        `SELECT org_tree_id, parent_code, parent_type, child_code, child_type, root_entity_code, parent_edge_id
           FROM organization_tree
          WHERE parent_code IN (${codePlaceholders})
            AND child_code IN (${codePlaceholders})
            AND is_active = TRUE`,
        [...assignedCodes, ...assignedCodes]
      );
      for (const row of rows) {
        pathCodes.add(row.parent_code);
        pathCodes.add(row.child_code);
        pathEdges.push(row);
      }
    }

    const codes = Array.from(pathCodes);
    const codePH = codes.map(() => '?').join(',');

    const [names] = await db.query(
      `SELECT cust_code AS code, name FROM customers WHERE cust_code IN (${codePH})
       UNION ALL SELECT cbo_code AS code, name FROM customer_buying_offices WHERE cbo_code IN (${codePH})
       UNION ALL SELECT csup_code AS code, name FROM customer_suppliers WHERE csup_code IN (${codePH})
       UNION ALL SELECT comp_code AS code, name FROM companies WHERE comp_code IN (${codePH})
       UNION ALL SELECT comp_clus_code AS code, name FROM company_clusters WHERE comp_clus_code IN (${codePH})
       UNION ALL SELECT comp_fact_code AS code, name FROM company_factories WHERE comp_fact_code IN (${codePH})
       UNION ALL SELECT comp_unit_code AS code, name FROM company_units WHERE comp_unit_code IN (${codePH})
       UNION ALL SELECT comp_dept_code AS code, name FROM company_departments WHERE comp_dept_code IN (${codePH})
       UNION ALL SELECT comp_section_code AS code, name FROM company_sections WHERE comp_section_code IN (${codePH})
       UNION ALL SELECT afc_code AS code, name FROM audit_firm_companies WHERE afc_code IN (${codePH})
       UNION ALL SELECT afc_branch_code AS code, name FROM audit_firm_company_branches WHERE afc_branch_code IN (${codePH})
       UNION ALL SELECT afc_dept_code AS code, name FROM audit_firm_company_departments WHERE afc_dept_code IN (${codePH})`,
      Array(12).fill(codes).flat()
    );
    const nameMap = {};
    for (const r of names) {
      nameMap[r.code] = r.name?.trim() || r.code;
    }

    const typeMap = {};
    for (const e of entities) typeMap[e.entity_code] = e.entity_type;
    for (const e of pathEdges) {
      if (!typeMap[e.parent_code] && e.parent_type) typeMap[e.parent_code] = e.parent_type;
      if (!typeMap[e.child_code] && e.child_type) typeMap[e.child_code] = e.child_type;
    }

    const edgeById = {};
    const childrenByParentEdgeId = {};
    const topLevelEdges = [];
    for (const e of pathEdges) {
      edgeById[e.org_tree_id] = e;
      const parentEdgeId = e.parent_edge_id ?? null;
      if (!childrenByParentEdgeId[parentEdgeId]) childrenByParentEdgeId[parentEdgeId] = [];
      childrenByParentEdgeId[parentEdgeId].push(e.org_tree_id);
      if (parentEdgeId === null) topLevelEdges.push(e.org_tree_id);
    }

    // Keep stable order
    for (const k of Object.keys(childrenByParentEdgeId)) {
      childrenByParentEdgeId[k].sort((a, b) => a - b);
    }

    const buildFromEdge = (edgeId, visitedEdges = new Set()) => {
      if (visitedEdges.has(edgeId)) return null;
      visitedEdges.add(edgeId);

      const e = edgeById[edgeId];
      if (!e) return null;

      const childIds = childrenByParentEdgeId[edgeId] || [];
      const children = childIds
        .map((cid) => buildFromEdge(cid, new Set(visitedEdges)))
        .filter(Boolean);

      return {
        code: e.child_code,
        name: nameMap[e.child_code] || e.child_code,
        entity_type: typeMap[e.child_code] || e.child_type || '',
        edge_id: e.org_tree_id,
        children,
      };
    };

    const rootCode = auditRootCode || pathEdges.find(e => (e.parent_edge_id ?? null) === null)?.parent_code || '__root__';
    const rootEntityType = typeMap[rootCode] || pathEdges.find(e => (e.parent_edge_id ?? null) === null)?.parent_type || '';
    const rootName = nameMap[rootCode] || rootCode;
    const rootChildren = topLevelEdges.map(eid => buildFromEdge(eid)).filter(Boolean);

    // Include any cap_assignment_entities that are not represented in the tree.
    // This handles entities with NULL org_tree_id that were missed by the edge-based traversal.
    // Keyed by entity_code+edge_id to allow same entity at different org positions.
    const codesInTree = new Set();
    (function walk(nodes) {
      for (const n of nodes) {
        codesInTree.add(`${n.code}__${n.edge_id ?? 'null'}`);
        if (n.children) walk(n.children);
      }
    })(rootChildren);

    for (const e of entities) {
      const ek = `${e.entity_code}__${e.org_tree_id ?? 'null'}`;
      // A root entity can be audited before an organization structure exists.
      // It has no organization_tree edge, so NULL is the correct instance ID.
      // The returned tree root already represents it; adding it as its own child
      // creates a duplicate node and makes the preview's Next navigation loop.
      const isUnlinkedRootEntity = e.entity_code === rootCode && (e.org_tree_id === null || e.org_tree_id === undefined);
      if (isUnlinkedRootEntity) continue;

      if (!codesInTree.has(ek)) {
        rootChildren.push({
          code: e.entity_code,
          name: nameMap[e.entity_code] || e.entity_code,
          entity_type: typeMap[e.entity_code] || e.entity_type || '',
          edge_id: e.org_tree_id ?? null,
          children: [],
        });
        codesInTree.add(ek);
      }
    }

    return { code: rootCode, name: rootName, entity_type: rootEntityType, edge_id: null, children: rootChildren };
  },
};

module.exports = CapModel;
