const AUDITO_AI_UNAVAILABLE_MESSAGE = 'Audito AI is temporarily unavailable. Please try again in a few moments.';

function createAuditoAiUnavailableError({ statusCode = 503, requestId = null } = {}) {
  const error = new Error(AUDITO_AI_UNAVAILABLE_MESSAGE);
  error.statusCode = statusCode;
  error.openAiRequestId = requestId;
  error.isAiProviderError = true;
  return error;
}

module.exports = { AUDITO_AI_UNAVAILABLE_MESSAGE, createAuditoAiUnavailableError };
