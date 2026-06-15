/**
 * Organization Link Rules
 *
 * Shared rules for links between independently registered entities.
 * Allows nearest-parent links, with Company -> Supplier as a special partner link.
 */

const ORG_LEVELS = {
  Customer: 8,
  'Buying Office': 7,
  Supplier: 7,
  Company: 5,
  Cluster: 4,
  Factory: 3,
  Unit: 2,
  Department: 1,
  Section: 1,
  'Audit Firm Company': 6,
  Branch: 3,
  'Audit Firm Department': 1,
};

const LINK_TARGETS = {
  'Buying Office': ['Customer'],
  Supplier: ['Buying Office'],
  Company: ['Supplier'],
  Cluster: ['Company'],
  Factory: ['Cluster'],
  Unit: ['Factory'],
  Department: ['Unit'],
  Section: ['Department'],
  Branch: ['Audit Firm Company'],
  'Audit Firm Department': ['Branch'],
};

const ALL_LINK_TARGET_TYPES = [...new Set(Object.values(LINK_TARGETS).flat())];

const ENTITY_ACCOUNT_TYPE = {
  Customer: 'Customer',
  'Buying Office': 'Customer',
  Supplier: 'Customer',
  Company: 'Company',
  Cluster: 'Company',
  Factory: 'Company',
  Unit: 'Company',
  Department: 'Company',
  Section: 'Company',
  'Audit Firm Company': 'Audit Firm',
  Branch: 'Audit Firm',
  'Audit Firm Department': 'Audit Firm',
};

function getAccountType(entityType) {
  return ENTITY_ACCOUNT_TYPE[entityType] || null;
}

function isValidLinkTargetType(targetType) {
  return ALL_LINK_TARGET_TYPES.includes(targetType);
}

function canCreateLink(requesterType, targetType) {
  const allowed = LINK_TARGETS[requesterType];
  if (!allowed) {
    return { ok: false, reason: 'Your entity type cannot create link requests.' };
  }
  if (!allowed.includes(targetType)) {
    return { ok: false, reason: `A ${requesterType} cannot link to a ${targetType}.` };
  }
  return { ok: true };
}

function isCompanySupplierLink(typeA, typeB) {
  const pair = new Set([typeA, typeB]);
  return pair.has('Supplier') && pair.has('Company');
}

function isPeerLink(typeA, typeB) {
  return typeA === 'Company' && typeB === 'Company';
}

const isBidirectionalLink = isPeerLink;

module.exports = {
  ORG_LEVELS,
  LINK_TARGETS,
  getAccountType,
  isValidLinkTargetType,
  canCreateLink,
  isCompanySupplierLink,
  isPeerLink,
  isBidirectionalLink,
};
