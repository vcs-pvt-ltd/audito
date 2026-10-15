const { db } = require('../config/db');
const { generateBatchIds } = require('../utils/codeGenerator');

const parseJson = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
};

// Column sizes of organization_ai_setup_sessions text fields.
const SESSION_TEXT_LIMITS = { summary: 1000, error_message: 500, model_name: 100 };

/** Fits AI-written text to its column, cutting at a word boundary with an ellipsis. */
const fitText = (value, max) => {
  if (typeof value !== 'string' || value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const normalizeSession = (session) => session && ({ ...session, warnings: parseJson(session.warnings_json, []), onboarding_draft: parseJson(session.onboarding_draft_json, null) });

const nodeChangeType = (node) => {
  if (Boolean(node.is_removed)) return 'removed';
  if (!node.source_entity_code || !node.source_edge_id) return 'added';
  return node.name !== node.baseline_name || (node.parent_id || null) !== (node.baseline_parent_id || null)
    ? 'updated'
    : 'unchanged';
};

const OrganizationAiSetupModel = {
  async createSession(data) {
    await db.query(
      `INSERT INTO organization_ai_setup_sessions
       (organization_ai_setup_session_id, root_entity_code, root_entity_type, account_type, setup_mode, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'draft')`,
      [data.id, data.rootEntityCode, data.rootEntityType, data.accountType, data.setupMode || 'create', data.createdBy]
    );
    return this.getSession(data.id, data.rootEntityCode);
  },

  async getSession(id, rootEntityCode) {
    const [rows] = await db.query(
      `SELECT * FROM organization_ai_setup_sessions
        WHERE organization_ai_setup_session_id = ? AND root_entity_code = ? LIMIT 1`,
      [id, rootEntityCode]
    );
    return normalizeSession(rows[0] || null);
  },

  async getLatestOpenSession(rootEntityCode) {
    const [rows] = await db.query(
      `SELECT * FROM organization_ai_setup_sessions
        WHERE root_entity_code = ?
          AND status IN ('draft', 'analyzing', 'ready', 'failed')
        ORDER BY updated_at DESC, id DESC
        LIMIT 1`,
      [rootEntityCode]
    );
    return normalizeSession(rows[0] || null);
  },

  async listNodes(sessionId) {
    const [rows] = await db.query(
      `SELECT organization_ai_setup_draft_node_id AS id, parent_draft_node_id AS parent_id,
              name, entity_type, source_entity_code, source_edge_id,
              reuse_source_draft_node_id AS reuse_source_node_id, baseline_name,
              baseline_parent_draft_node_id AS baseline_parent_id,
              sort_order, confidence, is_ai_generated, is_removed
         FROM organization_ai_setup_draft_nodes
        WHERE organization_ai_setup_session_id = ? ORDER BY sort_order, id`,
      [sessionId]
    );
    return rows.map((node) => ({
      ...node,
      change_type: nodeChangeType(node),
      confidence: node.confidence === null ? null : Number(node.confidence),
      is_ai_generated: Boolean(node.is_ai_generated),
      is_removed: Boolean(node.is_removed),
    }));
  },

  async clearNodes(sessionId, executor = db) {
    await executor.query(
      'DELETE FROM organization_ai_setup_draft_nodes WHERE organization_ai_setup_session_id = ?',
      [sessionId]
    );
  },

  async updateSession(id, fields, executor = db) {
    const allowed = ['status', 'model_name', 'summary', 'warnings_json', 'error_message', 'published_at', 'onboarding_draft_json', 'published_checklist_id'];
    const sets = [], values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (!allowed.includes(key)) continue;
      sets.push(`\`${key}\` = ?`);
      if (key.endsWith('_json') && value !== null) values.push(JSON.stringify(value));
      else values.push(SESSION_TEXT_LIMITS[key] ? fitText(value, SESSION_TEXT_LIMITS[key]) : value);
    }
    if (!sets.length) return;
    values.push(id);
    await executor.query(`UPDATE organization_ai_setup_sessions SET ${sets.join(', ')} WHERE organization_ai_setup_session_id = ?`, values);
  },

  async replaceNodes(sessionId, nodes, executor = db) {
    const ownsConnection = executor === db;
    const connection = ownsConnection ? await db.getConnection() : executor;
    try {
      if (ownsConnection) await connection.beginTransaction();
      const [storedRows] = await connection.query(
        'SELECT organization_ai_setup_draft_node_id FROM organization_ai_setup_draft_nodes WHERE organization_ai_setup_session_id = ? FOR UPDATE',
        [sessionId]
      );
      const storedIds = new Set(storedRows.map((row) => row.organization_ai_setup_draft_node_id));
      const newNodes = nodes.filter((node) => !storedIds.has(node.id));
      const generatedIds = await generateBatchIds(
        'organization_ai_setup_draft_nodes',
        'organization_ai_setup_draft_node_id',
        'OSN',
        newNodes.length,
        5,
        connection
      );
      const persistedIdByIncomingId = new Map();
      let generatedIndex = 0;
      for (const node of nodes) {
        persistedIdByIncomingId.set(node.id, storedIds.has(node.id) ? node.id : generatedIds[generatedIndex++]);
      }
      const persistedNodes = nodes.map((node) => ({
        ...node,
        id: persistedIdByIncomingId.get(node.id),
        parent_id: node.parent_id ? persistedIdByIncomingId.get(node.parent_id) || node.parent_id : null,
        reuse_source_node_id: node.reuse_source_node_id
          ? persistedIdByIncomingId.get(node.reuse_source_node_id) || node.reuse_source_node_id
          : null,
        baseline_parent_id: node.baseline_parent_id
          ? persistedIdByIncomingId.get(node.baseline_parent_id) || node.baseline_parent_id
          : null,
      }));
      await connection.query('DELETE FROM organization_ai_setup_draft_nodes WHERE organization_ai_setup_session_id = ?', [sessionId]);
      if (persistedNodes.length) {
        const values = persistedNodes.map((node, index) => [
          node.id, sessionId, node.parent_id || null, node.name, node.entity_type,
          node.source_entity_code || null, node.source_edge_id || null, node.reuse_source_node_id || null, node.baseline_name || null,
          node.baseline_parent_id || null, index,
          node.confidence === null || node.confidence === undefined ? null : node.confidence,
          node.is_ai_generated ? 1 : 0,
          node.is_removed ? 1 : 0
        ]);
        await connection.query(
          `INSERT INTO organization_ai_setup_draft_nodes
           (organization_ai_setup_draft_node_id, organization_ai_setup_session_id, parent_draft_node_id,
            name, entity_type, source_entity_code, source_edge_id, reuse_source_draft_node_id, baseline_name,
            baseline_parent_draft_node_id, sort_order, confidence, is_ai_generated, is_removed) VALUES ?`,
          [values]
        );
      }
      if (ownsConnection) await connection.commit();
      return persistedNodes;
    } catch (error) {
      if (ownsConnection) await connection.rollback().catch(() => {});
      throw error;
    } finally {
      if (ownsConnection) connection.release();
    }
  },
};

module.exports = OrganizationAiSetupModel;
