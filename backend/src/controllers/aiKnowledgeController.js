const fs = require('fs/promises');
const path = require('path');
const AiKnowledgeModel = require('../models/AiKnowledgeModel');
const {
  ensureVectorStore, uploadFile, attachFileToVectorStore, waitForVectorFile,
  removeFileFromVectorStore, deleteOpenAiFile, buildArticleBuffer, readDocumentBuffer,
} = require('../services/openAiKnowledgeService');
const { generateTableId } = require('../utils/codeGenerator');
const { successResponse, errorResponse } = require('../utils/helpers');

const AI_PUBLIC_UPLOAD_DIR = path.resolve(__dirname, '../public/uploads/ai-knowledge');
const LEGACY_AI_STORAGE_DIR = path.resolve(__dirname, '../storage/ai-knowledge');
const MAX_ARTICLE_LENGTH = 50000;

const cleanText = (value, max = 255) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const readTags = (value) => {
  const input = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(input.map(tag => cleanText(tag, 40)).filter(Boolean))].slice(0, 12);
};
const safeFileName = (fileName) => path.basename(String(fileName || 'knowledge-document')).replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 160);
const resolveKnowledgeFilePath = (storagePath) => {
  const storedPath = String(storagePath || '').trim();
  if (!storedPath) return null;

  // New uploads use the same public-relative path convention as audit evidence.
  if (storedPath.startsWith('/uploads/ai-knowledge/')) {
    const resolved = path.resolve(__dirname, '../public', `.${storedPath}`);
    return resolved.startsWith(`${AI_PUBLIC_UPLOAD_DIR}${path.sep}`) ? resolved : null;
  }

  // Supports any draft that was saved before the public-upload update.
  const resolved = path.resolve(storedPath);
  return resolved.startsWith(`${LEGACY_AI_STORAGE_DIR}${path.sep}`) ? resolved : null;
};

const deleteKnowledgeFile = async (storagePath) => {
  const resolvedPath = resolveKnowledgeFilePath(storagePath);
  if (!resolvedPath) return;
  await fs.unlink(resolvedPath).catch(() => {});
};

const listKnowledgeSources = async (_req, res) => {
  try { return successResponse(res, await AiKnowledgeModel.listSources(), 'Knowledge sources retrieved.'); }
  catch (error) { console.error('listKnowledgeSources error:', error); return errorResponse(res, 'Failed to retrieve AI knowledge sources.', 500); }
};

const createArticle = async (req, res) => {
  const title = cleanText(req.body?.title, 180);
  const bodyContent = String(req.body?.body_content || '').trim();
  if (!title || !bodyContent) return errorResponse(res, 'Article title and content are required.', 400);
  if (bodyContent.length > MAX_ARTICLE_LENGTH) return errorResponse(res, 'Article content must be 50,000 characters or fewer.', 400);
  try {
    const sourceId = await generateTableId('ai_knowledge_sources', 'ai_knowledge_source_id', 'AIKB', 5);
    const source = await AiKnowledgeModel.createSource({
      ai_knowledge_source_id: sourceId, source_type: 'article', title,
      category: cleanText(req.body?.category, 80), tags: readTags(req.body?.tags),
      body_content: bodyContent, created_by: req.user.userCode,
    });
    return successResponse(res, { source }, 'Article saved as a draft.');
  } catch (error) { console.error('createAiKnowledgeArticle error:', error); return errorResponse(res, 'Failed to save the knowledge article.', 500); }
};

const createDocument = async (req, res) => {
  const title = cleanText(req.body?.title, 180);
  if (!title || !req.file) return errorResponse(res, 'Document title and file are required.', 400);
  let storagePath = null;
  try {
    const sourceId = await generateTableId('ai_knowledge_sources', 'ai_knowledge_source_id', 'AIKB', 5);
    await fs.mkdir(AI_PUBLIC_UPLOAD_DIR, { recursive: true });
    const fileName = safeFileName(req.file.originalname);
    const storedFileName = `${sourceId}-${fileName}`;
    const absoluteFilePath = path.join(AI_PUBLIC_UPLOAD_DIR, storedFileName);
    storagePath = `/uploads/ai-knowledge/${storedFileName}`;
    await fs.writeFile(absoluteFilePath, req.file.buffer, { flag: 'wx' });
    const source = await AiKnowledgeModel.createSource({
      ai_knowledge_source_id: sourceId, source_type: 'document', title,
      category: cleanText(req.body?.category, 80), tags: readTags(req.body?.tags),
      source_file_name: fileName, source_mime: req.file.mimetype || 'application/octet-stream',
      storage_path: storagePath, created_by: req.user.userCode,
    });
    return successResponse(res, { source }, 'Document saved as a draft.');
  } catch (error) {
    await deleteKnowledgeFile(storagePath);
    console.error('createAiKnowledgeDocument error:', error);
    return errorResponse(res, 'Failed to save the knowledge document.', 500);
  }
};

const updateSource = async (req, res) => {
  const sourceId = cleanText(req.params.sourceId, 30);
  const title = cleanText(req.body?.title, 180);
  const bodyContent = String(req.body?.body_content || '').trim();
  if (!title) return errorResponse(res, 'Title is required.', 400);
  if (bodyContent.length > MAX_ARTICLE_LENGTH) return errorResponse(res, 'Article content must be 50,000 characters or fewer.', 400);
  try {
    const source = await AiKnowledgeModel.getSource(sourceId);
    if (!source) return errorResponse(res, 'Knowledge source not found.', 404);
    if (source.status === 'published' || source.status === 'processing') return errorResponse(res, 'Unpublish this source before editing it.', 409);
    if (source.source_type === 'article' && !bodyContent) return errorResponse(res, 'Article content is required.', 400);
    const updated = await AiKnowledgeModel.updateSource(sourceId, {
      title, category: cleanText(req.body?.category, 80), tags: readTags(req.body?.tags),
      body_content: source.source_type === 'article' ? bodyContent : null,
    });
    return successResponse(res, { source: updated }, 'Knowledge source updated.');
  } catch (error) { console.error('updateAiKnowledgeSource error:', error); return errorResponse(res, 'Failed to update the knowledge source.', 500); }
};

const publishSource = async (req, res) => {
  const sourceId = cleanText(req.params.sourceId, 30);
  let source;
  try {
    source = await AiKnowledgeModel.getSource(sourceId);
    if (!source) return errorResponse(res, 'Knowledge source not found.', 404);
    if (source.status === 'published') return successResponse(res, { source }, 'Knowledge source is already published.');
    await AiKnowledgeModel.updateStatus(sourceId, 'processing');

    const existingVectorStoreId = await AiKnowledgeModel.getSetting('public_vector_store_id');
    const vectorStoreId = await ensureVectorStore(existingVectorStoreId);
    if (!existingVectorStoreId) await AiKnowledgeModel.setSetting('public_vector_store_id', vectorStoreId);

    let buffer;
    if (source.source_type === 'article') {
      buffer = buildArticleBuffer(source);
    } else {
      const documentPath = resolveKnowledgeFilePath(source.storage_path);
      if (!documentPath) {
        const error = new Error('The saved knowledge document is unavailable. Upload it again before publishing.');
        error.statusCode = 404;
        throw error;
      }
      buffer = await readDocumentBuffer(documentPath);
    }
    const filename = source.source_type === 'article' ? `${safeFileName(source.title)}.md` : source.source_file_name;
    const mimeType = source.source_type === 'article' ? 'text/markdown' : source.source_mime;
    const openAiFile = await uploadFile({ buffer, filename, mimeType });
    await attachFileToVectorStore(vectorStoreId, openAiFile.id);
    await waitForVectorFile(vectorStoreId, openAiFile.id);
    const published = await AiKnowledgeModel.updateStatus(sourceId, 'published', {
      openai_file_id: openAiFile.id, vector_store_file_id: openAiFile.id,
    });
    return successResponse(res, { source: published }, 'Knowledge source published and indexed for Audito AI.');
  } catch (error) {
    if (sourceId) await AiKnowledgeModel.updateStatus(sourceId, 'failed', { error_message: error.message }).catch(() => {});
    console.error('publishAiKnowledgeSource error:', { message: error.message, requestId: error.openAiRequestId || null });
    return errorResponse(res, error.message || 'Failed to publish the knowledge source.', error.statusCode || 500);
  }
};

const unpublishSource = async (req, res) => {
  const sourceId = cleanText(req.params.sourceId, 30);
  try {
    const source = await AiKnowledgeModel.getSource(sourceId);
    if (!source) return errorResponse(res, 'Knowledge source not found.', 404);
    const vectorStoreId = await AiKnowledgeModel.getSetting('public_vector_store_id');
    await removeFileFromVectorStore(vectorStoreId, source.vector_store_file_id || source.openai_file_id);
    await deleteOpenAiFile(source.openai_file_id);
    const updated = await AiKnowledgeModel.updateStatus(sourceId, 'draft');
    return successResponse(res, { source: updated }, 'Knowledge source removed from Audito AI.');
  } catch (error) { console.error('unpublishAiKnowledgeSource error:', error); return errorResponse(res, 'Failed to unpublish the knowledge source.', 500); }
};

const deleteSource = async (req, res) => {
  const sourceId = cleanText(req.params.sourceId, 30);
  try {
    const source = await AiKnowledgeModel.getSource(sourceId);
    if (!source) return errorResponse(res, 'Knowledge source not found.', 404);
    const vectorStoreId = await AiKnowledgeModel.getSetting('public_vector_store_id');
    await removeFileFromVectorStore(vectorStoreId, source.vector_store_file_id || source.openai_file_id);
    await deleteOpenAiFile(source.openai_file_id);
    await deleteKnowledgeFile(source.storage_path);
    await AiKnowledgeModel.deleteSource(sourceId);
    return successResponse(res, null, 'Knowledge source deleted.');
  } catch (error) { console.error('deleteAiKnowledgeSource error:', error); return errorResponse(res, 'Failed to delete the knowledge source.', 500); }
};

module.exports = { listKnowledgeSources, createArticle, createDocument, updateSource, publishSource, unpublishSource, deleteSource };
