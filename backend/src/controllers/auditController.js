/**
 * Audit Controller
 *
 * AUDIT ASSIGNMENTS
 *   POST   /api/audits                      Create audit assignment
 *   GET    /api/audits                     List audit assignments
 *   GET    /api/audits/:id                  Get one with entities
 *   PUT    /api/audits/:id                  Update assignment
 *   DELETE /api/audits/:id                  Cancel (soft-delete)
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
  getEntityHeadOrgTreeScope,
  auditEntitiesInScope,
  getAccessibleEntityCodes,
} = require('../utils/accessHelper');
const AuditExecutionModel = require('../models/AuditExecutionModel');
const LimitsEnforcer = require('../utils/limitsEnforcer');
const { sendAuditAssignedEmail } = require('../services/emailService');
const NotificationModel = require('../models/NotificationModel');

// Generate a unique audit_code like AUD-20260316-0001
async function generateAuditCode() {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const prefix = `AUD-${ymd}-`;
  const [rows] = await db.query(
    `SELECT audit_code FROM audit_assignments WHERE audit_code LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let seq = 1;
  if (rows.length) {
    const last = rows[0].audit_code.split('-').pop();
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
  const ph = codes.map(() => '?').join(',');
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
    Array(12).fill(codes).flat()
  );
  const nameMap = {};
  for (const r of rows) nameMap[r.code] = r.name.trim();
  return nameMap;
}

async function resolveCreatorOrganizations(audits) {
  if (!audits || audits.length === 0) return {};
  const codes = [...new Set(audits.map((a) => a.created_by).filter(Boolean))];
  if (codes.length === 0) return {};
  const ph = codes.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT cust_code AS code, name, email, phone_number, 'Customer' AS entity_type
       FROM customers WHERE cust_code IN (${ph})
     UNION ALL
     SELECT comp_code AS code, name, email, phone_number, 'Company' AS entity_type
       FROM companies WHERE comp_code IN (${ph})
     UNION ALL
     SELECT afc_code AS code, name, email, phone_number, 'Audit Firm Company' AS entity_type
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
      entity_type: r.entity_type || null,
    };
  }
  return map;
}

// GET /api/audits/checklist/:id/entities
// Returns distinct entity codes/types/names that have at least one question in the checklist
const getChecklistEntities = async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await ChecklistModel.findById(id);
    if (!checklist) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    // Check if user has access to the checklist (creator or linked partner)
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(checklist.created_by)) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    const questions = await ChecklistModel.listQuestions(id);

    // Collect distinct entity instances (entity_code + org_tree_id)
    const seen = new Set();
    const entities = [];
    for (const q of questions) {
      const k = `${q.entity_code}__${q.org_tree_id ?? 'null'}`;
      if (!seen.has(k)) {
        seen.add(k);
        entities.push({
          entity_code: q.entity_code,
          org_tree_id: q.org_tree_id ?? null,
          entity_type: q.entity_type,
          question_count: 0,
        });
      }
      const ent = entities.find(e => e.entity_code === q.entity_code && (e.org_tree_id ?? null) === (q.org_tree_id ?? null));
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

// POST /api/audits
const createAudit = async (req, res) => {
  try {
    const {
      checklist_id, title, audit_type,
      assigned_auditor_code, assigned_firm_code,
      budget, currency, num_workers, start_date, end_date, notes,
      entities  // array of { entity_code, entity_type, entity_name }
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

    const limitError = await LimitsEnforcer.checkAuditLimit(req.user.entityCode);
    if (limitError) return errorResponse(res, limitError, 403);

    const audit_code = await generateAuditCode();

    const id = await AuditModel.create({
      audit_code, checklist_id, title, audit_type,
      assigned_auditor_code, assigned_firm_code,
      budget: budget ?? checklist.budget,
      currency: currency ?? checklist.currency ?? '$',
      num_workers: num_workers ?? checklist.num_workers,
      start_date, end_date, notes,
      created_by: req.user.entityCode,
      status: 'plan',
    });

    // Store only codes+types (+ org_tree_id if provided) — names are always resolved fresh on read
    const entitiesToStore = entities.map(({ org_tree_id, entity_code, entity_type }) => ({
      org_tree_id: org_tree_id ? parseInt(org_tree_id) : null,
      entity_code,
      entity_type,
    }));
    await AuditModel.addEntities(id, entitiesToStore);

    const created = await AuditModel.getWithEntities(id);
    if (created && created.entities && created.entities.length > 0) {
      const nameMap = await resolveEntityNames(created.entities);
      for (const e of created.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
    }

    if (assigned_auditor_code) {
      try {
        const auditor = await AuditorModel.findByCode(assigned_auditor_code);
        if (auditor && auditor.email) {
          const auditorName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          await sendAuditAssignedEmail(auditor.email, auditorName, created || { title, audit_type, start_date, end_date });
        }

        await NotificationModel.createIfNotExists({
          auditor_code: assigned_auditor_code,
          created_by_entity_code: req.user.entityCode,
          type: 'audit_assigned',
          title: 'New Audit Assigned',
          message: `${audit_code} assigned${title ? `: ${title}` : ''}. Start: ${start_date}`,
          audit_id: id,
          notify_date: null,
          notification_key: `audit_assigned:${id}:${assigned_auditor_code}`,
        });
        await NotificationModel.createIfNotExists({
          auditor_code: assigned_auditor_code,
          created_by_entity_code: req.user.entityCode,
          type: 'audit_start',
          title: 'Audit Start Reminder',
          message: `${audit_code} starts today${title ? `: ${title}` : ''}.`,
          audit_id: id,
          notify_date: start_date,
          notification_key: `audit_start:${id}:${assigned_auditor_code}:${start_date}`,
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
    } else if (req.user.role === 'entity_head') {
      audits = await AuditModel.listForEntityHead(req.user.assignedOrgTreeId);
      const scopeIds = await getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId);
      const scopeSet = new Set(scopeIds.map(Number));
      for (const a of audits) {
        const ents = await AuditModel.getEntities(a.id);
        const scopedEnts = ents.filter((e) => scopeSet.has(Number(e.org_tree_id)));
        a.entity_count = scopedEnts.length;
        const progress = await AuditExecutionModel.getProgress(a.id);
        const scopedProgress = progress.filter((p) => p.org_tree_id != null && scopeSet.has(Number(p.org_tree_id)));
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
      if (req.user.role === 'entity_head') continue;

      const ents = await AuditModel.getEntities(a.id);
      a.entity_count = ents.length;

      // Calculate total questions and answered questions across all entities for this audit
      const [progress] = await db.query(
        `SELECT SUM(total_questions) as total_questions, SUM(answered_questions) as answered_questions
         FROM audit_entity_progress
         WHERE audit_id = ?`,
        [a.id]
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
    const isAuditor = req.user.role === 'auditor' && audit.assigned_auditor_code === (req.user.userCode || '');
    const isFirmAdmin =
      req.user.role === 'admin' &&
      (req.user.accountType === 'Audit Firm' || req.user.accountType === 'Audit Firm Company') &&
      audit.assigned_firm_code &&
      audit.assigned_firm_code === req.user.entityCode;

    const entityHeadScopeIds = req.user.role === 'entity_head'
      ? await getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId)
      : [];
    const isEntityHead = req.user.role === 'entity_head'
      && auditEntitiesInScope(audit.entities, entityHeadScopeIds);

    if (!isCreator && !isAuditor && !isFirmAdmin && !isEntityHead) {
      return errorResponse(res, 'Audit not found.', 404);
    }
    // Always resolve names fresh — don't rely on stored entity_name
    if (audit.entities && audit.entities.length > 0) {
      const nameMap = await resolveEntityNames(audit.entities);
      for (const e of audit.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
    }

    // Attach creator org details (useful for audit firm assigned audits)
    try {
      if (audit.created_by) {
        const orgMap = await resolveCreatorOrganizations([audit]);
        audit.assigned_company = orgMap[audit.created_by] || null;
      }
      if (audit.assigned_auditor_code) {
        const auditor = await AuditorModel.findByCode(audit.assigned_auditor_code);
        if (auditor) {
          const fullName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          audit.auditor_name = fullName || null;
          audit.auditor_email = auditor.email || null;
          audit.auditor_phone = auditor.phone_number || null;
        }
      }
      if (!audit.auditor_name && audit.assigned_firm_code) {
        const [firmRows] = await db.query(
          `SELECT name, email, phone_number
             FROM audit_firm_companies
            WHERE afc_code = ?
            LIMIT 1`,
          [audit.assigned_firm_code]
        );
        const firm = firmRows?.[0] || null;
        if (firm) {
          audit.auditor_name = firm.name || null;
          audit.auditor_email = firm.email || null;
          audit.auditor_phone = firm.phone_number || null;
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

    // Firm admin is only allowed to assign/update the assigned_auditor_code (handover internal assignment).
    if (isFirmAdmin && !isCreatorAdmin) {
      const { assigned_auditor_code, assigned_org_tree_id } = req.body;

      if (!assigned_auditor_code) {
        return errorResponse(res, 'assigned_auditor_code is required.', 400);
      }

      // Ensure auditor belongs to this firm
      const auditor = await AuditorModel.findByCode(assigned_auditor_code);
      if (!auditor || auditor.created_by_entity_code !== req.user.entityCode) {
        return errorResponse(res, 'Invalid auditor for this audit firm.', 400);
      }

      await AuditModel.updateAssignedAuditor(id, { assigned_auditor_code, assigned_org_tree_id: assigned_org_tree_id || null });
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
          auditor_code: assigned_auditor_code,
          created_by_entity_code: audit.created_by,
          type: 'audit_assigned',
          title: 'New Audit Assigned',
          message: `${(updated && updated.audit_code) || audit.audit_code || `AUD-${id}`} assigned${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ''}. Start: ${(updated && updated.start_date) || audit.start_date}`,
          audit_id: Number(id),
          notify_date: null,
          notification_key: `audit_assigned:${id}:${assigned_auditor_code}`,
        });
        await NotificationModel.createIfNotExists({
          auditor_code: assigned_auditor_code,
          created_by_entity_code: audit.created_by,
          type: 'audit_start',
          title: 'Audit Start Reminder',
          message: `${(updated && updated.audit_code) || audit.audit_code || `AUD-${id}`} starts today${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ''}.`,
          audit_id: Number(id),
          notify_date: (updated && updated.start_date) || audit.start_date || null,
          notification_key: `audit_start:${id}:${assigned_auditor_code}:${(updated && updated.start_date) || audit.start_date || ''}`,
        });
        await NotificationModel.deleteByAuditForOtherAuditors(Number(id), assigned_auditor_code);
      } catch (e) {
        console.error('sendAuditAssignedEmail error:', e);
      }

      return successResponse(res, { audit: updated }, 'Assigned auditor updated.');
    }

    const {
      title, audit_type, assigned_auditor_code, assigned_firm_code, assigned_org_tree_id,
      budget, currency, num_workers, start_date, end_date, notes, status,
      entities
    } = req.body;

    const previousAssignedAuditor = audit.assigned_auditor_code || null;

    // Allow status-only updates without requiring other fields
    if (status && !title && !audit_type) {
      // Update only the status field
      await db.query(
        `UPDATE audit_assignments SET status = ? WHERE id = ?`,
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
      title, audit_type, assigned_auditor_code, assigned_firm_code, assigned_org_tree_id,
      budget, currency: currency || '$', num_workers, start_date, end_date, notes, status,
    });

    if (Array.isArray(entities) && entities.length > 0) {
      const entitiesToStore = entities.map(({ org_tree_id, entity_code, entity_type }) => ({
        org_tree_id: org_tree_id ? parseInt(org_tree_id) : null,
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

    const nextAssignedAuditor = updated ? (updated.assigned_auditor_code || null) : (assigned_auditor_code || null);
    if (nextAssignedAuditor && nextAssignedAuditor !== previousAssignedAuditor) {
      try {
        const auditor = await AuditorModel.findByCode(nextAssignedAuditor);
        if (auditor && auditor.email) {
          const auditorName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          await sendAuditAssignedEmail(auditor.email, auditorName, updated || audit);
        }

        await NotificationModel.createIfNotExists({
          auditor_code: nextAssignedAuditor,
          created_by_entity_code: audit.created_by,
          type: 'audit_assigned',
          title: 'New Audit Assigned',
          message: `${(updated && updated.audit_code) || audit.audit_code || `AUD-${id}`} assigned${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ''}. Start: ${(updated && updated.start_date) || audit.start_date}`,
          audit_id: Number(id),
          notify_date: null,
          notification_key: `audit_assigned:${id}:${nextAssignedAuditor}`,
        });
        await NotificationModel.createIfNotExists({
          auditor_code: nextAssignedAuditor,
          created_by_entity_code: audit.created_by,
          type: 'audit_start',
          title: 'Audit Start Reminder',
          message: `${(updated && updated.audit_code) || audit.audit_code || `AUD-${id}`} starts today${(updated && updated.title) || audit.title ? `: ${(updated && updated.title) || audit.title}` : ''}.`,
          audit_id: Number(id),
          notify_date: (updated && updated.start_date) || audit.start_date || null,
          notification_key: `audit_start:${id}:${nextAssignedAuditor}:${(updated && updated.start_date) || audit.start_date || ''}`,
        });
        await NotificationModel.deleteByAuditForOtherAuditors(Number(id), nextAssignedAuditor);
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
    await db.query('UPDATE audit_assignments SET status = ? WHERE id = ?', ['cancelled', id]);
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
      'SELECT COUNT(*) as count FROM audit_assignments WHERE created_by = ? AND is_active = TRUE',
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
  createAudit,
  listAudits,
  getAudit,
  updateAudit,
  deleteAudit,
  cancelAudit,
  getAuditCount,
};
