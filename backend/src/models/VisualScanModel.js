/**
 * Read-only data access for the AI Site Scan feature.
 *
 * Site scans do not create audit assignments or persist uploaded scan images.
 * This model supplies completed evidence together with its recorded audit/CAP
 * response so a scan can be grounded in the organization's own history.
 */

const { db } = require('../config/db');

function parseSelectedOptionIds(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }
}

async function hydrateSelectedOptions(rows) {
  const questionIds = [...new Set(rows.map((row) => row.checklist_question_id).filter(Boolean))];
  if (!questionIds.length) return rows;
  const [options] = await db.query(
    `SELECT checklist_question_id, checklist_question_option_id, option_text, marks
       FROM checklist_question_options
      WHERE checklist_question_id IN (?)
      ORDER BY checklist_question_id, order_index`,
    [questionIds]
  );
  const byQuestion = new Map();
  for (const option of options) {
    const key = String(option.checklist_question_id);
    if (!byQuestion.has(key)) byQuestion.set(key, new Map());
    byQuestion.get(key).set(String(option.checklist_question_option_id), option);
  }
  return rows.map((row) => {
    const selectedIds = parseSelectedOptionIds(row.selected_option_ids);
    const optionMap = byQuestion.get(String(row.checklist_question_id)) || new Map();
    return {
      ...row,
      selected_option_ids: selectedIds,
      selected_options: selectedIds.map((id) => optionMap.get(id)).filter(Boolean).map((option) => ({
        text: option.option_text,
        marks: Number(option.marks || 0),
      })),
    };
  });
}

const VisualScanModel = {
  async getOrganizationOccurrence(orgTreeId, entityCode) {
    if (orgTreeId) {
      const [rows] = await db.query(
        `SELECT org_tree_id, child_code, root_entity_code
           FROM organization_tree
          WHERE org_tree_id = ? AND is_active = TRUE
          LIMIT 1`,
        [orgTreeId]
      );
      return rows[0] || null;
    }
    if (!entityCode) return null;
    const [rows] = await db.query(
      `SELECT org_tree_id, child_code, root_entity_code
         FROM organization_tree
        WHERE child_code = ? AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 1`,
      [entityCode]
    );
    return rows[0] || null;
  },

  async getHistoricalAuditEvidence({ ownerEntityCode, selectedEntityCode, accessibleEntityCodes = [], issueOnly, limit = 3 }) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 12));
    const scopeCodes = [...new Set(accessibleEntityCodes.filter(Boolean))];
    if (!scopeCodes.length) return [];
    const issueCondition = issueOnly
      ? 'ar.cap_required = TRUE'
      : 'ar.cap_required = FALSE AND ar.status = \'answered\' AND ar.marks_obtained >= (cq.total_marks * 0.8)';
    const [rows] = await db.query(
      `SELECT ae.audit_evidence_id AS evidence_id, ae.file_path,
              aa.audit_id, aa.title AS audit_title, aa.completed_at,
              cq.checklist_question_id, cq.question_text, cq.answer_type, cq.total_marks,
              ar.answer_text, ar.selected_option_ids, ar.marks_obtained, ar.remarks,
              ar.cap_required, ar.status AS response_status, ar.entity_code, ar.answered_at,
              ca.description AS corrective_action, ca.severity AS corrective_severity,
              ca.status AS corrective_status, ca.resolution_notes, ca.verified_at
         FROM audit_evidence ae
         JOIN audit_responses ar ON ar.audit_response_id = ae.audit_response_id
         JOIN audit_assignments aa ON aa.audit_id = ar.audit_id
         JOIN checklist_questions cq ON cq.checklist_question_id = ar.checklist_question_id
         LEFT JOIN corrective_actions ca ON ca.id = (
           SELECT MAX(ca2.id) FROM corrective_actions ca2
            WHERE ca2.audit_response_id = ar.audit_response_id
         )
        WHERE aa.created_by = ?
          AND aa.is_active = TRUE
          AND aa.status = 'completed'
          AND ar.status = 'answered'
          AND ae.file_type = 'image'
          AND ${issueCondition}
          AND ar.entity_code IN (?)
        ORDER BY CASE WHEN ar.entity_code = ? THEN 0 ELSE 1 END, ar.answered_at DESC
        LIMIT ${safeLimit}`,
      [ownerEntityCode, scopeCodes, selectedEntityCode]
    );
    return hydrateSelectedOptions(rows);
  },

  async getHistoricalCapEvidence({ ownerEntityCode, selectedEntityCode, accessibleEntityCodes = [], limit = 2 }) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 2, 8));
    const scopeCodes = [...new Set(accessibleEntityCodes.filter(Boolean))];
    if (!scopeCodes.length) return [];
    const [rows] = await db.query(
      `SELECT cre.cap_response_evidence_id AS evidence_id, cre.file_path,
              c.cap_id, c.title AS cap_title, c.description AS cap_description,
              cq.checklist_question_id, cq.question_text, cq.answer_type, cq.total_marks,
              cr.response_text AS answer_text, cr.selected_option_ids, cr.marks_obtained,
              cr.remarks, cr.status AS response_status, cp.entity_code,
              cr.responded_at AS answered_at, ca.description AS corrective_action,
              ca.severity AS corrective_severity, ca.status AS corrective_status,
              ca.resolution_notes, ca.verified_at
         FROM cap_response_evidence cre
         JOIN cap_responses cr ON cr.cap_response_id = cre.cap_response_id
         JOIN cap_questions cp ON cp.cap_question_id = cr.cap_question_id
         JOIN caps c ON c.cap_id = cp.cap_id
         JOIN audit_assignments aa ON aa.audit_id = c.audit_id
         JOIN checklist_questions cq ON cq.checklist_question_id = cp.checklist_question_id
         LEFT JOIN corrective_actions ca ON ca.corrective_action_id = cp.corrective_action_id
        WHERE aa.created_by = ?
          AND aa.is_active = TRUE
          AND c.status = 'completed'
          AND cre.file_type = 'image'
          AND cr.status = 'completed'
          AND cp.entity_code IN (?)
        ORDER BY CASE WHEN cp.entity_code = ? THEN 0 ELSE 1 END, cr.responded_at DESC
        LIMIT ${safeLimit}`,
      [ownerEntityCode, scopeCodes, selectedEntityCode]
    );
    return hydrateSelectedOptions(rows);
  },
};

module.exports = VisualScanModel;
