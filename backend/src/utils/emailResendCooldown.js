const RESEND_COOLDOWN_MS = 30 * 1000;
const resendAttempts = new Map();

const normalizedKey = (key) => String(key || '').trim().toLowerCase();

const getResendCooldownSeconds = (key) => {
  const safeKey = normalizedKey(key);
  if (!safeKey) return 0;

  const lastSentAt = resendAttempts.get(safeKey);
  if (!lastSentAt) return 0;

  const remainingMs = RESEND_COOLDOWN_MS - (Date.now() - lastSentAt);
  if (remainingMs <= 0) {
    resendAttempts.delete(safeKey);
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
};

const recordResend = (key) => {
  const safeKey = normalizedKey(key);
  if (safeKey) resendAttempts.set(safeKey, Date.now());
};

module.exports = { RESEND_COOLDOWN_MS, getResendCooldownSeconds, recordResend };
