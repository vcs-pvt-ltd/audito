const { generateLandingAssistantReply } = require('../services/landingAssistantService');
const { createLandingVoiceSession } = require('../services/landingVoiceService');
const { successResponse, errorResponse } = require('../utils/helpers');

const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const rateLimits = new Map();
const voiceRateLimits = new Map();

const getClientKey = (req) => String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
const removeControlCharacters = (value) => value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
const readHistory = (value) => {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).flatMap(item => {
    const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : null;
    const content = removeControlCharacters(String(item?.content || '')).slice(0, 1000);
    return role && content ? [{ role, content }] : [];
  });
};

const checkRateLimit = (store, key, maximum) => {
  const now = Date.now();
  if (store.size > 10000) {
    for (const [rateKey, rate] of store.entries()) {
      if (now - rate.startedAt >= RATE_WINDOW_MS) store.delete(rateKey);
    }
  }
  const entry = store.get(key);
  if (!entry || now - entry.startedAt >= RATE_WINDOW_MS) {
    store.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (entry.count >= maximum) return false;
  entry.count += 1;
  return true;
};

const sendLandingAssistantMessage = async (req, res) => {
  const message = removeControlCharacters(String(req.body?.message || ''));
  if (!message || message.length > 1000) return errorResponse(res, 'Enter a question with no more than 1,000 characters.', 400);
  if (!checkRateLimit(rateLimits, getClientKey(req), MAX_REQUESTS_PER_WINDOW)) return errorResponse(res, 'Too many messages. Please wait a minute and try again.', 429);

  try {
    const reply = await generateLandingAssistantReply(message, readHistory(req.body?.history));
    return successResponse(res, reply, 'Assistant response ready.');
  } catch (error) {
    return errorResponse(res, error.message || 'The Audito Guide is temporarily unavailable.', error.statusCode || 502);
  }
};

const createLandingAssistantVoiceSession = async (req, res) => {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(voiceRateLimits, clientKey, 5)) {
    return errorResponse(res, 'Too many voice sessions. Please wait a minute and try again.', 429);
  }
  try {
    const session = await createLandingVoiceSession({ clientKey, history: readHistory(req.body?.history) });
    return successResponse(res, session, 'Voice session ready.');
  } catch (error) {
    console.error('createLandingAssistantVoiceSession error:', { message: error.message, requestId: error.openAiRequestId || null });
    return errorResponse(res, error.message || 'Audito voice is temporarily unavailable.', error.statusCode || 502);
  }
};

module.exports = { sendLandingAssistantMessage, createLandingAssistantVoiceSession };
