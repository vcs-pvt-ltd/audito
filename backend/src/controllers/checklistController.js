/**
 * Checklist Controller
 *
 * CHECKLIST TYPES
 *   POST   /api/checklists/types            Create checklist type
 *   GET    /api/checklists/types            List checklist types
 *   PUT    /api/checklists/types/:id        Update checklist type
 *   DELETE /api/checklists/types/:id        Deactivate checklist type
 *
 * CHECKLISTS
 *   POST   /api/checklists                  Create checklist
 *   GET    /api/checklists                  List checklists
 *   GET    /api/checklists/:id              Get checklist with questions
 *   PUT    /api/checklists/:id              Update checklist
 *   DELETE /api/checklists/:id              Deactivate checklist
 *
 * QUESTIONS
 *   POST   /api/checklists/:id/questions         Add question(s)
 *   PUT    /api/checklists/questions/:qid        Update question
 *   DELETE /api/checklists/questions/:qid        Delete question
 *
 * MEDIA
 *   POST   /api/checklists/upload-media          Upload media file
 *
 * EXCEL
 *   GET    /api/checklists/excel-template         Download template
 *   POST   /api/checklists/:id/questions/upload   Upload Excel
 */

const ChecklistModel = require('../models/ChecklistModel');
const OrganizationTreeModel = require('../models/OrganizationTreeModel');
const { db } = require('../config/db');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { getAccessibleEntityCodes } = require('../utils/accessHelper');
const LimitsEnforcer = require('../utils/limitsEnforcer');

const VALID_ANSWER_TYPES = ['free_text', 'single_option', 'multiple_options', 'dropdown'];

function parseQuestionsFromExcelBuffer({ buffer, entityCode }) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['Template'];
  if (!ws) {
    const err = new Error('Excel file must contain a "Template" sheet.');
    err.statusCode = 400;
    throw err;
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) {
    const err = new Error('No data rows found in the Template sheet.');
    err.statusCode = 400;
    throw err;
  }

  return { rows };
}

//  helper: validate + insert options for a question 

async function saveOptions(question_id, options, answer_type, executor = db) {
  if (answer_type === 'free_text') return;

  if (!Array.isArray(options) || options.length === 0) {
    throw new Error(`Options are required for answer type "${answer_type}".`);
  }

  const totalMarks = options.reduce((sum, o) => sum + (parseFloat(o.marks) || 0), 0);
  if (Math.abs(totalMarks - 10) > 0.01) {
    throw new Error(`Marks for all options must sum to 10. Got ${totalMarks.toFixed(2)}.`);
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt.option_text || !String(opt.option_text).trim()) {
      throw new Error(`Option ${i + 1} is missing text.`);
    }
    await ChecklistModel.createOption({
      question_id,
      option_text: String(opt.option_text).trim(),
      marks: parseFloat(opt.marks) || 0,
      order_index: i
    }, executor);
  }
}

// 
// CHECKLIST TYPES
// 

const createChecklistType = async (req, res) => {
  try {
    const { name, description } = req.body;
    const missing = validateRequiredFields(req.body, ['name']);
    if (missing) return errorResponse(res, missing, 400);

    // Uniqueness: checklist type name must be unique per organization
    try {
      const [rows] = await db.query(
        'SELECT id FROM checklist_types WHERE name = ? AND created_by = ? AND is_active = TRUE LIMIT 1',
        [name, req.user.entityCode]
      );
      if (rows.length > 0) return errorResponse(res, 'A checklist type with this name already exists for your organization.', 409);
    } catch (err) {
      console.error('Checklist type uniqueness check failed:', err);
    }

    const id = await ChecklistModel.createType({
      name,
      description,
      created_by: req.user.entityCode
    });

    const created = await ChecklistModel.findTypeById(id);
    return successResponse(res, { type: created }, 'Checklist type created.', 201);
  } catch (err) {
    console.error('createChecklistType error:', err);
    return errorResponse(res, 'Failed to create checklist type.', 500);
  }
};

const listChecklistTypes = async (req, res) => {
  try {
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    const types = await ChecklistModel.listTypes(accessibleCodes);
    return successResponse(res, { types, total: types.length });
  } catch (err) {
    console.error('listChecklistTypes error:', err);
    return errorResponse(res, 'Failed to fetch checklist types.', 500);
  }
};

const updateChecklistType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) return errorResponse(res, 'Name is required.', 400);

    const type = await ChecklistModel.findTypeById(id);
    if (!type || type.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Checklist type not found.', 404);
    }

    // Ensure uniqueness of name within this organization on update
    try {
      const [conflict] = await db.query(
        'SELECT id FROM checklist_types WHERE name = ? AND created_by = ? AND is_active = TRUE AND id != ? LIMIT 1',
        [name, req.user.entityCode, id]
      );
      if (conflict.length > 0) return errorResponse(res, 'A checklist type with this name already exists for your organization.', 409);
    } catch (err) {
      console.error('Checklist type update uniqueness check failed:', err);
    }

    await ChecklistModel.updateType(id, { name, description });
    return successResponse(res, null, 'Checklist type updated.');
  } catch (err) {
    console.error('updateChecklistType error:', err);
    return errorResponse(res, 'Failed to update.', 500);
  }
};

const deactivateChecklistType = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await ChecklistModel.findTypeById(id);
    if (!type || type.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Checklist type not found.', 404);
    }

    // Check if type is used in any checklists
    const [usage] = await db.query(
      'SELECT id FROM checklists WHERE checklist_type_id = ? AND is_active = TRUE LIMIT 1',
      [id]
    );
    if (usage.length > 0) {
      return errorResponse(res, 'This checklist type is currently used by one or more checklists and cannot be deleted.', 403);
    }

    await ChecklistModel.deactivateType(id);
    return successResponse(res, null, 'Checklist type deactivated.');
  } catch (err) {
    console.error('deactivateChecklistType error:', err);
    return errorResponse(res, 'Failed to deactivate.', 500);
  }
};

// 
// MEDIA UPLOAD
// 

const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `media_${Date.now()}${ext}`;
    const uploadDir = path.join(__dirname, '../public/uploads/checklists');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const relativePath = `/uploads/checklists/${filename}`;
    return successResponse(res, { file_path: relativePath }, 'File uploaded.');
  } catch (err) {
    console.error('uploadMedia error:', err);
    return errorResponse(res, 'Failed to upload file.', 500);
  }
};

// 
// CHECKLISTS
// 

const createChecklist = async (req, res) => {
  try {
    const {
      name, description, media_path,
      checklist_type_id,
      time_period_value, time_period_unit,
      repeat_duration_value, repeat_duration_unit,
      budget, currency, num_workers
    } = req.body;

    const missing = validateRequiredFields(req.body, ['name']);
    if (missing) return errorResponse(res, missing, 400);

    if (checklist_type_id) {
      const type = await ChecklistModel.findTypeById(checklist_type_id);
      if (!type || !type.is_active) {
        return errorResponse(res, 'Checklist type not found.', 404);
      }
    }

    // Uniqueness: checklist name must be unique per creating organization
    try {
      const [existing] = await db.query(
        'SELECT id FROM checklists WHERE name = ? AND created_by = ? AND is_active = TRUE LIMIT 1',
        [name, req.user.entityCode]
      );
      if (existing.length > 0) return errorResponse(res, 'A checklist with this name already exists for your organization.', 409);
    } catch (err) {
      console.error('Checklist uniqueness check failed:', err);
    }

    const limitError = await LimitsEnforcer.checkChecklistLimit(req.user.entityCode);
    if (limitError) return errorResponse(res, limitError, 403);

    const id = await ChecklistModel.create({
      name,
      description,
      media_path,
      checklist_type_id: checklist_type_id || null,
      time_period_value: time_period_value ? parseInt(time_period_value, 10) : null,
      time_period_unit: time_period_unit || null,
      repeat_duration_value: repeat_duration_value ? parseInt(repeat_duration_value, 10) : null,
      repeat_duration_unit: repeat_duration_unit || null,
      budget: budget ? parseFloat(budget) : null,
      currency: currency || '$',
      num_workers: num_workers ? parseInt(num_workers, 10) : null,
      created_by: req.user.entityCode
    });

    const created = await ChecklistModel.findById(id);
    return successResponse(res, { checklist: created }, 'Checklist created.', 201);
  } catch (err) {
    console.error('createChecklist error:', err);
    return errorResponse(res, 'Failed to create checklist.', 500);
  }
};

const listChecklists = async (req, res) => {
  try {
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    const checklists = await ChecklistModel.list(accessibleCodes);
    return successResponse(res, { checklists, total: checklists.length });
  } catch (err) {
    console.error('listChecklists error:', err);
    return errorResponse(res, 'Failed to fetch checklists.', 500);
  }
};

const getChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await ChecklistModel.getChecklistWithQuestions(id);
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);

    if (!checklist || !accessibleCodes.includes(checklist.created_by)) {
      return errorResponse(res, 'Checklist not found.', 404);
    }
    return successResponse(res, { checklist });
  } catch (err) {
    console.error('getChecklist error:', err);
    return errorResponse(res, 'Failed to fetch checklist.', 500);
  }
};

const updateChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await ChecklistModel.findById(id);
    if (!checklist || checklist.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    const [usage] = await db.query(
      'SELECT id FROM audit_assignments WHERE checklist_id = ? AND is_active = TRUE AND status != "cancelled" LIMIT 1',
      [id]
    );
    if (usage.length > 0) {
      return errorResponse(res, 'This checklist is currently used in an audit and cannot be edited.', 403);
    }

    const {
      name, description, media_path, checklist_type_id,
      time_period_value, time_period_unit,
      repeat_duration_value, repeat_duration_unit,
      budget, currency, num_workers
    } = req.body;

    if (!name) return errorResponse(res, 'Name is required.', 400);

    // Ensure new name is unique within this organization
    try {
      const [conflict] = await db.query(
        'SELECT id FROM checklists WHERE name = ? AND created_by = ? AND is_active = TRUE AND id != ? LIMIT 1',
        [name, req.user.entityCode, id]
      );
      if (conflict.length > 0) return errorResponse(res, 'A checklist with this name already exists for your organization.', 409);
    } catch (err) {
      console.error('Checklist update uniqueness check failed:', err);
    }

    await ChecklistModel.update(id, {
      name, description,
      media_path: media_path !== undefined ? media_path : checklist.media_path,
      checklist_type_id: checklist_type_id || null,
      time_period_value: time_period_value ? parseInt(time_period_value, 10) : null,
      time_period_unit: time_period_unit || null,
      repeat_duration_value: repeat_duration_value ? parseInt(repeat_duration_value, 10) : null,
      repeat_duration_unit: repeat_duration_unit || null,
      budget: budget ? parseFloat(budget) : null,
      currency: currency || '$',
      num_workers: num_workers ? parseInt(num_workers, 10) : null
    });

    return successResponse(res, null, 'Checklist updated.');
  } catch (err) {
    console.error('updateChecklist error:', err);
    return errorResponse(res, 'Failed to update checklist.', 500);
  }
};

const deactivateChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await ChecklistModel.findById(id);
    if (!checklist || checklist.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Checklist not found.', 404);
    }
    // Check if checklist is used in any active/planned/completed audits
    const [usage] = await db.query(
      'SELECT id FROM audit_assignments WHERE checklist_id = ? AND is_active = TRUE AND status != "cancelled" LIMIT 1',
      [id]
    );
    if (usage.length > 0) {
      return errorResponse(res, 'This checklist is currently used in an audit and cannot be deleted.', 403);
    }

    await ChecklistModel.deleteChecklistCascade(id);

    if (checklist.media_path) {
      const normalizedPath = String(checklist.media_path).replace(/^\/+/, '');
      const mediaAbsPath = path.join(__dirname, '../public', normalizedPath.replace(/^uploads\//, 'uploads/'));
      if (fs.existsSync(mediaAbsPath)) {
        fs.unlinkSync(mediaAbsPath);
      }
    }

    return successResponse(res, null, 'Checklist and related data deleted.');
  } catch (err) {
    console.error('deactivateChecklist error:', err);
    return errorResponse(res, 'Failed to delete checklist.', 500);
  }
};

// 
// QUESTIONS
// 

const addQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await ChecklistModel.findById(id);
    if (!checklist || checklist.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Checklist not found.', 404);
    }

    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return errorResponse(res, 'Questions array is required.', 400);
    }

    const existing = await ChecklistModel.listQuestions(id);
    const entityOrderMap = {};
    for (const q of existing) {
      const k = `${q.entity_code}__${q.org_tree_id ?? 'null'}`;
      entityOrderMap[k] = Math.max(entityOrderMap[k] || 0, q.order_index + 1);
    }

    const created = [];
    for (const q of questions) {
      const missing = validateRequiredFields(q, ['entity_code', 'entity_type', 'question_text', 'answer_type']);
      if (missing) return errorResponse(res, `Question validation: ${missing}`, 400);

      if (!VALID_ANSWER_TYPES.includes(q.answer_type)) {
        return errorResponse(res, `Invalid answer_type "${q.answer_type}". Allowed: ${VALID_ANSWER_TYPES.join(', ')}`, 400);
      }

      let orgTreeId = null;
      if (q.org_tree_id !== undefined && q.org_tree_id !== null && q.org_tree_id !== '') {
        orgTreeId = parseInt(q.org_tree_id, 10);
        if (Number.isNaN(orgTreeId)) {
          return errorResponse(res, 'Invalid org_tree_id.', 400);
        }
        const edge = await OrganizationTreeModel.findById(orgTreeId);
        if (!edge || edge.root_entity_code !== req.user.entityCode || edge.child_code !== q.entity_code) {
          return errorResponse(res, 'Invalid org_tree_id for selected entity.', 400);
        }
      }

      const key = `${q.entity_code}__${orgTreeId ?? 'null'}`;
      const orderIndex = entityOrderMap[key] || 0;

      const questionId = await ChecklistModel.createQuestion({
        checklist_id: id,
        entity_code: q.entity_code,
        org_tree_id: orgTreeId,
        entity_type: q.entity_type,
        entity_name: q.entity_name || null,
        question_text: q.question_text,
        answer_type: q.answer_type,
        total_marks: 10,
        order_index: orderIndex
      });

      await saveOptions(questionId, q.options || [], q.answer_type);
      entityOrderMap[key] = orderIndex + 1;
      created.push(questionId);
    }

    return successResponse(res, { created_count: created.length }, `${created.length} question(s) added.`, 201);
  } catch (err) {
    console.error('addQuestions error:', err);
    return errorResponse(res, err.message || 'Failed to add questions.', 400);
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { qid } = req.params;
    const question = await ChecklistModel.findQuestionById(qid);
    if (!question) return errorResponse(res, 'Question not found.', 404);

    const checklist = await ChecklistModel.findById(question.checklist_id);
    if (!checklist || checklist.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const { question_text, answer_type, entity_code, org_tree_id, entity_type, entity_name, options } = req.body;
    if (!question_text) return errorResponse(res, 'question_text is required.', 400);
    if (answer_type && !VALID_ANSWER_TYPES.includes(answer_type)) {
      return errorResponse(res, 'Invalid answer_type.', 400);
    }

    const newType = answer_type || question.answer_type;

    await ChecklistModel.deleteOptions(qid);

    let orgTreeId = undefined;
    if (org_tree_id !== undefined) {
      if (org_tree_id === null || org_tree_id === '') {
        orgTreeId = null;
      } else {
        orgTreeId = parseInt(org_tree_id, 10);
        if (Number.isNaN(orgTreeId)) {
          return errorResponse(res, 'Invalid org_tree_id.', 400);
        }
        const selectedEntityCode = entity_code || question.entity_code;
        const edge = await OrganizationTreeModel.findById(orgTreeId);
        if (!edge || edge.root_entity_code !== req.user.entityCode || edge.child_code !== selectedEntityCode) {
          return errorResponse(res, 'Invalid org_tree_id for selected entity.', 400);
        }
      }
    }

    // Update question with all fields including entity context
    await ChecklistModel.updateQuestion(qid, {
      question_text,
      answer_type: newType,
      entity_code: entity_code || question.entity_code,
      org_tree_id: orgTreeId !== undefined ? orgTreeId : (question.org_tree_id ?? null),
      entity_type: entity_type || question.entity_type,
      entity_name: entity_name || question.entity_name || null,
      total_marks: 10,
      order_index: question.order_index || 0
    });

    await saveOptions(qid, options || [], newType);
    return successResponse(res, null, 'Question updated.');
  } catch (err) {
    console.error('updateQuestion error:', err);
    return errorResponse(res, err.message || 'Failed to update question.', 400);
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { qid } = req.params;
    const question = await ChecklistModel.findQuestionById(qid);
    if (!question) return errorResponse(res, 'Question not found.', 404);

    const checklist = await ChecklistModel.findById(question.checklist_id);
    if (!checklist || checklist.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    await ChecklistModel.deleteQuestion(qid);
    return successResponse(res, null, 'Question deleted.');
  } catch (err) {
    console.error('deleteQuestion error:', err);
    return errorResponse(res, 'Failed to delete question.', 500);
  }
};

// 
// EXCEL TEMPLATE + BULK UPLOAD
// 

// Known entity type hierarchy order for this project
const KNOWN_TYPE_ORDER = [
  'Customer',
  'Buying Office', 'Supplier',
  'Company', 'Cluster', 'Factory', 'Unit', 'Department', 'Section',
  'Audit Firm Company', 'Branch', 'Audit Firm Department'
];

// Answer type map — accepts any casing / spacing variation
const ANSWER_TYPE_MAP = {
  'freetext': 'free_text',
  'free_text': 'free_text',
  'free text': 'free_text',
  'singleoption': 'single_option',
  'single_option': 'single_option',
  'single option': 'single_option',
  'multipleoptions': 'multiple_options',
  'multiple_options': 'multiple_options',
  'multiple options': 'multiple_options',
  'dropdown': 'dropdown',
};

/**
 * Builds all org entity data needed for template generation and upload parsing.
 *
 * Returns:
 *   typeOrder     — ordered entity type levels that exist in this user's tree
 *                   e.g. ['Buying Office', 'Company', 'Factory', 'Department']
 *   entityNameMap — { code: name }
 *   entityTypeMap — { code: type }
 *   entityByType  — { type: [{ code, name }] }
 *   childrenMap   — { parentCode: [childCode, ...] }
 *   edges         — raw org tree edges
 */
async function buildOrgEntityMaps(adminCode, entityType) {
  const { getAccessibleEntityCodes } = require('../utils/accessHelper');
  const accessibleCodes = await getAccessibleEntityCodes(adminCode, entityType);

  // Fetch descendants for ALL accessible root codes to build a complete map
  let allEdges = [];
  for (const code of accessibleCodes) {
    const edges = await OrganizationTreeModel.getAllDescendants(code);
    allEdges = [...allEdges, ...edges];
  }

  // Deduplicate edges by ID to avoid redundant processing
  const edgeMap = new Map();
  allEdges.forEach(e => edgeMap.set(e.id, e));
  const edges = Array.from(edgeMap.values());

  const entityTypeMap = {};
  const allCodes = new Set(accessibleCodes);
  for (const e of edges) {
    entityTypeMap[e.parent_code] = e.parent_type;
    entityTypeMap[e.child_code] = e.child_type;
    allCodes.add(e.parent_code);
    allCodes.add(e.child_code);
  }

  // Fetch all entity names + authoritative types in one UNION query
  const entityNameMap = {};
  const codeList = Array.from(allCodes);
  if (codeList.length > 0) {
    const ph = codeList.map(() => '?').join(',');
    const params = Array(12).fill(codeList).flat();
    const [nameRows] = await db.query(
      `SELECT cust_code         AS code, name, 'Customer'          AS entity_type FROM customers                    WHERE cust_code         IN (${ph})
       UNION ALL
       SELECT cbo_code        AS code, name, 'Buying Office'    AS entity_type FROM customer_buying_offices     WHERE cbo_code        IN (${ph})
       UNION ALL
       SELECT csup_code       AS code, name, 'Supplier'         AS entity_type FROM customer_suppliers          WHERE csup_code       IN (${ph})
       UNION ALL
       SELECT comp_code       AS code, name, 'Company'          AS entity_type FROM companies                   WHERE comp_code       IN (${ph})
       UNION ALL
       SELECT comp_clus_code  AS code, name, 'Cluster'          AS entity_type FROM company_clusters            WHERE comp_clus_code  IN (${ph})
       UNION ALL
       SELECT comp_fact_code  AS code, name, 'Factory'          AS entity_type FROM company_factories           WHERE comp_fact_code  IN (${ph})
       UNION ALL
       SELECT comp_unit_code  AS code, name, 'Unit'             AS entity_type FROM company_units               WHERE comp_unit_code  IN (${ph})
       UNION ALL
       SELECT comp_dept_code  AS code, name, 'Department'       AS entity_type FROM company_departments         WHERE comp_dept_code  IN (${ph})
       UNION ALL
       SELECT comp_section_code AS code, name, 'Section'        AS entity_type FROM company_sections            WHERE comp_section_code IN (${ph})
       UNION ALL
       SELECT afc_branch_code AS code, name, 'Branch'           AS entity_type FROM audit_firm_company_branches WHERE afc_branch_code IN (${ph})
       UNION ALL
       SELECT afc_dept_code   AS code, name, 'Audit Firm Department' AS entity_type FROM audit_firm_company_departments WHERE afc_dept_code IN (${ph})
       UNION ALL
       SELECT afc_code        AS code, name, 'Audit Firm Company' AS entity_type FROM audit_firm_companies      WHERE afc_code        IN (${ph})`,
      params
    );
    for (const r of nameRows) {
      entityNameMap[r.code] = r.name.trim();
      entityTypeMap[r.code] = r.entity_type; // authoritative type from DB
    }
  }

  // Children map: parentCode → [childCode]
  const childrenMap = {};
  const childrenEdgeMap = {};
  for (const e of edges) {
    if (!childrenMap[e.parent_code]) childrenMap[e.parent_code] = [];
    if (!childrenMap[e.parent_code].includes(e.child_code)) {
      childrenMap[e.parent_code].push(e.child_code);
    }

    if (!childrenEdgeMap[e.parent_code]) childrenEdgeMap[e.parent_code] = [];
    if (!childrenEdgeMap[e.parent_code].some(x => x.child_code === e.child_code)) {
      childrenEdgeMap[e.parent_code].push({ child_code: e.child_code, edge_id: e.id });
    }
  }

  // typeOrder: admin's own entity type first, then all child types from the
  // authoritative post-UNION entityTypeMap, ordered by known project hierarchy.
  const adminEntityType = entityTypeMap[adminCode];
  const typesInTree = new Set(
    Object.values(entityTypeMap).filter(Boolean)
  );
  const typeOrder = KNOWN_TYPE_ORDER.filter(t => typesInTree.has(t));

  // entityByType: type → [{ code, name }] — includes the admin's own entity
  const entityByType = {};
  for (const [code, type] of Object.entries(entityTypeMap)) {
    if (!type || !typeOrder.includes(type)) continue;
    if (!entityByType[type]) entityByType[type] = [];
    if (!entityByType[type].find(e => e.code === code)) {
      entityByType[type].push({ code, name: entityNameMap[code] || code });
    }
  }

  return { edges, typeOrder, entityNameMap, entityTypeMap, entityByType, childrenMap, childrenEdgeMap };
}

/**
 * DFS from admin's direct children, building full hierarchy paths.
 * Each returned row is an array of names aligned to typeOrder columns.
 * Only leaf nodes (entities with no further children in tree) produce a row.
 */
function buildStructurePaths(typeOrder, entityTypeMap, entityNameMap, childrenMap, adminCode) {
  const paths = [];
  const visited = new Set();

  function dfs(code, currentPath) {
    // Prevent infinite recursion from circular references in the tree
    if (visited.has(code)) {
      return;
    }
    visited.add(code);

    const type = entityTypeMap[code];
    const name = entityNameMap[code] || code;
    const typeIdx = typeOrder.indexOf(type);
    if (typeIdx < 0) return;

    const newPath = [...currentPath];
    newPath[typeIdx] = name;
    for (let i = typeIdx + 1; i < typeOrder.length; i++) newPath[i] = '';

    const relevantChildren = (childrenMap[code] || []).filter(c => {
      const ct = entityTypeMap[c];
      return ct && typeOrder.includes(ct);
    });

    if (relevantChildren.length === 0) {
      paths.push(newPath);
    } else {
      for (const childCode of relevantChildren) {
        dfs(childCode, newPath);
      }
    }
  }

  const rootChildren = childrenMap[adminCode] || [];
  const emptyPath = typeOrder.map(() => '');
  // Pre-fill the admin entity's own name in the first column of every path
  const adminTypeIdx = typeOrder.indexOf(entityTypeMap[adminCode]);
  if (adminTypeIdx >= 0) emptyPath[adminTypeIdx] = entityNameMap[adminCode] || adminCode;
  for (const rootCode of rootChildren) {
    dfs(rootCode, emptyPath);
  }
  return paths;
}

/**
 * Resolves entity_code + entity_type from a row's filled hierarchy column values.
 *
 * entityCols = [{ type: 'Buying Office', name: 'Head BO' }, { type: 'Company', name: 'Main Factory' }, ...]
 *   — ordered by typeOrder, includes empty (name='') entries
 *
 * Resolution: finds the target entity by walking top-down through the tree,
 * matching entity names at each level. The deepest non-empty level is the target.
 */
function resolveEntityFromHierarchy(entityCols, entityByType, childrenMap, childrenEdgeMap, entityTypeMap, entityNameMap) {
  const filled = entityCols.filter(c => c.name.trim());
  if (filled.length === 0) {
    return { error: 'No entity level filled in. Enter the entity name in the appropriate column.' };
  }

  // Resolve candidates top-down
  const firstFilled = filled[0];
  const firstLevelEntities = entityByType[firstFilled.type] || [];
  let candidates = firstLevelEntities
    .filter(e => e.name.toLowerCase() === firstFilled.name.toLowerCase())
    .map(e => e.code);

  // Track the edge id that leads to the current candidate.
  // For the first filled level (root-level entity), there is no incoming edge.
  let candidateEdgeIds = candidates.map(() => null);

  if (candidates.length === 0) {
    return { error: `"${firstFilled.name}" not found in ${firstFilled.type} entities. Check the Company Structure sheet.` };
  }

  for (let i = 1; i < filled.length; i++) {
    const col = filled[i];
    const nextCandidates = [];
    const nextEdgeIds = [];
    for (const parentCode of candidates) {
      for (const childCode of (childrenMap[parentCode] || [])) {
        if (
          entityTypeMap[childCode] === col.type &&
          (entityNameMap[childCode] || '').toLowerCase() === col.name.toLowerCase()
        ) {
          if (!nextCandidates.includes(childCode)) {
            nextCandidates.push(childCode);
            const edgeRow = (childrenEdgeMap[parentCode] || []).find(x => x.child_code === childCode);
            nextEdgeIds.push(edgeRow ? edgeRow.edge_id : null);
          }
        }
      }
    }
    if (nextCandidates.length === 0) {
      return { error: `"${col.name}" not found as a ${col.type} under "${filled[i - 1].name}".` };
    }
    candidates = nextCandidates;
    candidateEdgeIds = nextEdgeIds;
  }

  if (candidates.length > 1) {
    const last = filled[filled.length - 1];
    return { error: `Multiple "${last.name}" ${last.type} entities found. Fill in more hierarchy levels to disambiguate.` };
  }

  return { code: candidates[0], type: entityTypeMap[candidates[0]], org_tree_id: candidateEdgeIds[0] ?? null };
}

const downloadExcelTemplate = async (req, res) => {
  try {
    const { typeOrder, entityNameMap, entityTypeMap, entityByType, childrenMap } =
      await buildOrgEntityMaps(req.user.entityCode, req.user.entityType);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Audito 3.0';
    const hasTree = typeOrder.length > 0;

    // For Company users, exclude Supplier column from the template
    let typeColumns = hasTree ? typeOrder : ['Entity'];
    if (req.user.entityType === 'Company') {
      typeColumns = typeColumns.filter(t => t !== 'Supplier');
    }

    // ── Sheet 1: Guide (Instructions + Company Structure combined) ─────────────
    const wsGuide = wb.addWorksheet('Guide');
    wsGuide.getColumn(1).width = 24; // section label column
    wsGuide.getColumn(2).width = 110; // content column

    // Helper adders for the Guide sheet
    const addGuideTitle = (text) => {
      const row = wsGuide.addRow(['', text]);
      row.getCell(2).font = { bold: true, size: 14, color: { argb: 'FF2C3E50' } };
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } };
      row.getCell(2).alignment = { wrapText: false };
    };
    const addGuideLine = (label, text) => {
      const row = wsGuide.addRow([label, text]);
      row.getCell(1).font = { bold: !!label, size: 10, color: { argb: 'FF7F8C8D' } };
      row.getCell(2).font = { size: 11, color: { argb: 'FF34495E' } };
      row.getCell(2).alignment = { wrapText: true };
    };
    const addGuideBlank = () => wsGuide.addRow([]);

    // SECTION A: INSTRUCTIONS
    addGuideTitle('INSTRUCTIONS — How to fill in the Template sheet:');
    addGuideBlank();

    typeColumns.forEach((colType, i) => {
      const entities = entityByType[colType] || [];
      const samples = entities.slice(0, 4).map(e => e.name).join(', ');
      if (i === 0) {
        addGuideLine(`Col ${i + 1}`, `"${colType}" — Required. Must match a ${colType} name from your Company Structure section below.${samples ? '  Examples: ' + samples : ''}`);
      } else if (i < typeColumns.length - 1) {
        addGuideLine(`Col ${i + 1}`, `"${colType}" — Optional. Must match a ${colType} name that is a child of the ${typeColumns[i - 1]} above it.`);
      } else {
        addGuideLine(`Col ${i + 1}`, `"${colType}" — Optional (deepest level). The question will be assigned to the deepest entity level you fill in.`);
      }
    });

    const n = typeColumns.length;
    addGuideLine(`Col ${n + 1}`, '"Question" — Required. The full question text.');
    addGuideLine(`Col ${n + 2}`, '"answer_type" — Required. One of: FreeText, SingleOption, Dropdown, MultipleOptions');
    addGuideLine(`Col ${n + 3}`, '"answer_options" — Comma-separated option texts. Required for non-FreeText types.  Example: Yes,No');
    addGuideLine(`Col ${n + 4}`, '"answer_points" — Comma-separated points per option (same order). All must sum to 10.  Example: 10,0');
    addGuideBlank();

    addGuideTitle('NOTES:');
    addGuideLine('', '- Do not modify the header row in the Template sheet.');
    addGuideLine('', '- Delete the example rows before uploading.');
    addGuideLine('', '- The question is assigned to the DEEPEST entity level column you fill in.');
    addGuideLine('', '- Each row represents one question.');
    addGuideBlank();
    addGuideBlank();

    // SECTION B: COMPANY STRUCTURE
    addGuideTitle('YOUR COMPANY STRUCTURE — Entity hierarchy reference:');
    addGuideBlank();

    // Structure header row
    const structHeaderRow = wsGuide.addRow(['', ...typeColumns]);
    for (let c = 2; c <= typeColumns.length + 1; c++) {
      const cell = structHeaderRow.getCell(c);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A085' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      wsGuide.getColumn(c + 1).width = 26;
    }

    const structurePaths = buildStructurePaths(typeColumns, entityTypeMap, entityNameMap, childrenMap, req.user.entityCode);
    const structureData = structurePaths.length > 0
      ? structurePaths
      : [typeColumns.map(() => '(No entities in your organization tree yet)')];

    structureData.forEach(rowData => {
      const row = wsGuide.addRow(['', ...rowData]);
      row.alignment = { wrapText: false };
    });

    // ── Sheet 2: Template (data entry) ──────────────────────────────────────────
    const wsTemplate = wb.addWorksheet('Template', { views: [{ state: 'frozen', ySplit: 1 }] });

    const templateHeaders = [
      ...typeColumns,
      'Question',
      'answer_type',
      'answer_options',
      'answer_points'
    ];

    wsTemplate.addRow(templateHeaders);

    const headerRow = wsTemplate.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    templateHeaders.forEach((header, index) => {
      const colNumber = index + 1;
      const cell = headerRow.getCell(colNumber);
      const isEntityCol = index < typeColumns.length;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEntityCol ? 'FF34495E' : 'FF2980B9' }
      };
      let width = 25;
      if (header === 'Question') width = 55;
      else if (header === 'answer_type') width = 18;
      else if (header === 'answer_options') width = 38;
      else if (header === 'answer_points') width = 25;
      wsTemplate.getColumn(colNumber).width = width;
    });

    // Example rows using real entity names
    const exampleRows = [];
    if (hasTree) {
      const firstType = typeColumns[0];
      const firstEntities = (entityByType[firstType] || []).slice(0, 2);
      for (const topEnt of firstEntities) {
        const childCodes = (childrenMap[topEnt.code] || [])
          .filter(c => typeColumns.includes(entityTypeMap[c]));
        const targets = childCodes.length > 0 ? childCodes.slice(0, 1) : [null];

        for (const childCode of targets) {
          const buildRow = (qText, aType, aOpts, aPts) => {
            const row = typeColumns.map(() => '');
            row[0] = topEnt.name;
            if (childCode) {
              const childTypeIdx = typeColumns.indexOf(entityTypeMap[childCode]);
              if (childTypeIdx >= 0) row[childTypeIdx] = entityNameMap[childCode] || '';
            }
            return [...row, qText, aType, aOpts, aPts];
          };
          exampleRows.push(buildRow('Describe the current condition', 'FreeText', '', ''));
          exampleRows.push(buildRow('Is the area properly maintained?', 'SingleOption', 'Yes,No', '10,0'));
          exampleRows.push(buildRow('Select compliance status', 'Dropdown', 'Full,Partial,None', '10,0,0'));
          exampleRows.push(buildRow('Select all available safety equipment', 'MultipleOptions', 'Helmet,Gloves,Glasses', '4,3,3'));
        }
        if (exampleRows.length >= 8) break;
      }
    }
    if (exampleRows.length === 0) {
      const placeholderRow = typeColumns.map((_, i) => i === 0 ? '(entity name here)' : '');
      exampleRows.push([...placeholderRow, 'Describe the current condition', 'FreeText', '', '']);
      exampleRows.push([...placeholderRow, 'Is the area properly maintained?', 'SingleOption', 'Yes,No', '10,0']);
      exampleRows.push([...placeholderRow, 'Select compliance status', 'Dropdown', 'Full,Partial,None', '10,0,0']);
      exampleRows.push([...placeholderRow, 'Select all available safety equipment', 'MultipleOptions', 'Helmet,Gloves,Glasses', '4,3,3']);
    }

    exampleRows.forEach(rowData => {
      const row = wsTemplate.addRow(rowData);
      row.alignment = { vertical: 'middle', wrapText: true };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="checklist_questions_template.xlsx"');

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('downloadExcelTemplate error:', err);
    return errorResponse(res, 'Failed to generate template.', 500);
  }
};

const uploadQuestionsExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await ChecklistModel.findById(id);
    if (!checklist || checklist.created_by !== req.user.entityCode) {
      return errorResponse(res, 'Checklist not found.', 404);
    }
    if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

    const { rows } = parseQuestionsFromExcelBuffer({ buffer: req.file.buffer, entityCode: req.user.entityCode });

    // Detect which columns are entity type columns (headers that match known type names)
    const rawHeaders = rows[0].map(h => String(h).trim());
    const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim() !== ''));
    const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

    // Entity type columns: header matches a known type name (case-insensitive)
    const entityColIndices = rawHeaders
      .map((h, i) => ({ idx: i, type: KNOWN_TYPE_ORDER.find(t => t.toLowerCase() === h.toLowerCase()) }))
      .filter(c => c.type);

    if (entityColIndices.length === 0) {
      return errorResponse(res, 'No entity type columns found in header row. Expected columns named after entity types (e.g. "Buying Office", "Factory", "Branch").', 400);
    }

    // Helper: get a non-entity column by name
    const getColByName = (row, name) => {
      const idx = lowerHeaders.indexOf(name.toLowerCase());
      return idx >= 0 ? String(row[idx] || '').trim() : '';
    };

    const { entityTypeMap, entityByType, childrenMap, childrenEdgeMap, entityNameMap } =
      await buildOrgEntityMaps(req.user.entityCode, req.user.entityType);

    const existing = await ChecklistModel.listQuestions(id);
    const baseEntityOrderMap = {};
    for (const q of existing) {
      baseEntityOrderMap[q.entity_code] = Math.max(baseEntityOrderMap[q.entity_code] || 0, q.order_index + 1);
    }

    const errors = [];
    const parsedRows = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-based + header row

      const question_text = getColByName(row, 'question');
      const answer_type_raw = getColByName(row, 'answer_type');
      const answer_opts_str = getColByName(row, 'answer_options');
      const answer_pts_str = getColByName(row, 'answer_points');

      if (!question_text || !answer_type_raw) {
        errors.push(`Row ${rowNum}: Missing required fields (Question, answer_type).`);
        continue;
      }

      // Build entity column values for this row (ordered by typeOrder position)
      const entityCols = entityColIndices.map(({ idx, type }) => ({
        type,
        name: String(row[idx] || '').trim()
      }));

      const resolved = resolveEntityFromHierarchy(
        entityCols, entityByType, childrenMap, childrenEdgeMap, entityTypeMap, entityNameMap
      );
      if (resolved.error) {
        errors.push(`Row ${rowNum}: ${resolved.error}`);
        continue;
      }

      const { code: entity_code, type: entity_type, org_tree_id } = resolved;

      // Normalize answer type
      const normalizedType = answer_type_raw.toLowerCase().replace(/[\s_-]+/g, '');
      const answer_type = ANSWER_TYPE_MAP[normalizedType] || ANSWER_TYPE_MAP[answer_type_raw.toLowerCase()];
      if (!answer_type) {
        errors.push(`Row ${rowNum}: Invalid answer_type "${answer_type_raw}". Use: FreeText, SingleOption, Dropdown, MultipleOptions.`);
        continue;
      }

      // Parse options
      const options = [];
      if (answer_type !== 'free_text') {
        const optTexts = answer_opts_str.split(',').map(s => s.trim()).filter(Boolean);
        const optPoints = answer_pts_str.split(',').map(s => parseFloat(s.trim()));

        if (optTexts.length === 0) {
          errors.push(`Row ${rowNum}: answer_options is required for answer_type "${answer_type_raw}".`);
          continue;
        }
        if (optTexts.length !== optPoints.filter(n => !isNaN(n)).length) {
          errors.push(`Row ${rowNum}: answer_options and answer_points must have the same number of entries.`);
          continue;
        }
        for (let o = 0; o < optTexts.length; o++) {
          options.push({ option_text: optTexts[o], marks: isNaN(optPoints[o]) ? 0 : optPoints[o] });
        }
        const sum = options.reduce((s, o) => s + o.marks, 0);
        if (Math.abs(sum - 10) > 0.01) {
          errors.push(`Row ${rowNum}: answer_points must sum to 10 (got ${sum.toFixed(2)}).`);
          continue;
        }
      }

      parsedRows.push({
        rowNum,
        entity_code,
        org_tree_id: org_tree_id ?? null,
        entity_type,
        question_text,
        answer_type,
        options
      });
    }

    if (errors.length > 0) {
      return errorResponse(
        res,
        `Validation failed in ${errors.length} row(s). No questions were imported.`,
        400,
        errors
      );
    }

    let created = 0;
    const entityOrderMap = { ...baseEntityOrderMap };
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const row of parsedRows) {
        const k = `${row.entity_code}__null`;
        const orderIndex = entityOrderMap[k] || 0;
        const questionId = await ChecklistModel.createQuestion({
          checklist_id: id,
          entity_code: row.entity_code,
          org_tree_id: row.org_tree_id ?? null,
          entity_type: row.entity_type,
          entity_name: null,
          question_text: row.question_text,
          answer_type: row.answer_type,
          total_marks: 10,
          order_index: orderIndex
        }, connection);

        await saveOptions(questionId, row.options, row.answer_type, connection);
        entityOrderMap[k] = orderIndex + 1;
        created++;
      }

      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    return successResponse(res, {
      created_count: created,
      error_count: 0,
      errors
    }, `${created} question(s) uploaded.`);
  } catch (err) {
    console.error('uploadQuestionsExcel error:', err);
    return errorResponse(res, 'Failed to process Excel file.', 500);
  }
};

// Preview-only Excel parse (no DB writes)
const previewQuestionsExcel = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

    const { rows } = parseQuestionsFromExcelBuffer({ buffer: req.file.buffer, entityCode: req.user.entityCode });

    const rawHeaders = rows[0].map(h => String(h).trim());
    const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim() !== ''));
    const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

    const entityColIndices = rawHeaders
      .map((h, i) => ({ idx: i, type: KNOWN_TYPE_ORDER.find(t => t.toLowerCase() === h.toLowerCase()) }))
      .filter(c => c.type);

    if (entityColIndices.length === 0) {
      return errorResponse(res, 'No entity type columns found in header row. Expected columns named after entity types (e.g. "Buying Office", "Factory", "Branch").', 400);
    }

    const getColByName = (row, name) => {
      const idx = lowerHeaders.indexOf(name.toLowerCase());
      return idx >= 0 ? String(row[idx] || '').trim() : '';
    };

    const { entityTypeMap, entityByType, childrenMap, childrenEdgeMap, entityNameMap } =
      await buildOrgEntityMaps(req.user.entityCode, req.user.entityType);

    const errors = [];
    const items = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      const question_text = getColByName(row, 'question');
      const answer_type_raw = getColByName(row, 'answer_type');
      const answer_opts_str = getColByName(row, 'answer_options');
      const answer_pts_str = getColByName(row, 'answer_points');

      if (!question_text || !answer_type_raw) {
        errors.push(`Row ${rowNum}: Missing required fields (Question, answer_type).`);
        continue;
      }

      const entityCols = entityColIndices.map(({ idx, type }) => ({
        type,
        name: String(row[idx] || '').trim()
      }));

      const resolved = resolveEntityFromHierarchy(
        entityCols, entityByType, childrenMap, childrenEdgeMap, entityTypeMap, entityNameMap
      );
      if (resolved.error) {
        errors.push(`Row ${rowNum}: ${resolved.error}`);
        continue;
      }

      const { code: entity_code, type: entity_type, org_tree_id } = resolved;

      const normalizedType = answer_type_raw.toLowerCase().replace(/[\s_-]+/g, '');
      const answer_type = ANSWER_TYPE_MAP[normalizedType] || ANSWER_TYPE_MAP[answer_type_raw.toLowerCase()];
      if (!answer_type) {
        errors.push(`Row ${rowNum}: Invalid answer_type "${answer_type_raw}". Use: FreeText, SingleOption, Dropdown, MultipleOptions.`);
        continue;
      }

      const options = [];
      if (answer_type !== 'free_text') {
        const optTexts = answer_opts_str.split(',').map(s => s.trim()).filter(Boolean);
        const optPoints = answer_pts_str.split(',').map(s => parseFloat(s.trim()));

        if (optTexts.length === 0) {
          errors.push(`Row ${rowNum}: answer_options is required for answer_type "${answer_type_raw}".`);
          continue;
        }
        if (optTexts.length !== optPoints.filter(n => !isNaN(n)).length) {
          errors.push(`Row ${rowNum}: answer_options and answer_points must have the same number of entries.`);
          continue;
        }
        for (let o = 0; o < optTexts.length; o++) {
          options.push({ option_text: optTexts[o], marks: isNaN(optPoints[o]) ? 0 : optPoints[o] });
        }
        const sum = options.reduce((s, o) => s + o.marks, 0);
        if (Math.abs(sum - 10) > 0.01) {
          errors.push(`Row ${rowNum}: answer_points must sum to 10 (got ${sum.toFixed(2)}).`);
          continue;
        }
      }

      items.push({
        entity_code,
        org_tree_id: org_tree_id ?? null,
        entity_type,
        entity_name: entityNameMap[entity_code] || entity_code,
        question_text,
        answer_type,
        options,
      });
    }

    return successResponse(res, {
      created_count: items.length,
      errors,
      items,
    }, 'Excel parsed.');
  } catch (err) {
    console.error('previewQuestionsExcel error:', err);
    return errorResponse(res, err.statusCode ? err.message : 'Failed to process Excel file.', err.statusCode || 500);
  }
};

module.exports = {
  createChecklistType,
  listChecklistTypes,
  updateChecklistType,
  deactivateChecklistType,
  uploadMedia,
  createChecklist,
  listChecklists,
  getChecklist,
  updateChecklist,
  deactivateChecklist,
  addQuestions,
  updateQuestion,
  deleteQuestion,
  downloadExcelTemplate,
  uploadQuestionsExcel,
  previewQuestionsExcel
};

