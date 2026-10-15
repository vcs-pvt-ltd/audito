// How customers reach the Audito team. Shown on review screens and in emails.
// AUDITO_CONTACT_EMAIL and AUDITO_WHATSAPP_NUMBER override the defaults.
function auditoContact() {
  const email = (process.env.AUDITO_CONTACT_EMAIL || process.env.PAYMENT_CONTACT_EMAIL || 'hi@audito.cloud').trim();
  const whatsapp = (process.env.AUDITO_WHATSAPP_NUMBER || '+94 77 361 2339').trim();
  const digits = whatsapp.replace(/\D/g, '');
  return { email, whatsapp, whatsapp_url: digits ? `https://wa.me/${digits}` : null };
}

module.exports = { auditoContact };
