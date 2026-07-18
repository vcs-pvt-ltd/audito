/**
 * CAP Controller
 *
 * Handles Corrective Action Plan (CAP) endpoints:
 *   POST   /api/caps                         Create CAP from corrective actions
 *   GET    /api/caps                         List CAPs for current user
 *   GET    /api/caps/audit/:auditId          List CAPs for specific audit
 *   GET    /api/caps/:id                     Get CAP detail
 *   GET    /api/caps/:id/items               Get CAP questions (for execution)
 *   POST   /api/caps/:id/respond             Submit response to a CAP question
 *   GET    /api/caps/:id/responses           Get all responses for a CAP
 *   GET    /api/caps/:id/progress            Get entity-level progress
 *   POST   /api/caps/:id/complete            Complete a CAP
 *   PUT    /api/caps/:id/status              Update CAP status
 *   GET    /api/caps/entity-heads/:code      Get entity heads for assignment
 *   POST   /api/caps/create-follow-up        Create follow-up audit
 *   POST   /api/caps/:id/evidence            Upload CAP evidence (by response_id)
 *   DELETE /api/caps/evidence/:evidenceId    Delete CAP evidence
 */

const CapModel = require('../models/CapModel');
const AuditModel = require('../models/AuditModel');
const EntityHeadModel = require('../models/EntityHeadModel');
const AdminModel = require('../models/AdminModel');
const AuditorModel = require('../models/AuditorModel');
const NotificationModel = require('../models/NotificationModel');
const { db } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  getEntityHeadOrgTreeScope,
  getAccessibleEntityCodes,
  resolveEntityNames,
  auditEntitiesInScope,
  extractEntityHeadSubtree,
} = require('../utils/accessHelper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateAuditId, generateCapId, generateCapEntityProgressIds, generateCapResponseId, generateCapResponseEvidenceId } = require('../utils/codeGenerator');
const { MAX_EVIDENCE_BYTES, getEvidenceMediaType, getEvidencePolicy } = require('../utils/evidencePolicy');

const ENTITY_TABLE_MAP = {
  'Customer': { table: 'customers', codeField: 'cust_code' },
  'Buying Office': { table: 'customer_buying_offices', codeField: 'cbo_code' },
  'Company': { table: 'companies', codeField: 'comp_code' },
  'Cluster': { table: 'company_clusters', codeField: 'comp_clus_code' },
  'Factory': { table: 'company_factories', codeField: 'comp_fact_code' },
  'Unit': { table: 'company_units', codeField: 'comp_unit_code' },
  'Department': { table: 'company_departments', codeField: 'comp_dept_code' },
  'Section': { table: 'company_sections', codeField: 'comp_section_code' },
  'Audit Firm Company': { table: 'audit_firm_companies', codeField: 'afc_code' },
  'Branch': { table: 'audit_firm_company_branches', codeField: 'afc_branch_code' },
  'Audit Firm Department': { table: 'audit_firm_company_departments', codeField: 'afc_dept_code' },
};

// ── File upload setup ─────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/cap-evidence');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (/^(image|video|audio)\//.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image, video, and audio files are allowed.'), false);
};

const capUpload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

async function notifyCapCreated({ capId, capTitle, audit, entities, parentCapId, creator }) {
  const type = parentCapId ? 'sub_cap_created' : 'cap_created';
  const label = parentCapId ? 'Sub-CAP' : 'CAP';
  const message = `${label} "${capTitle}" has been created for audit "${audit.title || audit.audit_code || audit.audit_id}".`;
  const createdByEntityCode = audit.created_by || creator?.entityCode || null;
  const recipients = new Map();

  // Notify the workspace admin who owns the source audit.
  const auditAdmin = audit.created_by ? await AdminModel.findByEntityCode(audit.created_by) : null;
  if (auditAdmin?.admin_id) recipients.set(`admin:${auditAdmin.admin_id}`, { userCode: auditAdmin.admin_id, role: 'admin' });
  else if (creator?.role === 'admin' && creator.userCode) recipients.set(`admin:${creator.userCode}`, { userCode: creator.userCode, role: 'admin' });

  // Notify every active entity head responsible for a CAP target. Fall back to entity-code assignments
  // where a target is not represented by an organization-tree node.
  const orgTreeIds = [...new Set((entities || []).map((entity) => entity.org_tree_id).filter(Boolean))];
  const heads = await EntityHeadModel.findByOrgTreeIds(orgTreeIds);
  const headCodes = new Set(heads.map((head) => head.entity_head_id));
  for (const entityCode of [...new Set((entities || []).map((entity) => entity.entity_code).filter(Boolean))]) {
    const entityHeads = await EntityHeadModel.findByEntityCode(entityCode);
    for (const head of entityHeads) {
      if (!headCodes.has(head.entity_head_id)) heads.push(head);
    }
  }
  for (const head of heads) {
    if (head?.entity_head_id) recipients.set(`entity_head:${head.entity_head_id}`, { userCode: head.entity_head_id, role: 'entity_head' });
  }

  for (const recipient of recipients.values()) {
    await NotificationModel.createIfNotExists({
      recipient_user_code: recipient.userCode,
      recipient_role: recipient.role,
      created_by_entity_code: createdByEntityCode,
      type,
      title: `${label} Created`,
      message,
      audit_id: audit.audit_id,
      notification_key: `${type}:${capId}:${recipient.role}:${recipient.userCode}`,
    });
  }
}

// ── POST /api/caps ────────────────────────────────────────────────
/**
 * Create a CAP Plan from the corrective_actions of a completed audit.
 * Body: { audit_id, title?, description? }
 */
  const createCap = async (req, res) => {
  try {
    const { audit_id, parent_cap_id, title, description } = req.body;
    if (!audit_id) return errorResponse(res, 'audit_id is required.', 400);

    const audit = await AuditModel.findById(audit_id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);
    if (audit.status !== 'completed') {
      return errorResponse(res, 'CAP can only be created for completed audits.', 400);
    }

    // Verify auditor access
    if (req.user.role === 'auditor' && audit.assigned_auditor_id !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const parentCapId = parent_cap_id || null;

    // Only block duplicates for root-level CAPs (no parent).
    if (!parentCapId) {
      const existing = await CapModel.listCapsByAudit(audit_id);
      const rootCaps = existing.filter(c => !c.parent_cap_id);
      if (rootCaps.length > 0) {
        return errorResponse(res, 'A CAP plan already exists for this audit.', 409);
      }
    } else {
      const parentCap = await CapModel.getCapById(parentCapId);
      if (!parentCap) return errorResponse(res, 'Parent CAP not found.', 404);
      if (parentCap.audit_id !== audit_id) {
        return errorResponse(res, 'Parent CAP must belong to the same audit.', 400);
      }
      const existingSubs = await CapModel.listSubCapsByParent(parentCapId);
      if (existingSubs.length > 0) {
        return errorResponse(res, 'A Sub-CAP already exists for this parent CAP.', 409);
      }
    }

    // Create the CAP record
    const cap_id = await generateCapId();
    await CapModel.createCap({
      cap_id,
      audit_id,
      title: title || (parentCapId ? `Sub-CAP` : `CAP for ${audit.audit_code}`),
      description: description || null,
      created_by: req.user.userCode,
      parent_cap_id: parentCapId,
    });

    // Sub-CAP: seed only from parent cap-required findings (unique data per cap_id).
    if (parentCapId) {
      try {
        await CapModel.seedSubCapFromParent(cap_id, parentCapId, req.user.userCode);
      } catch (seedErr) {
        await db.query('DELETE FROM caps WHERE cap_id = ?', [cap_id]);
        if (seedErr.code === 'NO_PARENT_FINDINGS') {
          return errorResponse(res, seedErr.message, 400);
        }
        throw seedErr;
      }
      await CapModel.updateCapStatus(cap_id, 'plan');
      try {
        const subCapEntities = await CapModel.getCapEntities(cap_id);
        await notifyCapCreated({
          capId: cap_id,
          capTitle: title || 'Sub-CAP',
          audit,
          entities: subCapEntities,
          parentCapId,
          creator: req.user,
        });
      } catch (notificationError) {
        console.error('notifySubCapCreated error:', notificationError);
      }
      return successResponse(res, { cap_id, parent_cap_id: parentCapId }, 'Sub-CAP plan created successfully.');
    }

    // Root CAP: seed from audit corrective actions
    const [correctiveActions] = await db.query(
      `SELECT * FROM corrective_actions WHERE audit_id = ? AND (cap_response_id IS NULL OR cap_response_id = 0) ORDER BY entity_code`,
      [audit_id]
    );
    if (!correctiveActions.length) {
      await db.query('DELETE FROM caps WHERE cap_id = ?', [cap_id]);
      return errorResponse(res, 'No corrective actions found for this audit.', 400);
    }

    // 1. Identify all targeted entity instances (expand generic ones if needed).
    // CAP assignment entities must retain the organization-tree edge ID. Entity
    // codes can be reused at different locations in an organization, so the code
    // by itself is not a safe instance identifier.
    const [auditEntityInstances] = await db.query(
      `SELECT entity_code, org_tree_id, entity_type
         FROM audit_assignment_entities
        WHERE audit_id = ? AND is_active = 1`,
      [audit_id]
    );
    const auditInstancesByEntity = new Map();
    for (const instance of auditEntityInstances) {
      if (!auditInstancesByEntity.has(instance.entity_code)) {
        auditInstancesByEntity.set(instance.entity_code, []);
      }
      auditInstancesByEntity.get(instance.entity_code).push(instance);
    }

    const entityInstanceMap = new Map();
    for (const ca of correctiveActions) {
      const correctiveActionOrgTreeId = ca.org_tree_id ?? ca.assigned_org_tree_id ?? null;
      const matchingAuditInstances = auditInstancesByEntity.get(ca.entity_code) || [];

      if (correctiveActionOrgTreeId !== null && correctiveActionOrgTreeId !== undefined && correctiveActionOrgTreeId !== '') {
        const k = `${ca.entity_code}__${correctiveActionOrgTreeId}`;
        if (!entityInstanceMap.has(k)) {
          const matchedInstance = matchingAuditInstances.find(
            (instance) => String(instance.org_tree_id ?? '') === String(correctiveActionOrgTreeId)
          );
          entityInstanceMap.set(k, {
            entity_code: ca.entity_code,
            org_tree_id: correctiveActionOrgTreeId,
            entity_type: matchedInstance?.entity_type || '',
          });
        }
      } else {
        // Older corrective actions can lack an edge ID. Expand them to every
        // matching audit entity instance, preserving each instance's org_tree_id.
        for (const inst of matchingAuditInstances) {
          const k = `${inst.entity_code}__${inst.org_tree_id ?? 'null'}`;
          if (!entityInstanceMap.has(k)) {
            entityInstanceMap.set(k, {
              entity_code: inst.entity_code,
              org_tree_id: inst.org_tree_id ?? null,
              entity_type: inst.entity_type,
            });
          }
        }
      }
    }

    const entities = Array.from(entityInstanceMap.values());
    await CapModel.addCapEntities(cap_id, entities);

    // 2. Add CAP questions (this will now correctly expand generic CAs because entities are matched)
    await CapModel.addCapQuestions(cap_id, correctiveActions);

    // 3. Initialize progress for ALL identified entity instances
    // Calculate question counts first
    const [counts] = await db.query(
      `SELECT entity_code, org_tree_id, COUNT(*) as count FROM cap_questions WHERE cap_id = ? GROUP BY entity_code, org_tree_id`,
      [cap_id]
    );
    const countMap = {};
    for (const row of counts) {
      countMap[`${row.entity_code}__${row.org_tree_id ?? 'null'}`] = row.count;
    }

    const progressIds = await generateCapEntityProgressIds(entities.length);
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const k = `${e.entity_code}__${e.org_tree_id ?? 'null'}`;
      await CapModel.initCapEntityProgress(progressIds[i], cap_id, e.entity_code, e.org_tree_id ?? null, countMap[k] || 0);
    }

    // New CAP starts in plan, then moves to in_progress once responses begin.
    await CapModel.updateCapStatus(cap_id, 'plan');

    try {
      await notifyCapCreated({
        capId: cap_id,
        capTitle: title || `CAP for ${audit.audit_code}`,
        audit,
        entities,
        parentCapId: null,
        creator: req.user,
      });
    } catch (notificationError) {
      console.error('notifyCapCreated error:', notificationError);
    }

    return successResponse(res, { cap_id }, 'CAP plan created successfully.');
  } catch (err) {
    console.error('createCap error:', err);
    return errorResponse(res, 'Failed to create CAP plan.', 500);
  }
};

function filterCapProgressByScope(progress, scopeIds) {
  if (!scopeIds?.length) return progress || [];
  const scopeSet = new Set(scopeIds);
  return (progress || []).filter((p) => p.org_tree_id != null && scopeSet.has(p.org_tree_id));
}

// ── GET /api/caps ─────────────────────────────────────────────────
const listCaps = async (req, res) => {
  try {
    let caps;
    const includeSubCaps = req.query.include_sub_caps === '1' || req.query.include_sub_caps === 'true';
    const listOpts = { rootOnly: !includeSubCaps };
    const scopeIds = req.user?.role === 'entity_head'
      ? await getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId)
      : [];

    if (req.user?.role === 'admin') {
      const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
      caps = await CapModel.listCapsForAdmin(accessibleCodes, listOpts);
      const nameMap = await resolveEntityNames(accessibleCodes);
      for (const c of caps) {
        const ownerCode = c.owner_entity_code;
        c.entity_name = ownerCode && ownerCode !== req.user.entityCode ? (nameMap.get(ownerCode)?.name || null) : null;
      }
    } else if (req.user?.role === 'entity_head') {
      caps = await CapModel.listCapsForEntityHead(req.user.assignedOrgTreeId, listOpts);
    } else {
      caps = await CapModel.listCapsForUser(req.user.userCode, listOpts);
    }

    // Attach entity count and calculate progress per CAP mirroring listAudits pattern
    for (const c of caps) {
      const ents = await CapModel.getCapEntities(c.cap_id);
      const scopedEnts = req.user?.role === 'entity_head'
        ? ents.filter((e) => scopeIds.includes(e.org_tree_id))
        : ents;
      c.entity_count = scopedEnts.length;

      const progress = await CapModel.getCapProgress(c.cap_id);
      const scopedProgress = req.user?.role === 'entity_head'
        ? filterCapProgressByScope(progress, scopeIds)
        : progress;

      const totalQuestions = scopedProgress.reduce((s, p) => s + (p.total_questions || 0), 0);
      const answeredQuestions = scopedProgress.reduce((s, p) => s + (p.answered_questions || 0), 0);

      c.total_questions = totalQuestions;
      c.answered_questions = answeredQuestions;
      c.progress_pct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    }

    return successResponse(res, { caps, total: caps.length });
  } catch (err) {
    console.error('listCaps error:', err);
    return errorResponse(res, 'Failed to fetch CAPs.', 500);
  }
};

// ── GET /api/caps/audit/:auditId ──────────────────────────────────
const listCapsByAudit = async (req, res) => {
  try {
    const { auditId } = req.params;
    const caps = await CapModel.listCapsByAudit(auditId);
    const root_caps = caps.filter((c) => !c.parent_cap_id);
    const sub_caps = caps.filter((c) => c.parent_cap_id);
    return successResponse(res, { caps, root_caps, sub_caps });
  } catch (err) {
    console.error('listCapsByAudit error:', err);
    return errorResponse(res, 'Failed to fetch CAPs.', 500);
  }
};

// ── GET /api/caps/:id/corrective-actions ──────────────────────────
const getCorrectiveActions = async (req, res) => {
  try {
    const { id } = req.params;
    const [items, corrective_actions, tree] = await Promise.all([
      CapModel.getCapCorrectiveActionItems(id),
      CapModel.getCapCorrectiveActions(id),
      CapModel.getCapEntityTree(id),
    ]);
    return successResponse(res, { items, corrective_actions, tree });
  } catch (err) {
    console.error('getCorrectiveActions error:', err);
    return errorResponse(res, 'Failed to fetch corrective actions.', 500);
  }
};

// ── POST /api/caps/:id/corrective-actions ─────────────────────────
const saveCorrectiveActions = async (req, res) => {
  try {
    const { id } = req.params;
    const { actions } = req.body;
    await CapModel.saveCapCorrectiveActions(id, actions, req.user.userCode);
    return successResponse(res, null, 'Corrective actions saved.');
  } catch (err) {
    console.error('saveCorrectiveActions error:', err);
    return errorResponse(res, 'Failed to save corrective actions.', 500);
  }
};

// ── GET /api/caps/:id ─────────────────────────────────────────────
const getCapDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const cap = await CapModel.getCapById(id);
    if (!cap) return errorResponse(res, 'CAP not found.', 404);

    let parent_cap = null;
    let sub_caps = [];
    if (cap.parent_cap_id) {
      parent_cap = await CapModel.getCapById(cap.parent_cap_id);
    } else {
      sub_caps = await CapModel.listSubCapsByParent(cap.cap_id);
    }

    const [questions, entities, progress, tree] = await Promise.all([
      CapModel.listCapQuestions(id),
      CapModel.getCapEntities(id),
      CapModel.getCapProgress(id),
      CapModel.getCapEntityTree(id),
    ]);

    // Role-based access check
    const isCreator = req.user.role === 'admin' && cap.created_by === req.user.userCode;
    // Auditor: if they were assigned to the original audit
    const audit = await AuditModel.findById(cap.audit_id);
    cap.evidence_policy = await getEvidencePolicy(audit?.created_by);
    const isAuditor = req.user.role === 'auditor' && audit?.assigned_auditor_id === req.user.userCode;
    const scopeIds = req.user.role === 'entity_head'
      ? await getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId)
      : [];
    const isEntityHead = req.user.role === 'entity_head'
      && auditEntitiesInScope(entities, scopeIds);

    if (req.user.role !== 'admin' && !isCreator && !isAuditor && !isEntityHead) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    // Enrich source audit + organization/auditor details for CAP reporting
    let source_audit = null;
    try {
      if (audit) {
        source_audit = { ...audit };

        if (audit.created_by) {
          const creatorAdmin = await AdminModel.findByEntityCode(audit.created_by);
          const cfg = creatorAdmin?.entity_type ? ENTITY_TABLE_MAP[creatorAdmin.entity_type] : null;
          if (cfg && creatorAdmin?.entity_code) {
            const [orgRows] = await db.query(
              `SELECT name, email, phone_number FROM \`${cfg.table}\` WHERE \`${cfg.codeField}\` = ? LIMIT 1`,
              [creatorAdmin.entity_code]
            );
            const org = orgRows?.[0] || null;
            if (org) {
              source_audit.organization_name = org.name || null;
              source_audit.organization_email = org.email || null;
              source_audit.organization_phone = org.phone_number || null;
            }
          }
        }

        if (audit.assigned_auditor_id) {
          const auditor = await AuditorModel.findByCode(audit.assigned_auditor_id);
          if (auditor) {
            const fullName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
            source_audit.auditor_name = fullName || auditor.auditor_id;
            source_audit.auditor_email = auditor.email || null;
            source_audit.auditor_phone = auditor.phone_number || null;
          }
        }
        if (!source_audit.auditor_name && audit.assigned_firm_code) {
          const [firmRows] = await db.query(
            `SELECT name, email, phone_number
               FROM audit_firm_companies
              WHERE afc_code = ?
              LIMIT 1`,
            [audit.assigned_firm_code]
          );
          const firm = firmRows?.[0] || null;
          if (firm) {
            source_audit.auditor_name = firm.name || null;
            source_audit.auditor_email = firm.email || null;
            source_audit.auditor_phone = firm.phone_number || null;
          }
        }
      }
    } catch (e) {
      console.warn('getCapDetail source audit enrichment warning:', e?.message || e);
    }

    let scopedEntities = entities;
    let scopedProgress = progress;
    let scopedQuestions = questions;
    let scopedTree = tree;
    if (req.user.role === 'entity_head') {
      const scopeSet = new Set(scopeIds);
      scopedEntities = entities.filter((e) => scopeSet.has(e.org_tree_id));
      scopedProgress = filterCapProgressByScope(progress, scopeIds);
      scopedQuestions = questions.filter((q) => q.org_tree_id != null && scopeSet.has(q.org_tree_id));
      if (tree) {
        scopedTree = extractEntityHeadSubtree(tree, req.user.assignedOrgTreeId, scopeIds);
      }
    }

    return successResponse(res, {
      cap,
      source_audit,
      parent_cap,
      sub_caps,
      questions: scopedQuestions,
      entities: scopedEntities,
      progress: scopedProgress,
      tree: scopedTree,
    });
  } catch (err) {
    console.error('getCapDetail error:', err);
    return errorResponse(res, 'Failed to fetch CAP detail.', 500);
  }
};

// ── GET /api/caps/:id/items ───────────────────────────────────────
const getCapItems = async (req, res) => {
  try {
    const { id } = req.params;
    const cap = await CapModel.getCapById(id);
    if (!cap) return errorResponse(res, 'CAP not found.', 404);

    const entities = await CapModel.getCapEntities(id);
    const scopeIds = req.user.role === 'entity_head'
      ? await getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId)
      : [];
    if (req.user.role === 'entity_head' && !auditEntitiesInScope(entities, scopeIds)) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    let [questions, responses, tree] = await Promise.all([
      CapModel.listCapQuestions(id),
      CapModel.getCapResponses(id),
      CapModel.getCapEntityTree(id),
    ]);

    if (req.user.role === 'entity_head') {
      const scopeSet = new Set(scopeIds);
      questions = questions.filter((q) => q.org_tree_id != null && scopeSet.has(q.org_tree_id));
      const allowedQuestionIds = new Set(questions.map((q) => q.cap_question_id));
      responses = responses.filter((r) => allowedQuestionIds.has(r.cap_question_id));
      if (tree) {
        tree = extractEntityHeadSubtree(tree, req.user.assignedOrgTreeId, scopeIds);
      }
    }

    return successResponse(res, { questions, responses, tree });
  } catch (err) {
    console.error('getCapItems error:', err);
    return errorResponse(res, 'Failed to fetch CAP items.', 500);
  }
};

// ── POST /api/caps/:id/respond ────────────────────────────────────
const submitCapResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      cap_question_id,
      response_text,
      selected_option_ids,
      marks_obtained,
      remarks,
      cap_required
    } = req.body;

    if (!cap_question_id) return errorResponse(res, 'cap_question_id is required.', 400);

    const cap = await CapModel.getCapById(id);
    if (!cap) return errorResponse(res, 'CAP not found.', 404);

    const { generateCapResponseId } = require('../utils/codeGenerator');

// ... existing code ...

  // Upsert response
    const cap_response_id = await generateCapResponseId();
    const responseId = await CapModel.upsertCapResponse({
      cap_response_id,
      cap_question_id,
      response_text: response_text || null,
      selected_option_ids: selected_option_ids || null,
      marks_obtained: marks_obtained || 0,
      remarks: remarks || null,
      cap_required: cap_required ? 1 : 0,
      status: 'completed',
      responded_by: req.user.userCode,
    });

    if (cap.status === 'plan') {
      await CapModel.updateCapStatus(id, 'in_progress');
    }

    // Update cap_question status
    await CapModel.updateCapQuestionStatus(cap_question_id, 'completed');

    // Get the cap question to know the entity
    const capQuestion = await CapModel.getCapQuestion(cap_question_id);
    if (capQuestion) {
      // Recalculate entity progress
      const orgTreeId = capQuestion.org_tree_id ?? capQuestion.assigned_org_tree_id ?? null;
      const allResponses = await CapModel.getCapResponsesByEntity(id, capQuestion.entity_code, orgTreeId);
      const progress = await CapModel.getCapProgress(id);
      const entityProgress = progress.find(p =>
        p.entity_code === capQuestion.entity_code && (p.org_tree_id ?? null) === (orgTreeId ?? null)
      );
      const total = entityProgress?.total_questions || 1;
      await CapModel.updateCapEntityProgress(id, capQuestion.entity_code, orgTreeId, allResponses.length, total);
    }

    return successResponse(res, { response_id: responseId }, 'Response saved.');
  } catch (err) {
    console.error('submitCapResponse error:', err);
    return errorResponse(res, 'Failed to save response.', 500);
  }
};

// ── GET /api/caps/:id/responses ───────────────────────────────────
const getCapResponses = async (req, res) => {
  try {
    const { id } = req.params;
    const responses = await CapModel.getCapResponses(id);
    return successResponse(res, { responses });
  } catch (err) {
    console.error('getCapResponses error:', err);
    return errorResponse(res, 'Failed to fetch responses.', 500);
  }
};

// ── GET /api/caps/:id/progress ────────────────────────────────────
const getCapProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const progress = await CapModel.getCapProgress(id);
    return successResponse(res, { progress });
  } catch (err) {
    console.error('getCapProgress error:', err);
    return errorResponse(res, 'Failed to fetch progress.', 500);
  }
};

// ── POST /api/caps/:id/complete ───────────────────────────────────
const completeCap = async (req, res) => {
  try {
    const { id } = req.params;
    const cap = await CapModel.getCapById(id);
    if (!cap) return errorResponse(res, 'CAP not found.', 404);

    const progress = await CapModel.getCapProgress(id);
    const incomplete = progress.filter(p => p.status !== 'completed');
    if (incomplete.length > 0) {
      return errorResponse(res, `${incomplete.length} entity/entities not yet completed.`, 400);
    }

    await CapModel.updateCapStatus(id, 'completed');
    return successResponse(res, null, 'CAP completed successfully.');
  } catch (err) {
    console.error('completeCap error:', err);
    return errorResponse(res, 'Failed to complete CAP.', 500);
  }
};

// ── PUT /api/caps/:id/status ──────────────────────────────────────
const updateCapStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return errorResponse(res, 'status is required.', 400);

    const allowed = ['plan', 'in_progress', 'completed'];
    if (!allowed.includes(status)) {
      return errorResponse(res, `Invalid status. Allowed: ${allowed.join(', ')}`, 400);
    }

    await CapModel.updateCapStatus(id, status);
    return successResponse(res, null, 'Status updated.');
  } catch (err) {
    console.error('updateCapStatus error:', err);
    return errorResponse(res, 'Failed to update status.', 500);
  }
};

// ── PUT /api/caps/:id/assign ──────────────────────────────────────
const assignCap = async (req, res) => {
  try {
    const { id } = req.params;
    const { responsible_entity_head_id: responsible_person_code, responsible_person_name, due_date } = req.body;

    await db.query(
      `UPDATE corrective_actions
          SET responsible_entity_head_id = ?,
              responsible_person_name = ?,
              due_date = ?
        WHERE corrective_action_id IN (
          SELECT corrective_action_id FROM cap_questions WHERE cap_id = ?
        )`,
      [responsible_person_code || null, responsible_person_name || null, due_date || null, id]
    );

    return successResponse(res, null, 'CAP assigned.');
  } catch (err) {
    console.error('assignCap error:', err);
    return errorResponse(res, 'Failed to assign CAP.', 500);
  }
};

// ── PUT /api/caps/:id/resolve ─────────────────────────────────────
const resolveCap = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_notes } = req.body;

    await CapModel.updateCapStatus(id, 'completed');

    await db.query(
      `UPDATE corrective_actions
          SET resolution_notes = ?, status = 'resolved', resolved_at = NOW()
        WHERE corrective_action_id IN (SELECT corrective_action_id FROM cap_questions WHERE cap_id = ?)`,
      [resolution_notes || null, id]
    );

    return successResponse(res, null, 'CAP marked completed.');
  } catch (err) {
    console.error('resolveCap error:', err);
    return errorResponse(res, 'Failed to resolve CAP.', 500);
  }
};

// ── GET /api/caps/entity-heads/:entityCode ────────────────────────
const getEntityHeads = async (req, res) => {
  try {
    const { entityCode } = req.params;
    const heads = await EntityHeadModel.findByEntityCode(entityCode);
    return successResponse(res, { heads });
  } catch (err) {
    console.error('getEntityHeads error:', err);
    return errorResponse(res, 'Failed to fetch entity heads.', 500);
  }
};

// ── POST /api/caps/create-follow-up ──────────────────────────────
const createFollowUpAudit = async (req, res) => {
  try {
    const { parent_audit_id, title, assigned_auditor_id, start_date, end_date, notes } = req.body;
    if (!parent_audit_id || !title || !start_date || !end_date) {
      return errorResponse(res, 'parent_audit_id, title, start_date, end_date are required.', 400);
    }

    const parent = await AuditModel.findById(parent_audit_id);
    if (!parent) return errorResponse(res, 'Parent audit not found.', 404);

    const newAuditId = await generateAuditId();
    const audit_code = `AUD-FU-${Date.now()}`;
    await db.query(
      `INSERT INTO audit_assignments
         (audit_id, checklist_id, title, audit_type, assigned_auditor_id,
          start_date, end_date, status, notes, parent_audit_id, audit_mode, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 'cap_verification', ?)`,
      [
        newAuditId,
        parent.checklist_id,
        title,
        parent.audit_type,
        assigned_auditor_id || parent.assigned_auditor_id,
        start_date,
        end_date,
        notes || null,
        parent_audit_id,
        req.user.userCode,
      ]
    );

    // Copy entities from parent audit
    const [parentEntities] = await db.query(
      `SELECT entity_code, entity_type FROM audit_assignment_entities WHERE audit_id = ? AND is_active = 1`,
      [parent_audit_id]
    );
    for (const e of parentEntities) {
      await db.query(
        `INSERT INTO audit_assignment_entities (audit_id, entity_code, entity_type) VALUES (?, ?, ?)`,
        [newAuditId, e.entity_code, e.entity_type]
      );
    }

    return successResponse(res, { audit_id: newAuditId, audit_code }, 'Follow-up audit created.');
  } catch (err) {
    console.error('createFollowUpAudit error:', err);
    return errorResponse(res, 'Failed to create follow-up audit.', 500);
  }
};

// ── POST /api/caps/:id/evidence ───────────────────────────────────
const uploadCapEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const { response_id } = req.body;

    if (!req.file) return errorResponse(res, 'No file uploaded.', 400);
    if (!response_id) return errorResponse(res, 'response_id is required.', 400);

    const discardUploadedFile = () => {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    };
    const cap = await CapModel.getCapById(id);
    if (!cap) {
      discardUploadedFile();
      return errorResponse(res, 'CAP not found.', 404);
    }
    const audit = await AuditModel.findById(cap.audit_id);
    if (req.user.role === 'auditor' && audit?.assigned_auditor_id !== req.user.userCode) {
      discardUploadedFile();
      return errorResponse(res, 'Not authorized to upload evidence for this CAP.', 403);
    }

    const responseId = response_id;
    const capId = id;
    
    // Auth check
    const [rows] = await db.query(
      `SELECT cr.cap_response_id, cq.org_tree_id
         FROM cap_responses cr
         JOIN cap_questions cq ON cq.cap_question_id = cr.cap_question_id
        WHERE cr.cap_response_id = ? AND cq.cap_id = ?
        LIMIT 1`,
      [responseId, capId]
    );
    if (!rows.length) {
      discardUploadedFile();
      return errorResponse(res, 'CAP response not found for this CAP.', 404);
    }
    if (req.user.role === 'entity_head') {
      const scopeIds = await getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId);
      if (rows[0].org_tree_id == null || !scopeIds.includes(rows[0].org_tree_id)) {
        discardUploadedFile();
        return errorResponse(res, 'Not authorized to upload evidence for this CAP response.', 403);
      }
    }

    const mediaType = getEvidenceMediaType(req.file.mimetype);
    const evidencePolicy = await getEvidencePolicy(audit?.created_by);
    if (!mediaType || !evidencePolicy.allowed_media_types.includes(mediaType)) {
      discardUploadedFile();
      return errorResponse(res, `${evidencePolicy.plan_name} plan allows image evidence only.`, 403);
    }
    if (req.file.size > MAX_EVIDENCE_BYTES) {
      discardUploadedFile();
      return errorResponse(res, 'Evidence file must be 2MB or less.', 400);
    }
    if ((await CapModel.getEvidence(responseId)).length > 0) {
      discardUploadedFile();
      return errorResponse(res, 'Only one evidence file is allowed for each response.', 409);
    }

    const relativePath = `/uploads/cap-evidence/${req.file.filename}`;

    const evidenceId = await CapModel.addEvidence({
      cap_response_evidence_id: await generateCapResponseEvidenceId(),
      cap_response_id: responseId,
      file_type: mediaType,
      file_path: relativePath,
      file_name: req.file.originalname,
      file_size: req.file.size,
      uploaded_by: req.user.userCode,
    });

    return successResponse(
      res,
      {
        id: evidenceId,
        file_type: mediaType,
        file_path: relativePath,
        file_name: req.file.originalname,
        file_size: req.file.size,
      },
      'Evidence uploaded.'
    );
  } catch (err) {
    console.error('uploadCapEvidence error:', err);
    return errorResponse(res, 'Failed to upload evidence.', 500);
  }
};

// ── DELETE /api/caps/evidence/:evidenceId ─────────────────────────
const deleteCapEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const evidence = await CapModel.deleteEvidence(evidenceId);
    if (!evidence) return errorResponse(res, 'Evidence not found.', 404);

    // Remove file from disk
    const filePath = path.join(__dirname, '../public', evidence.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return successResponse(res, null, 'Evidence removed.');
  } catch (err) {
    console.error('deleteCapEvidence error:', err);
    return errorResponse(res, 'Failed to delete evidence.', 500);
  }
};

module.exports = {
  createCap,
  listCaps,
  listCapsByAudit,
  getCapDetail,
  getCapItems,
  submitCapResponse,
  getCapResponses,
  getCapProgress,
  completeCap,
  updateCapStatus,
  assignCap,
  resolveCap,
  getEntityHeads,
  createFollowUpAudit,
  uploadCapEvidence,
  deleteCapEvidence,
  getCorrectiveActions,
  saveCorrectiveActions,
  capUpload,
};
