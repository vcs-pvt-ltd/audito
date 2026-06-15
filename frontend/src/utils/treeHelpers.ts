// Common tree manipulation utilities used in both audit and CAP execution

export interface TreeNode {
  entity_type: string;
  code: string;
  name: string;
  edge_id?: number | null;
  children?: TreeNode[];
  [key: string]: any;
}

export function findNode(node: TreeNode, code: string): TreeNode | null {
  if (node.code === code) return node;
  for (const child of node.children || []) {
    const found = findNode(child, code);
    if (found) return found;
  }
  return null;
}

export function findNodeByEdgeId(node: TreeNode, edgeId: number): TreeNode | null {
  if (node.edge_id === edgeId) return node;
  for (const child of node.children || []) {
    const found = findNodeByEdgeId(child, edgeId);
    if (found) return found;
  }
  return null;
}

export function pruneTree(node: TreeNode, codes: Set<string>): TreeNode | null {
  const prunedChildren: TreeNode[] = [];
  for (const child of node.children || []) {
    const pruned = pruneTree(child, codes);
    if (pruned) prunedChildren.push(pruned);
  }
  if (codes.has(node.code) || prunedChildren.length > 0) {
    return { ...node, children: prunedChildren };
  }
  return null;
}

export function getRelevantChildren(
  node: TreeNode,
  targetCodes: Set<string>,
  keyGenerator?: (code: string, node: TreeNode) => string
): TreeNode[] {
  const hasDesc = (n: TreeNode): boolean => {
    const key = keyGenerator ? keyGenerator(n.code, n) : n.code;
    if (targetCodes.has(key)) return true;
    return (n.children || []).some((c) => hasDesc(c));
  };
  return (node.children || []).filter((c) => hasDesc(c));
}

export function getAggProgress(
  node: TreeNode,
  codes: Set<string>,
  progressMap: Record<string, any>,
  keyGenerator?: (code: string, node: TreeNode) => string
): { tQ: number; aQ: number } {
  let tQ = 0;
  let aQ = 0;
  
  const key = keyGenerator ? keyGenerator(node.code, node) : node.code;
  const pData = progressMap[key] || (key.endsWith("__null") ? progressMap[node.code] : null);
  
  if (pData) {
    tQ += pData.total_questions || 0;
    aQ += pData.answered_questions || 0;
  }
  
  for (const child of node.children || []) {
    const c = getAggProgress(child, codes, progressMap, keyGenerator);
    tQ += c.tQ;
    aQ += c.aQ;
  }
  
  return { tQ, aQ };
}

export function buildBreadcrumb(
  tree: TreeNode | null,
  selectedCode: string,
  targetCodes: Set<string>
): TreeNode[] {
  const breadcrumb: TreeNode[] = [];
  
  function traverse(node: TreeNode): boolean {
    if (node.code === selectedCode) {
      breadcrumb.push(node);
      return true;
    }
    for (const child of node.children || []) {
      if (traverse(child)) {
        breadcrumb.unshift(node);
        return true;
      }
    }
    return false;
  }
  
  if (tree) traverse(tree);
  return breadcrumb;
}
