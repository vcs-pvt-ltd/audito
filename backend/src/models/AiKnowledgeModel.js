const { db } = require('../config/db');
const { generateAiKnowledgeSettingId } = require('../utils/codeGenerator');

const listSources = async () => {
  const [rows] = await db.query(
    `SELECT ai_knowledge_source_id, source_type, title, category, tags_json, body_content,
            source_file_name, source_mime, status, error_message, published_at,
            created_by, created_at, updated_at
     FROM ai_knowledge_sources
     ORDER BY FIELD(status, 'processing', 'failed', 'draft', 'published', 'archived'), updated_at DESC`
  );
  return rows.map(row => ({ ...row, tags: safeJsonArray(row.tags_json) }));
};

const getSource = async (sourceId) => {
  const [rows] = await db.query('SELECT * FROM ai_knowledge_sources WHERE ai_knowledge_source_id = ? LIMIT 1', [sourceId]);
  return rows[0] ? { ...rows[0], tags: safeJsonArray(rows[0].tags_json) } : null;
};

const createSource = async (source) => {
  await db.query(
    `INSERT INTO ai_knowledge_sources
       (ai_knowledge_source_id, source_type, title, category, tags_json, body_content,
        source_file_name, source_mime, storage_path, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [
      source.ai_knowledge_source_id, source.source_type, source.title, source.category || null,
      JSON.stringify(source.tags || []), source.body_content || null, source.source_file_name || null,
      source.source_mime || null, source.storage_path || null, source.created_by,
    ]
  );
  return getSource(source.ai_knowledge_source_id);
};

const updateSource = async (sourceId, source) => {
  await db.query(
    `UPDATE ai_knowledge_sources
     SET title = ?, category = ?, tags_json = ?, body_content = ?, updated_at = NOW()
     WHERE ai_knowledge_source_id = ?`,
    [source.title, source.category || null, JSON.stringify(source.tags || []), source.body_content || null, sourceId]
  );
  return getSource(sourceId);
};

const updateStatus = async (sourceId, status, data = {}) => {
  await db.query(
    `UPDATE ai_knowledge_sources
     SET status = ?, error_message = ?, openai_file_id = ?, vector_store_file_id = ?,
         published_at = ?, updated_at = NOW()
     WHERE ai_knowledge_source_id = ?`,
    [
      status,
      data.error_message || null,
      data.openai_file_id || null,
      data.vector_store_file_id || null,
      status === 'published' ? new Date() : null,
      sourceId,
    ]
  );
  return getSource(sourceId);
};

const deleteSource = async (sourceId) => db.query('DELETE FROM ai_knowledge_sources WHERE ai_knowledge_source_id = ?', [sourceId]);

const getSetting = async (key) => {
  const [rows] = await db.query('SELECT setting_value FROM ai_knowledge_settings WHERE setting_key = ? LIMIT 1', [key]);
  return rows[0]?.setting_value || null;
};

const setSetting = async (key, value) => {
  const existing = await getSetting(key);
  if (existing !== null) {
    await db.query('UPDATE ai_knowledge_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?', [value, key]);
    return;
  }
  const aiKnowledgeSettingId = await generateAiKnowledgeSettingId();
  await db.query(
    `INSERT INTO ai_knowledge_settings (ai_knowledge_setting_id, setting_key, setting_value)
     VALUES (?, ?, ?)`,
    [aiKnowledgeSettingId, key, value]
  );
};

const getPublishedSourceCount = async () => {
  const [[row]] = await db.query("SELECT COUNT(*) AS count FROM ai_knowledge_sources WHERE status = 'published'");
  return Number(row?.count || 0);
};

const findPublishedByOpenAiFileIds = async (fileIds) => {
  if (!fileIds.length) return [];
  const placeholders = fileIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT ai_knowledge_source_id, title, category, source_file_name, openai_file_id
     FROM ai_knowledge_sources
     WHERE status = 'published' AND openai_file_id IN (${placeholders})`,
    fileIds
  );
  return rows;
};

const safeJsonArray = (value) => {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch (_) { return []; }
};

module.exports = {
  listSources, getSource, createSource, updateSource, updateStatus, deleteSource,
  getSetting, setSetting, getPublishedSourceCount, findPublishedByOpenAiFileIds,
};
