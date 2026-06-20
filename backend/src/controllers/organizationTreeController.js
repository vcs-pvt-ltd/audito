/**
 * Organization Tree Controller
 *
 * Lets admins manually build their organization tree by linking
 * independently created entities.
 *
 * Endpoints:
 *   GET    /api/org-tree                      Full nested tree for current admin
 *   POST   /api/org-tree                      Add a child under a parent
 *   DELETE /api/org-tree/:id                   Remove a tree edge
 *   GET    /api/org-tree/entities/:entityType  List all entities of a type (for selection)
 */

const OrganizationTreeModel = require('../models/OrganizationTreeModel');
const LinkModel = require('../models/LinkModel');
const { db } = require('../config/db');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const { getAccessibleEntityCodes, getEntityHeadOrgTreeScope, extractEntityHeadSubtree } = require('../utils/accessHelper');
const { isCompanySupplierLink } = require('../utils/linkRules');

// ─── Entity table config (type → table + code field) ─────────────

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
  'Audit Firm Department': { table: 'audit_firm_company_departments', codeField: 'afc_dept_code' }
};

const DEFAULT_HIERARCHIES = {
  'Customer': ["Buying Office", "Supplier"],
  'Company': ["Cluster", "Factory", "Unit", "Department", "Section"],
  'Audit Firm': ["Branch", "Audit Firm Department"],
};

function normalizeAccountType(entityType, accountType) {
  if (entityType === 'Audit Firm Company' || entityType === 'Audit Firm') return 'Audit Firm';
  return accountType;
}

// ─── Entity table config (type → table + code field) ─────────────
const PARTNER_ACCOUNT_OWNER_FIELD = {
  Customer: 'cust_code',
  'Buying Office': 'cust_code',
  Supplier: 'cust_code',
  Company: 'comp_code',
  'Audit Firm Company': 'afc_code',
};

// Entity type (title-case) → which owner columns exist in that table
const ENTITY_TYPE_OWNER_FIELDS = {
  'Buying Office': ['cust_code'],
  'Supplier': ['cust_code', 'cbo_code'],
  'Company': ['cust_code'],
  'Cluster': ['cust_code', 'comp_code'],
  'Factory': ['cust_code', 'comp_code'],
  'Unit': ['cust_code', 'comp_code'],
  'Department': ['cust_code', 'comp_code'],
  'Section': ['cust_code', 'comp_code'],
  'Branch': ['afc_code'],
  'Audit Firm Department': ['afc_code', 'afc_branch_code']
};

// ─── Helpers ──────────────────────────────────────────────────────

async function resolveEntity(type, code) {
  const config = ENTITY_TABLE_MAP[type];
  if (!config) return null;
  const [rows] = await db.query(
    `SELECT * FROM \`${config.table}\` WHERE \`${config.codeField}\` = ? AND is_active = TRUE`,
    [code]
  );
  return rows[0] || null;
}

async function resolveEntityType(code) {
  for (const [type, config] of Object.entries(ENTITY_TABLE_MAP)) {
    const [rows] = await db.query(
      `SELECT \`${config.codeField}\` FROM \`${config.table}\` WHERE \`${config.codeField}\` = ? AND is_active = TRUE`,
      [code]
    );
    if (rows.length > 0) return type;
  }
  return null;
}

/**
 * Returns all linked partner entity codes (bidirectional).
 * Whether this admin is the requester OR the target in an accepted link,
 * the partner's root_entity_code must be included so both sides can see
 * edges the other admin added to the shared subtree.
 */
async function getLinkedPartnerCodes(entityType, entityCode) {
  const links = await LinkModel.getAcceptedLinks(entityType, entityCode);
  return links.map(l =>
    l.requester_code === entityCode ? l.target_code : l.requester_code
  );
}

async function ensureCompanySupplierLinkEdges(entityType, entityCode, createdBy) {
  if (!['Company', 'Supplier'].includes(entityType)) return;

  const links = await LinkModel.getAcceptedLinks(entityType, entityCode);
  for (const link of links) {
    if (!isCompanySupplierLink(link.requester_type, link.target_type)) continue;

    const supplierCode = link.requester_type === 'Supplier' ? link.requester_code : link.target_code;
    const companyCode = link.requester_type === 'Company' ? link.requester_code : link.target_code;

    // Only the Supplier (target) tree shows the linked Company (requester).
    const supplierTreeEdge = await OrganizationTreeModel.findEdgeForRoot(
      supplierCode, companyCode, supplierCode
    );
    if (!supplierTreeEdge) {
      await OrganizationTreeModel.addNode({
        parent_type: 'Supplier',
        parent_code: supplierCode,
        child_type: 'Company',
        child_code: companyCode,
        created_by: createdBy,
        root_entity_code: supplierCode,
      });
    }

    // The Company (requester) tree must NOT show the Supplier (target).
    // Drop any legacy reverse edge that was previously created.
    const companyTreeEdge = await OrganizationTreeModel.findEdgeForRoot(
      companyCode, supplierCode, companyCode
    );
    if (companyTreeEdge) {
      await OrganizationTreeModel.removeNode(companyTreeEdge.id);
    }
  }
}

function getAllowedChildrenMap(accountType) {
  const chain = DEFAULT_HIERARCHIES[accountType] || [];
  const allowed = {};
  if (accountType === 'Customer') allowed['Customer'] = chain.length > 0 ? [chain[0]] : [];
  else if (accountType === 'Company') allowed['Company'] = chain.length > 0 ? [chain[0]] : [];
  else if (accountType === 'Audit Firm') allowed['Audit Firm Company'] = chain.length > 0 ? [chain[0]] : [];
  for (let i = 0; i < chain.length; i++) {
    allowed[chain[i]] = i < chain.length - 1 ? [chain[i + 1]] : [];
  }
  return allowed;
}

// ─── GET TREE ─────────────────────────────────────────────────────

const getTree = async (req, res) => {
  try {
    const entityCode = req.user.role === 'entity_head'
      ? (req.user.createdByEntityCode || req.user.entityCode)
      : req.user.entityCode;
    const entityType = req.user.role === 'entity_head'
      ? await resolveEntityType(entityCode)
      : req.user.entityType;

    const root = await resolveEntity(entityType, entityCode);
    if (!root) return errorResponse(res, 'Organization not found.', 404);

    await ensureCompanySupplierLinkEdges(entityType, entityCode, req.user.userCode);

    // Build allowed root codes: own code + linked partner scopes per link rules.
    const allowedRootCodes = await getAccessibleEntityCodes(entityCode, entityType);

    const accType = normalizeAccountType(entityType, req.user.accountType);
    const hierarchyChain = DEFAULT_HIERARCHIES[accType] || [];
    const allowedChildren = getAllowedChildrenMap(accType);

    // Get descendant edges visible in the context of our entity
    const edges = await OrganizationTreeModel.getTreeDescendants(entityCode, allowedRootCodes);

    // Collect all unique entity codes
    const entityCodes = new Map();
    entityCodes.set(entityCode, entityType);
    for (const edge of edges) {
      entityCodes.set(edge.child_code, edge.child_type);
    }

    // Resolve all entities
    const entities = {};
    for (const [code, type] of entityCodes) {
      const entity = await resolveEntity(type, code);
      const cf = ENTITY_TABLE_MAP[type] ? ENTITY_TABLE_MAP[type].codeField : null;
      entities[code] = entity && cf ? { ...entity, entity_type: type, code: entity[cf] } : null;
    }

    // Build nested tree.
    // IMPORTANT: When looking for children of a given parent, we must only consider
    // edges that share the same root_entity_code as the edge that brought us to this
    // parent node. This prevents a shared child (e.g. Dept A under both Unit 1 and Unit 2)
    // from leaking its sub-entries into a path where they were never explicitly added.
    // Identify which nodes are partner roots for the frontend
    const partnerCodes = await getLinkedPartnerCodes(entityType, entityCode);
    const partnerSet = new Set(partnerCodes);

    // Build a lookup: edge_path → child edges that extend it
    // i.e., a child edge's edge_path starts with the parent edge's edge_path

    // Build a map from edge_path → child edge rows for fast lookup
    // edge_path of a child = parent's edge_path + ',' + child.id
    // For top-level children of root, edge_path = just their own id (no comma prefix)
    const edgePathMap = new Map(); // parentEdgePath (or 'ROOT') → array of child edge rows

    for (const edge of edges) {
      const parts = edge.edge_path.split(',');
      // Parent path = everything except the last segment
      const parentPath = parts.length === 1 ? 'ROOT' : parts.slice(0, -1).join(',');
      if (!edgePathMap.has(parentPath)) edgePathMap.set(parentPath, []);
      edgePathMap.get(parentPath).push(edge);
    }

    function buildChildren(currentEdgePath, pathCodes = new Set()) {
      const childEdges = edgePathMap.get(currentEdgePath) || [];

      return childEdges
        .filter(edge => !pathCodes.has(edge.child_code)) // prevent cycles
        .map(edge => {
          const entity = entities[edge.child_code] || {};
          const newPath = new Set(pathCodes);
          newPath.add(edge.child_code);
          return {
            edge_id: edge.id,
            ...entity,
            is_partner_root: partnerSet.has(edge.child_code),
            children: buildChildren(edge.edge_path, newPath) // recurse using THIS edge's path
          };
        });
    }

    let tree = {
      ...entities[entityCode],
      children: buildChildren('ROOT', new Set([entityCode])) // top-level children have no parent path
    };

    if (req.user.role === 'entity_head') {
      const scopeIds = await getEntityHeadOrgTreeScope(req.user.assignedOrgTreeId);
      tree = extractEntityHeadSubtree(tree, req.user.assignedOrgTreeId, scopeIds) || tree;

      if ((!req.user.assignedOrgTreeId || !scopeIds.length) && req.user.assignedEntityCode) {
        const findByCode = (node) => {
          if (!node) return null;
          if (node.code === req.user.assignedEntityCode) return node;
          for (const child of node.children || []) {
            const found = findByCode(child);
            if (found) return found;
          }
          return null;
        };
        tree = findByCode(tree) || tree;
      }
    }

    return successResponse(res, { tree, hierarchyChain, allowedChildren });

  } catch (error) {
    console.error('Get tree error:', error);
    return errorResponse(res, 'Failed to fetch organization tree.', 500);
  }
};


// ─── ADD NODE ─────────────────────────────────────────────────────

const addNode = async (req, res) => {
  try {
    const { parent_code, child_type, child_code } = req.body;

    const missing = validateRequiredFields(req.body, ['parent_code', 'child_type', 'child_code']);
    if (missing) return errorResponse(res, missing, 400);

    const adminCode = req.user.entityCode;
    const adminType = req.user.entityType;

    const accType = normalizeAccountType(adminType, req.user.accountType);
    const allowedChildrenMap = getAllowedChildrenMap(accType);

    const parentType = adminCode === parent_code
      ? adminType
      : await resolveEntityType(parent_code);

    if (!parentType) return errorResponse(res, 'Parent entity not found.', 404);

    const allowed = allowedChildrenMap[parentType] || [];
    if (!allowed.includes(child_type)) {
      return errorResponse(
        res,
        `"${child_type}" cannot be added under "${parentType}". Allowed: ${allowed.join(', ') || 'none'}`,
        400
      );
    }

    const child = await resolveEntity(child_type, child_code);
    if (!child) return errorResponse(res, 'Child entity not found.', 404);

    const linkedPartnerCodes = await getLinkedPartnerCodes(adminType, adminCode);
    const allowedRootCodes = [adminCode, ...linkedPartnerCodes];
    const descendants = await OrganizationTreeModel.getTreeDescendants(adminCode, allowedRootCodes);

    if (adminCode !== parent_code) {
      const inTree = descendants.some(d => d.child_code === parent_code);
      if (!inTree) return errorResponse(res, 'Parent is not in your organization tree.', 403);
    }

    // ── Find the parent_edge_id ──────────────────────────────────────
    // The edge that represents the parent node in THIS tree context.
    // For the root node itself (adminCode), there's no edge — use null.
    let parent_edge_id = null;
    if (adminCode !== parent_code) {
      const parentEdge = descendants.find(d => d.child_code === parent_code);
      parent_edge_id = parentEdge ? parentEdge.id : null;
    }
    // ─────────────────────────────────────────────────────────────────

    // Check duplicate: same parent_edge_id + child_code
    const existing = await OrganizationTreeModel.findEdgeByParentEdgeAndChild(
      parent_edge_id,
      parent_code,
      child_code,
      allowedRootCodes
    );
    if (existing) return errorResponse(res, 'This relationship already exists in the tree.', 409);

    const id = await OrganizationTreeModel.addNode({
      parent_type: parentType,
      parent_code,
      child_type,
      child_code,
      created_by: req.user.userCode,
      root_entity_code: adminCode,
      parent_edge_id  // ← pass it
    });

    return successResponse(res, {
      id,
      parent_type: parentType,
      parent_code,
      child_type,
      child_code
    }, 'Node added to organization tree.', 201);

  } catch (error) {
    console.error('Add tree node error:', error);
    return errorResponse(res, 'Failed to add node.', 500);
  }
};

// ─── REMOVE NODE ──────────────────────────────────────────────────

const removeNode = async (req, res) => {
  try {
    const { id } = req.params;

    const edge = await OrganizationTreeModel.findById(id);
    if (!edge) return errorResponse(res, 'Tree relationship not found.', 404);

    const adminCode = req.user.entityCode;
    const adminType = req.user.entityType;

    // Fetch linked partner codes once — used for both checks below
    const partnerCodes = await getLinkedPartnerCodes(adminType, adminCode);

    // Block removal of the auto-created link edge (child_code IS a linked entity root).
    // That edge was created by the link system and must be removed by removing the link itself.
    if (partnerCodes.includes(edge.child_code)) {
      return errorResponse(res, 'This is a linked entity. Remove the link to detach it from the tree.', 403);
    }

    // Verify admin has access — edge must belong to this admin's tree OR a linked partner's tree
    if (edge.root_entity_code !== adminCode && !partnerCodes.includes(edge.root_entity_code)) {
      return errorResponse(res, 'Not authorized to modify this tree.', 403);
    }

    // Dependency check: block if users/heads or checklists exist
    const hasDeps = await OrganizationTreeModel.hasDependencies(id);
    if (hasDeps) {
      return errorResponse(res, 'This entity is in use by users (Entity Heads) or checklists and cannot be removed here. Remove dependencies first.', 400);
    }

    // Scope the subtree delete to the edge's own root — NOT adminCode.
    // When a target admin removes a requester-owned edge the root differs from adminCode,
    // so we must pass edge.root_entity_code or the DELETE will find nothing.
    await OrganizationTreeModel.removeSubtree(id, edge.child_code, edge.root_entity_code);
    return successResponse(res, null, 'Node and its sub-tree removed from organization tree.');

  } catch (error) {
    console.error('Remove tree node error:', error);
    return errorResponse(res, 'Failed to remove node.', 500);
  }
};

// ─── LIST ENTITIES OF A TYPE ──────────────────────────────────────

const listEntitiesOfType = async (req, res) => {
  try {
    const { entityType } = req.params;
    const config = ENTITY_TABLE_MAP[entityType];

    if (!config) return errorResponse(res, 'Invalid entity type.', 400);

    const adminCode = req.user.entityCode;
    const accountType = req.user.accountType;
    const normalizedAccountType =
      accountType === 'Audit Firm Company' || accountType === 'Audit Firm'
        ? 'Audit Firm'
        : accountType;

    // Filter entities to only show ones owned by this admin
    let ownerField = null;
    if (normalizedAccountType === 'Customer') {
      // Customer-owned entities use cust_code
      if (['Buying Office', 'Supplier'].includes(entityType)) {
        ownerField = 'cust_code';
      } else if (['Company', 'Cluster', 'Factory', 'Unit', 'Department', 'Section'].includes(entityType)) {
        ownerField = 'cust_code';
      }
    } else if (normalizedAccountType === 'Company') {
      if (['Cluster', 'Factory', 'Unit', 'Department', 'Section'].includes(entityType)) {
        ownerField = 'comp_code';
      }
    } else if (normalizedAccountType === 'Audit Firm') {
      if (entityType === 'Branch' || entityType === 'Audit Firm Department') {
        ownerField = 'afc_code';
      }
    }

    let rows;
    if (ownerField) {
      [rows] = await db.query(
        `SELECT * FROM \`${config.table}\` WHERE \`${ownerField}\` = ? AND is_active = TRUE ORDER BY name`,
        [adminCode]
      );
    } else {
      [rows] = await db.query(
        `SELECT * FROM \`${config.table}\` WHERE is_active = TRUE ORDER BY name`
      );
    }

    // Merge linked entities — two complementary strategies:
    //   1. Tree-based  — via org tree accessible codes (fast path)
    //   2. Owner-based — partner's directly-created entities (works even after tree removal)
    if (ownerField) {
      const existingCodes = new Set(rows.map(r => r[config.codeField]));

      // 1. Tree-based merge
      const accessibleCodes = await getAccessibleEntityCodes(adminCode, req.user.entityType);
      const otherCodes = accessibleCodes.filter(c => c !== adminCode);
      if (otherCodes.length > 0) {
        const placeholders = otherCodes.map(() => '?').join(',');
        const [linkedRows] = await db.query(
          `SELECT * FROM \`${config.table}\` WHERE \`${config.codeField}\` IN (${placeholders}) AND is_active = TRUE`,
          otherCodes
        );
        for (const row of linkedRows) {
          if (!existingCodes.has(row[config.codeField])) {
            rows.push(row);
            existingCodes.add(row[config.codeField]);
          }
        }
      }

      // 2. Owner-based merge: partner's entities by their creator field, independent of org tree
      const links = await LinkModel.getAcceptedLinks(req.user.entityType, adminCode);
      const validOwnerFields = ENTITY_TYPE_OWNER_FIELDS[entityType] || [];
      for (const link of links) {
        const partnerCode = link.requester_code === adminCode ? link.target_code : link.requester_code;
        const partnerType = link.requester_code === adminCode ? link.target_type : link.requester_type;
        const partnerOwnerField = PARTNER_ACCOUNT_OWNER_FIELD[partnerType];
        if (partnerOwnerField && validOwnerFields.includes(partnerOwnerField)) {
          const [partnerRows] = await db.query(
            `SELECT * FROM \`${config.table}\` WHERE \`${partnerOwnerField}\` = ? AND is_active = TRUE`,
            [partnerCode]
          );
          for (const row of partnerRows) {
            if (!existingCodes.has(row[config.codeField])) {
              rows.push(row);
              existingCodes.add(row[config.codeField]);
            }
          }
        }
      }
    }

    const items = rows.map(row => ({
      ...row,
      entity_type: entityType,
      code: row[config.codeField]
    }));

    return successResponse(res, { items, total: items.length });

  } catch (error) {
    console.error('List entities error:', error);
    return errorResponse(res, 'Failed to fetch entities.', 500);
  }
};


// ─── SYNC TREE BATCH ─────────────────────────────────────────────

const syncTree = async (req, res) => {
  try {
    const { adds = [], removes = [] } = req.body;
    const adminCode = req.user.entityCode;
    const adminType = req.user.entityType;

    const accType = normalizeAccountType(adminType, req.user.accountType);

    const partnerCodes = await getLinkedPartnerCodes(adminType, adminCode);
    const allowedRootCodes = [adminCode, ...partnerCodes];
    const allowedChildrenMap = getAllowedChildrenMap(accType);

    // Process Removes first. Track any that are blocked by dependencies so the
    // client can be told instead of silently leaving the node in place.
    const blockedRemovals = [];
    for (const edgeId of removes) {
      const edge = await OrganizationTreeModel.findById(edgeId);
      if (!edge) continue;
      if (partnerCodes.includes(edge.child_code)) continue;
      if (edge.root_entity_code === adminCode || partnerCodes.includes(edge.root_entity_code)) {
        // Dependency check for batch removes
        const hasDeps = await OrganizationTreeModel.hasDependencies(edgeId);
        if (!hasDeps) {
          await OrganizationTreeModel.removeSubtree(edgeId, edge.child_code, edge.root_entity_code);
        } else {
          blockedRemovals.push(edge.child_code);
        }
      }
    }

    // Re-fetch descendants AFTER removes so adds work on clean state
    let descendants = await OrganizationTreeModel.getTreeDescendants(adminCode, allowedRootCodes);

    // Process Adds — re-fetch descendants after each insert so chained
    // adds (parent added earlier in same batch) can resolve their parent_edge_id
    for (const add of adds) {
      const { parent_code, child_type, child_code } = add;
      let { parent_edge_id = null } = add;

      const parentType = adminCode === parent_code
        ? adminType
        : await resolveEntityType(parent_code);
      if (!parentType) continue;

      const allowed = allowedChildrenMap[parentType] || [];
      if (!allowed.includes(child_type)) continue;

      const child = await resolveEntity(child_type, child_code);
      if (!child) continue;

      if (adminCode !== parent_code) {
        const inTree = descendants.some(d => d.child_code === parent_code);
        if (!inTree) continue;
      }

      // If parent_edge_id not provided (null), try to resolve it from
      // current descendants — covers chained adds in same batch where
      // the parent was just inserted earlier in this loop
      if (parent_edge_id === null && adminCode !== parent_code) {
        const parentEdgeRow = descendants.find(d => d.child_code === parent_code);
        parent_edge_id = parentEdgeRow ? parentEdgeRow.id : null;
      }

      // Validate parent_edge_id if resolved
      if (parent_edge_id !== null) {
        const parentEdge = await OrganizationTreeModel.findById(parent_edge_id);
        if (!parentEdge || parentEdge.child_code !== parent_code) {
          parent_edge_id = null; // reset if invalid — let it be top-level
        }
      }

      const existing = await OrganizationTreeModel.findEdgeByParentEdgeAndChild(
        parent_edge_id,
        parent_code,
        child_code,
        allowedRootCodes
      );
      if (existing) continue;

      const newId = await OrganizationTreeModel.addNode({
        parent_type: parentType,
        parent_code,
        child_type,
        child_code,
        created_by: req.user.userCode,
        root_entity_code: adminCode,
        parent_edge_id
      });

      // ← Re-fetch after each insert so the next chained add can find this one
      descendants = await OrganizationTreeModel.getTreeDescendants(adminCode, allowedRootCodes);
    }

    if (blockedRemovals.length > 0) {
      return successResponse(
        res,
        { blockedRemovals },
        `Saved, but ${blockedRemovals.length} entit${blockedRemovals.length === 1 ? 'y was' : 'ies were'} kept because they are in use by users, checklists or audits. Remove those dependencies first.`
      );
    }

    return successResponse(res, null, 'Organization tree synchronized successfully.');
  } catch (error) {
    console.error('Sync tree error:', error);
    return errorResponse(res, 'Failed to synchronize organization tree.', 500);
  }
};

module.exports = { getTree, addNode, removeNode, listEntitiesOfType, syncTree };
