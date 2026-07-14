/**
 * Access Helper
 *
 * Shared utility for determining which entity codes an admin
 * has access to — their own entity, all descendants in the
 * organization tree, plus linked partner entities per link rules.
 */

const { db } = require('../config/db');
const OrganizationTreeModel = require('../models/OrganizationTreeModel');
const LinkModel = require('../models/LinkModel');
const { getAccountType, isCompanySupplierLink, isPeerLink } = require('./linkRules');

/**
 * All entity codes that belong to a linked partner's account.
 */
async function getPartnerAccountCodes(partnerType, partnerCode) {
  const codes = new Set([partnerCode]);
  const accountType = getAccountType(partnerType);
  if (!accountType) return [partnerCode];

  if (accountType === 'Customer') {
    let accountRoot = partnerCode;

    if (partnerType === 'Customer') {
      accountRoot = partnerCode;
    } else if (partnerType === 'Buying Office') {
      const [rows] = await db.query(
        'SELECT cust_code FROM customer_buying_offices WHERE cbo_code = ? AND is_active = TRUE',
        [partnerCode]
      );
      if (rows[0]?.cust_code) accountRoot = rows[0].cust_code;
    } else if (partnerType === 'Supplier') {
      const [rows] = await db.query(
        'SELECT cust_code FROM customer_suppliers WHERE csup_code = ? AND is_active = TRUE',
        [partnerCode]
      );
      accountRoot = rows[0]?.cust_code || partnerCode;
    }

    codes.add(accountRoot);

    const collectCustomerOwned = async (root) => {
      const [bos] = await db.query(
        'SELECT cbo_code FROM customer_buying_offices WHERE cust_code = ? AND is_active = TRUE',
        [root]
      );
      for (const r of bos) codes.add(r.cbo_code);

      const [sups] = await db.query(
        'SELECT csup_code FROM customer_suppliers WHERE cust_code = ? AND is_active = TRUE',
        [root]
      );
      for (const r of sups) codes.add(r.csup_code);
    };

    await collectCustomerOwned(accountRoot);

    if (partnerType !== 'Customer' && partnerCode !== accountRoot) {
      await collectCustomerOwned(partnerCode);
    }
  }

  if (accountType === 'Company') {
    const ownedTables = [
      ['company_clusters', 'comp_clus_code'],
      ['company_factories', 'comp_fact_code'],
      ['company_units', 'comp_unit_code'],
      ['company_departments', 'comp_dept_code'],
      ['company_sections', 'comp_section_code'],
    ];
    for (const [table, field] of ownedTables) {
      const [rows] = await db.query(
        `SELECT \`${field}\` AS code FROM \`${table}\` WHERE comp_code = ? AND is_active = TRUE`,
        [partnerCode]
      );
      for (const r of rows) codes.add(r.code);
    }
  }

  if (accountType === 'Audit Firm') {
    const [branches] = await db.query(
      'SELECT afc_branch_code FROM audit_firm_company_branches WHERE afc_code = ? AND is_active = TRUE',
      [partnerCode]
    );
    for (const r of branches) codes.add(r.afc_branch_code);

    const [depts] = await db.query(
      'SELECT afc_dept_code FROM audit_firm_company_departments WHERE afc_code = ? AND is_active = TRUE',
      [partnerCode]
    );
    for (const r of depts) codes.add(r.afc_dept_code);
  }

  return Array.from(codes);
}

async function addPartnerScopeToSet(codesSet, partnerType, partnerCode) {
  const partnerAccountCodes = await getPartnerAccountCodes(partnerType, partnerCode);
  for (const code of partnerAccountCodes) {
    if (codesSet.has(code)) continue;
    codesSet.add(code);

    const partnerDescendants = await OrganizationTreeModel.getAllDescendants(code);
    for (const edge of partnerDescendants) {
      codesSet.add(edge.child_code);
    }
  }
}

async function removePartnerScopeFromSet(codesSet, partnerType, partnerCode, keepCode) {
  const partnerAccountCodes = await getPartnerAccountCodes(partnerType, partnerCode);
  for (const code of partnerAccountCodes) {
    if (code !== keepCode) codesSet.delete(code);
  }

  const partnerDescendants = await OrganizationTreeModel.getAllDescendants(partnerCode);
  for (const edge of partnerDescendants) {
    if (edge.child_code !== keepCode) codesSet.delete(edge.child_code);
  }
}

/**
 * Returns all entity codes accessible to an admin:
 * 1. Own entity code + org-tree descendants
 * 2. Linked partners per link type:
 *    - Supplier ↔ Company: supplier sees full company account (one-way)
 *    - Company ↔ Company: both see each other (peer)
 *    - Other hierarchy links: target sees requester's account
 */
async function getAccessibleEntityCodes(adminCode, entityType) {
  const codesSet = new Set();
  codesSet.add(adminCode);

  const ownDescendants = await OrganizationTreeModel.getAllDescendants(adminCode);
  for (const edge of ownDescendants) {
    codesSet.add(edge.child_code);
  }

  if (entityType) {
    const links = await LinkModel.getAcceptedLinks(entityType, adminCode);
    for (const link of links) {
      if (isCompanySupplierLink(link.requester_type, link.target_type)) {
        const iAmCompanyRequester =
          adminCode === link.requester_code &&
          link.requester_type === 'Company' &&
          link.target_type === 'Supplier';
        if (iAmCompanyRequester) {
          await removePartnerScopeFromSet(codesSet, 'Supplier', link.target_code, adminCode);
          continue;
        }

        const iAmSupplier =
          (adminCode === link.requester_code && link.requester_type === 'Supplier') ||
          (adminCode === link.target_code && link.target_type === 'Supplier');
        if (!iAmSupplier) continue;

        const companyCode = link.requester_type === 'Company'
          ? link.requester_code
          : link.target_code;
        await addPartnerScopeToSet(codesSet, 'Company', companyCode);
        continue;
      }

      if (isPeerLink(link.requester_type, link.target_type)) {
        const partnerCode = link.requester_code === adminCode ? link.target_code : link.requester_code;
        const partnerType = link.requester_code === adminCode ? link.target_type : link.requester_type;
        await addPartnerScopeToSet(codesSet, partnerType, partnerCode);
        continue;
      }

      if (link.target_code === adminCode) {
        await addPartnerScopeToSet(codesSet, link.requester_type, link.requester_code);
      }
    }
  }

  return Array.from(codesSet);
}

/**
 * Resolves an array of entity codes to their names and types.
 * Returns a Map<string, { name, entity_type }>.
 */
async function resolveEntityNames(codes) {
  if (!codes || codes.length === 0) return new Map();
  const unique = [...new Set(codes.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const ph = unique.map(() => '?').join(',');
  const params = unique;
  const [rows] = await db.query(
    `SELECT cust_code AS code, name, 'Customer' AS entity_type FROM customers WHERE cust_code IN (${ph})
     UNION ALL
     SELECT cbo_code, name, 'Buying Office' FROM customer_buying_offices WHERE cbo_code IN (${ph})
     UNION ALL
     SELECT csup_code, name, 'Supplier' FROM customer_suppliers WHERE csup_code IN (${ph})
     UNION ALL
     SELECT comp_code, name, 'Company' FROM companies WHERE comp_code IN (${ph})
     UNION ALL
     SELECT comp_clus_code, name, 'Cluster' FROM company_clusters WHERE comp_clus_code IN (${ph})
     UNION ALL
     SELECT comp_fact_code, name, 'Factory' FROM company_factories WHERE comp_fact_code IN (${ph})
     UNION ALL
     SELECT comp_unit_code, name, 'Unit' FROM company_units WHERE comp_unit_code IN (${ph})
     UNION ALL
     SELECT comp_dept_code, name, 'Department' FROM company_departments WHERE comp_dept_code IN (${ph})
     UNION ALL
     SELECT comp_section_code, name, 'Section' FROM company_sections WHERE comp_section_code IN (${ph})
     UNION ALL
     SELECT afc_code, name, 'Audit Firm Company' FROM audit_firm_companies WHERE afc_code IN (${ph})
     UNION ALL
     SELECT afc_branch_code, name, 'Branch' FROM audit_firm_company_branches WHERE afc_branch_code IN (${ph})
     UNION ALL
     SELECT afc_dept_code, name, 'Department' FROM audit_firm_company_departments WHERE afc_dept_code IN (${ph})`,
    [...params, ...params, ...params, ...params, ...params, ...params, ...params, ...params, ...params, ...params, ...params, ...params]
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.code, { name: r.name?.trim?.() || r.code, entity_type: r.entity_type });
  }
  return map;
}

/**
 * Edge ids visible to an entity head: their assigned org-tree node plus all descendants.
 */
async function getEntityHeadOrgTreeScope(orgTreeId) {
  const id = parseInt(orgTreeId, 10);
  if (!Number.isFinite(id)) return [];
  const ids = await OrganizationTreeModel.getDescendantEdgeIds(id);
  return ids.length ? ids : [id];
}

function entityMatchesOrgTreeScope(entity, scopeIds) {
  if (!scopeIds?.length || !entity) return false;
  const orgId = entity.org_tree_id ?? entity.assigned_org_tree_id ?? null;
  if (orgId === null || orgId === undefined) return false;
  return scopeIds.includes(Number(orgId));
}

function auditEntitiesInScope(entities, scopeIds) {
  return (entities || []).some((e) => entityMatchesOrgTreeScope(e, scopeIds));
}

/**
 * Find the subtree rooted at the entity head's assigned edge (or the highest in-scope node).
 */
function extractEntityHeadSubtree(tree, assignedOrgTreeId, scopeIds = []) {
  if (!tree) return null;
  const assignedId = parseInt(assignedOrgTreeId, 10);
  if (!Number.isFinite(assignedId)) return tree;

  const findByEdge = (node) => {
    if (!node) return null;
    if (node.edge_id === assignedId) return node;
    for (const child of node.children || []) {
      const found = findByEdge(child);
      if (found) return found;
    }
    return null;
  };

  const exact = findByEdge(tree);
  if (exact) return exact;

  const scopeSet = new Set((scopeIds || []).map(Number));
  const pruneToScope = (node) => {
    if (!node) return null;
    const edgeId = node.edge_id ?? null;
    const children = (node.children || []).map(pruneToScope).filter(Boolean);

    if (edgeId !== null && scopeSet.has(edgeId)) {
      return { ...node, children };
    }
    if (children.length) {
      return { ...node, edge_id: node.edge_id ?? null, children };
    }
    return null;
  };

  return pruneToScope(tree);
}

module.exports = {
  getPartnerAccountCodes,
  getAccessibleEntityCodes,
  resolveEntityNames,
  getEntityHeadOrgTreeScope,
  entityMatchesOrgTreeScope,
  auditEntitiesInScope,
  extractEntityHeadSubtree,
};
