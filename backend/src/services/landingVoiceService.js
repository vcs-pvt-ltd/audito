const crypto = require('crypto');
const { getLandingPageContent } = require('./landingPageContentService');
const { buildGroundedInstructions } = require('./landingAssistantService');
const { AUDITO_AI_UNAVAILABLE_MESSAGE, createAuditoAiUnavailableError } = require('../utils/aiErrors');

const OPENAI_CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/client_secrets';
const DEFAULT_REALTIME_MODEL = 'gpt-realtime-2.1';
const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_VOICE = 'marin';

const safetyIdentifier = (clientKey) => {
  const secret = process.env.OPENAI_SAFETY_IDENTIFIER_SECRET || process.env.JWT_SECRET || process.env.OPENAI_API_KEY;
  return `audito-guest-${crypto.createHmac('sha256', secret).update(String(clientKey || 'unknown')).digest('hex').slice(0, 32)}`;
};

const createLandingVoiceSession = async ({ clientKey, history = [] }) => {
  if (!process.env.OPENAI_API_KEY || !process.env.FRONTEND_URL) {
    console.error('Audito landing voice is not configured on the backend.');
    const error = new Error(AUDITO_AI_UNAVAILABLE_MESSAGE);
    error.statusCode = 503;
    throw error;
  }
  const page = await getLandingPageContent();
  const response = await fetch(OPENAI_CLIENT_SECRET_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': safetyIdentifier(clientKey),
    },
    body: JSON.stringify({
      expires_after: { anchor: 'created_at', seconds: 600 },
      session: {
        type: 'realtime',
        model: process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL,
        instructions: buildGroundedInstructions(page, { voice: true, history }),
        max_output_tokens: 700,
        output_modalities: ['audio'],
        audio: {
          input: {
            transcription: { model: process.env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 650,
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            voice: process.env.OPENAI_REALTIME_VOICE || DEFAULT_VOICE,
            speed: 1,
          },
        },
      },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.value) {
    const requestId = response.headers.get('x-request-id') || null;
    console.error('OpenAI landing voice session request failed:', {
      status: response.status,
      requestId,
      code: payload?.error?.code || payload?.error?.type || '',
      reason: payload?.error?.message || 'Unknown provider error',
    });
    throw createAuditoAiUnavailableError({ statusCode: response.status === 429 ? 429 : 503, requestId });
  }
  return {
    value: payload.value,
    expires_at: payload.expires_at,
    model: payload.session?.model || process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL,
    voice: payload.session?.audio?.output?.voice || process.env.OPENAI_REALTIME_VOICE || DEFAULT_VOICE,
  };
};

module.exports = { createLandingVoiceSession };
