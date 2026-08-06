const { db } = require('../config/db');
const OrganizationUserModel = require('../models/OrganizationUserModel');
const NotificationModel = require('../models/NotificationModel');
const { getOrganizationUserScope } = require('./accessHelper');

/**
 * Resolve active Organization Users whose exact or subtree scope contains at
 * least one affected organization-tree entity. Entity codes are retained as a
 * fallback for legacy scope rows that do not have an org-tree edge id.
 */
async function findOrganizationUsersForEntities(entities = [], createdByEntityCode = null) {
  const entityCodes = [...new Set(entities.map((entity) => String(entity.entity_code || '')).filter(Boolean))];
  const rootOnlyEntityCodes = new Set(entities
    .filter((entity) => (entity.org_tree_id ?? entity.assigned_org_tree_id) === null || (entity.org_tree_id ?? entity.assigned_org_tree_id) === undefined || (entity.org_tree_id ?? entity.assigned_org_tree_id) === '')
    .map((entity) => String(entity.entity_code || ''))
    .filter(Boolean));
  const orgTreeIds = [...new Set(entities
    .map((entity) => entity.org_tree_id ?? entity.assigned_org_tree_id)
    .filter((id) => id !== null && id !== undefined && id !== '')
    .map(String))];
  if (!entityCodes.length && !orgTreeIds.length) return [];

  const creatorCodes = new Set([createdByEntityCode, ...entityCodes].filter(Boolean));
  if (orgTreeIds.length) {
    const placeholders = orgTreeIds.map(() => '?').join(',');
    const [edges] = await db.query(
      `SELECT DISTINCT root_entity_code FROM organization_tree
        WHERE org_tree_id IN (${placeholders}) AND is_active = TRUE`,
      orgTreeIds
    );
    for (const edge of edges) if (edge.root_entity_code) creatorCodes.add(edge.root_entity_code);
  }

  const candidates = await OrganizationUserModel.listByCreators([...creatorCodes]);
  const targetTreeIds = new Set(orgTreeIds);
  const matches = [];

  for (const user of candidates) {
    const userCode = user.organization_user_id || user.user_code;
    if (!userCode) continue;
    const scope = await getOrganizationUserScope({
      role: 'organization_user',
      userCode,
      assignedOrgTreeId: user.assigned_org_tree_id || null,
      assignedEntityCode: user.assigned_entity_code || null,
      createdByEntityCode: user.created_by_entity_code || null,
    });
    const coversTree = [...scope.orgTreeIds].some((id) => targetTreeIds.has(String(id)));
    const coversCode = [...scope.entityCodes].some((code) => rootOnlyEntityCodes.has(String(code)));
    if (coversTree || coversCode) matches.push(user);
  }

  return matches;
}

async function notifyOrganizationUsersForEntities({
  entities,
  createdByEntityCode = null,
  type,
  title,
  message,
  auditId = null,
  notificationKeyPrefix,
}) {
  const users = await findOrganizationUsersForEntities(entities, createdByEntityCode);
  for (const user of users) {
    const userCode = user.organization_user_id || user.user_code;
    await NotificationModel.createIfNotExists({
      recipient_user_code: userCode,
      recipient_role: 'organization_user',
      created_by_entity_code: createdByEntityCode,
      type,
      title,
      message,
      audit_id: auditId,
      notification_key: `${notificationKeyPrefix}:organization_user:${userCode}`,
    });
  }
}

module.exports = { findOrganizationUsersForEntities, notifyOrganizationUsersForEntities };
