const SubscriptionModel = require('../models/SubscriptionModel');

// Photos may be larger so they stay sharp in reports; video and audio stay at 2 MB.
const MAX_EVIDENCE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_EVIDENCE_MEDIA_BYTES = 2 * 1024 * 1024;
/** Upload limit for any evidence file (the largest per-type limit). */
const MAX_EVIDENCE_BYTES = MAX_EVIDENCE_IMAGE_BYTES;

function getEvidenceMediaType(mimeType) {
  if (String(mimeType || '').startsWith('image/')) return 'image';
  if (String(mimeType || '').startsWith('video/')) return 'video';
  if (String(mimeType || '').startsWith('audio/')) return 'audio';
  return null;
}

/** Why an evidence file of this type and size is too large, or null when it is fine. */
function evidenceSizeProblem(mediaType, bytes) {
  const limit = mediaType === 'image' ? MAX_EVIDENCE_IMAGE_BYTES : MAX_EVIDENCE_MEDIA_BYTES;
  if (bytes <= limit) return null;
  return mediaType === 'image' ? 'Evidence images must be 5MB or less.' : 'Video and audio evidence must be 2MB or less.';
}

async function getEvidencePolicy(rootEntityCode) {
  const planName = await SubscriptionModel.getActivePlan(rootEntityCode);
  const allowRichMedia = Boolean(planName);
  return {
    plan_name: planName,
    allow_rich_media: allowRichMedia,
    allowed_media_types: allowRichMedia ? ['image', 'video', 'audio'] : ['image'],
  };
}

module.exports = {
  MAX_EVIDENCE_BYTES,
  MAX_EVIDENCE_IMAGE_BYTES,
  MAX_EVIDENCE_MEDIA_BYTES,
  evidenceSizeProblem,
  getEvidenceMediaType,
  getEvidencePolicy,
};
