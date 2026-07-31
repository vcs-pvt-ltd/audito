const { db } = require('../config/db');
const OrganizationTreeModel = require('./OrganizationTreeModel');

const VALID_SCOPE_MODES = new Set(['EXACT', 'SUBTREE']);
const MAX_SCOPES_PER_USER = 200;

function normalizeId(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function normalizeScope(scope = {}) {
  return {
    org_tree_id: normalizeId(scope.org_tree_id),
    entity_code: String(scope.entity_code || '').trim(),
    entity_type: scope.entity_type ? String(scope.entity_type).trim() : null,
    scope_mode: String(scope.scope_mode || 'EXACT').trim().toUpperCase(),
  };
}

const OrganizationUserScopeModel = {
  normalizeScopes(scopes) {
    if (!Array.isArray(scopes)) return [];
    const normalized = scopes.map(normalizeScope);
    const unique = new Map();
    for (const scope of normalized) {
      const key = scope.org_tree_id ? `tree:${scope.org_tree_id}` : `root:${scope.entity_code}`;
      unique.set(key, scope);
    }
    return [...unique.values()];
  },

  async validateForWorkspace(scopes, { rootEntityCode, accessibleEntityCodes = [] }) {
    const normalized = this.normalizeScopes(scopes);
    if (normalized.length === 0) {
      return { ok: false, message: 'Select at least one organization entity.', scopes: [] };
    }
    if (normalized.length > MAX_SCOPES_PER_USER) {
      return { ok: false, message: `A maximum of ${MAX_SCOPES_PER_USER} entity scopes is allowed.`, scopes: [] };
    }

    for (const scope of normalized) {
      if (!scope.entity_code) {
        return { ok: false, message: 'Each scope must include an entity_code.', scopes: [] };
      }
      if (!VALID_SCOPE_MODES.has(scope.scope_mode)) {
        return { ok: false, message: 'scope_mode must be EXACT or SUBTREE.', scopes: [] };
      }
    }

    const allowedCodes = new Set([rootEntityCode, ...accessibleEntityCodes].filter(Boolean));
    const treeIds = normalized.map((scope) => scope.org_tree_id).filter(Boolean);
    const edgesById = new Map();
    if (treeIds.length) {
      const placeholders = treeIds.map(() => '?').join(',');
      const [edges] = await db.query(
        `SELECT org_tree_id, child_code, child_type, root_entity_code
           FROM organization_tree
          WHERE org_tree_id IN (${placeholders}) AND is_active = TRUE`,
        treeIds
      );
      for (const edge of edges) edgesById.set(String(edge.org_tree_id), edge);
    }

    const validated = [];
    for (const scope of normalized) {
      if (!scope.org_tree_id) {
        if (scope.entity_code !== rootEntityCode) {
          return { ok: false, message: 'Only the workspace root can be selected without an organization-tree id.', scopes: [] };
        }
        validated.push(scope);
        continue;
      }

      const edge = edgesById.get(scope.org_tree_id);
      if (!edge) {
        return { ok: false, message: `Organization-tree entity ${scope.org_tree_id} was not found.`, scopes: [] };
      }
      if (!allowedCodes.has(edge.child_code) || (edge.root_entity_code && !allowedCodes.has(edge.root_entity_code))) {
        return { ok: false, message: 'One or more selected entities are outside your accessible organization.', scopes: [] };
      }
      validated.push({
        ...scope,
        entity_code: edge.child_code,
        entity_type: edge.child_type || scope.entity_type,
      });
    }

    return { ok: true, scopes: validated };
  },

  async listByUser(organizationUserId, executor = db) {
    const [rows] = await executor.query(
      `SELECT scope_id, organization_user_id, org_tree_id, entity_code, entity_type,
              scope_mode, is_active, created_at, updated_at
         FROM organization_user_scopes
        WHERE organization_user_id = ? AND is_active = TRUE
        ORDER BY scope_id`,
      [organizationUserId]
    );
    return rows;
  },

  async listByUsers(organizationUserIds, executor = db) {
    const ids = [...new Set((organizationUserIds || []).filter(Boolean))];
    if (!ids.length) return new Map();
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await executor.query(
      `SELECT scope_id, organization_user_id, org_tree_id, entity_code, entity_type,
              scope_mode, is_active, created_at, updated_at
         FROM organization_user_scopes
        WHERE organization_user_id IN (${placeholders}) AND is_active = TRUE
        ORDER BY scope_id`,
      ids
    );
    const map = new Map(ids.map((id) => [id, []]));
    for (const row of rows) {
      if (!map.has(row.organization_user_id)) map.set(row.organization_user_id, []);
      map.get(row.organization_user_id).push(row);
    }
    return map;
  },

  async replaceForUser(organizationUserId, scopes, createdByAdminId, executor = db) {
    const normalized = this.normalizeScopes(scopes);
    await executor.query('DELETE FROM organization_user_scopes WHERE organization_user_id = ?', [organizationUserId]);
    if (!normalized.length) return;

    const values = [];
    const placeholders = normalized.map((scope) => {
      values.push(
        organizationUserId,
        scope.org_tree_id,
        scope.entity_code,
        scope.entity_type,
        scope.scope_mode,
        createdByAdminId || null
      );
      return '(?, ?, ?, ?, ?, TRUE, ?)';
    }).join(',');
    await executor.query(
      `INSERT INTO organization_user_scopes
        (organization_user_id, org_tree_id, entity_code, entity_type, scope_mode, is_active, created_by_admin_id)
       VALUES ${placeholders}`,
      values
    );
  },

  async resolveForUser({ organizationUserId, assignedOrgTreeId = null, assignedEntityCode = null }) {
    let scopes = await this.listByUser(organizationUserId);
    if (!scopes.length && assignedEntityCode) {
      scopes = [{
        org_tree_id: normalizeId(assignedOrgTreeId),
        entity_code: assignedEntityCode,
        entity_type: null,
        scope_mode: 'SUBTREE',
        legacy: true,
      }];
    }

    const orgTreeIds = new Set();
    const entityCodes = new Set();
    for (const scope of scopes) {
      if (scope.org_tree_id) {
        if (scope.scope_mode === 'SUBTREE') {
          const ids = await OrganizationTreeModel.getDescendantEdgeIds(scope.org_tree_id);
          for (const id of ids) orgTreeIds.add(String(id));
        } else {
          orgTreeIds.add(String(scope.org_tree_id));
        }
        continue;
      }

      entityCodes.add(scope.entity_code);
      if (scope.scope_mode === 'SUBTREE') {
        const [edges] = await db.query(
          `SELECT org_tree_id
             FROM organization_tree
            WHERE root_entity_code = ? AND is_active = TRUE`,
          [scope.entity_code]
        );
        for (const edge of edges) orgTreeIds.add(String(edge.org_tree_id));
      }
    }

    return {
      scopes,
      orgTreeIds: [...orgTreeIds],
      entityCodes: [...entityCodes],
    };
  },
};

module.exports = OrganizationUserScopeModel;
