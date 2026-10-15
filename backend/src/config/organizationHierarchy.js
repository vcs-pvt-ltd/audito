const DISPLAY_ORDERS = {
  Customer: ['Customer', 'Buying Office', 'Supplier'],
  Company: ['Company', 'Cluster', 'Factory', 'Unit', 'Department', 'Section'],
  'Audit Firm': ['Audit Firm Company', 'Branch', 'Audit Firm Department'],
};

// Relationship rules, not mandatory levels. Organization paths contain only
// the entity types the organization actually uses.
const ALLOWED_CHILDREN = {
  Customer: {
    Customer: ['Buying Office'],
    'Buying Office': ['Supplier'],
    Supplier: [],
  },
  Company: {
    Company: ['Cluster', 'Factory', 'Department'],
    Cluster: ['Factory'],
    Factory: ['Unit', 'Department'],
    Unit: ['Department'],
    Department: ['Section'],
    Section: [],
  },
  'Audit Firm': {
    'Audit Firm Company': ['Branch'],
    Branch: ['Audit Firm Department'],
    'Audit Firm Department': [],
  },
};

const ROOT_TYPES = {
  Customer: 'Customer',
  Company: 'Company',
  'Audit Firm': 'Audit Firm Company',
};

function getDisplayOrder(accountType) {
  return [...(DISPLAY_ORDERS[accountType] || [])];
}

function getAllowedChildrenMap(accountType) {
  const rules = ALLOWED_CHILDREN[accountType] || {};
  return Object.fromEntries(Object.entries(rules).map(([type, children]) => [type, [...children]]));
}

function getReachableEntityTypes(accountType, rootEntityType) {
  const rules = ALLOWED_CHILDREN[accountType] || {};
  const reachable = new Set();
  const visit = (type) => {
    for (const childType of rules[type] || []) {
      if (reachable.has(childType)) continue;
      reachable.add(childType);
      visit(childType);
    }
  };
  visit(rootEntityType);
  return getDisplayOrder(accountType).filter((type) => reachable.has(type));
}

function getAllowedParentTypes(accountType, entityType) {
  const rules = ALLOWED_CHILDREN[accountType] || {};
  return Object.entries(rules)
    .filter(([, children]) => children.includes(entityType))
    .map(([parentType]) => parentType);
}

function getHierarchyPaths(accountType, rootEntityType) {
  const rules = ALLOWED_CHILDREN[accountType] || {};
  const paths = [];
  const walk = (type, path, seen) => {
    if (seen.has(type)) return;
    const nextSeen = new Set(seen).add(type);
    const children = rules[type] || [];
    if (!children.length) {
      paths.push([...path, type]);
      return;
    }
    for (const child of children) walk(child, [...path, type], nextSeen);
  };
  walk(rootEntityType, [], new Set());
  return paths;
}

module.exports = {
  DISPLAY_ORDERS,
  ALLOWED_CHILDREN,
  ROOT_TYPES,
  getDisplayOrder,
  getAllowedChildrenMap,
  getReachableEntityTypes,
  getAllowedParentTypes,
  getHierarchyPaths,
};
