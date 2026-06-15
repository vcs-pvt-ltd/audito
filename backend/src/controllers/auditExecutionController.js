/**
 * Audit Execution Controller
 *
 * Auditor-facing endpoints for executing audits:
 *   GET    /api/audit-execution/my-audits                       List auditor's assigned audits
 *   GET    /api/audit-execution/:id                             Get audit detail (auditor view)
 *   POST   /api/audit-execution/:id/start                      Start an audit
 *   POST   /api/audit-execution/:id/respond                    Submit/update a question response
 *   GET    /api/audit-execution/:id/responses                  Get all responses for audit
 *   GET    /api/audit-execution/:id/responses/:entityCode      Get responses for entity
 *   POST   /api/audit-execution/:id/evidence                   Upload evidence file
 *   DELETE /api/audit-execution/evidence/:evidenceId           Delete evidence
 *   GET    /api/audit-execution/:id/progress                   Get entity progress
 *   POST   /api/audit-execution/:id/complete                   Complete audit
 *   GET    /api/audit-execution/:id/report                     Get report data
 */

const AuditModel = require('../models/AuditModel');
const AuditExecutionModel = require('../models/AuditExecutionModel');
const ChecklistModel = require('../models/ChecklistModel');
const EntityHeadModel = require('../models/EntityHeadModel');
const AdminModel = require('../models/AdminModel');
const AuditorModel = require('../models/AuditorModel');
const { db } = require('../config/db');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const {
  getEntityHeadOrgTreeScope,
  auditEntitiesInScope,
  extractEntityHeadSubtree,
} = require('../utils/accessHelper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ENTITY_TABLE_MAP = {
  'Customer': { table: 'customers', codeField: 'cust_code' },
  'Buying Office': { table: 'customer_buying_offices', codeField: 'cbo_code' },
  'Supplier': { table: 'customer_suppliers', codeField: 'csup_code' },
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

// ── File upload setup ────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../public/uploads/evidence');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /^(image|video|audio)\//;
  if (allowed.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only image, video, and audio files are allowed.'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

async function recomputeAndUpsertProgressForAudit(auditId, entityQuestions) {
  const allResponses = await AuditExecutionModel.getAllResponses(auditId);
  const byKey = {};
  for (const r of allResponses || []) {
    const k = `${r.entity_code}__${(r.org_tree_id ?? 'null')}`;
    if (!byKey[k]) byKey[k] = [];
    byKey[k].push(r);
  }

  for (const eq of entityQuestions || []) {
    const entity_code = String(eq.entity_code);
    const orgTreeId = (eq.org_tree_id === undefined || eq.org_tree_id === null || eq.org_tree_id === '')
      ? null
      : (Number.isFinite(Number(eq.org_tree_id)) ? Number(eq.org_tree_id) : null);
    const k = `${entity_code}__${orgTreeId ?? 'null'}`;
    const resp = byKey[k] || [];
    const questions = Array.isArray(eq.questions) ? eq.questions : [];

    const answered = resp.filter(r => String(r.status || '').toLowerCase() === 'answered' || String(r.status || '').toLowerCase() === 'completed').length;
    const totalMarks = questions.reduce((s, q) => s + parseFloat(q.total_marks || 0), 0);
    const obtainedMarks = resp.reduce((s, r) => s + parseFloat(r.marks_obtained || 0), 0);
    const status = questions.length === 0
      ? 'completed'
      : (answered >= questions.length ? 'completed' : (answered > 0 ? 'in_progress' : 'not_started'));

    await AuditExecutionModel.upsertProgress({
      audit_id: auditId,
      org_tree_id: orgTreeId,
      entity_code,
      total_questions: questions.length,
      answered_questions: answered,
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      status,
    });
  }
}

function buildQuestionsForEntityInstance(allQuestions, entity_code, org_tree_id) {
  const normOrgTreeId = (v) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const targetOrgTreeId = normOrgTreeId(org_tree_id);
  const byEntity = (allQuestions || []).filter(q => String(q.entity_code) === String(entity_code));
  const generic = byEntity.filter(q => normOrgTreeId(q.org_tree_id) === null);
  const exact = byEntity.filter(q => normOrgTreeId(q.org_tree_id) === targetOrgTreeId);

  const selected = exact.length > 0 ? [...generic, ...exact] : [...generic, ...byEntity];
  const seen = new Set();
  const out = [];
  for (const q of selected) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}

// Resolve entity names (same pattern as auditController)
async function resolveEntityNames(entityList) {
  if (!entityList || entityList.length === 0) return {};
  const codes = [...new Set(entityList.map(e => e.entity_code))];
  const ph = codes.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT cust_code          AS code, name FROM customers                    WHERE cust_code          IN (${ph})
     UNION ALL SELECT cbo_code  AS code, name FROM customer_buying_offices       WHERE cbo_code           IN (${ph})
     UNION ALL SELECT csup_code AS code, name FROM customer_suppliers            WHERE csup_code          IN (${ph})
     UNION ALL SELECT comp_code AS code, name FROM companies                     WHERE comp_code          IN (${ph})
     UNION ALL SELECT comp_clus_code AS code, name FROM company_clusters         WHERE comp_clus_code     IN (${ph})
     UNION ALL SELECT comp_fact_code AS code, name FROM company_factories        WHERE comp_fact_code     IN (${ph})
     UNION ALL SELECT comp_unit_code AS code, name FROM company_units            WHERE comp_unit_code     IN (${ph})
     UNION ALL SELECT comp_dept_code AS code, name FROM company_departments      WHERE comp_dept_code     IN (${ph})
     UNION ALL SELECT comp_section_code AS code, name FROM company_sections      WHERE comp_section_code IN (${ph})
     UNION ALL SELECT afc_code AS code, name FROM audit_firm_companies           WHERE afc_code           IN (${ph})
     UNION ALL SELECT afc_branch_code AS code, name FROM audit_firm_company_branches WHERE afc_branch_code IN (${ph})
     UNION ALL SELECT afc_dept_code AS code, name FROM audit_firm_company_departments WHERE afc_dept_code IN (${ph})`,
    Array(12).fill(codes).flat()
  );
  const nameMap = {};
  for (const r of rows) nameMap[r.code] = r.name.trim();
  return nameMap;
}

async function getEntityHeadScope(req) {
  if (req.user?.role !== 'entity_head') return [];
  return getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId);
}

function filterProgressByScope(progress, scopeIds) {
  if (!scopeIds?.length) return progress || [];
  const scopeSet = new Set(scopeIds.map(Number));
  return (progress || []).filter((p) => p.org_tree_id != null && scopeSet.has(Number(p.org_tree_id)));
}

// ── GET /api/audit-execution/my-audits ───────────────────────────
const listMyAudits = async (req, res) => {
  try {
    const userCode = req.user.userCode;
    const scopeIds = await getEntityHeadScope(req);
    const audits = req.user.role === 'entity_head'
      ? await AuditModel.listForEntityHead(req.user.assignedOrgTreeId)
      : await AuditModel.listForAuditor(userCode);
    for (const a of audits) {
      const ents = await AuditModel.getEntities(a.id);
      const scopedEnts = req.user.role === 'entity_head'
        ? ents.filter((e) => scopeIds.includes(Number(e.org_tree_id)))
        : ents;
      a.entity_count = scopedEnts.length;
      const progress = await AuditExecutionModel.getProgress(a.id);
      const scopedProgress = req.user.role === 'entity_head'
        ? filterProgressByScope(progress, scopeIds)
        : progress;
      const totalQ = scopedProgress.reduce((s, p) => s + (p.total_questions || 0), 0);
      const answeredQ = scopedProgress.reduce((s, p) => s + (p.answered_questions || 0), 0);
      a.total_questions = totalQ;
      a.answered_questions = answeredQ;
      a.progress_pct = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0;
    }
    return successResponse(res, { audits, total: audits.length });
  } catch (err) {
    console.error('listMyAudits error:', err);
    return errorResponse(res, 'Failed to fetch audits.', 500);
  }
};

// ── GET /api/audit-execution/:id/corrective-actions ──────────────
const getCorrectiveActions = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);

    if (req.user.role === 'auditor' && audit.assigned_auditor_code !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const auditId = parseInt(id);
    const [items, corrective_actions, tree] = await Promise.all([
      AuditExecutionModel.listCapRequiredItems(auditId),
      AuditExecutionModel.listCorrectiveActionsByAudit(auditId),
      AuditExecutionModel.getEntityTree(auditId),
    ]);

    const entityToOrgTreeIds = {};
    const walk = (node) => {
      if (!node) return;
      if (node.code && node.edge_id) {
        if (!entityToOrgTreeIds[node.code]) entityToOrgTreeIds[node.code] = new Set();
        entityToOrgTreeIds[node.code].add(node.edge_id);
      }
      for (const c of node.children || []) walk(c);
    };
    walk(tree);

    // Prefer response org_tree_id (edge instance) so repeated entity codes under different parents don't collide.
    // Only fall back to tree-derived edge_id when the mapping is unambiguous.
    const orgTreeIds = [...new Set((items || []).map((it) => it.org_tree_id).filter(Boolean))];
    const heads = await EntityHeadModel.findByOrgTreeIds(orgTreeIds);
    const headByOrgTreeId = {};
    for (const h of heads) headByOrgTreeId[h.assigned_org_tree_id] = h;

    const enrichedItems = (items || []).map((it) => {
      const orgTreeIdFromResponse = it.org_tree_id ?? null;
      const fallbackSet = entityToOrgTreeIds[it.entity_code];
      const unambiguousFallback = fallbackSet && fallbackSet.size === 1
        ? Array.from(fallbackSet)[0]
        : null;

      const assignedOrgTreeId = (orgTreeIdFromResponse ?? unambiguousFallback) || null;
      const head = assignedOrgTreeId ? headByOrgTreeId[assignedOrgTreeId] : null;
      return {
        ...it,
        assigned_org_tree_id: assignedOrgTreeId,
        responsible_entity_head: head
          ? {
            user_code: head.user_code,
            first_name: head.first_name,
            last_name: head.last_name,
            email: head.email,
          }
          : null,
      };
    });

    return successResponse(res, { items: enrichedItems, corrective_actions, tree });
  } catch (err) {
    console.error('getCorrectiveActions error:', err);
    return errorResponse(res, 'Failed to fetch corrective actions.', 500);
  }
};

// ── PUT /api/audit-execution/:id/corrective-actions ──────────────
const saveCorrectiveActions = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);

    if (req.user.role === 'auditor' && audit.assigned_auditor_code !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const missing = validateRequiredFields(req.body, ['actions']);
    if (missing) return errorResponse(res, missing, 400);

    const actions = Array.isArray(req.body.actions) ? req.body.actions : [];
    if (!actions.length) return errorResponse(res, 'No actions provided.', 400);

    const auditId = parseInt(id);

    const tree = await AuditExecutionModel.getEntityTree(auditId);
    const entityToOrgTreeIds = {};
    const walk = (node) => {
      if (!node) return;
      if (node.code && node.edge_id) {
        if (!entityToOrgTreeIds[node.code]) entityToOrgTreeIds[node.code] = new Set();
        entityToOrgTreeIds[node.code].add(node.edge_id);
      }
      for (const c of node.children || []) walk(c);
    };
    walk(tree);

    const orgTreeIds = [...new Set(actions.map((a) => {
      if (a.org_tree_id) return a.org_tree_id;
      if (a.assigned_org_tree_id) return a.assigned_org_tree_id; // fallback for older clients
      const s = entityToOrgTreeIds[String(a.entity_code)];
      return s && s.size === 1 ? Array.from(s)[0] : null;
    }).filter(Boolean))];
    const heads = await EntityHeadModel.findByOrgTreeIds(orgTreeIds);
    const headByOrgTreeId = {};
    for (const h of heads) headByOrgTreeId[h.assigned_org_tree_id] = h;

    const results = [];
    for (const a of actions) {
      if (!a || !a.response_id || !a.entity_code || !a.question_id) continue;

      const fallbackSet = entityToOrgTreeIds[String(a.entity_code)];
      const unambiguousFallback = fallbackSet && fallbackSet.size === 1
        ? Array.from(fallbackSet)[0]
        : null;
      const orgTreeId = a.org_tree_id ?? a.assigned_org_tree_id ?? unambiguousFallback ?? null;
      const head = orgTreeId ? headByOrgTreeId[orgTreeId] : null;
      const responsiblePersonCode = head?.user_code || null;
      const responsiblePersonName = head ? `${head.first_name} ${head.last_name}`.trim() : null;

      const caId = await AuditExecutionModel.upsertCorrectiveAction({
        audit_id: auditId,
        response_id: parseInt(a.response_id),
        entity_code: String(a.entity_code),
        question_id: parseInt(a.question_id),
        org_tree_id: orgTreeId,
        responsible_person_code: responsiblePersonCode,
        responsible_person_name: responsiblePersonName,
        due_date: a.due_date ? String(a.due_date).slice(0, 10) : null,
        created_by: req.user.userCode,
      });
      results.push({ id: caId, response_id: parseInt(a.response_id) });
    }

    return successResponse(res, { saved: results }, 'Corrective actions saved.');
  } catch (err) {
    console.error('saveCorrectiveActions error:', err);
    return errorResponse(res, 'Failed to save corrective actions.', 500);
  }
};

// ── GET /api/audit-execution/:id ─────────────────────────────────
const getAuditDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.getWithEntities(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);

    // Verify auditor access
    if (req.user.role === 'auditor' && audit.assigned_auditor_code !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const scopeIds = await getEntityHeadScope(req);
    if (req.user.role === 'entity_head' && !auditEntitiesInScope(audit.entities, scopeIds)) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    // Resolve entity names
    if (audit.entities?.length > 0) {
      const nameMap = await resolveEntityNames(audit.entities);
      for (const e of audit.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
    }

    // Get progress per entity
    let progress = await AuditExecutionModel.getProgress(id);
    if (req.user.role === 'entity_head') {
      progress = filterProgressByScope(progress, scopeIds);
      audit.entities = (audit.entities || []).filter((e) => scopeIds.includes(Number(e.org_tree_id)));
    }
    audit.entity_progress = progress;

    // Get checklist questions grouped by entity, filtered to only audit's assigned entities
    if (audit.checklist_id) {
      const clData = await ChecklistModel.getChecklistWithQuestions(audit.checklist_id);
      if (clData && clData.entity_questions) {
        // Build per assigned entity instance. Include:
        // - generic questions for entity_code (org_tree_id NULL)
        // - exact org_tree_id questions when present
        // - fallback to any org_tree_id questions if exact not present (for reused entities)
        const allQuestions = (clData.entity_questions || []).flatMap(eq => (eq.questions || []).map(q => ({
          ...q,
          entity_code: eq.entity_code,
          org_tree_id: (q.org_tree_id ?? eq.org_tree_id ?? null),
        })));

        const tree = await AuditExecutionModel.getEntityTree(parseInt(id));
        const treeEntities = [];
        const walk = (node) => {
          if (!node) return;
          if (node.code && node.edge_id) {
            treeEntities.push({ entity_code: node.code, org_tree_id: node.edge_id });
          }
          for (const c of node.children || []) walk(c);
        };
        walk(tree);

        const instanceMap = new Map();
        for (const ent of (audit.entities || [])) {
          const orgTreeIdRaw = ent.org_tree_id ?? ent.assigned_org_tree_id ?? null;
          const orgTreeId = (orgTreeIdRaw === null || orgTreeIdRaw === undefined || orgTreeIdRaw === '')
            ? null
            : (Number.isFinite(Number(orgTreeIdRaw)) ? Number(orgTreeIdRaw) : null);
          const k = `${ent.entity_code}__${orgTreeId ?? 'null'}`;
          if (!instanceMap.has(k)) instanceMap.set(k, { entity_code: ent.entity_code, org_tree_id: orgTreeId });
        }
        for (const ent of treeEntities) {
          const orgTreeId = (ent.org_tree_id === null || ent.org_tree_id === undefined || ent.org_tree_id === '')
            ? null
            : (Number.isFinite(Number(ent.org_tree_id)) ? Number(ent.org_tree_id) : null);
          const k = `${ent.entity_code}__${orgTreeId ?? 'null'}`;
          if (!instanceMap.has(k)) instanceMap.set(k, { entity_code: ent.entity_code, org_tree_id: orgTreeId });
        }

        audit.entity_questions = Array.from(instanceMap.values()).map(ent => {
          return {
            entity_code: ent.entity_code,
            org_tree_id: ent.org_tree_id ?? null,
            questions: buildQuestionsForEntityInstance(allQuestions, ent.entity_code, ent.org_tree_id ?? null),
          };
        });

        if (req.user.role === 'entity_head') {
          const scopeSet = new Set(scopeIds.map(Number));
          audit.entity_questions = audit.entity_questions.filter(
            (eq) => eq.org_tree_id != null && scopeSet.has(Number(eq.org_tree_id))
          );
        }

        await recomputeAndUpsertProgressForAudit(parseInt(id), audit.entity_questions);
        audit.entity_progress = await AuditExecutionModel.getProgress(parseInt(id));
      } else {
        audit.entity_questions = [];
      }
    }

    return successResponse(res, { audit });
  } catch (err) {
    console.error('getAuditDetail error:', err);
    return errorResponse(res, 'Failed to fetch audit.', 500);
  }
};

// ...

// ── POST /api/audit-execution/:id/start ──────────────────────────
const startAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);
    if (audit.assigned_auditor_code !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    // Check start date
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(audit.start_date).toISOString().split('T')[0];
    if (today < startDate) {
      return errorResponse(res, `Audit cannot be started before ${startDate}.`, 400);
    }

    if (audit.status !== 'plan') {
      return errorResponse(res, `Audit is already ${audit.status}.`, 400);
    }

    await AuditExecutionModel.startAudit(id);

    // Initialize entity progress records
    const entities = await AuditModel.getEntities(id);
    if (audit.checklist_id) {
      const questions = await ChecklistModel.listQuestions(audit.checklist_id);
      for (const ent of entities) {
        const entQs = buildQuestionsForEntityInstance(questions, ent.entity_code, ent.org_tree_id ?? null);
        const totalMarks = entQs.reduce((s, q) => s + parseFloat(q.total_marks || 0), 0);
        await AuditExecutionModel.upsertProgress({
          audit_id: parseInt(id), org_tree_id: ent.org_tree_id || null, entity_code: ent.entity_code,
          total_questions: entQs.length, answered_questions: 0,
          total_marks: totalMarks, obtained_marks: 0,
          status: 'not_started',
        });
      }
    }

    return successResponse(res, null, 'Audit started.');
  } catch (err) {
    console.error('startAudit error:', err);
    return errorResponse(res, 'Failed to start audit.', 500);
  }
};

// ...

// ── POST /api/audit-execution/:id/respond ────────────────────────
const submitResponse = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);
    if (audit.assigned_auditor_code !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }
    if (audit.status !== 'in_progress') {
      return errorResponse(res, 'Audit is not in progress.', 400);
    }

    const {
      org_tree_id, entity_code, question_id,
      answer_text, selected_option_ids,
      marks_obtained, remarks, cap_required,
    } = req.body;

    if (!org_tree_id || !entity_code || !question_id) {
      return errorResponse(res, 'org_tree_id, entity_code and question_id are required.', 400);
    }

    const responseId = await AuditExecutionModel.upsertResponse({
      audit_id: parseInt(id),
      org_tree_id: parseInt(org_tree_id),
      entity_code,
      question_id: parseInt(question_id),
      answer_text, selected_option_ids,
      marks_obtained: parseFloat(marks_obtained) || 0,
      remarks, cap_required: !!cap_required,
      status: 'answered',
      answered_by: req.user.userCode,
    });

    // Update entity progress
    const allResponses = await AuditExecutionModel.getResponsesByEntity(parseInt(id), parseInt(org_tree_id), entity_code);
    const questions = await ChecklistModel.listQuestions(audit.checklist_id);
    const entQs = buildQuestionsForEntityInstance(questions, entity_code, parseInt(org_tree_id));
    const totalMarks = entQs.reduce((s, q) => s + parseFloat(q.total_marks || 0), 0);
    const answeredCount = allResponses.filter(r => r.status === 'answered').length;
    const obtainedMarks = allResponses.reduce((s, r) => s + parseFloat(r.marks_obtained || 0), 0);
    const progressStatus = answeredCount >= entQs.length ? 'completed' : 'in_progress';

    await AuditExecutionModel.upsertProgress({
      audit_id: parseInt(id), org_tree_id: parseInt(org_tree_id), entity_code,
      total_questions: entQs.length, answered_questions: answeredCount,
      total_marks: totalMarks, obtained_marks: obtainedMarks,
      status: progressStatus,
    });

    return successResponse(res, { response_id: responseId }, 'Response saved.');
  } catch (err) {
    console.error('submitResponse error:', err);
    return errorResponse(res, 'Failed to save response.', 500);
  }
};

// ── GET /api/audit-execution/:id/responses ───────────────────────
const getResponses = async (req, res) => {
  try {
    const { id } = req.params;
    const scopeIds = await getEntityHeadScope(req);
    if (req.user.role === 'entity_head') {
      const entities = await AuditModel.getEntities(id);
      if (!auditEntitiesInScope(entities, scopeIds)) {
        return errorResponse(res, 'Not authorized.', 403);
      }
    }

    let responses = await AuditExecutionModel.getAllResponses(parseInt(id));
    if (req.user.role === 'entity_head') {
      const scopeSet = new Set(scopeIds.map(Number));
      responses = responses.filter((r) => r.org_tree_id != null && scopeSet.has(Number(r.org_tree_id)));
    }

    // Attach evidence to each response
    for (const r of responses) {
      r.evidence = await AuditExecutionModel.getEvidence(r.id);
    }

    return successResponse(res, { responses });
  } catch (err) {
    console.error('getResponses error:', err);
    return errorResponse(res, 'Failed to fetch responses.', 500);
  }
};

// ── GET /api/audit-execution/:id/responses/:entityCode ───────────
const getEntityResponses = async (req, res) => {
  try {
    const { id, entityCode } = req.params;
    const orgTreeId = req.query.org_tree_id ? parseInt(String(req.query.org_tree_id)) : null;
    if (!orgTreeId) {
      return errorResponse(res, 'org_tree_id query param is required.', 400);
    }
    const responses = await AuditExecutionModel.getResponsesByEntity(parseInt(id), orgTreeId, String(entityCode));

    for (const r of responses) {
      r.evidence = await AuditExecutionModel.getEvidence(r.id);
    }

    return successResponse(res, { responses });
  } catch (err) {
    console.error('getEntityResponses error:', err);
    return errorResponse(res, 'Failed to fetch responses.', 500);
  }
};

// ── POST /api/audit-execution/:id/evidence ───────────────────────
const uploadEvidence = async (req, res) => {
  try {
    const { id } = req.params;
    const { response_id, file_type } = req.body;

    if (!req.file) return errorResponse(res, 'No file uploaded.', 400);
    if (!response_id) return errorResponse(res, 'response_id is required.', 400);

    const relativePath = `/uploads/evidence/${req.file.filename}`;
    const evidenceId = await AuditExecutionModel.addEvidence({
      response_id: parseInt(response_id),
      file_type: file_type || 'image',
      file_path: relativePath,
      file_name: req.file.originalname,
      file_size: req.file.size,
      uploaded_by: req.user.userCode,
    });

    return successResponse(res, {
      id: evidenceId,
      file_path: relativePath,
      file_name: req.file.originalname,
      file_size: req.file.size,
    }, 'Evidence uploaded.');
  } catch (err) {
    console.error('uploadEvidence error:', err);
    return errorResponse(res, 'Failed to upload evidence.', 500);
  }
};

// ── DELETE /api/audit-execution/evidence/:evidenceId ─────────────
const deleteEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const evidence = await AuditExecutionModel.deleteEvidence(parseInt(evidenceId));
    if (!evidence) return errorResponse(res, 'Evidence not found.', 404);

    // Remove file from disk
    const filePath = path.join(__dirname, '../public', evidence.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    return successResponse(res, null, 'Evidence deleted.');
  } catch (err) {
    console.error('deleteEvidence error:', err);
    return errorResponse(res, 'Failed to delete evidence.', 500);
  }
};

// ── GET /api/audit-execution/:id/progress ────────────────────────
const getProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const progress = await AuditExecutionModel.getProgress(parseInt(id));
    return successResponse(res, { progress });
  } catch (err) {
    console.error('getProgress error:', err);
    return errorResponse(res, 'Failed to fetch progress.', 500);
  }
};

// ── POST /api/audit-execution/:id/complete ───────────────────────
const completeAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);
    if (audit.assigned_auditor_code !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }
    if (audit.status !== 'in_progress') {
      return errorResponse(res, 'Audit is not in progress.', 400);
    }

    // Check all entities are completed
    const progress = await AuditExecutionModel.getProgress(parseInt(id));
    const incomplete = progress.filter(p => (p.total_questions || 0) > 0 && p.status !== 'completed');
    if (incomplete.length > 0) {
      return errorResponse(res, `${incomplete.length} entity/entities not yet completed.`, 400);
    }

    await AuditExecutionModel.completeAudit(parseInt(id));

    return successResponse(res, null, 'Audit completed successfully.');
  } catch (err) {
    console.error('completeAudit error:', err);
    return errorResponse(res, 'Failed to complete audit.', 500);
  }
};

// ── GET /api/audit-execution/:id/report ──────────────────────────
const getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.getWithEntities(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);

    // Attach organization details (registered organization) and auditor info
    try {
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
            audit.organization_name = org.name || null;
            audit.organization_email = org.email || null;
            audit.organization_phone = org.phone_number || null;
          }
        }
      }

      if (audit.assigned_auditor_code) {
        const auditor = await AuditorModel.findByCode(audit.assigned_auditor_code);
        if (auditor) {
          const fullName = `${auditor.first_name || ''} ${auditor.last_name || ''}`.trim();
          audit.auditor_name = fullName || auditor.user_code;
          audit.auditor_email = auditor.email || null;
          audit.auditor_phone = auditor.phone_number || null;
        }
      }
    } catch (e) {
      console.warn('getReport enrichment warning:', e?.message || e);
    }

    // Resolve names
    if (audit.entities?.length > 0) {
      const nameMap = await resolveEntityNames(audit.entities);
      for (const e of audit.entities) e.entity_name = nameMap[e.entity_code] || e.entity_code;
    }

    // Get all responses with evidence
    const responses = await AuditExecutionModel.getAllResponses(parseInt(id));
    for (const r of responses) {
      r.evidence = await AuditExecutionModel.getEvidence(r.id);
    }

    // Get progress
    const progress = await AuditExecutionModel.getProgress(parseInt(id));
    if (progress?.length > 0) {
      const progressEntities = progress.map(p => ({ entity_code: p.entity_code }));
      const nameMap = await resolveEntityNames(progressEntities);
      for (const p of progress) {
        p.entity_name = nameMap[p.entity_code] || p.entity_code;
      }
    }

    // Get questions for context
    let questions = [];
    if (audit.checklist_id) {
      questions = await ChecklistModel.listQuestions(audit.checklist_id);
      // Attach options
      for (const q of questions) {
        const [opts] = await db.query(
          'SELECT * FROM checklist_question_options WHERE question_id = ? ORDER BY order_index',
          [q.id]
        );
        q.options = opts;
      }
    }

    // Summary stats
    const totalMarks = progress.reduce((s, p) => s + parseFloat(p.total_marks || 0), 0);
    const obtainedMarks = progress.reduce((s, p) => s + parseFloat(p.obtained_marks || 0), 0);
    const totalQuestions = progress.reduce((s, p) => s + (p.total_questions || 0), 0);
    const answeredQuestions = progress.reduce((s, p) => s + (p.answered_questions || 0), 0);

    return successResponse(res, {
      audit,
      responses,
      progress,
      questions,
      summary: {
        total_marks: totalMarks,
        obtained_marks: obtainedMarks,
        score_pct: totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0,
        total_questions: totalQuestions,
        answered_questions: answeredQuestions,
        total_entities: audit.entities.length,
      },
    });
  } catch (err) {
    console.error('getReport error:', err);
    return errorResponse(res, 'Failed to generate report.', 500);
  }
};

// ── GET /api/audit-execution/:id/entity-tree ─────────────────────
const getEntityTree = async (req, res) => {
  try {
    const { id } = req.params;
    const audit = await AuditModel.findById(id);
    if (!audit) return errorResponse(res, 'Audit not found.', 404);

    if (req.user.role === 'auditor' && audit.assigned_auditor_code !== req.user.userCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const scopeIds = await getEntityHeadScope(req);
    if (req.user.role === 'entity_head') {
      const entities = await AuditModel.getEntities(id);
      if (!auditEntitiesInScope(entities, scopeIds)) {
        return errorResponse(res, 'Not authorized.', 403);
      }
    }

    let tree = await AuditExecutionModel.getEntityTree(parseInt(id));
    if (req.user.role === 'entity_head' && tree) {
      tree = extractEntityHeadSubtree(tree, req.user.assignedOrgTreeId, scopeIds);
    }
    return successResponse(res, { tree });
  } catch (err) {
    console.error('getEntityTree error:', err);
    return errorResponse(res, 'Failed to fetch entity tree.', 500);
  }
};

module.exports = {
  listMyAudits,
  getAuditDetail,
  startAudit,
  submitResponse,
  getResponses,
  getEntityResponses,
  uploadEvidence,
  deleteEvidence,
  getProgress,
  completeAudit,
  getReport,
  getEntityTree,
  getCorrectiveActions,
  saveCorrectiveActions,
  upload,
};
