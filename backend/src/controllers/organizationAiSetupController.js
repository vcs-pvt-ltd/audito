const crypto = require('crypto');
const { db } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');
const { generateTableId } = require('../utils/codeGenerator');
const SubscriptionModel = require('../models/SubscriptionModel');
const OrganizationAiSetupModel = require('../models/OrganizationAiSetupModel');
const OrganizationTreeModel = require('../models/OrganizationTreeModel');
const LinkModel = require('../models/LinkModel');
const onboarding = require('../services/onboardingDraftService');
const { publishChecklist } = require('../services/onboardingPublishService');
const LimitsEnforcer = require('../utils/limitsEnforcer');
const { minimumLevelsForChild } = require('../config/packageHierarchy');
const { findDuplicateName, normalizeEntityName } = require('../utils/nameNormalizer');
const { normalizeAccountType, validateNodes, analyzeDocuments, refineOrganizationDraft, reconcileExistingEntityPlacements } = require('../services/organizationAiSetupService');
const { isSupportedAiDocument } = require('../utils/aiDocumentFiles');
const { getOrgName } = require('../utils/orgLookup');
const { getHierarchyContext } = require('../services/organizationAiSetupService');

const ENTITY_SPECS = {
  'Buying Office': { table: 'customer_buying_offices', codeField: 'cbo_code', prefix: 'CBO' },
  Supplier: { table: 'customer_suppliers', codeField: 'csup_code', prefix: 'SUP' },
  Cluster: { table: 'company_clusters', codeField: 'comp_clus_code', prefix: 'CC' },
  Factory: { table: 'company_factories', codeField: 'comp_fact_code', prefix: 'COMPF' },
  Unit: { table: 'company_units', codeField: 'comp_unit_code', prefix: 'CU' },
  Department: { table: 'company_departments', codeField: 'comp_dept_code', prefix: 'CD' },
  Section: { table: 'company_sections', codeField: 'comp_section_code', prefix: 'CS' },
  Branch: { table: 'audit_firm_company_branches', codeField: 'afc_branch_code', prefix: 'AFCB' },
  'Audit Firm Department': { table: 'audit_firm_company_departments', codeField: 'afc_dept_code', prefix: 'AFCD' },
};

const OWNER_COLUMNS = {
  'Buying Office': 'cust_code', Supplier: 'cust_code', Cluster: 'comp_code', Factory: 'comp_code', Unit: 'comp_code',
  Department: 'comp_code', Section: 'comp_code', Branch: 'afc_code', 'Audit Firm Department': 'afc_code',
};

const DEPARTMENT_STORAGE = {
  Department: { table: 'company_departments', ownerColumn: 'comp_code' },
  'Audit Firm Department': { table: 'audit_firm_company_departments', ownerColumn: 'afc_code' },
};

const STORAGE_PARENT_TYPES = {
  Supplier: 'Buying Office', Factory: 'Cluster', Unit: 'Factory', Department: 'Unit',
  Section: 'Department', 'Audit Firm Department': 'Branch',
};

const STORAGE_PARENT_COLUMNS = {
  Supplier: 'cbo_code', Factory: 'comp_clus_code', Unit: 'comp_fact_code', Department: 'comp_unit_code',
  Section: 'comp_dept_code', 'Audit Firm Department': 'afc_branch_code',
};

async function enforceDepartmentPlanLimit(session, nodes, executor = db) {
  const limits = await SubscriptionModel.getLimits(session.root_entity_code);
  if (session.account_type === 'Company' && await SubscriptionModel.getActivePlan(session.root_entity_code) === 'Package') {
    const byId = new Map(nodes.map(n => [n.id, n]));
    for (const node of nodes) {
      let count = 1, current = node;
      while (current) {
        if (['Company', 'Cluster', 'Factory', 'Unit'].includes(current.entity_type)) count++;
        current = byId.get(current.parent_id);
      }
      const minimum = minimumLevelsForChild(session.root_entity_type, node.entity_type) || 1;
      if (Math.max(count, minimum) > Number(limits?.company_level || 1)) {
        const error = new Error('This structure exceeds the company levels in your package. Review the organization areas.');
        error.code = 'AI_SETUP_PLAN_LIMIT'; throw error;
      }
    }
  }
  const departmentLimit = Number(limits?.department);
  if (!Number.isFinite(departmentLimit)) return;

  for (const [entityType, storage] of Object.entries(DEPARTMENT_STORAGE)) {
    const proposed = nodes.filter((node) => node.entity_type === entityType && !node.source_entity_code && !node.reuse_source_node_id);
    if (!proposed.length) continue;
    const [existingRows] = await executor.query(
      `SELECT name FROM \`${storage.table}\` WHERE \`${storage.ownerColumn}\` = ? AND is_active = TRUE`,
      [session.root_entity_code]
    );
    const existing = existingRows.length;
    const names = new Set(existingRows.map(row => normalizeEntityName(row.name)));
    const requested = new Set(proposed.map(node => normalizeEntityName(node.name)).filter(name => !names.has(name))).size;
    if (existing + requested > departmentLimit) {
      const error = new Error(`Department plan limit reached: ${existing} existing + ${requested} in this draft exceeds your limit of ${departmentLimit}.`);
      error.code = 'AI_SETUP_PLAN_LIMIT';
      throw error;
    }
  }
}

// Client/AI node identifiers are temporary until OrganizationAiSetupModel
// stores them. The model replaces new identifiers with sequential database
// IDs from codeGenerator while preserving their parent relationships.
const newNodeId = () => `TMP-${crypto.randomBytes(10).toString('hex')}`;

async function attachUsageProtection(nodes) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const existingNodes = sourceNodes.filter((node) => node.source_edge_id);
  if (!existingNodes.length) {
    return sourceNodes.map((node) => ({ ...node, is_locked: false, lock_reasons: [] }));
  }

  const [directUsage, entityCodeUsage] = await Promise.all([
    OrganizationTreeModel.getDependencyUsage(existingNodes.map((node) => node.source_edge_id)),
    OrganizationTreeModel.getEntityCodeDependencyUsage(existingNodes.map((node) => node.source_entity_code)),
  ]);
  const byId = new Map(sourceNodes.map((node) => [node.id, node]));
  const reasonsByNodeId = new Map();
  const addReasons = (nodeId, reasons) => {
    if (!nodeId || !reasons?.size) return;
    if (!reasonsByNodeId.has(nodeId)) reasonsByNodeId.set(nodeId, new Set());
    for (const reason of reasons) reasonsByNodeId.get(nodeId).add(reason);
  };

  for (const node of existingNodes) {
    addReasons(node.id, directUsage.get(String(node.source_edge_id)));
    addReasons(node.id, entityCodeUsage.get(String(node.source_entity_code)));
  }

  // Entity names live in the shared entity table, so usage in one placement
  // protects every placement of that same entity record.
  const reasonsByEntityCode = new Map();
  for (const node of existingNodes) {
    const reasons = reasonsByNodeId.get(node.id);
    if (!reasons?.size || !node.source_entity_code) continue;
    if (!reasonsByEntityCode.has(node.source_entity_code)) reasonsByEntityCode.set(node.source_entity_code, new Set());
    for (const reason of reasons) reasonsByEntityCode.get(node.source_entity_code).add(reason);
  }
  for (const node of existingNodes) addReasons(node.id, reasonsByEntityCode.get(node.source_entity_code));

  // A parent move/removal changes the hierarchy context of every descendant,
  // so direct usage also locks all baseline ancestors of that edge.
  for (const [nodeId, reasons] of [...reasonsByNodeId.entries()]) {
    let parentId = byId.get(nodeId)?.baseline_parent_id || null;
    const visited = new Set();
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      addReasons(parentId, reasons);
      parentId = byId.get(parentId)?.baseline_parent_id || null;
    }
  }

  return sourceNodes.map((node) => {
    const reasons = [...(reasonsByNodeId.get(node.id) || [])].sort();
    return { ...node, is_locked: reasons.length > 0, lock_reasons: reasons };
  });
}

function protectedChange(node) {
  return Boolean(node?.source_edge_id) && (
    Boolean(node.is_removed)
    || node.name !== node.baseline_name
    || (node.parent_id || null) !== (node.baseline_parent_id || null)
  );
}

function protectedChangeError(nodes) {
  const node = (nodes || []).find((item) => item.is_locked && protectedChange(item));
  if (!node) return null;
  const usages = (node.lock_reasons || []).join(', ') || 'another Audito function';
  return `"${node.baseline_name || node.name}" cannot be renamed, moved, or removed because it is used by ${usages}.`;
}

function restoreProtectedNodes(nextNodes, protectedNodes) {
  const protectedById = new Map((protectedNodes || []).filter((node) => node.is_locked).map((node) => [node.id, node]));
  const lockedEntityCodes = new Set([...protectedById.values()].map((node) => node.source_entity_code).filter(Boolean));
  const existingIds = new Set((protectedNodes || []).map((node) => node.id));
  let restored = false;
  let next = (nextNodes || []).map((node) => {
    const locked = protectedById.get(node.id);
    if (!locked || !protectedChange(node)) return node;
    restored = true;
    return {
      ...node,
      name: locked.baseline_name || locked.name,
      parent_id: locked.baseline_parent_id || null,
      is_removed: false,
    };
  });

  const blockedPlacementRoots = new Set(next
    .filter((node) => !existingIds.has(node.id) && !node.source_edge_id && lockedEntityCodes.has(node.source_entity_code))
    .map((node) => node.id));
  if (blockedPlacementRoots.size) {
    const blockedBranchIds = new Set(blockedPlacementRoots);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of next) {
        if (node.parent_id && blockedBranchIds.has(node.parent_id) && !blockedBranchIds.has(node.id)) {
          blockedBranchIds.add(node.id);
          changed = true;
        }
      }
    }
    next = next.filter((node) => !blockedBranchIds.has(node.id));
    restored = true;
  }
  return { nodes: next, restored };
}

// Entity records the organization already created (for example in Entity
// Setup), whether or not they are placed in the organization tree yet.
async function loadEntityCatalog(session) {
  const { allowedEntityTypes } = getHierarchyContext(session.account_type, session.root_entity_type);
  const catalog = [];
  for (const entityType of allowedEntityTypes) {
    const spec = ENTITY_SPECS[entityType];
    const ownerColumn = OWNER_COLUMNS[entityType];
    if (!spec || !ownerColumn) continue;
    const parentColumn = STORAGE_PARENT_COLUMNS[entityType];
    const [rows] = await db.query(
      `SELECT \`${spec.codeField}\` AS code, name${parentColumn ? `, \`${parentColumn}\` AS parent_code` : ''}
         FROM \`${spec.table}\` WHERE \`${ownerColumn}\` = ? AND is_active = TRUE ORDER BY name LIMIT 250`,
      [session.root_entity_code]
    );
    catalog.push(...rows.filter((row) => row.code && String(row.name || '').trim()).map((row) => ({ code: row.code, name: row.name, entity_type: entityType,
      parent_type: STORAGE_PARENT_TYPES[entityType] || null, parent_code: row.parent_code || null })));
  }
  return catalog;
}

// Draft nodes for entity records that are not in the organization tree yet,
// placed under the parent stored on the record when that is a valid place,
// otherwise directly under the root when allowed. Records that need a parent
// the draft does not have stay in the catalog for the user to place.
function existingEntityNodes(session, nodes, catalog) {
  const context = getHierarchyContext(session.account_type, session.root_entity_type);
  const parentTypes = (type) => Object.entries(context.allowedChildren).filter(([, children]) => children.includes(type)).map(([parent]) => parent);
  const byCode = new Map(nodes.filter((node) => node.source_entity_code && !node.is_removed).map((node) => [`${node.entity_type}|${node.source_entity_code}`, node]));
  const order = context.allowedEntityTypes;
  const added = [];
  for (const entity of [...catalog].sort((a, b) => order.indexOf(a.entity_type) - order.indexOf(b.entity_type))) {
    const key = `${entity.entity_type}|${entity.code}`;
    if (byCode.has(key)) continue;
    const storedParent = entity.parent_code ? byCode.get(`${entity.parent_type}|${entity.parent_code}`) : null;
    const allowedParents = parentTypes(entity.entity_type);
    let parentId;
    if (storedParent && allowedParents.includes(storedParent.entity_type)) parentId = storedParent.id;
    else if (allowedParents.includes(context.rootEntityType)) parentId = null;
    else continue;
    const node = { id: newNodeId(), parent_id: parentId, name: entity.name, entity_type: entity.entity_type, source_entity_code: entity.code,
      source_edge_id: null, reuse_source_node_id: null, baseline_name: entity.name, baseline_parent_id: null, confidence: null, is_ai_generated: false, is_removed: false };
    added.push(node);
    byCode.set(key, node);
  }
  return added;
}

// Adds the organization's existing entity records to a guided draft once.
// Returns the refreshed session when something changed.
async function includeExistingEntities(session) {
  if (!session.onboarding_draft || session.onboarding_draft.entity_catalog_included || session.status === 'published') return session;
  const nodes = await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id);
  const added = existingEntityNodes(session, nodes, await loadEntityCatalog(session));
  const draft = { ...session.onboarding_draft, entity_catalog_included: true,
    node_evidence: { ...(session.onboarding_draft.node_evidence || {}), ...Object.fromEntries(added.map((node) => [node.id, { origin: 'existing', source_reference: '' }])) } };
  await storeGeneratedDraft(session, [...nodes, ...added], draft);
  return OrganizationAiSetupModel.getSession(session.organization_ai_setup_session_id, session.root_entity_code);
}

// Existing records the review screen can still add to the draft.
async function unplacedEntities(session, nodes) {
  try {
    const used = new Set(nodes.filter((node) => node.source_entity_code && !node.is_removed).map((node) => `${node.entity_type}|${node.source_entity_code}`));
    return (await loadEntityCatalog(session)).filter((entity) => !used.has(`${entity.entity_type}|${entity.code}`))
      .map(({ code, name, entity_type }) => ({ code, name, entity_type }));
  } catch (error) {
    console.error('AI setup entity catalog error:', error.message);
    return [];
  }
}

async function withRootName(session) {
  return { ...session, root_entity_name: await getOrgName(session.root_entity_type, session.root_entity_code) };
}

// Combined onboarding reads documents in the background because large audit
// sheets need several AI passes. The backend runs as one process, so a read
// that is not in this process's job list is gone (for example after a
// restart) and its session is released at once instead of blocking uploads.
const analysisJobs = new Map();
const STILL_READING = 'Audito is still reading your document. Wait until it finishes.';

function stillAnalyzing(session) {
  return session.status === 'analyzing' && analysisJobs.has(session.organization_ai_setup_session_id);
}

// A stored audit sheet is needed only while its setup is open. Sheets of setups
// that are saved, discarded or gone are deleted (also after an interrupted save).
async function removeFinishedSetupSheets() {
  const stored = onboarding.listStoredSheets();
  if (!stored.length) return;
  const [rows] = await db.query('SELECT organization_ai_setup_session_id, root_entity_code, status FROM organization_ai_setup_sessions WHERE organization_ai_setup_session_id IN (?)',
    [stored.map((sheet) => sheet.organization_ai_setup_session_id)]);
  const byId = new Map(rows.map((row) => [row.organization_ai_setup_session_id, row]));
  for (const sheet of stored) {
    const session = byId.get(sheet.organization_ai_setup_session_id);
    if (!session || session.root_entity_code !== sheet.root_entity_code || ['published', 'discarded'].includes(session.status)) onboarding.clearEvidence(sheet);
  }
}
const runSheetCleanup = () => removeFinishedSetupSheets().catch((error) => console.error('Stored audit sheet cleanup error:', error.message));
setTimeout(runSheetCleanup, 15000).unref();
setInterval(runSheetCleanup, 6 * 60 * 60 * 1000).unref();

// Marks a read restarted after an interruption, so it is resumed only once.
const RESUMED_MARK = 'Reading resumed after an interruption.';

// A read cut off by a server restart continues with the stored audit sheet
// (once); without the sheet, or if it was cut off again, it fails.
async function recoverStaleAnalysis(session) {
  if (session.status !== 'analyzing' || stillAnalyzing(session) || !session.onboarding_draft) return session;
  if (session.error_message !== RESUMED_MARK && onboarding.hasEvidence(session)) {
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { error_message: RESUMED_MARK });
    const resumed = { ...session, error_message: RESUMED_MARK };
    startAnalysis(resumed, session.onboarding_draft.structure_read ? 'questions' : 'structure');
    return resumed;
  }
  const fields = { status: 'failed', error_message: onboarding.hasEvidence(session) ? 'Reading was interrupted. Press Prepare to try again.' : 'Reading was interrupted. Upload the sheet again.' };
  await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, fields);
  return { ...session, ...fields };
}

// phase "structure" reads the organization from a new upload; phase
// "questions" reads the questions onto the organization the user verified.
function startAnalysis(session, phase = 'structure') {
  const id = session.organization_ai_setup_session_id;
  const job = { progress: phase === 'questions' ? { stage: 'Reading audit questions', done: 0, total: 1 } : { stage: 'Preparing your document', done: 0, total: 1 } };
  analysisJobs.set(id, job);
  (async () => {
    try {
      if (phase === 'structure') {
        job.progress = { stage: 'Matching your existing organization', done: 0, total: 1 };
        session = await includeExistingEntities(session);
      }
      session = await withRootName(session);
      const currentNodes = await attachUsageProtection(await OrganizationAiSetupModel.listNodes(id));
      const result = await onboarding.generateCombinedDraft({ session, nodes: currentNodes, phase, onProgress: (progress) => { job.progress = progress; } });
      const protectedResult = restoreProtectedNodes(result.nodes, currentNodes);
      job.progress = { stage: 'Saving your draft', done: 1, total: 1 };
      await storeGeneratedDraft(session, protectedResult.nodes, result.draft);
      const warnings = protectedResult.restored
        ? [...new Set([...result.warnings, 'Some requested changes were skipped because those organization entities are already used by another Audito function.'])].slice(0, 30)
        : result.warnings;
      await OrganizationAiSetupModel.updateSession(id, {
        status: 'ready', model_name: result.model, summary: result.message || result.summary, warnings_json: warnings, error_message: null,
      });
    } catch (error) {
      console.error('Background AI onboarding analysis error:', error.message);
      await OrganizationAiSetupModel.updateSession(id, {
        status: 'failed', error_message: error.statusCode && error.statusCode < 500 ? error.message : 'AI could not read this document. Try again, or upload a clearer file.',
      }).catch(() => {});
    } finally {
      analysisJobs.delete(id);
    }
  })();
}

const sessionPayload = async (inputSession) => {
  const session = await recoverStaleAnalysis(inputSession);
  let nodes = await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id);
  // Recover update sessions affected by an interrupted/failed legacy replace.
  // A valid update review always contains the existing mapped occurrences,
  // including occurrences explicitly marked for removal.
  if (session.setup_mode === 'update' && !nodes.length) {
    const existingNodes = await loadExistingDraftNodes(session.root_entity_code);
    if (existingNodes.length) {
      await OrganizationAiSetupModel.replaceNodes(session.organization_ai_setup_session_id, existingNodes);
      nodes = await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id);
    }
  }
  const reconciledNodes = session.onboarding_draft ? nodes : reconcileExistingEntityPlacements(nodes, nodes);
  const nodeSignature = (items) => JSON.stringify(items.map((node) => ({
    id: node.id,
    parent_id: node.parent_id || null,
    source_entity_code: node.source_entity_code || null,
    source_edge_id: node.source_edge_id || null,
    reuse_source_node_id: node.reuse_source_node_id || null,
    is_removed: Boolean(node.is_removed),
  })).sort((a, b) => a.id.localeCompare(b.id)));
  if (nodeSignature(reconciledNodes) !== nodeSignature(nodes)) {
    await OrganizationAiSetupModel.replaceNodes(session.organization_ai_setup_session_id, reconciledNodes);
    nodes = await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id);
  }
  nodes = await attachUsageProtection(nodes);
  return { session, nodes, evidence_available: onboarding.hasEvidence(session), review_token: session.onboarding_draft ? onboarding.reviewToken(session, nodes) : null,
    plan_issue: await planIssue(session, nodes),
    entity_catalog: session.onboarding_draft && session.status !== 'published' ? await unplacedEntities(session, nodes) : [],
    root_entity_name: await getOrgName(session.root_entity_type, session.root_entity_code),
    analysis_progress: session.status === 'analyzing' ? analysisJobs.get(session.organization_ai_setup_session_id)?.progress || { stage: 'Reading your document', done: 0, total: 1 } : null };
};

// Preview package limits during review so the user can fix the draft before
// saving. Publishing re-checks the same limits inside its transaction.
async function planIssue(session, nodes) {
  if (!session.onboarding_draft || session.status === 'published') return null;
  try {
    await enforceDepartmentPlanLimit(session, nodes.filter((node) => !node.is_removed));
    return await LimitsEnforcer.checkChecklistLimit(session.root_entity_code) || null;
  } catch (error) {
    if (error.code === 'AI_SETUP_PLAN_LIMIT') return error.message;
    console.error('AI setup plan preview error:', error.message);
    return null;
  }
}

async function loadExistingDraftNodes(rootEntityCode) {
  const edges = await OrganizationTreeModel.getTreeDescendants(rootEntityCode, [rootEntityCode]);
  const draftIdByEdgeId = new Map(edges.map((edge) => [edge.org_tree_id, `TMP-${edge.org_tree_id}`]));
  const nodes = [];
  for (const edge of edges) {
    const spec = ENTITY_SPECS[edge.child_type];
    if (!spec) continue;
    const [rows] = await db.query(
      `SELECT name FROM \`${spec.table}\` WHERE \`${spec.codeField}\` = ? AND is_active = TRUE LIMIT 1`,
      [edge.child_code]
    );
    if (!rows[0]) continue;
    const id = draftIdByEdgeId.get(edge.org_tree_id);
    const parentId = edge.parent_edge_id ? draftIdByEdgeId.get(edge.parent_edge_id) || null : null;
    nodes.push({
      id,
      parent_id: parentId,
      name: rows[0].name,
      entity_type: edge.child_type,
      source_entity_code: edge.child_code,
      source_edge_id: edge.org_tree_id,
      reuse_source_node_id: null,
      baseline_name: rows[0].name,
      baseline_parent_id: parentId,
      confidence: 1,
      is_ai_generated: false,
      is_removed: false,
    });
  }
  return nodes;
}

async function requireSession(req, res) {
  const session = await OrganizationAiSetupModel.getSession(req.params.id, req.user.entityCode);
  if (!session) { errorResponse(res, 'Organization setup draft not found.', 404); return null; }
  if (session.status === 'discarded') { errorResponse(res, 'This draft was discarded. Start a new setup.', 409); return null; }
  return session;
}

async function storeGeneratedDraft(session, nodes, draft) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const persisted = await OrganizationAiSetupModel.replaceNodes(session.organization_ai_setup_session_id, nodes, connection);
    if (draft) await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id,
      { onboarding_draft_json: onboarding.remapDraft(draft, nodes, persisted) }, connection);
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

const createSession = async (req, res) => {
  try {
    // Guided (onboarding) setup runs once; afterwards the regular editor is used.
    if (req.body?.combined && await guidedSetupCompleted(req.user.entityCode)) {
      return errorResponse(res, 'Your setup is already complete.', 409, { code: 'SETUP_COMPLETED' });
    }
    const openSession = await OrganizationAiSetupModel.getLatestOpenSession(req.user.entityCode);
    if (openSession) {
      if (req.body?.combined && openSession.account_type !== 'Audit Firm' && !openSession.onboarding_draft) {
        openSession.onboarding_draft = onboarding.normalizeDraft();
        await OrganizationAiSetupModel.updateSession(openSession.organization_ai_setup_session_id, { onboarding_draft_json: openSession.onboarding_draft });
      }
      return successResponse(res, await sessionPayload(req.body?.combined ? await includeExistingEntities(openSession) : openSession), 'Your saved organization draft was resumed.');
    }
    const existingNodes = await loadExistingDraftNodes(req.user.entityCode);
    const session = await OrganizationAiSetupModel.createSession({
      id: await generateTableId('organization_ai_setup_sessions', 'organization_ai_setup_session_id', 'OAS', 5), rootEntityCode: req.user.entityCode, rootEntityType: req.user.entityType,
      accountType: normalizeAccountType(req.user.entityType, req.user.accountType),
      setupMode: existingNodes.length ? 'update' : 'create', createdBy: req.user.userCode,
    });
    if (existingNodes.length) await OrganizationAiSetupModel.replaceNodes(session.organization_ai_setup_session_id, existingNodes);
    if (req.body?.combined && session.account_type !== 'Audit Firm') {
      session.onboarding_draft = onboarding.normalizeDraft();
      await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { onboarding_draft_json: session.onboarding_draft });
    }
    return successResponse(res, await sessionPayload(req.body?.combined ? await includeExistingEntities(session) : session), 'Organization setup draft created.', 201);
  } catch (error) {
    console.error('Create AI organization setup session error:', error.message);
    return errorResponse(res, 'Unable to create the organization setup draft.', 500);
  }
};

const getCurrentSession = async (req, res) => {
  try {
    const session = await OrganizationAiSetupModel.getLatestOpenSession(req.user.entityCode);
    return successResponse(res, session ? await sessionPayload(session) : null);
  } catch (error) {
    console.error('Get current AI organization setup session error:', error.message);
    return errorResponse(res, 'Unable to retrieve the saved organization draft.', 500);
  }
};

// Guided setup is complete once it published an organization and a checklist.
async function guidedSetupCompleted(rootEntityCode) {
  const [rows] = await db.query(`SELECT s.published_checklist_id FROM organization_ai_setup_sessions s
    INNER JOIN checklists c ON c.checklist_id = s.published_checklist_id AND c.is_active = TRUE
    WHERE s.root_entity_code = ? AND s.status = 'published' LIMIT 1`, [rootEntityCode]);
  return rows.length > 0;
}

const getCompletion = async (req, res) => {
  try {
    return successResponse(res, { completed: await guidedSetupCompleted(req.user.entityCode) });
  } catch (error) { return errorResponse(res, 'Unable to check setup progress.', 500); }
};

const getSession = async (req, res) => {
  try {
    const session = await requireSession(req, res); if (!session) return;
    return successResponse(res, await sessionPayload(session));
  } catch (error) {
    console.error('Get AI organization setup session error:', error.message);
    return errorResponse(res, 'Unable to retrieve the organization setup draft.', 500);
  }
};

const analyze = async (req, res) => {
  let session;
  try {
    session = await requireSession(req, res); if (!session) return;
    if (session.status === 'published') return errorResponse(res, 'This organization setup draft has already been published.', 409);
    if (stillAnalyzing(session)) return errorResponse(res, STILL_READING, 409, { code: 'ANALYSIS_RUNNING' });
    const files = Array.isArray(req.files) ? req.files : [];
    // Guided setup can read the sheet it already stored again, without a new upload.
    const reuseStored = !files.length && Boolean(session.onboarding_draft) && onboarding.hasEvidence(session);
    if (!files.length && !reuseStored) return errorResponse(res, 'Upload at least one PDF, Word, text, or spreadsheet document.', 400);
    if (session.onboarding_draft) {
      if (!reuseStored) {
        try { await onboarding.keepEvidence(session, files); }
        catch (readError) { return errorResponse(res, readError.statusCode ? readError.message : 'This document could not be read. Try another file.', 400); }
      }
      await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'analyzing', error_message: null });
      session = await OrganizationAiSetupModel.getSession(session.organization_ai_setup_session_id, req.user.entityCode);
      startAnalysis(session);
      return successResponse(res, await sessionPayload(session), 'Reading your document.', 202);
    }
    const unsupported = files.find((file) => !isSupportedAiDocument(file));
    if (unsupported) return errorResponse(res, `${unsupported.originalname} is not supported here. Upload a PDF, Word, text, or spreadsheet document.`, 400);
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'analyzing', error_message: null });
    const currentNodes = await attachUsageProtection(
      await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id)
    );
    const rootEntityName = await getOrgName(session.root_entity_type, session.root_entity_code);
    const result = await analyzeDocuments({ files, accountType: session.account_type, rootEntityType: session.root_entity_type, rootEntityName, currentNodes });
    const protectedResult = restoreProtectedNodes(result.nodes, currentNodes);
    await storeGeneratedDraft(session, protectedResult.nodes, result.draft);
    if (protectedResult.restored) {
      result.warnings = [...new Set([...(result.warnings || []), 'Some requested changes were skipped because those organization entities are already used by another Audito function.'])].slice(0, 30);
    }
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, {
      status: 'ready', model_name: result.model, summary: result.summary, warnings_json: result.warnings, error_message: null,
    });
    session = await OrganizationAiSetupModel.getSession(session.organization_ai_setup_session_id, req.user.entityCode);
    const assistantMessage = result.message || (result.summary
      ? `Here is what I understood: ${result.summary} Review the proposed tree, then tell me what to correct or re-upload a document to analyze again.`
      : 'I created an organization draft from the uploaded document. Review the tree, ask me to adjust it, or re-upload a document to analyze again.');
    return successResponse(res, { ...(await sessionPayload(session)), assistant_message: assistantMessage }, 'AI organization draft is ready for review.');
  } catch (error) {
    if (session) await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'failed', error_message: 'Analysis could not be completed. Please try another document.' }).catch(() => {});
    console.error('Analyze AI organization setup error:', error.message);
    return errorResponse(res, error.statusCode ? error.message : 'AI could not analyze the uploaded document. Please try another readable document.', error.statusCode || 500);
  } finally {
    for (const file of (Array.isArray(req.files) ? req.files : [])) file.buffer = null;
  }
};

/**
 * POST /api/organization-ai-setup/:id/questions
 * Reads the audit questions from the uploaded sheet onto the saved, verified organization.
 */
const generateQuestions = async (req, res) => {
  try {
    let session = await requireSession(req, res); if (!session) return;
    if (!session.onboarding_draft) return errorResponse(res, 'Questions are read only during guided setup.', 400);
    if (session.status === 'published') return errorResponse(res, 'This setup has already been saved.', 409);
    if (stillAnalyzing(session)) return errorResponse(res, STILL_READING, 409, { code: 'ANALYSIS_RUNNING' });
    if (!onboarding.hasEvidence(session)) return errorResponse(res, 'Upload your audit sheet again so AI can read its questions.', 409, { code: 'EVIDENCE_EXPIRED' });
    const nodes = await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id);
    if (nodes.some((node) => !node.is_removed && !String(node.name || '').trim())) return errorResponse(res, 'Enter a name for every area first.', 400);
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'analyzing', error_message: null });
    session = await OrganizationAiSetupModel.getSession(session.organization_ai_setup_session_id, req.user.entityCode);
    startAnalysis(session, 'questions');
    return successResponse(res, await sessionPayload(session), 'Reading your questions.', 202);
  } catch (error) {
    console.error('Generate AI setup questions error:', error.message);
    return errorResponse(res, 'Unable to read the questions. Try again.', 500);
  }
};

const chat = async (req, res) => {
  try {
    const session = await requireSession(req, res); if (!session) return;
    if (session.status === 'published') return errorResponse(res, 'This organization setup draft has already been published.', 409);
    if (stillAnalyzing(session)) return errorResponse(res, STILL_READING, 409, { code: 'ANALYSIS_RUNNING' });
    const message = String(req.body?.message || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!message || message.length > 2000) return errorResponse(res, 'Enter a setup message with no more than 2,000 characters.', 400);
    const nodes = await attachUsageProtection(
      await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id)
    );
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-10).map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000),
    })).filter((item) => item.content) : [];
    const result = session.onboarding_draft
      ? await onboarding.generateCombinedDraft({ session: await withRootName(session), nodes, message })
      : await refineOrganizationDraft({ message, nodes, messages: history, accountType: session.account_type, rootEntityType: session.root_entity_type, rootEntityName: await getOrgName(session.root_entity_type, session.root_entity_code) });
    const protectedResult = restoreProtectedNodes(result.nodes, nodes);
    await storeGeneratedDraft(session, protectedResult.nodes, result.draft);
    if (protectedResult.restored) {
      result.warnings = [...new Set([...(result.warnings || []), 'Some requested changes were skipped because those organization entities are already used by another Audito function.'])].slice(0, 30);
      result.message = `${result.message} I kept entities that are already in use unchanged.`.trim();
    }
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'ready', model_name: result.model, summary: result.summary, warnings_json: result.warnings, error_message: null });
    const updated = await OrganizationAiSetupModel.getSession(session.organization_ai_setup_session_id, req.user.entityCode);
    return successResponse(res, { ...(await sessionPayload(updated)), assistant_message: result.message }, 'Organization draft updated.');
  } catch (error) {
    console.error('Chat AI organization setup error:', error.message);
    return errorResponse(res, error.statusCode ? error.message : 'AI could not update the organization draft. Please try again.', error.statusCode || 500);
  }
};

const updateDraft = async (req, res) => {
  try {
    const session = await requireSession(req, res); if (!session) return;
    if (session.status === 'published') return errorResponse(res, 'This organization setup draft has already been published.', 409);
    if (stillAnalyzing(session)) return errorResponse(res, STILL_READING, 409, { code: 'ANALYSIS_RUNNING' });
    if (!Array.isArray(req.body?.nodes)) return errorResponse(res, 'Draft nodes are required.', 400);
    const storedNodes = await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id);
    if (session.onboarding_draft && req.body.review_token !== onboarding.reviewToken(session, storedNodes)) {
      return errorResponse(res, 'This draft changed in another tab. Reload the saved draft before applying your changes.', 409);
    }
    const protectedStoredNodes = await attachUsageProtection(storedNodes);
    const storedById = new Map(storedNodes.map((node) => [node.id, node]));
    const incomingIds = new Set(req.body.nodes.map((node) => String(node?.id || '')));
    const missingExisting = storedNodes.find((node) => node.source_edge_id && !incomingIds.has(node.id));
    if (missingExisting) return errorResponse(res, `Existing entity "${missingExisting.name}" cannot be deleted with AI setup. Use Organization Mapping for dependency-aware removal.`, 400);
    // The guided onboarding flow never removes live organization records.
    const removedExisting = session.onboarding_draft && req.body.nodes.find((node) => storedById.get(String(node?.id || ''))?.source_edge_id
      && node?.is_removed && !storedById.get(String(node.id)).is_removed);
    if (removedExisting) return errorResponse(res, `"${removedExisting.name}" is part of your existing organization. Remove it later in Organization Mapping.`, 400);
    const reusableByCodeAndType = new Map(
      storedNodes
        .filter((node) => node.source_entity_code && node.source_edge_id)
        .map((node) => [`${node.entity_type}|${node.source_entity_code}`, node])
    );
    // The entity library can place an owned entity that is not in the current
    // organization tree yet. Resolve those codes on the server instead of
    // trusting the name/type supplied by the browser.
    const requestedByType = new Map();
    for (const node of req.body.nodes) {
      const id = String(node?.id || '');
      const entityType = String(node?.entity_type || '').trim();
      const sourceCode = String(node?.source_entity_code || '').trim();
      if (!sourceCode || storedById.has(id) || reusableByCodeAndType.has(`${entityType}|${sourceCode}`)) continue;
      if (!requestedByType.has(entityType)) requestedByType.set(entityType, new Set());
      requestedByType.get(entityType).add(sourceCode);
    }
    const ownedEntityByCodeAndType = new Map();
    for (const [entityType, requestedCodes] of requestedByType.entries()) {
      const spec = ENTITY_SPECS[entityType];
      const ownerColumn = OWNER_COLUMNS[entityType];
      if (!spec || !ownerColumn || !requestedCodes.size) continue;
      const codes = [...requestedCodes];
      const placeholders = codes.map(() => '?').join(', ');
      const [rows] = await db.query(
        `SELECT \`${spec.codeField}\` AS source_entity_code, name FROM \`${spec.table}\` WHERE \`${ownerColumn}\` = ? AND \`${spec.codeField}\` IN (${placeholders}) AND is_active = TRUE`,
        [session.root_entity_code, ...codes]
      );
      for (const row of rows) {
        ownedEntityByCodeAndType.set(`${entityType}|${row.source_entity_code}`, {
          entity_type: entityType,
          source_entity_code: row.source_entity_code,
          name: row.name,
          baseline_name: row.name,
        });
      }
    }
    const requestedNodes = req.body.nodes.map((node) => {
      const stored = storedById.get(String(node?.id || ''));
      const reusable = !stored && node?.source_entity_code
        ? reusableByCodeAndType.get(`${node.entity_type}|${String(node.source_entity_code).trim()}`)
          || ownedEntityByCodeAndType.get(`${node.entity_type}|${String(node.source_entity_code).trim()}`)
        : null;
      if (!stored && node?.source_entity_code && !reusable) {
        throw new Error('The selected entity is unavailable or does not belong to this organization.');
      }
      return {
        ...node,
        id: node.id || newNodeId(),
        name: reusable?.name || node.name,
        entity_type: reusable?.entity_type || node.entity_type,
        source_entity_code: stored?.source_entity_code || reusable?.source_entity_code || null,
        source_edge_id: stored?.source_edge_id || null,
        reuse_source_node_id: stored?.reuse_source_node_id || (node?.reuse_source_node_id ? String(node.reuse_source_node_id).trim() : null),
        baseline_name: stored?.baseline_name || reusable?.baseline_name || reusable?.name || null,
        baseline_parent_id: stored?.baseline_parent_id || null,
        is_ai_generated: stored ? stored.is_ai_generated : node.is_ai_generated,
        is_removed: Boolean(node?.is_removed),
      };
    });
    let combinedNodes = requestedNodes;
    if (session.onboarding_draft) {
      // Removed new areas were never live; drop them instead of validating them.
      combinedNodes = requestedNodes.filter((node) => !node.is_removed || node.source_edge_id);
      const unnamed = combinedNodes.find((node) => !String(node.name || '').trim());
      if (unnamed) return errorResponse(res, `Enter a name for every organization area. A ${unnamed.entity_type || 'new'} area has no name.`, 400);
    }
    const nodes = validateNodes(
      session.onboarding_draft ? combinedNodes : reconcileExistingEntityPlacements(requestedNodes, protectedStoredNodes),
      session.account_type,
      session.root_entity_type,
      { strictHierarchy: !session.onboarding_draft, allowEmpty: Boolean(session.onboarding_draft) }
    );
    const protectionById = new Map(protectedStoredNodes.map((node) => [node.id, node]));
    const protectedIncomingNodes = nodes.map((node) => {
      const protection = protectionById.get(node.id);
      return protection ? { ...node, is_locked: protection.is_locked, lock_reasons: protection.lock_reasons } : node;
    });
    const usageError = protectedChangeError(protectedIncomingNodes);
    if (usageError) return errorResponse(res, usageError, 409);
    const lockedCodes = new Set(protectedStoredNodes.filter((node) => node.is_locked).map((node) => node.source_entity_code).filter(Boolean));
    const lockedNames = new Set(protectedStoredNodes.filter((node) => node.is_locked).map((node) => `${node.entity_type}|${String(node.baseline_name || node.name).trim().toLowerCase()}`));
    const blockedPlacement = nodes.find((node) => !storedById.has(node.id) && (
      lockedCodes.has(node.source_entity_code)
      || lockedNames.has(`${node.entity_type}|${String(node.name).trim().toLowerCase()}`)
    ));
    if (blockedPlacement) {
      return errorResponse(res, `"${blockedPlacement.name}" is already used by Audito and its hierarchy placements cannot be changed.`, 409);
    }
    const warnings = Array.isArray(req.body?.warnings) ? req.body.warnings.map((value) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500)).filter(Boolean).slice(0, 30) : session.warnings;
    const summary = String(req.body?.summary || session.summary || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    let combinedDraft;
    if (session.onboarding_draft) {
      combinedDraft = onboarding.normalizeDraft(req.body.onboarding_draft || session.onboarding_draft);
      const originalQuestions = new Map(session.onboarding_draft.questions.map(q => [q.id, q]));
      // The question text keeps its document source when the user only sets the
      // area, answer type or scores; those details are labelled separately.
      combinedDraft.questions = combinedDraft.questions.map(q => {
        const previous = originalQuestions.get(q.id);
        const textSame = previous && q.question_text === previous.question_text;
        const detailsSame = previous && ['node_id', 'answer_type', 'options'].every(key => JSON.stringify(q[key]) === JSON.stringify(previous[key]));
        return { ...q, origin: textSame ? previous.origin : 'manual', source_reference: textSame ? previous.source_reference : '',
          details_origin: detailsSame ? previous.details_origin || 'unknown' : 'manual' };
      });
      combinedDraft.node_evidence = Object.fromEntries(nodes.map(node => {
        const previous = storedById.get(node.id);
        return [node.id, previous && previous.name === node.name && previous.parent_id === node.parent_id
          ? session.onboarding_draft.node_evidence?.[node.id] || { origin: 'existing', source_reference: '' }
          : { origin: 'manual', source_reference: '' }];
      }));
      if (JSON.stringify(combinedDraft.checklist) !== JSON.stringify(session.onboarding_draft.checklist)) combinedDraft.checklist.source_reference = 'Manually reviewed';
    }
    await storeGeneratedDraft(session, nodes, combinedDraft);
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'ready', summary, warnings_json: warnings, error_message: null });
    const updated = await OrganizationAiSetupModel.getSession(session.organization_ai_setup_session_id, req.user.entityCode);
    return successResponse(res, await sessionPayload(updated), 'Organization draft saved.');
  } catch (error) {
    console.error('Update AI organization setup draft error:', error.message);
    return errorResponse(res, error.message || 'Unable to save the organization draft.', error.code === 'AI_SETUP_PLAN_LIMIT' ? 403 : 400);
  }
};

const discard = async (req, res) => {
  try {
    const session = await requireSession(req, res); if (!session) return;
    if (session.status === 'published') return errorResponse(res, 'A published organization draft cannot be discarded.', 409);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'discarded', error_message: null }, connection);
      await OrganizationAiSetupModel.clearNodes(session.organization_ai_setup_session_id, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    onboarding.clearEvidence(session);
    return successResponse(res, null, 'Organization draft discarded.');
  } catch (error) {
    console.error('Discard AI organization setup draft error:', error.message);
    return errorResponse(res, 'Unable to discard the organization draft.', 500);
  }
};

async function nextEntityCode(connection, spec, counters) {
  if (counters.has(spec.table)) {
    const next = counters.get(spec.table) + 1; counters.set(spec.table, next);
    return `${spec.prefix}-${String(next).padStart(5, '0')}`;
  }
  // The start position is a literal number: as a bound parameter PostgreSQL
  // reads SUBSTRING(text, ?) as the regex form, which case-insensitive columns reject.
  const [rows] = await connection.query(
    `SELECT MAX(CAST(SUBSTRING(\`${spec.codeField}\`, ${spec.prefix.length + 2}) AS UNSIGNED)) AS max_num
       FROM \`${spec.table}\`
      WHERE \`${spec.codeField}\` REGEXP ?`,
    [`^${spec.prefix}-[0-9]+$`]
  );
  const next = Number(rows[0]?.max_num || 0) + 1; counters.set(spec.table, next);
  return `${spec.prefix}-${String(next).padStart(5, '0')}`;
}

function findStorageParent(node, directParent, created, byId, root) {
  const requiredType = STORAGE_PARENT_TYPES[node.entity_type];
  if (!requiredType) return null;
  let candidate = directParent || root;
  while (candidate) {
    if (candidate.entity_type === requiredType) return candidate;
    const draftNode = candidate.id ? byId.get(candidate.id) : null;
    candidate = draftNode?.parent_id ? created.get(draftNode.parent_id) || null : (candidate === root ? null : root);
  }
  return null;
}

async function insertEntity(connection, node, storageParent, rootCode, counters) {
  const spec = ENTITY_SPECS[node.entity_type];
  const ownerColumn = OWNER_COLUMNS[node.entity_type];
  const existing = await findDuplicateName({ db: connection, table: spec.table, nameColumn: 'name', name: node.name,
    idColumn: spec.codeField, whereClauses: [`\`${ownerColumn}\` = ?`, 'is_active = TRUE'], whereParams: [rootCode] });
  // A matching entity may already exist in Entity Setup but not yet be mapped.
  // Reuse that record and let the caller create only the hierarchy placement.
  if (existing) return { code: existing.id, reusedExisting: true };
  const code = await nextEntityCode(connection, spec, counters);
  const parentCode = storageParent?.code || null;
  const statements = {
    'Buying Office': ['INSERT INTO customer_buying_offices (name, cust_code, cbo_code) VALUES (?, ?, ?)', [node.name, rootCode, code]],
    Supplier: ['INSERT INTO customer_suppliers (name, cust_code, cbo_code, csup_code) VALUES (?, ?, ?, ?)', [node.name, rootCode, parentCode, code]],
    Cluster: ['INSERT INTO company_clusters (name, comp_code, comp_clus_code) VALUES (?, ?, ?)', [node.name, rootCode, code]],
    Factory: ['INSERT INTO company_factories (name, comp_code, comp_clus_code, comp_fact_code) VALUES (?, ?, ?, ?)', [node.name, rootCode, parentCode, code]],
    Unit: ['INSERT INTO company_units (name, comp_code, comp_fact_code, comp_unit_code) VALUES (?, ?, ?, ?)', [node.name, rootCode, parentCode, code]],
    Department: ['INSERT INTO company_departments (name, comp_code, comp_unit_code, comp_dept_code) VALUES (?, ?, ?, ?)', [node.name, rootCode, parentCode, code]],
    Section: ['INSERT INTO company_sections (name, comp_code, comp_dept_code, comp_section_code) VALUES (?, ?, ?, ?)', [node.name, rootCode, parentCode, code]],
    Branch: ['INSERT INTO audit_firm_company_branches (name, afc_code, afc_branch_code) VALUES (?, ?, ?)', [node.name, rootCode, code]],
    'Audit Firm Department': ['INSERT INTO audit_firm_company_departments (name, afc_code, afc_branch_code, afc_dept_code) VALUES (?, ?, ?, ?)', [node.name, rootCode, parentCode, code]],
  };
  await connection.query(statements[node.entity_type][0], statements[node.entity_type][1]);
  return { code, reusedExisting: false };
}

const publish = async (req, res) => {
  let connection;
  let checklistLock;
  const structureLocks = [];
  try {
    const session = await requireSession(req, res); if (!session) return;
    if (session.status === 'published') {
      onboarding.clearEvidence(session);
      return successResponse(res, { checklist_id: session.published_checklist_id, already_published: true }, 'Your setup is already saved.');
    }
    if (stillAnalyzing(session)) return errorResponse(res, STILL_READING, 409, { code: 'ANALYSIS_RUNNING' });
    if (session.onboarding_draft) checklistLock = await LimitsEnforcer.acquireQuotaLock(session.root_entity_code, 'checklist');
    for (const type of Object.keys(DEPARTMENT_STORAGE)) structureLocks.push(await LimitsEnforcer.acquireQuotaLock(session.root_entity_code, `structure:${type}`));
    let nodes, activeNodes;
    try {
      const storedNodes = await attachUsageProtection(
        await OrganizationAiSetupModel.listNodes(session.organization_ai_setup_session_id)
      );
      if (session.onboarding_draft && req.body?.review_token !== onboarding.reviewToken(session, storedNodes)) {
        return errorResponse(res, 'Review the current organization and checklist together before saving. The draft may have changed in another tab.', 409);
      }
      const usageError = protectedChangeError(storedNodes);
      if (usageError) return errorResponse(res, usageError, 409);
      const lockedExistingNodes = storedNodes.filter((node) => node.is_locked && node.source_edge_id);
      const lockedCodes = new Set(lockedExistingNodes.map((node) => node.source_entity_code).filter(Boolean));
      const lockedNames = new Set(lockedExistingNodes.map((node) => `${node.entity_type}|${String(node.baseline_name || node.name).trim().toLowerCase()}`));
      const blockedPlacement = storedNodes.find((node) => !node.source_edge_id && (
        lockedCodes.has(node.source_entity_code)
        || lockedNames.has(`${node.entity_type}|${String(node.name).trim().toLowerCase()}`)
      ));
      if (blockedPlacement) return errorResponse(res, `"${blockedPlacement.name}" is already used by Audito and its hierarchy placements cannot be changed.`, 409);
      nodes = validateNodes(storedNodes, session.account_type, session.root_entity_type, { strictHierarchy: true, allowEmpty: Boolean(session.onboarding_draft) });
      activeNodes = validateNodes(nodes.filter((node) => !node.is_removed), session.account_type, session.root_entity_type, { allowEmpty: true, strictHierarchy: true });
      if (session.onboarding_draft) onboarding.validateChecklist(session.onboarding_draft, activeNodes);
    } catch (validationError) {
      return errorResponse(res, validationError.message || 'Correct the organization hierarchy before applying it.', 400);
    }
    const byAllIds = new Map(nodes.map((node) => [node.id, node]));
    // Determine removal roots from the original live hierarchy. Draft parents
    // may have changed, but deletion must always target the stable source edge.
    const removedRoots = nodes.filter((node) => node.is_removed
      && node.source_edge_id
      && !byAllIds.get(node.baseline_parent_id)?.is_removed);
    for (const node of removedRoots) {
      const affectedEdgeIds = await OrganizationTreeModel.getDescendantEdgeIds(node.source_edge_id);
      const linked = await LinkModel.findActiveByTargetTreeIds(affectedEdgeIds);
      if (linked) return errorResponse(res, `"${node.name}" is used by an active organization link. Remove that link before applying this draft.`, 403);
      if (await OrganizationTreeModel.hasDependencies(node.source_edge_id)) {
        return errorResponse(res, `"${node.name}" or its branch is used by a user, checklist, or active audit. Remove those assignments before applying this draft.`, 400);
      }
    }
    const existingNames = new Map();
    for (const node of activeNodes.filter((item) => item.source_entity_code)) {
      const key = `${node.entity_type}|${node.source_entity_code}`;
      if (existingNames.has(key) && existingNames.get(key) !== node.name) {
        return errorResponse(res, `"${node.baseline_name}" appears in more than one branch and must use the same updated name everywhere.`, 400);
      }
      existingNames.set(key, node.name);
    }
    const placementKeys = new Set();
    const placementNames = new Set();
    for (const node of activeNodes) {
      const entityIdentity = node.source_entity_code || node.reuse_source_node_id || node.id;
      const placementKey = `${node.entity_type}|${entityIdentity}|${node.parent_id || 'root'}`;
      const nameKey = `${node.entity_type}|${normalizeEntityName(node.name)}|${node.parent_id || 'root'}`;
      if (placementKeys.has(placementKey) || placementNames.has(nameKey)) {
        return errorResponse(res, `"${node.name}" is already placed under that parent.`, 400);
      }
      placementKeys.add(placementKey);
      placementNames.add(nameKey);
    }
    connection = await db.getConnection(); await connection.beginTransaction();
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'publishing', error_message: null }, connection);
    await enforceDepartmentPlanLimit(session, activeNodes, connection);
    const byId = new Map(activeNodes.map((node) => [node.id, node]));
    const root = { entity_type: session.root_entity_type, code: session.root_entity_code };
    const created = new Map(), remaining = new Set(activeNodes.map((node) => node.id)), counters = new Map();
    let createdCount = 0, updatedCount = 0;
    while (remaining.size) {
      let progressed = false;
      for (const id of [...remaining]) {
        const node = byId.get(id), parent = node.parent_id ? created.get(node.parent_id) : null;
        if (node.parent_id && !parent) continue;
        const reusedEntity = node.reuse_source_node_id ? created.get(node.reuse_source_node_id) : null;
        if (node.reuse_source_node_id && !reusedEntity) continue;
        const storageParent = findStorageParent(node, parent, created, byId, root);
        let code, edgeId;
        if (node.source_entity_code && node.source_edge_id) {
          const spec = ENTITY_SPECS[node.entity_type];
          const [edgeRows] = await connection.query(
            'SELECT * FROM organization_tree WHERE org_tree_id = ? AND child_code = ? AND root_entity_code = ? AND is_active = TRUE LIMIT 1',
            [node.source_edge_id, node.source_entity_code, session.root_entity_code]
          );
          if (!edgeRows[0]) throw new Error(`Existing organization reference for "${node.name}" is no longer available.`);
          code = node.source_entity_code;
          edgeId = node.source_edge_id;
          if (node.name !== node.baseline_name) {
            const duplicate = await findDuplicateName({ db: connection, table: spec.table, nameColumn: 'name', name: node.name,
              idColumn: spec.codeField, excludeId: code, whereClauses: [`\`${OWNER_COLUMNS[node.entity_type]}\` = ?`, 'is_active = TRUE'], whereParams: [session.root_entity_code] });
            if (duplicate) throw new Error(`An organization area named "${duplicate.name}" already exists.`);
          }
          await connection.query(`UPDATE \`${spec.table}\` SET name = ? WHERE \`${spec.codeField}\` = ?`, [node.name, code]);
          const parentColumn = STORAGE_PARENT_COLUMNS[node.entity_type];
          if (parentColumn) await connection.query(`UPDATE \`${spec.table}\` SET \`${parentColumn}\` = ? WHERE \`${spec.codeField}\` = ?`, [storageParent?.code || null, code]);
          await connection.query(
            'UPDATE organization_tree SET parent_type = ?, parent_code = ?, parent_edge_id = ? WHERE org_tree_id = ? AND root_entity_code = ?',
            [parent?.entity_type || session.root_entity_type, parent?.code || session.root_entity_code, parent?.edge_id || null, edgeId, session.root_entity_code]
          );
          if (node.name !== node.baseline_name || (node.parent_id || null) !== (node.baseline_parent_id || null)) updatedCount += 1;
        } else if (reusedEntity || node.source_entity_code) {
          const spec = ENTITY_SPECS[node.entity_type];
          const ownerColumn = OWNER_COLUMNS[node.entity_type];
          code = reusedEntity?.code || node.source_entity_code;
          if (!reusedEntity) {
            const [entityRows] = await connection.query(
              `SELECT 1 FROM \`${spec.table}\` WHERE \`${spec.codeField}\` = ? AND \`${ownerColumn}\` = ? AND is_active = TRUE LIMIT 1`,
              [code, session.root_entity_code]
            );
            if (!entityRows[0]) throw new Error(`Reusable organization entity "${node.name}" is no longer available.`);
          }
          edgeId = await generateTableId('organization_tree', 'org_tree_id', 'OT', 4, connection);
          await connection.query(
            `INSERT INTO organization_tree (org_tree_id, parent_type, parent_code, child_type, child_code, created_by, root_entity_code, parent_edge_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [edgeId, parent?.entity_type || session.root_entity_type, parent?.code || session.root_entity_code, node.entity_type, code, req.user.userCode, session.root_entity_code, parent?.edge_id || null]
          );
          createdCount += 1;
        } else {
          const insertedEntity = await insertEntity(connection, node, storageParent, session.root_entity_code, counters);
          code = insertedEntity.code;
          edgeId = await generateTableId('organization_tree', 'org_tree_id', 'OT', 4, connection);
          await connection.query(
            `INSERT INTO organization_tree (org_tree_id, parent_type, parent_code, child_type, child_code, created_by, root_entity_code, parent_edge_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [edgeId, parent?.entity_type || session.root_entity_type, parent?.code || session.root_entity_code, node.entity_type, code, req.user.userCode, session.root_entity_code, parent?.edge_id || null]
          );
          createdCount += 1;
        }
        created.set(id, { ...node, code, edge_id: edgeId }); remaining.delete(id); progressed = true;
      }
      if (!progressed) throw new Error('The organization draft could not be ordered for publishing.');
    }
    for (const node of removedRoots) {
      await connection.query(
        `WITH RECURSIVE subtree AS (
          SELECT org_tree_id FROM organization_tree
           WHERE org_tree_id = ? AND root_entity_code = ?
          UNION ALL
          SELECT ot.org_tree_id FROM organization_tree ot
          INNER JOIN subtree s ON ot.parent_edge_id = s.org_tree_id
           WHERE ot.root_entity_code = ? AND ot.is_active = TRUE
        )
        DELETE FROM organization_tree
         WHERE root_entity_code = ?
           AND org_tree_id IN (SELECT org_tree_id FROM subtree)`,
        [node.source_edge_id, session.root_entity_code, session.root_entity_code, session.root_entity_code]
      );
    }
    const checklistId = session.onboarding_draft ? await publishChecklist(connection, session, activeNodes, created) : null;
    await OrganizationAiSetupModel.updateSession(session.organization_ai_setup_session_id, { status: 'published', published_at: new Date(), published_checklist_id: checklistId }, connection);
    await connection.commit();
    onboarding.clearEvidence(session);
    const removedCount = nodes.filter((node) => node.is_removed && node.source_entity_code).length;
    return successResponse(res, { created_count: createdCount, updated_count: updatedCount, removed_count: removedCount, checklist_id: checklistId }, 'Your setup was saved.', 201);
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    await OrganizationAiSetupModel.updateSession(req.params.id, { status: 'ready', error_message: 'Publishing failed. No organization changes were saved.' }).catch(() => {});
    console.error('Publish AI organization setup error:', error.message);
    if (error.code === 'AI_SETUP_PLAN_LIMIT') return errorResponse(res, error.message, 403);
    if (!error.code) return errorResponse(res, error.message || 'Unable to save setup. No changes were saved.', error.statusCode || 400);
    return errorResponse(res, error.code === '23505' || error.code === 'AI_SETUP_DUPLICATE_NAME' ? 'A matching organization entity already exists. Rename the draft node and try again.' : 'Unable to publish the organization draft. No changes were saved.', 500);
  } finally { if (connection) connection.release(); for (const lock of structureLocks.reverse()) await lock.release(); if (checklistLock) await checklistLock.release(); }
};

module.exports = { createSession, getCurrentSession, getCompletion, getSession, analyze, generateQuestions, chat, updateDraft, discard, publish, removeFinishedSetupSheets };
