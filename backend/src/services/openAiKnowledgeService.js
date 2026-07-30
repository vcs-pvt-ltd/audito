const fs = require('fs/promises');
const path = require('path');

const OPENAI_URL = 'https://api.openai.com/v1';

const configured = () => Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL);

const openAiRequest = async (endpoint, options = {}) => {
  if (!configured()) {
    const error = new Error('The Audito AI service is not configured. Add OPENAI_API_KEY and OPENAI_MODEL to the backend environment.');
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(`${OPENAI_URL}${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(openAiPublicError(response.status, payload?.error?.code));
    error.statusCode = response.status === 429 ? 429 : 502;
    error.openAiRequestId = response.headers.get('x-request-id') || null;
    throw error;
  }
  return payload;
};

const openAiPublicError = (status, code) => {
  if (status === 401 || status === 403) return 'The Audito AI service could not be authorized. Please contact support.';
  if (status === 429 && code === 'insufficient_quota') return 'The Audito AI service is temporarily unavailable. Please try again later.';
  if (status === 429) return 'The Audito AI service is busy. Please wait a moment and try again.';
  return 'The Audito AI service could not complete this request. Please try again.';
};

const ensureVectorStore = async (existingId) => {
  if (existingId) return existingId;
  const vectorStore = await openAiRequest('/vector_stores', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Audito Public Knowledge Base' }),
  });
  return vectorStore.id;
};

const uploadFile = async ({ buffer, filename, mimeType }) => {
  const formData = new FormData();
  formData.append('purpose', 'assistants');
  formData.append('file', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename);
  return openAiRequest('/files', { method: 'POST', body: formData });
};

const attachFileToVectorStore = async (vectorStoreId, fileId) => openAiRequest(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: fileId }),
});

const waitForVectorFile = async (vectorStoreId, fileId) => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const item = await openAiRequest(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files/${encodeURIComponent(fileId)}`);
    if (item.status === 'completed') return item;
    if (item.status === 'failed' || item.status === 'cancelled') {
      const error = new Error('The document could not be indexed for Audito AI.'); error.statusCode = 422; throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  const error = new Error('The document is still indexing. Please try publishing it again shortly.'); error.statusCode = 504; throw error;
};

const removeFileFromVectorStore = async (vectorStoreId, vectorStoreFileId) => {
  if (!vectorStoreId || !vectorStoreFileId) return;
  try { await openAiRequest(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files/${encodeURIComponent(vectorStoreFileId)}`, { method: 'DELETE' }); }
  catch (_) { /* Remote cleanup should not block an administrative unpublish. */ }
};

const deleteOpenAiFile = async (fileId) => {
  if (!fileId) return;
  try { await openAiRequest(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' }); }
  catch (_) { /* The source is no longer retrievable after vector-store removal. */ }
};

const buildArticleBuffer = (source) => Buffer.from(`# ${source.title}\n\n${source.body_content || ''}\n`, 'utf8');
const readDocumentBuffer = (storagePath) => fs.readFile(path.resolve(storagePath));

const getOutputTextAndCitations = (payload) => {
  const citations = [];
  const text = [];
  for (const item of payload?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if (content?.type !== 'output_text') continue;
      if (content.text) text.push(content.text);
      for (const annotation of content.annotations || []) {
        if (annotation?.type === 'file_citation' && annotation.file_id) citations.push(annotation.file_id);
      }
    }
  }
  return { answer: text.join('\n').trim() || String(payload?.output_text || '').trim(), fileIds: [...new Set(citations)] };
};

module.exports = {
  configured, openAiRequest, ensureVectorStore, uploadFile, attachFileToVectorStore,
  waitForVectorFile, removeFileFromVectorStore, deleteOpenAiFile, buildArticleBuffer,
  readDocumentBuffer, getOutputTextAndCitations,
};
