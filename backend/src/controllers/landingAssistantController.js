const { generateLandingAssistantReply } = require('../services/landingAssistantService');
const { successResponse, errorResponse } = require('../utils/helpers');

const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;
const rateLimits = new Map();

const getClientKey = (req) => String(req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
const removeControlCharacters = (value) => value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

const checkRateLimit = (key) => {
  const now = Date.now();
  if (rateLimits.size > 10000) {
    for (const [rateKey, rate] of rateLimits.entries()) {
      if (now - rate.startedAt >= RATE_WINDOW_MS) rateLimits.delete(rateKey);
    }
  }
  const entry = rateLimits.get(key);
  if (!entry || now - entry.startedAt >= RATE_WINDOW_MS) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) return false;
  entry.count += 1;
  return true;
};

const sendLandingAssistantMessage = async (req, res) => {
  const message = removeControlCharacters(String(req.body?.message || ''));
  if (!message || message.length > 1000) return errorResponse(res, 'Enter a question with no more than 1,000 characters.', 400);
  if (!checkRateLimit(getClientKey(req))) return errorResponse(res, 'Too many messages. Please wait a minute and try again.', 429);

  try {
    const reply = await generateLandingAssistantReply(message);
    return successResponse(res, reply, 'Assistant response ready.');
  } catch (error) {
    return errorResponse(res, error.message || 'The Audito Guide is temporarily unavailable.', error.statusCode || 502);
  }
};

module.exports = { sendLandingAssistantMessage };
