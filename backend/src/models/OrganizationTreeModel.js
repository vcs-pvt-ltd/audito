/**
 * Organization Tree Model
 *
 * Manages the organization_tree table which stores parent-child
 * relationships between independently created entities.
 *
 * Entities are created independently; the admin builds the tree
 * manually by linking them here.  A child can appear under
 * multiple parents (e.g. one supplier shared by many buying offices).
 */

const { db } = require('../config/db');

const OrganizationTreeModel = {

  async addNode({ parent_type, parent_code, child_type, child_code, created_by, root_entity_code, parent_edge_id = null }) {
  const [result] = await db.query(
    `INSERT INTO organization_tree 
     (parent_type, parent_code, child_type, child_code, created_by, root_entity_code, parent_edge_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [parent_type, parent_code, child_type, child_code, created_by, root_entity_code || null, parent_edge_id || null]
  );
  return result.insertId;
},

  async removeNode(id) {
    await db.query('DELETE FROM organization_tree WHERE id = ?', [id]);
  },

  /**
   * Remove an edge AND all descendant edges under it within the same root tree.
   * Uses a recursive CTE to collect all descendant EDGE IDs reachable from the
   * starting edge via parent_edge_id, then deletes only those edges.
   *
   * IMPORTANT: We must traverse by parent_edge_id (edge-instance linkage), not
   * by parent_code/child_code (entity codes), because the same entity can appear
   * multiple times under different parents.
   */
  async removeSubtree(edgeId, childCode, rootEntityCode) {
    // childCode is intentionally unused (kept for backward compatibility with call sites)
    await db.query(
      `WITH RECURSIVE subtree AS (
        SELECT id
        FROM organization_tree
        WHERE id = ?
          AND root_entity_code = ?

        UNION ALL

        SELECT ot.id
        FROM organization_tree ot
        INNER JOIN subtree s ON ot.parent_edge_id = s.id
        WHERE ot.root_entity_code = ?
          AND ot.is_active = TRUE
      )
      DELETE FROM organization_tree
      WHERE root_entity_code = ?
        AND id IN (SELECT id FROM subtree)`,
      [edgeId, rootEntityCode, rootEntityCode, rootEntityCode]
    );
  },

  async findById(id) {
    const [rows] = await db.query(
      'SELECT * FROM organization_tree WHERE id = ? AND is_active = TRUE',
      [id]
    );
    return rows[0] || null;
  },

  async findEdge(parent_code, child_code) {
    const [rows] = await db.query(
      'SELECT * FROM organization_tree WHERE parent_code = ? AND child_code = ? AND is_active = TRUE',
      [parent_code, child_code]
    );
    return rows[0] || null;
  },

  async findEdgeForRoot(parent_code, child_code, root_entity_code) {
    const [rows] = await db.query(
      'SELECT * FROM organization_tree WHERE parent_code = ? AND child_code = ? AND root_entity_code = ? AND is_active = TRUE',
      [parent_code, child_code, root_entity_code]
    );
    return rows[0] || null;
  },

  /**
   * Check if a parent→child edge exists in ANY of the given root_entity_codes.
   * Used to prevent visual duplicates when verifying across linked admin trees.
   */
  async findEdgeByParentEdgeAndChild(parent_edge_id, parent_code, child_code, rootCodes) {
  if (!rootCodes || !rootCodes.length) return null;
  const placeholders = rootCodes.map(() => '?').join(',');
  
  if (parent_edge_id === null) {
    // Top-level edge (child of root) — match by parent_code + child_code + null parent_edge_id
    const [rows] = await db.query(
      `SELECT * FROM organization_tree 
       WHERE parent_code = ? AND child_code = ? 
       AND parent_edge_id IS NULL
       AND root_entity_code IN (${placeholders}) 
       AND is_active = TRUE LIMIT 1`,
      [parent_code, child_code, ...rootCodes]
    );
    return rows[0] || null;
  }

  const [rows] = await db.query(
    `SELECT * FROM organization_tree 
     WHERE parent_edge_id = ? AND child_code = ? 
     AND root_entity_code IN (${placeholders}) 
     AND is_active = TRUE LIMIT 1`,
    [parent_edge_id, child_code, ...rootCodes]
  );
  return rows[0] || null;
},

  async getChildrenOf(parent_code) {
    const [rows] = await db.query(
      'SELECT * FROM organization_tree WHERE parent_code = ? AND is_active = TRUE',
      [parent_code]
    );
    return rows;
  },

  /**
   * Get descendants scoped to a specific admin's tree (by root_entity_code).
   * Each root_entity_code is traversed independently to prevent data from
   * one organization leaking into another's tree view.
   * Used for the organization tree VIEW.
   */
async getTreeDescendants(rootCode, allowedRootCodes = null) {
  const roots = (allowedRootCodes && allowedRootCodes.length) ? allowedRootCodes : [rootCode];
  const placeholders = roots.map(() => '?').join(',');

  const [rows] = await db.query(
    `WITH RECURSIVE tree AS (
      -- Anchor: Start with direct children of our entity within authorized tree instances
      SELECT
        id, parent_type, parent_code, child_type, child_code, root_entity_code, 1 AS depth,
        CAST(id AS CHAR(2000)) AS edge_path
      FROM organization_tree
      WHERE parent_code = ?
        AND root_entity_code IN (${placeholders})
        AND is_active = TRUE

      UNION ALL

      -- Recursive: 
      -- 1. Follow parent_edge_id for internal tree consistency
      -- 2. Follow parent_code for bridging across authorized tree roots (parent_edge_id IS NULL)
      SELECT
        ot.id, ot.parent_type, ot.parent_code, ot.child_type, ot.child_code, ot.root_entity_code, t.depth + 1,
        CONCAT(t.edge_path, ',', ot.id)
      FROM organization_tree ot
      INNER JOIN tree t ON (
        ot.parent_edge_id = t.id OR 
        (ot.parent_code = t.child_code AND ot.parent_edge_id IS NULL)
      )
      WHERE ot.root_entity_code IN (${placeholders})
        AND ot.is_active = TRUE
        AND t.depth < 20
    )
    SELECT id, parent_type, parent_code, child_type, child_code,
           root_entity_code, depth, edge_path
    FROM tree
    ORDER BY depth`,
    [rootCode, ...roots, ...roots]
  );

  const result = [];
  const seenPaths = new Set();
  for (const row of rows) {
    if (!seenPaths.has(row.edge_path)) {
      seenPaths.add(row.edge_path);
      result.push(row);
    }
  }
  return result;
},

  /**
   * Return an edge id and all descendant edge ids reachable via parent_edge_id
   * within the same root_entity_code tree.
   */
  async getDescendantEdgeIds(edgeId) {
    const id = parseInt(edgeId, 10);
    if (!Number.isFinite(id)) return [];

    const edge = await this.findById(id);
    if (!edge) return [id];

    const root = edge.root_entity_code;
    const [rows] = await db.query(
      `WITH RECURSIVE subtree AS (
        SELECT id
          FROM organization_tree
         WHERE id = ?
           AND root_entity_code = ?
           AND is_active = TRUE

        UNION ALL

        SELECT ot.id
          FROM organization_tree ot
         INNER JOIN subtree s ON ot.parent_edge_id = s.id
         WHERE ot.root_entity_code = ?
           AND ot.is_active = TRUE
      )
      SELECT id FROM subtree`,
      [id, root, root]
    );
    return rows.map((r) => r.id);
  },

  /**
   * Recursively get ALL descendants globally (all edges regardless of root_entity_code).
   * Used for data access — visibility of users, entities from linked organizations.
   */
  async getAllDescendants(rootCode) {
    const [rows] = await db.query(
      `WITH RECURSIVE tree AS (
        -- Start with edges directly child of rootCode (regardless of tree instance)
        SELECT id, parent_type, parent_code, child_type, child_code, 1 AS depth
        FROM organization_tree
        WHERE parent_code = ? AND is_active = TRUE
        
        UNION DISTINCT
        
        -- Recursively find all children by matching child_code to parent_code
        SELECT ot.id, ot.parent_type, ot.parent_code, ot.child_type, ot.child_code, t.depth + 1
        FROM organization_tree ot
        INNER JOIN tree t ON ot.parent_code = t.child_code
        WHERE ot.is_active = TRUE AND t.depth < 20
      )
      SELECT DISTINCT id, parent_type, parent_code, child_type, child_code FROM tree`,
      [rootCode]
    );
    return rows;
  },

  /**
   * Check if an edge or any of its descendants are "in use" by:
   * 1. Users assigned to that specific org_tree_id (especially Entity Heads)
   * 2. Checklist questions specifically linked to that org_tree_id
   */
  async hasDependencies(edgeId) {
    const ids = await this.getDescendantEdgeIds(edgeId);
    if (!ids.length) return false;

    const placeholders = ids.map(() => '?').join(',');

    // Check Users
    const [userRows] = await db.query(
      `SELECT COUNT(*) as count FROM entity_heads 
       WHERE assigned_org_tree_id IN (${placeholders}) 
       AND is_active = TRUE`,
      ids
    );
    if (userRows[0].count > 0) return true;

    // Check Checklist Questions
    const [checklistRows] = await db.query(
      `SELECT COUNT(*) as count FROM checklist_questions 
       WHERE org_tree_id IN (${placeholders}) 
       AND is_active = TRUE`,
      ids
    );
    if (checklistRows[0].count > 0) return true;

    return false;
  }
};

module.exports = OrganizationTreeModel;
