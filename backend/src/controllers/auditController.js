/**
 * Audit Controller
 *
 * AUDIT ASSIGNMENTS
 *   POST   /api/audits                      Create audit assignment
 *   GET    /api/audits                     List audit assignments
 *   GET    /api/audits/:id                  Get one with entities
 *   PUT    /api/audits/:id                  Update assignment
 *   DELETE /api/audits/:id                  Permanently delete a planned audit
 *
 * HELPER
 *   GET    /api/audits/checklist/:id/entities  Get entities that have questions in this checklist
 */

const AuditModel = require('../models/AuditModel');
const ChecklistModel = require('../models/ChecklistModel');
const AuditorModel = require('../models/AuditorModel');
const { db } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  getOrganizationUserScope,
  auditEntitiesInScope,
  getAccessibleEntityCodes,
} = require('../utils/accessHelper');
const AuditExecutionModel = require('../models/AuditExecutionModel');
const LimitsEnforcer = require('../utils/limitsEnforcer');
const { sendAuditAssignedEmail } = require('../services/emailService');
const NotificationModel = require('../models/NotificationModel');
const { getCountryDialingCode } = require('../utils/orgLookup');

function formatPhoneWithDialingCode(phoneNumber, dialingCode) {
  const phone = String(phoneNumber || '').trim();
  const code = String(dialingCode || '').trim();
  if (!phone || !code || phone.startsWith('+') || phone.startsWith(code)) return phone || null;
  return `${code} ${phone.replace(/^0+/, '')}`.trim();
}

function auditScore(marks, total) {
  const score = Number(marks || 0);
  const max = Number(total || 0);
  return {
    marks_obtained: Number(score.toFixed(2)),
    total_marks: Number(max.toFixed(2)),
    percentage: max > 0 ? Number(((score / max) * 100).toFixed(1)) : 0,
  };
}

// Generate a unique audit_code like AUD-20260316-0001
async function generateAuditCode() {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const prefix = `AUD-${ymd}-`;
  const [rows] = await db.query(
    `SELECT audit_id FROM audit_assignments WHERE audit_id LIKE ? ORDER BY audit_id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let seq = 1;
  if (rows.length) {
    const last = rows[0].audit_id.split('-').pop();
    seq = parseInt(last, 10) + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// Resolve entity names fresh from source tables — never rely on stored cache.
// Looks up all 11 entity tables by code; deduplication is safe because
// each entity type uses its own unique code prefix.
async function resolveEntityNames(entityList) {
  if (!entityList || entityList.length === 0) return {};
  const codes = [...new Set(entityList.map(e => e.entity_code))];
  const nameMap = {};
  const LOOKUP_BATCH_SIZE = 500;
  for (let start = 0; start < codes.length; start += LOOKUP_BATCH_SIZE) {
    const batch = codes.slice(start, start + LOOKUP_BATCH_SIZE);
    const ph = batch.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT cust_code          AS code, name FROM customers                    WHERE cust_code          IN (${ph})
       UNION ALL
       SELECT cbo_code           AS code, name FROM customer_buying_offices       WHERE cbo_code           IN (${ph})
       UNION ALL
       SELECT csup_code          AS code, name FROM customer_suppliers            WHERE csup_code          IN (${ph})
       UNION ALL
       SELECT comp_code          AS code, name FROM companies                     WHERE comp_code          IN (${ph})
       UNION ALL
       SELECT comp_clus_code     AS code, name FROM company_clusters              WHERE comp_clus_code     IN (${ph})
       UNION ALL
       SELECT comp_fact_code     AS code, name FROM company_factories             WHERE comp_fact_code     IN (${ph})
       UNION ALL
       SELECT comp_unit_code     AS code, name FROM company_units                 WHERE comp_unit_code     IN (${ph})
       UNION ALL
       SELECT comp_dept_code     AS code, name FROM company_departments           WHERE comp_dept_code     IN (${ph})
       UNION ALL
       SELECT comp_section_code  AS code, name FROM company_sections              WHERE comp_section_code  IN (${ph})
       UNION ALL
       SELECT afc_code           AS code, name FROM audit_firm_companies          WHERE afc_code           IN (${ph})
       UNION ALL
       SELECT afc_branch_code    AS code, name FROM audit_firm_company_branches   WHERE afc_branch_code    IN (${ph})
       UNION ALL
       SELECT afc_dept_code      AS code, name FROM audit_firm_company_departments WHERE afc_dept_code      IN (${ph})`,
      Array(12).fill(batch).flat()
    );
    for (const r of rows) nameMap[r.code] = r.name.trim();
  }
  return nameMap;
}

async function resolveCreatorOrganizations(audits) {
  if (!audits || audits.length === 0) return {};
  const codes = [...new Set(audits.map((a) => a.created_by).filter(Boolean))];
  if (codes.length === 0) return {};
  const ph = codes.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT cust_code AS code, name, email, phone_number, country, address_line_1, address_line_2, address_line_3, 'Customer' AS entity_type
       FROM customers WHERE cust_code IN (${ph})
     UNION ALL
     SELECT comp_code AS code, name, email, phone_number, country, address_line_1, address_line_2, address_line_3, 'Company' AS entity_type
       FROM companies WHERE comp_code IN (${ph})
     UNION ALL
     SELECT afc_code AS code, name, email, phone_number, country, address_line_1, address_line_2, address_line_3, 'Audit Firm Company' AS entity_type
       FROM audit_firm_companies WHERE afc_code IN (${ph})`,
    Array(3).fill(codes).flat()
  );
  const map = {};
  for (const r of rows) {
    map[r.code] = {
      code: r.code,
      name: r.name?.trim?.() || r.code,
      email: r.email || null,
      phone_number: r.phone_number || null,
      country: r.country || null,
      address: [r.address_line_1, r.address_line_2, r.address_line_3].filter(Boolean).join(', ') || null,
      entity_type: r.entity_type || null,
    };
  }
  return map;
}

// GET /api/audits/checklist/:id/entities
// Returns distinct entity codes/types/names that have at least one question in the checklist
const getChecklistEntities = async (req, res) => {
  try {
    const { checklist_id } = req.params;
    const checklist = await ChecklistModel.findById(checklist_id);
    if (!checklist) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    // Check if user has access to the checklist (creator or linked partner)
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(checklist.created_by)) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    const questions = await ChecklistModel.listQuestions(checklist_id);

    // Collect distinct entity instances (entity_code + org_tree_id)
    const seen = new Set();
    const entities = [];
    for (const q of questions) {
      const k = `${q.entity_code}__${q.org_tree_id || 'null'}`;
      if (!seen.has(k)) {
        seen.add(k);
        entities.push({
          entity_code: q.entity_code,
          org_tree_id: q.org_tree_id || null,
          entity_type: q.entity_type,
          question_count: 0,
        });
      }
      const ent = entities.find(e => e.entity_code === q.entity_code && (e.org_tree_id ?? null) === (q.org_tree_id || null));
      if (ent) ent.question_count++;
    }

    // Fetch names for all codes in one UNION query
    if (entities.length > 0) {
      const nameMap = await resolveEntityNames(entities);
      for (const e of entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
    }

    return successResponse(res, { entities, checklist });
  } catch (err) {
    console.error('getChecklistEntities error:', err);
    return errorResponse(res, 'Failed to fetch checklist entities.', 500);
  }
};

// GET /api/audits/comparison/candidates
const getComparisonCandidates = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return errorResponse(res, 'Only organization administrators can compare audits.', 403);
    }
    if (req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company') {
      return errorResponse(res, 'Audit comparison is not available for audit firm accounts.', 403);
    }
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    const isFirmAdmin = req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company';
    const rows = await AuditModel.listComparisonCandidates({
      accessibleCodes,
      firmCode: isFirmAdmin ? req.user.entityCode : null,
    });
    const audits = rows.map((row) => ({
      audit_id: row.audit_id,
      checklist_id: row.checklist_id,
      checklist_name: row.checklist_name || 'Untitled checklist',
      title: row.title || 'Untitled audit',
      audit_type: row.audit_type,
      start_date: row.start_date,
      end_date: row.end_date,
      completed_at: row.completed_at,
      ...auditScore(row.marks_obtained, row.total_marks),
    }));
    return successResponse(res, { audits });
  } catch (err) {
    console.error('getComparisonCandidates error:', err);
    return errorResponse(res, 'Failed to load completed audits for comparison.', 500);
  }
};

// POST /api/audits/comparison
const compareAudits = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return errorResponse(res, 'Only organization administrators can compare audits.', 403);
    }
    if (req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company') {
      return errorResponse(res, 'Audit comparison is not available for audit firm accounts.', 403);
    }

    const requestedIds = Array.isArray(req.body?.audit_ids)
      ? [...new Set(req.body.audit_ids.map((id) => String(id || '').trim()).filter(Boolean))]
      : [];
    if (requestedIds.length < 2 || requestedIds.length > 5) {
      return errorResponse(res, 'Select between 2 and 5 completed audits to compare.', 400);
    }

    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    const isFirmAdmin = req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company';
    const candidates = await AuditModel.listComparisonCandidates({
      accessibleCodes,
      firmCode: isFirmAdmin ? req.user.entityCode : null,
    });
    const selected = requestedIds.map((id) => candidates.find((candidate) => candidate.audit_id === id)).filter(Boolean);
    if (selected.length !== requestedIds.length) {
      return errorResponse(res, 'One or more selected audits are not available for comparison.', 403);
    }

    const checklistId = selected[0]?.checklist_id;
    if (!checklistId || selected.some((audit) => audit.checklist_id !== checklistId)) {
      return errorResponse(res, 'Select completed audits that use the same checklist.', 400);
    }

    const audits = [...selected]
      .sort((a, b) => new Date(a.completed_at || a.end_date || 0).getTime() - new Date(b.completed_at || b.end_date || 0).getTime())
      .map((audit) => ({
        audit_id: audit.audit_id,
        title: audit.title || 'Untitled audit',
        audit_type: audit.audit_type,
        start_date: audit.start_date,
        end_date: audit.end_date,
        completed_at: audit.completed_at,
        ...auditScore(audit.marks_obtained, audit.total_marks),
      }));

    const rows = await AuditModel.getComparisonResponseRows(audits.map((audit) => audit.audit_id));
    const auditIndex = new Map(audits.map((audit) => [audit.audit_id, audit]));
    const entities = new Map();

    for (const row of rows) {
      if (!auditIndex.has(row.audit_id)) continue;
      const entityType = String(row.entity_type || 'General').trim() || 'General';
      const orgTreeId = row.org_tree_id || null;
      const entityKey = `${row.entity_code}::${orgTreeId || 'null'}`;
      if (!entities.has(entityKey)) {
        entities.set(entityKey, {
          entity_code: row.entity_code,
          org_tree_id: orgTreeId,
          entity_type: entityType,
          byAudit: new Map(),
        });
      }
      const entity = entities.get(entityKey);
      if (!entity.byAudit.has(row.audit_id)) {
        entity.byAudit.set(row.audit_id, { marks: 0, total: 0, actions: 0, openActions: 0 });
      }
      const value = entity.byAudit.get(row.audit_id);
      value.marks += Number(row.marks_obtained || 0);
      value.total += Number(row.total_marks || 0);
      value.actions += Number(row.corrective_action_count || 0);
      value.openActions += Number(row.open_corrective_action_count || 0);
    }

    const entityResults = [...entities.values()].map((entity) => ({
      entity_code: entity.entity_code,
      org_tree_id: entity.org_tree_id,
      entity_type: entity.entity_type,
      audits: audits.map((audit) => {
        const value = entity.byAudit.get(audit.audit_id);
        if (!value) return { audit_id: audit.audit_id, available: false };
        return {
          audit_id: audit.audit_id,
          available: true,
          ...auditScore(value.marks, value.total),
          corrective_action_count: value.actions,
          open_corrective_action_count: value.openActions,
        };
      }),
    }));
    const entityTree = await AuditExecutionModel.getEntityTree(audits[0].audit_id);

    /* Legacy question-level builders are intentionally disabled. The
       comparison response is entity-only and does not return this content.
    const sectionResults = [...sections.entries()].map(([entity_type, byAudit]) => ({
      entity_type,
      audits: audits.map((audit) => {
        const value = byAudit.get(audit.audit_id) || { marks: 0, total: 0, answered: 0, actions: 0, openActions: 0 };
        return { audit_id: audit.audit_id, ...auditScore(value.marks, value.total), answered_count: value.answered, corrective_action_count: value.actions, open_corrective_action_count: value.openActions };
      }),
    }));

    const questionResults = [...questions.values()]
      .map((question) => ({
        entity_type: question.entity_type,
        question_text: question.question_text,
        audits: audits.map((audit) => {
          const value = question.byAudit.get(audit.audit_id);
          if (!value) return { audit_id: audit.audit_id, available: false };
          return {
            audit_id: audit.audit_id,
            available: true,
            ...auditScore(value.marks, value.total),
            status: value.status,
            answer_summary: [...new Set(value.answerTexts)].join(' · ') || null,
            remarks_summary: [...new Set(value.remarks)].join(' · ') || null,
            evidence_count: value.evidence,
            corrective_action_count: value.actions,
            open_corrective_action_count: value.openActions,
          };
        }),
      }))
      .sort((a, b) => a.entity_type.localeCompare(b.entity_type) || a.question_text.localeCompare(b.question_text));
    */

    return successResponse(res, {
      checklist: { name: selected[0]?.checklist_name || 'Checklist' },
      audits,
      entity_tree: entityTree,
      entities: entityResults,
      comparison_basis: 'Scores and corrective-action counts are aggregated by audited organization entity. No question or response content is returned.',
    });
  } catch (err) {
    console.error('compareAudits error:', err);
    return errorResponse(res, 'Failed to compare the selected audits.', 500);
  }
};

// POST /api/audits
const createAudit = async (req, res) => {
  try {
    const {
      checklist_id, title, audit_type,
      assigned_auditor_id, assigned_firm_code, assigned_org_tree_id, send_assignment_email = false,
      budget, currency, num_workers, start_date, end_date, notes,
      entities  // array of { entity_code, entity_type, entity_name, org_tree_id }
    } = req.body;

    if (!checklist_id || !title || !audit_type || !start_date || !end_date) {
      return errorResponse(res, 'checklist_id, title, audit_type, start_date, end_date are required.', 400);
    }
    if (!['internal', 'external'].includes(audit_type)) {
      return errorResponse(res, 'audit_type must be "internal" or "external".', 400);
    }
    if (!Array.isArray(entities) || entities.length === 0) {
      return errorResponse(res, 'At least one entity must be selected.', 400);
    }

    const checklist = await ChecklistModel.findById(checklist_id);
    if (!checklist) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    // Check if user has access to the checklist (creator or linked partner)
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(checklist.created_by)) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    if (audit_type === 'internal') {
      if (!assigned_auditor_id) {
        return errorResponse(res, 'A verified auditor is required for an internal audit.', 400);
      }
      const assignedAuditor = await AuditorModel.findByCode(assigned_auditor_id);
      if (!assignedAuditor || !assignedAuditor.email_verified || !accessibleCodes.includes(assignedAuditor.created_by_entity_code)) {
        return errorResponse(res, 'Select a verified auditor available to your organization.', 400);
      }
    }

    const creation = await LimitsEnforcer.withQuotaLock(
      req.user.entityCode,
      'audit',
      async () => {
        const limitError = await LimitsEnforcer.checkAuditLimit(req.user.entityCode);
        if (limitError) return { limitError };

        const audit_code = await generateAuditCode();

        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();
          const id = await AuditModel.create({
          audit_id: audit_code, checklist_id, title, audit_type,
          assigned_auditor_id, assigned_firm_code, assigned_org_tree_id,
          budget: budget ?? checklist.budget,
          currency: currency ?? checklist.currency ?? '$',
          num_workers: num_workers ?? checklist.num_workers,
          start_date, end_date, notes,
          created_by: req.user.entityCode,
          status: 'plan',
          }, connection);

        // Store only codes+types (+ org_tree_id if provided) — names are always resolved fresh on read
        const entitiesToStore = entities.map(({ org_tree_id, entity_code, entity_type }) => ({
          org_tree_id: org_tree_id || null,
          entity_code,
          entity_type,
        }));
          await AuditModel.addEntities(id, entitiesToStore, connection);
          await connection.commit();
          return { id };
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }
    );
    if (creation.limitError) return errorResponse(res, creation.limitError, 403);
    const { id } = creation;

    const created = await AuditModel.getWithEntities(id);
    if (created && created.entities && created.entities.length > 0) {
      try {
        const nameMap = await resolveEntityNames(created.entities);
        for (const e of created.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
      } catch (nameError) {
        console.error('createAudit entity-name enrichment error:', nameError);
      }
    }

    if (assigned_auditor_id) {
      try {
        const auditor = await AuditorModel.findByCode(assigned_auditor_id);
        if (send_assignment_email === true && auditor && auditor.email) {
          const auditorName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          await sendAuditAssignedEmail(auditor.email, auditorName, created || { title, audit_type, start_date, end_date });
        }

        await NotificationModel.createIfNotExists({
          recipient_user_code: assigned_auditor_id,
          recipient_role: 'auditor',
          created_by_entity_code: req.user.entityCode,
          type: 'audit_assigned',
          title: 'New Audit Assigned',
          message: `You have been assigned${title ? `: ${title}` : ' a new audit'}. Start: ${start_date}`,
          audit_id: id,
          notify_date: null,
          notification_key: `audit_assigned:${id}:${assigned_auditor_id}`,
        });
        await NotificationModel.createIfNotExists({
          recipient_user_code: assigned_auditor_id,
          recipient_role: 'auditor',
          created_by_entity_code: req.user.entityCode,
          type: 'audit_start',
          title: 'Audit Start Reminder',
          message: `${title ? `: ${title}` : ''} starts today.`,
          audit_id: id,
          notify_date: start_date,
          notification_key: `audit_start:${id}:${assigned_auditor_id}:${start_date}`,
        });
      } catch (e) {
        console.error('sendAuditAssignedEmail error:', e);
      }
    }

    return successResponse(res, { audit: created }, 'Audit assignment created.', 201);
  } catch (err) {
    console.error('createAudit error:', err);
    return errorResponse(res, 'Failed to create audit assignment.', 500);
  }
};

// GET /api/audits
const listAudits = async (req, res) => {
  try {
    let audits;
    if (req.user.role === 'auditor') {
      audits = await AuditModel.listForAuditor(req.user.userCode);
    } else if (req.user.role === 'organization_user') {
      const organizationScope = await getOrganizationUserScope(req.user);
      audits = await AuditModel.listForOrganizationUser(organizationScope);
      const scopeIds = organizationScope.orgTreeIds;
      const entityCodeScope = organizationScope.entityCodes;
      const scopeSet = new Set(scopeIds.map(String));
      const entityCodeSet = new Set(entityCodeScope);
      for (const a of audits) {
        const ents = await AuditModel.getEntities(a.audit_id);
        const scopedEnts = ents.filter((e) => auditEntitiesInScope([e], scopeIds, entityCodeScope));
        a.entity_count = scopedEnts.length;
        const progress = await AuditExecutionModel.getProgress(a.audit_id);
        const scopedProgress = progress.filter((p) => p.org_tree_id != null
          ? scopeSet.has(String(p.org_tree_id))
          : entityCodeSet.has(p.entity_code));
        const totalQuestions = scopedProgress.reduce((s, p) => s + (p.total_questions || 0), 0);
        const answeredQuestions = scopedProgress.reduce((s, p) => s + (p.answered_questions || 0), 0);
        a.total_questions = totalQuestions;
        a.answered_questions = answeredQuestions;
        a.progress_pct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
      }
    } else {
      // Admin: creator sees their own audits; Audit Firm admin sees audits assigned to their firm.
      if (req.user.role === 'admin' && (req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company')) {
        audits = await AuditModel.listAssignedToFirm(req.user.entityCode);
      } else {
        const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
        audits = await AuditModel.list(accessibleCodes);
      }
    }
    // Attach entity count and calculate progress per audit
    for (const a of audits) {
      if (req.user.role === 'organization_user') continue;

      const ents = await AuditModel.getEntities(a.audit_id);
      a.entity_count = ents.length;

      // Calculate total questions and answered questions across all entities for this audit
      const [progress] = await db.query(
        `SELECT SUM(total_questions) as total_questions, SUM(answered_questions) as answered_questions
         FROM audit_entity_progress
         WHERE audit_id = ?`,
        [a.audit_id]
      );

      const totalQuestions = progress[0]?.total_questions || 0;
      const answeredQuestions = progress[0]?.answered_questions || 0;

      a.total_questions = totalQuestions;
      a.answered_questions = answeredQuestions;
      a.progress_pct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    }

    // Enrich with creator organization details for firm admins (assigned audits view)
    if (req.user.role === 'admin' && (req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company')) {
      const orgMap = await resolveCreatorOrganizations(audits);
      for (const a of audits) {
        const org = orgMap[a.created_by] || null;
        a.assigned_company = org
          ? {
              code: org.code,
              name: org.name,
              email: org.email,
              phone_number: org.phone_number,
              country: org.country,
              address: org.address,
              entity_type: org.entity_type,
            }
          : null;
      }
    }
    return successResponse(res, { audits, total: audits.length });
  } catch (err) {
    console.error('listAudits error:', err);
    return errorResponse(res, 'Failed to fetch audits.', 500);
  }
};

// GET /api/audits/:id
const getAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.getWithEntities(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);

    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    const isCreator = req.user.role === 'admin' && accessibleCodes.includes(audit.created_by);
    const isAuditor = req.user.role === 'auditor' && audit.assigned_auditor_id === (req.user.userCode || '');
    const isFirmAdmin =
      req.user.role === 'admin' &&
      (req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company') &&
      audit.assigned_firm_code &&
      audit.assigned_firm_code === req.user.entityCode;

    const organizationScope = req.user.role === 'organization_user'
      ? await getOrganizationUserScope(req.user)
      : { orgTreeIds: [], entityCodes: [] };
    const organizationUserScopeIds = organizationScope.orgTreeIds;
    const organizationUserCodeScope = organizationScope.entityCodes;
    const isOrganizationUser = req.user.role === 'organization_user'
      && auditEntitiesInScope(audit.entities, organizationUserScopeIds, organizationUserCodeScope);

    if (!isCreator && !isAuditor && !isFirmAdmin && !isOrganizationUser) {
      return errorResponse(res, 'Audit not found.', 404);
    }
    // Always resolve names fresh — don't rely on stored entity_name
    if (audit.entities && audit.entities.length > 0) {
      const nameMap = await resolveEntityNames(audit.entities);
      for (const e of audit.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
      if (req.user.role === 'organization_user') {
        audit.entities = audit.entities.filter((entity) =>
          auditEntitiesInScope([entity], organizationUserScopeIds, organizationUserCodeScope)
        );
      }
    }

    // Attach creator org details (useful for audit firm assigned audits)
    try {
      if (audit.created_by) {
        const orgMap = await resolveCreatorOrganizations([audit]);
        audit.assigned_company = orgMap[audit.created_by] || null;
      }
      if (audit.assigned_auditor_id) {
        const auditor = await AuditorModel.findByCode(audit.assigned_auditor_id);
        if (auditor) {
          const fullName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          const dialingCode = await getCountryDialingCode(auditor.country);
          audit.auditor_name = fullName || null;
          audit.auditor_email = auditor.email || null;
          audit.auditor_phone = formatPhoneWithDialingCode(auditor.phone_number, dialingCode);
        }
      }
      if (!audit.auditor_name && audit.assigned_firm_code) {
        const [firmRows] = await db.query(
          `SELECT name, email, phone_number, country
             FROM audit_firm_companies
            WHERE afc_code = ?
            LIMIT 1`,
          [audit.assigned_firm_code]
        );
        const firm = firmRows?.[0] || null;
        if (firm) {
          audit.auditor_name = firm.name || null;
          audit.auditor_email = firm.email || null;
          audit.auditor_phone = formatPhoneWithDialingCode(
            firm.phone_number,
            await getCountryDialingCode(firm.country)
          );
        }
      }
    } catch (e) {
      // non-fatal enrichment
      console.warn('getAudit creator org enrichment warning:', e?.message || e);
    }
    return successResponse(res, { audit });
  } catch (err) {
    console.error('getAudit error:', err);
    return errorResponse(res, 'Failed to fetch audit.', 500);
  }
};

// PUT /api/audits/:id
const updateAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);

    const isCreatorAdmin = req.user.role === 'admin' && audit.created_by === req.user.entityCode;
    const isFirmAdmin =
      req.user.role === 'admin' &&
      (req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company') &&
      audit.assigned_firm_code &&
      audit.assigned_firm_code === req.user.entityCode;

    if (!isCreatorAdmin && !isFirmAdmin) {
      return errorResponse(res, 'Audit not found.', 404);
    }

    const auditHasStarted = ['in_progress', 'completed'].includes(String(audit.status || '').toLowerCase());
    const assignmentChanged =
      (Object.prototype.hasOwnProperty.call(req.body, 'assigned_auditor_id') &&
        (req.body.assigned_auditor_id || null) !== (audit.assigned_auditor_id || null)) ||
      (Object.prototype.hasOwnProperty.call(req.body, 'assigned_org_tree_id') &&
        (req.body.assigned_org_tree_id || null) !== (audit.assigned_org_tree_id || null));

    // An audit firm may hand an audit over before work starts. Once the auditor
    // has started or completed it, its assignment must stay intact.
    if (isFirmAdmin && auditHasStarted && assignmentChanged) {
      return errorResponse(res, 'The auditor assignment cannot be changed after the audit has started.', 409);
    }

    // Firm admin is only allowed to assign/update the assigned_auditor_id (handover internal assignment).
    if (isFirmAdmin && !isCreatorAdmin) {
      const { assigned_auditor_id, assigned_org_tree_id } = req.body;

      if (!assigned_auditor_id) {
        return errorResponse(res, 'assigned_auditor_id is required.', 400);
      }

      // Ensure auditor belongs to this firm
      const auditor = await AuditorModel.findByCode(assigned_auditor_id);
      if (!auditor || !auditor.email_verified || auditor.created_by_entity_code !== req.user.entityCode) {
        return errorResponse(res, 'Select a verified auditor for this audit firm.', 400);
      }

      await AuditModel.updateAssignedAuditor(id, { assigned_auditor_id, assigned_org_tree_id: assigned_org_tree_id || null });
      const updated = await AuditModel.getWithEntities(id);
      if (updated && updated.entities && updated.entities.length > 0) {
        const nameMap = await resolveEntityNames(updated.entities);
        for (const e of updated.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
      }

      try {
        if (auditor && auditor.email) {
          const auditorName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          await sendAuditAssignedEmail(auditor.email, auditorName, updated || audit);
        }

        await NotificationModel.createIfNotExists({
          recipient_user_code: assigned_auditor_id,
          recipient_role: 'auditor',
          created_by_entity_code: audit.created_by,
          type: 'audit_assigned',
          title: 'New Audit Assigned',
          message: `assigned${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ''}. Start: ${(updated && updated.start_date) || audit.start_date}`,
          audit_id: id,
          notify_date: null,
          notification_key: `audit_assigned:${id}:${assigned_auditor_id}`,
        });
        await NotificationModel.createIfNotExists({
          recipient_user_code: assigned_auditor_id,
          recipient_role: 'auditor',
          created_by_entity_code: audit.created_by,
          type: 'audit_start',
          title: 'Audit Start Reminder',
          message: `${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ''} starts today.`,
          audit_id: id,
          notify_date: (updated && updated.start_date) || audit.start_date || null,
          notification_key: `audit_start:${id}:${assigned_auditor_id}:${(updated && updated.start_date) || audit.start_date || ''}`,
        });
        await NotificationModel.deleteByAuditForOtherRecipients(id, assigned_auditor_id);
      } catch (e) {
        console.error('sendAuditAssignedEmail error:', e);
      }

      return successResponse(res, { audit: updated }, 'Assigned auditor updated.');
    }

    const {
      title, audit_type, assigned_auditor_id, assigned_firm_code, assigned_org_tree_id,
      budget, currency, num_workers, start_date, end_date, notes, status,
      entities
    } = req.body;

    const previousAssignedAuditor = audit.assigned_auditor_id || null;

    // Allow status-only updates without requiring other fields
    if (status && !title && !audit_type) {
      // Update only the status field
      await db.query(
        `UPDATE audit_assignments SET status = ? WHERE audit_id = ?`,
        [status, id]
      );
      const updated = await AuditModel.getWithEntities(id);
      if (updated && updated.entities && updated.entities.length > 0) {
        const nameMap = await resolveEntityNames(updated.entities);
        for (const e of updated.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
      }
      return successResponse(res, { audit: updated }, 'Audit status updated.');
    }

    // Full update requires all core fields
    if (!title || !audit_type || !start_date || !end_date) {
      return errorResponse(res, 'title, audit_type, start_date, end_date are required.', 400);
    }

    await AuditModel.update(id, {
      title, audit_type, assigned_auditor_id, assigned_firm_code, assigned_org_tree_id,
      budget, currency: currency || '$', num_workers, start_date, end_date, notes, status,
    });

    if (Array.isArray(entities) && entities.length > 0) {
      const entitiesToStore = entities.map(({ org_tree_id, entity_code, entity_type }) => ({
        org_tree_id: org_tree_id || null,
        entity_code,
        entity_type,
      }));
      await AuditModel.updateEntities(id, entitiesToStore);
    }

    const updated = await AuditModel.getWithEntities(id);
    if (updated && updated.entities && updated.entities.length > 0) {
      const nameMap = await resolveEntityNames(updated.entities);
      for (const e of updated.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
    }

    const nextAssignedAuditor = updated ? (updated.assigned_auditor_id || null) : (assigned_auditor_id || null);
    if (nextAssignedAuditor && nextAssignedAuditor !== previousAssignedAuditor) {
      try {
        const auditor = await AuditorModel.findByCode(nextAssignedAuditor);
        if (auditor && auditor.email) {
          const auditorName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          await sendAuditAssignedEmail(auditor.email, auditorName, updated || audit);
        }

        await NotificationModel.createIfNotExists({
          recipient_user_code: nextAssignedAuditor,
          recipient_role: 'auditor',
          created_by_entity_code: audit.created_by,
          type: 'audit_assigned',
          title: 'New Audit Assigned',
          message: `You have been assigned${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ' a new audit'}. Start: ${(updated && updated.start_date) || audit.start_date}`,
          audit_id: id,
          notify_date: null,
          notification_key: `audit_assigned:${id}:${nextAssignedAuditor}`,
        });
        await NotificationModel.createIfNotExists({
          recipient_user_code: nextAssignedAuditor,
          recipient_role: 'auditor',
          created_by_entity_code: audit.created_by,
          type: 'audit_start',
          title: 'Audit Start Reminder',
          message: `${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ''} starts today.`,
          audit_id: id,
          notify_date: (updated && updated.start_date) || audit.start_date || null,
          notification_key: `audit_start:${id}:${nextAssignedAuditor}:${(updated && updated.start_date) || audit.start_date || ''}`,
        });
        await NotificationModel.deleteByAuditForOtherRecipients(id, nextAssignedAuditor);
      } catch (e) {
        console.error('sendAuditAssignedEmail error:', e);
      }
    }

    return successResponse(res, { audit: updated }, 'Audit updated.');
  } catch (err) {
    console.error('updateAudit error:', err);
    return errorResponse(res, 'Failed to update audit.', 500);
  }
};

// POST /api/audits/:id/cancel
const cancelAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) {
      return errorResponse(res, 'Audit not found.', 404);
    }

    // Check if user has access to the audit (creator or linked partner)
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(audit.created_by)) {
      return errorResponse(res, 'Audit not found.', 404);
    }

    if (audit.status === 'completed') {
      return errorResponse(res, 'Completed audits cannot be cancelled.', 400);
    }
    await db.query('UPDATE audit_assignments SET status = ? WHERE audit_id = ?', ['cancelled', id]);
    return successResponse(res, null, 'Audit cancelled.');
  } catch (err) {
    console.error('cancelAudit error:', err);
    return errorResponse(res, 'Failed to cancel audit.', 500);
  }
};

// DELETE /api/audits/:id
const deleteAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) {
      return errorResponse(res, 'Audit not found.', 404);
    }

    // Check if user has access to the audit (creator or linked partner)
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(audit.created_by)) {
      return errorResponse(res, 'Audit not found.', 404);
    }
    
    // As per user request: dont allow to delete if audit exist in progress status
    if (audit.status !== 'plan') {
      return errorResponse(res, `Audits in "${audit.status}" status cannot be deleted. You can only cancel them.`, 400);
    }

    await AuditModel.delete(id);
    return successResponse(res, null, 'Audit deleted successfully.');
  } catch (err) {
    console.error('deleteAudit error:', err);
    return errorResponse(res, 'Failed to delete audit.', 500);
  }
};

// GET /api/audits/count
// Returns the active audit count for the current admin — uses the same
// query as LimitsEnforcer.checkAuditLimit so the frontend and enforcer agree.
const getAuditCount = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return successResponse(res, { count: 0 });
    }
    const [[{ count }]] = await db.query(
      `SELECT COUNT(*) as count
       FROM audit_assignments
       WHERE created_by = ? AND is_active = TRUE AND status != 'cancelled'`,
      [req.user.entityCode]
    );
    return successResponse(res, { count: Number(count) });
  } catch (err) {
    console.error('getAuditCount error:', err);
    return errorResponse(res, 'Failed to fetch audit count.', 500);
  }
};

module.exports = {
  getChecklistEntities,
  getComparisonCandidates,
  compareAudits,
  createAudit,
  listAudits,
  getAudit,
  updateAudit,
  deleteAudit,
  cancelAudit,
  getAuditCount,
};
