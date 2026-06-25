/**
 * Audit Execution Model
 *
 * Handles audit_responses, audit_evidence, and audit_entity_progress tables.
 * Used by auditors to execute assigned audits.
 */

const { db } = require('../config/db');
const OrganizationTreeModel = require('./OrganizationTreeModel');

const AuditExecutionModel = {

  // ── RESPONSES ────────────────────────────────────────────────────

  async upsertResponse({ audit_id, org_tree_id, entity_code, question_id, answer_text, selected_option_ids, marks_obtained, remarks, cap_required, status, answered_by }) {
    const normId = (org_tree_id !== null && org_tree_id !== undefined) ? (org_tree_id || null) : null;
    const vals = [
      answer_text || null,
      selected_option_ids ? JSON.stringify(selected_option_ids) : null,
      marks_obtained || 0, remarks || null,
      cap_required ? 1 : 0, status || 'answered', answered_by,
    ];

    if (normId === null) {
      // MySQL treats NULLs as distinct in UNIQUE keys, so ON DUPLICATE KEY UPDATE never fires.
      // Use explicit UPDATE → INSERT to prevent duplicate rows.
      const [upd] = await db.query(
        `UPDATE audit_responses SET answer_text=?, selected_option_ids=?, marks_obtained=?, remarks=?, cap_required=?, status=?, answered_by=?, answered_at=NOW()
         WHERE audit_id=? AND org_tree_id IS NULL AND entity_code=? AND question_id=?`,
        [...vals, audit_id, entity_code, question_id]
      );
      if (upd.affectedRows > 0) {
        const [r] = await db.query(
          'SELECT id FROM audit_responses WHERE audit_id=? AND org_tree_id IS NULL AND entity_code=? AND question_id=? ORDER BY id DESC LIMIT 1',
          [audit_id, entity_code, question_id]
        );
        return r[0]?.id;
      }
      const [ins] = await db.query(
        `INSERT INTO audit_responses (audit_id, org_tree_id, entity_code, question_id, answer_text, selected_option_ids, marks_obtained, remarks, cap_required, status, answered_by, answered_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [audit_id, entity_code, question_id, ...vals]
      );
      return ins.insertId;
    }

    const [res] = await db.query(
      `INSERT INTO audit_responses
         (audit_id, org_tree_id, entity_code, question_id, answer_text, selected_option_ids, marks_obtained, remarks, cap_required, status, answered_by, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         answer_text = VALUES(answer_text),
         selected_option_ids = VALUES(selected_option_ids),
         marks_obtained = VALUES(marks_obtained),
         remarks = VALUES(remarks),
         cap_required = VALUES(cap_required),
         status = VALUES(status),
         answered_at = NOW()`,
      [audit_id, normId, entity_code, question_id, ...vals]
    );
    if (res.insertId) return res.insertId;
    const [rows] = await db.query(
      'SELECT id FROM audit_responses WHERE audit_id=? AND org_tree_id<=>? AND entity_code=? AND question_id=?',
      [audit_id, normId, entity_code, question_id]
    );
    return rows[0]?.id;
  },

  async getResponse(audit_id, org_tree_id, question_id) {
    const [rows] = await db.query(
      `SELECT r.*, GROUP_CONCAT(e.id) AS evidence_ids
       FROM audit_responses r
       LEFT JOIN audit_evidence e ON e.response_id = r.id
       WHERE r.audit_id = ? AND r.org_tree_id <=> ? AND r.question_id = ?
       GROUP BY r.id`,
      [audit_id, org_tree_id || null, question_id]
    );
    return rows[0] || null;
  },

  async getResponsesByEntity(audit_id, org_tree_id, entity_code) {
    const [rows] = await db.query(
      `SELECT r.*
       FROM audit_responses r
       INNER JOIN (
         SELECT MAX(id) AS max_id
         FROM audit_responses
         WHERE audit_id = ? AND org_tree_id <=> ? AND entity_code = ?
         GROUP BY question_id
       ) dedup ON r.id = dedup.max_id
       ORDER BY r.question_id`,
      [audit_id, org_tree_id ?? null, entity_code, audit_id, org_tree_id ?? null, entity_code]
    );
    return rows;
  },

  async getResponsesByEntityCode(audit_id, entity_code) {
    const [rows] = await db.query(
      `SELECT r.*
       FROM audit_responses r
       WHERE r.audit_id = ? AND r.entity_code = ?
       ORDER BY r.question_id`,
      [audit_id, entity_code]
    );
    return rows;
  },

  async getAllResponses(audit_id) {
    const [rows] = await db.query(
      `SELECT r.*
       FROM audit_responses r
       INNER JOIN (
         SELECT MAX(id) AS max_id
         FROM audit_responses
         WHERE audit_id = ?
         GROUP BY entity_code, org_tree_id, question_id
       ) dedup ON r.id = dedup.max_id
       WHERE r.audit_id = ?
       ORDER BY r.org_tree_id, r.entity_code, r.question_id`,
      [audit_id, audit_id]
    );
    return rows;
  },

  // ── EVIDENCE ─────────────────────────────────────────────────────

  async addEvidence({ response_id, file_type, file_path, file_name, file_size, uploaded_by }) {
    const [res] = await db.query(
      `INSERT INTO audit_evidence (response_id, file_type, file_path, file_name, file_size, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [response_id, file_type, file_path, file_name || null, file_size || 0, uploaded_by]
    );
    return res.insertId;
  },

  async getEvidence(response_id) {
    const [rows] = await db.query(
      'SELECT * FROM audit_evidence WHERE response_id = ? ORDER BY created_at',
      [response_id]
    );
    return rows;
  },

  async getEvidenceByAudit(audit_id) {
    const [rows] = await db.query(
      `SELECT e.* FROM audit_evidence e
       INNER JOIN audit_responses r ON r.id = e.response_id
       WHERE r.audit_id = ?
       ORDER BY e.response_id, e.created_at`,
      [audit_id]
    );
    return rows;
  },

  async deleteEvidence(id) {
    const [rows] = await db.query('SELECT * FROM audit_evidence WHERE id = ?', [id]);
    if (!rows[0]) return null;
    await db.query('DELETE FROM audit_evidence WHERE id = ?', [id]);
    return rows[0];
  },

  // ── CORRECTIVE ACTIONS ───────────────────────────────────────────

  async listCapRequiredItems(audit_id) {
    const [rows] = await db.query(
      `SELECT
         r.id AS response_id,
         r.audit_id,
         r.org_tree_id,
         r.entity_code,
         r.question_id,
         r.answer_text,
         r.selected_option_ids,
         r.marks_obtained,
         r.remarks,
         r.cap_required,
         r.status,
         r.answered_by,
         r.answered_at,
         q.question_text,
         q.answer_type,
         q.total_marks,
         q.order_index,
         q.entity_type
       FROM audit_responses r
       INNER JOIN checklist_questions q ON q.id = r.question_id
       WHERE r.audit_id = ? AND r.cap_required = 1
       ORDER BY r.entity_code, q.order_index`,
      [audit_id]
    );
    return rows;
  },

  async listCorrectiveActionsByAudit(audit_id) {
    const [rows] = await db.query(
      `SELECT * FROM corrective_actions WHERE audit_id = ? ORDER BY created_at`,
      [audit_id]
    );
    return rows;
  },

  async upsertCorrectiveAction({
    audit_id,
    response_id,
    entity_code,
    question_id,
    org_tree_id,
    responsible_person_code,
    responsible_person_name,
    due_date,
    created_by,
  }) {
    const [existing] = await db.query(
      `SELECT id FROM corrective_actions WHERE audit_id = ? AND response_id = ? LIMIT 1`,
      [audit_id, response_id]
    );

    if (!existing.length) {
      const cap_code = `CAP-${audit_id}-${response_id}`;
      const [res] = await db.query(
        `INSERT INTO corrective_actions
           (cap_code, audit_id, response_id, entity_code, question_id, org_tree_id,
            responsible_person_code, responsible_person_name, due_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cap_code,
          audit_id,
          response_id,
          entity_code,
          question_id,
          org_tree_id || null,
          responsible_person_code || null,
          responsible_person_name || null,
          due_date || null,
          created_by,
        ]
      );
      return res.insertId;
    }

    await db.query(
      `UPDATE corrective_actions
       SET responsible_person_code = ?,
           responsible_person_name = ?,
           due_date = ?,
           org_tree_id = ?
       WHERE audit_id = ? AND response_id = ?`,
      [
        responsible_person_code || null,
        responsible_person_name || null,
        due_date || null,
        org_tree_id || null,
        audit_id,
        response_id,
      ]
    );
    return existing[0].id;
  },

  // ── ENTITY PROGRESS ──────────────────────────────────────────────

  async upsertProgress({ audit_id, org_tree_id, entity_code, total_questions, answered_questions, total_marks, obtained_marks, status }) {
    const normId = (org_tree_id !== null && org_tree_id !== undefined) ? (org_tree_id || null) : null;
    const completedAt = status === 'completed' ? new Date() : null;
    const updateVals = [total_questions, answered_questions, total_marks, obtained_marks, status, completedAt];

    if (normId === null) {
      // MySQL treats NULLs as distinct in UNIQUE keys, so ON DUPLICATE KEY UPDATE never fires.
      const [upd] = await db.query(
        `UPDATE audit_entity_progress SET total_questions=?, answered_questions=?, total_marks=?, obtained_marks=?, status=?, completed_at=?
         WHERE audit_id=? AND org_tree_id IS NULL AND entity_code=?`,
        [...updateVals, audit_id, entity_code]
      );
      if (upd.affectedRows === 0) {
        await db.query(
          `INSERT INTO audit_entity_progress (audit_id, org_tree_id, entity_code, total_questions, answered_questions, total_marks, obtained_marks, status, completed_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
          [audit_id, entity_code, ...updateVals]
        );
      }
      return;
    }

    await db.query(
      `INSERT INTO audit_entity_progress
         (audit_id, org_tree_id, entity_code, total_questions, answered_questions, total_marks, obtained_marks, status, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_questions = VALUES(total_questions),
         answered_questions = VALUES(answered_questions),
         total_marks = VALUES(total_marks),
         obtained_marks = VALUES(obtained_marks),
         status = VALUES(status),
         completed_at = VALUES(completed_at)`,
      [audit_id, normId, entity_code, ...updateVals]
    );
  },

  async getProgress(audit_id) {
    const [rows] = await db.query(
      `SELECT p.*
       FROM audit_entity_progress p
       INNER JOIN (
         SELECT MAX(id) AS max_id
         FROM audit_entity_progress
         WHERE audit_id = ?
         GROUP BY entity_code, org_tree_id
       ) dedup ON p.id = dedup.max_id
       WHERE p.audit_id = ?
       ORDER BY p.org_tree_id, p.entity_code`,
      [audit_id, audit_id]
    );
    return rows;
  },

  async getEntityProgress(audit_id, org_tree_id, entity_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_entity_progress WHERE audit_id = ? AND org_tree_id <=> ? AND entity_code = ?',
      [audit_id, org_tree_id || null, entity_code]
    );
    return rows[0] || null;
  },

  async getEntityProgressByCode(audit_id, entity_code) {
    const [rows] = await db.query(
      'SELECT * FROM audit_entity_progress WHERE audit_id = ? AND entity_code = ? ORDER BY org_tree_id',
      [audit_id, entity_code]
    );
    return rows;
  },

  // ── AUDIT STATUS ─────────────────────────────────────────────────

  async startAudit(id) {
    await db.query(
      "UPDATE audit_assignments SET status = 'in_progress' WHERE id = ? AND status = 'plan'",
      [id]
    );
  },

  async completeAudit(id) {
    await db.query(
      "UPDATE audit_assignments SET status = 'completed', completed_at = NOW() WHERE id = ?",
      [id]
    );
  },

  // ── ENTITY TREE ──────────────────────────────────────────────────

  async getEntityTree(audit_id) {
    // Get audit entity codes. These are the nodes assigned to the audit.
    const [entities] = await db.query(
      'SELECT org_tree_id, entity_code, entity_type FROM audit_assignment_entities WHERE assignment_id = ? AND is_active = TRUE',
      [audit_id]
    );
    if (!entities.length) return null;

    const [[audit]] = await db.query(
      'SELECT created_by FROM audit_assignments WHERE id = ? AND is_active = TRUE',
      [audit_id]
    );
    const auditRootCode = audit?.created_by || null;

    // For execution UI we want the full org tree under the audit root so sibling
    // nodes (e.g. Unit 2) remain visible even if no assigned leaf edge references them.
    // We still build node instances keyed by edge id, so reused entity codes can
    // appear under multiple parents without collapsing.
    let filteredEdges = [];
    if (auditRootCode) {
      const assignedEdgeIds = [...new Set(entities.map(e => e.org_tree_id).filter(Boolean))];
      let assignedRootCodes = [];
      if (assignedEdgeIds.length) {
        const edgePH = assignedEdgeIds.map(() => '?').join(',');
        const [assignedRoots] = await db.query(
          `SELECT DISTINCT root_entity_code
             FROM organization_tree
            WHERE id IN (${edgePH}) AND is_active = TRUE`,
          assignedEdgeIds
        );
        assignedRootCodes = assignedRoots.map((r) => r.root_entity_code).filter(Boolean);
      }

      const allowedRootCodes = [...new Set([auditRootCode, ...assignedRootCodes])];
      filteredEdges = await OrganizationTreeModel.getTreeDescendants(auditRootCode, allowedRootCodes);
    } else {
      // Fallback: when we don't know the audit root, build a minimal tree from assigned edges.
      const assignedEdgeIds = [...new Set(entities.map(e => e.org_tree_id).filter(Boolean))];
      if (!assignedEdgeIds.length) return null;

      const edgePH = assignedEdgeIds.map(() => '?').join(',');
      const [rows] = await db.query(
        `WITH RECURSIVE chain AS (
           SELECT id, parent_code, parent_type, child_code, child_type, root_entity_code, parent_edge_id
           FROM organization_tree
           WHERE id IN (${edgePH}) AND is_active = TRUE
           UNION ALL
           SELECT ot.id, ot.parent_code, ot.parent_type, ot.child_code, ot.child_type, ot.root_entity_code, ot.parent_edge_id
           FROM organization_tree ot
           INNER JOIN chain c ON c.parent_edge_id = ot.id
           WHERE ot.is_active = TRUE
         )
         SELECT DISTINCT id, parent_code, parent_type, child_code, child_type, root_entity_code, parent_edge_id
         FROM chain`,
        assignedEdgeIds
      );
      filteredEdges = rows;
    }

    const codes = [...new Set([
      ...(auditRootCode ? [auditRootCode] : []),
      ...filteredEdges.flatMap(e => [e.parent_code, e.child_code]),
    ].filter(Boolean))];
    const codePH = codes.map(() => '?').join(',');

    // Resolve entity names for all relevant codes in the tree.
    const [names] = await db.query(
      `SELECT cust_code          AS code, name FROM customers                    WHERE cust_code          IN (${codePH})
       UNION ALL SELECT cbo_code  AS code, name FROM customer_buying_offices       WHERE cbo_code           IN (${codePH})
       UNION ALL SELECT csup_code AS code, name FROM customer_suppliers            WHERE csup_code          IN (${codePH})
       UNION ALL SELECT comp_code AS code, name FROM companies                     WHERE comp_code          IN (${codePH})
       UNION ALL SELECT comp_clus_code AS code, name FROM company_clusters         WHERE comp_clus_code     IN (${codePH})
       UNION ALL SELECT comp_fact_code AS code, name FROM company_factories        WHERE comp_fact_code     IN (${codePH})
       UNION ALL SELECT comp_unit_code AS code, name FROM company_units            WHERE comp_unit_code     IN (${codePH})
       UNION ALL SELECT comp_dept_code AS code, name FROM company_departments      WHERE comp_dept_code     IN (${codePH})
       UNION ALL SELECT comp_section_code AS code, name FROM company_sections      WHERE comp_section_code IN (${codePH})
       UNION ALL SELECT afc_code AS code, name FROM audit_firm_companies           WHERE afc_code           IN (${codePH})
       UNION ALL SELECT afc_branch_code AS code, name FROM audit_firm_company_branches WHERE afc_branch_code IN (${codePH})
       UNION ALL SELECT afc_dept_code AS code, name FROM audit_firm_company_departments WHERE afc_dept_code IN (${codePH})`,
      Array(12).fill(codes).flat()
    );
    const nameMap = {};
    for (const r of names) {
      nameMap[r.code] = r.name?.trim() || r.code;
    }

    // Type info: prefer assigned entities for leaf nodes, else use edge metadata.
    const typeMap = {};
    for (const e of entities) {
      if (e.entity_code && e.entity_type) typeMap[e.entity_code] = e.entity_type;
    }
    for (const e of filteredEdges) {
      if (!typeMap[e.parent_code] && e.parent_type) typeMap[e.parent_code] = e.parent_type;
      if (!typeMap[e.child_code] && e.child_type) typeMap[e.child_code] = e.child_type;
    }

    // parent_edge_id (organization_tree.id) → child edge rows
    const childrenByParentEdgeId = new Map();
    for (const e of filteredEdges) {
      const parentEdgeId = e.parent_edge_id ?? null;
      if (!childrenByParentEdgeId.has(parentEdgeId)) childrenByParentEdgeId.set(parentEdgeId, []);
      childrenByParentEdgeId.get(parentEdgeId).push(e);
    }

    if (auditRootCode && filteredEdges.some((e) => e.edge_path)) {
      const edgePathMap = new Map();
      for (const edge of filteredEdges) {
        const parts = String(edge.edge_path || edge.id).split(',');
        const parentPath = parts.length === 1 ? 'ROOT' : parts.slice(0, -1).join(',');
        if (!edgePathMap.has(parentPath)) edgePathMap.set(parentPath, []);
        edgePathMap.get(parentPath).push(edge);
      }

      const buildChildrenByPath = (currentEdgePath, pathCodes = new Set()) => {
        const childEdges = edgePathMap.get(currentEdgePath) || [];
        return childEdges
          .filter((edge) => !pathCodes.has(edge.child_code))
          .map((edge) => {
            const nextPathCodes = new Set(pathCodes);
            nextPathCodes.add(edge.child_code);
            return {
              code: edge.child_code,
              name: nameMap[edge.child_code] || edge.child_code,
              entity_type: typeMap[edge.child_code] || edge.child_type || '',
              edge_id: edge.id,
              children: buildChildrenByPath(edge.edge_path, nextPathCodes),
            };
          });
      };

      return {
        code: auditRootCode,
        name: nameMap[auditRootCode] || auditRootCode,
        entity_type: typeMap[auditRootCode] || '',
        edge_id: null,
        children: buildChildrenByPath('ROOT', new Set([auditRootCode])),
      };
    }

    const buildFromEdge = (edgeRow, visitedEdgeIds = new Set()) => {
      if (!edgeRow) return null;
      if (visitedEdgeIds.has(edgeRow.id)) return null;
      const nextVisited = new Set(visitedEdgeIds);
      nextVisited.add(edgeRow.id);

      const childEdges = childrenByParentEdgeId.get(edgeRow.id) || [];
      const children = childEdges
        .map(e => buildFromEdge(e, nextVisited))
        .filter(Boolean);

      return {
        code: edgeRow.child_code,
        name: nameMap[edgeRow.child_code] || edgeRow.child_code,
        entity_type: typeMap[edgeRow.child_code] || edgeRow.child_type || '',
        edge_id: edgeRow.id,
        children,
      };
    };

    const rootChildrenEdges = (childrenByParentEdgeId.get(null) || [])
      .filter(e => !auditRootCode || e.parent_code === auditRootCode);

    const rootChildren = rootChildrenEdges.map(e => buildFromEdge(e)).filter(Boolean);
    if (auditRootCode) {
      return {
        code: auditRootCode,
        name: nameMap[auditRootCode] || auditRootCode,
        entity_type: typeMap[auditRootCode] || '',
        edge_id: null,
        children: rootChildren,
      };
    }
    if (rootChildren.length === 1) return rootChildren[0];
    return { code: '__root__', name: 'All Entities', entity_type: '', edge_id: null, children: rootChildren };
  },
};

module.exports = AuditExecutionModel;
