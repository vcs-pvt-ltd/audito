const { getAllowedParentTypes } = require('../config/organizationHierarchy');

const idOf = node => String(node?.id || node?.node_id || '');

function preferredParents(node, nodes, context) {
  const byId = new Map(nodes.filter(item => !item.is_removed).map(item => [idOf(item), item]));
  const nodeId = idOf(node);
  const parentId = node.parent_id || null;
  const parentType = parentId ? byId.get(parentId)?.entity_type : context.rootEntityType;
  const currentLevel = context.fullChain.indexOf(parentType);
  if (currentLevel < 0) return [];
  const allowedTypes = new Set(getAllowedParentTypes(context.accountType, node.entity_type));
  const below = (candidateId, ancestorId) => {
    if (!ancestorId) return true;
    const seen = new Set();
    for (let cursor = byId.get(candidateId); cursor && !seen.has(idOf(cursor)); cursor = byId.get(cursor.parent_id)) {
      if (cursor.parent_id === ancestorId) return true;
      seen.add(idOf(cursor));
    }
    return false;
  };
  const candidates = [...byId.values()].filter(candidate => {
    const candidateId = idOf(candidate);
    const level = context.fullChain.indexOf(candidate.entity_type);
    return candidateId !== nodeId && allowedTypes.has(candidate.entity_type) && level > currentLevel
      && below(candidateId, parentId) && !below(candidateId, nodeId);
  });
  const deepest = Math.max(-1, ...candidates.map(candidate => context.fullChain.indexOf(candidate.entity_type)));
  return candidates.filter(candidate => context.fullChain.indexOf(candidate.entity_type) === deepest);
}

function inferUniqueParents(nodes, context, { protectedIds = new Set() } = {}) {
  const result = nodes.map(node => ({ ...node }));
  const warnings = [];
  const inferredIds = new Set();
  // Parent areas may themselves have been moved earlier in the same draft.
  for (let pass = 0; pass < result.length; pass++) {
    let changed = false;
    for (const node of result) {
      const id = idOf(node);
      if (node.is_removed || node.source_edge_id || protectedIds.has(id)) continue;
      const candidates = preferredParents(node, result, context);
      if (candidates.length !== 1) continue;
      const parent = candidates[0];
      if (node.parent_id === idOf(parent)) continue;
      node.parent_id = idOf(parent);
      inferredIds.add(id);
      changed = true;
    }
    if (!changed) break;
  }
  for (const node of result) {
    if (inferredIds.has(idOf(node))) {
      const parent = result.find(candidate => idOf(candidate) === node.parent_id);
      warnings.push(`Check that "${node.name}" reports to "${parent?.name || 'the selected area'}". This link was inferred from the areas in your sheet.`);
    } else if (!node.is_removed && !node.source_edge_id && !protectedIds.has(idOf(node)) && preferredParents(node, result, context).length > 1) {
      warnings.push(`Choose which area "${node.name}" reports to. The sheet does not identify one clearly.`);
    }
  }
  return { nodes: result, warnings, inferredIds };
}

module.exports = { preferredParents, inferUniqueParents };
