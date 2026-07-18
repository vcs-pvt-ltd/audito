const SubscriptionModel = require('../models/SubscriptionModel');

const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;

function getEvidenceMediaType(mimeType) {
  if (String(mimeType || '').startsWith('image/')) return 'image';
  if (String(mimeType || '').startsWith('video/')) return 'video';
  if (String(mimeType || '').startsWith('audio/')) return 'audio';
  return null;
}

async function getEvidencePolicy(rootEntityCode) {
  const planName = await SubscriptionModel.getActivePlan(rootEntityCode);
  const allowRichMedia = planName === 'Elite' || planName === 'Custom';
  return {
    plan_name: planName,
    allow_rich_media: allowRichMedia,
    allowed_media_types: allowRichMedia ? ['image', 'video', 'audio'] : ['image'],
  };
}

module.exports = {
  MAX_EVIDENCE_BYTES,
  getEvidenceMediaType,
  getEvidencePolicy,
};
