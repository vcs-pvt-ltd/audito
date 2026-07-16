const crypto = require('crypto');

class GatewayConfigurationError extends Error {}

const DEFAULT_FIELDS = {
  merchantId: 'merchant_id',
  transactionId: 'transaction_id',
  amount: 'amount',
  currency: 'currency',
  returnUrl: 'return_url',
  notifyUrl: 'notify_url',
  signature: 'signature',
  status: 'status',
  reference: 'transaction_id',
};

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function getFieldNames() {
  return {
    merchantId: env('SAMPATH_FIELD_MERCHANT_ID', DEFAULT_FIELDS.merchantId),
    transactionId: env('SAMPATH_FIELD_TRANSACTION_ID', DEFAULT_FIELDS.transactionId),
    amount: env('SAMPATH_FIELD_AMOUNT', DEFAULT_FIELDS.amount),
    currency: env('SAMPATH_FIELD_CURRENCY', DEFAULT_FIELDS.currency),
    returnUrl: env('SAMPATH_FIELD_RETURN_URL', DEFAULT_FIELDS.returnUrl),
    notifyUrl: env('SAMPATH_FIELD_NOTIFY_URL', DEFAULT_FIELDS.notifyUrl),
    signature: env('SAMPATH_FIELD_SIGNATURE', DEFAULT_FIELDS.signature),
    status: env('SAMPATH_FIELD_STATUS', DEFAULT_FIELDS.status),
    reference: env('SAMPATH_FIELD_REFERENCE', DEFAULT_FIELDS.reference),
  };
}

function hmac(value, secret) {
  const algorithm = env('SAMPATH_HMAC_ALGORITHM', 'sha256').toLowerCase();
  if (!['sha256', 'sha384', 'sha512'].includes(algorithm)) {
    throw new GatewayConfigurationError('SAMPATH_HMAC_ALGORITHM must be sha256, sha384, or sha512.');
  }
  return crypto.createHmac(algorithm, secret).update(value, 'utf8').digest('hex');
}

function constantTimeEquals(left, right) {
  const a = Buffer.from(String(left || '').trim().toLowerCase(), 'utf8');
  const b = Buffer.from(String(right || '').trim().toLowerCase(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function list(name, fallback) {
  return env(name, fallback).split(',').map((item) => item.trim()).filter(Boolean);
}

function canonicalize(values, fields) {
  const separator = env('SAMPATH_SIGNATURE_SEPARATOR', '|');
  return fields.map((field) => String(values[field] ?? '')).join(separator);
}

function getCheckoutConfig() {
  const gatewayUrl = env('SAMPATH_GATEWAY_URL');
  const merchantId = env('SAMPATH_MERCHANT_ID');
  const requestSecret = env('SAMPATH_REQUEST_HMAC_SECRET');
  const publicApiUrl = env('PUBLIC_API_URL');
  const frontendUrl = env('FRONTEND_URL');

  if (!gatewayUrl || !merchantId || !requestSecret || !publicApiUrl || !frontendUrl) {
    throw new GatewayConfigurationError(
      'Sampath gateway is not configured. Set SAMPATH_GATEWAY_URL, SAMPATH_MERCHANT_ID, SAMPATH_REQUEST_HMAC_SECRET, PUBLIC_API_URL, and FRONTEND_URL.'
    );
  }

  return { gatewayUrl, merchantId, requestSecret, publicApiUrl: publicApiUrl.replace(/\/$/, ''), frontendUrl: frontendUrl.replace(/\/$/, '') };
}

/**
 * Creates a browser-safe hosted-payment request. Card data never touches
 * Audito; the frontend posts these signed fields directly to Sampath.
 *
 * The exact form field names and signing order are configured from the
 * merchant integration guide through environment variables.
 */
function createHostedCheckout(payment, { savePaymentMethod = false } = {}) {
  const config = getCheckoutConfig();
  const fields = getFieldNames();
  const saveField = env('SAMPATH_FIELD_SAVE_PAYMENT_METHOD');
  const saveValue = savePaymentMethod ? env('SAMPATH_SAVE_PAYMENT_METHOD_VALUE', 'true') : '';
  const values = {
    merchantId: config.merchantId,
    transactionId: payment.payment_code,
    amount: Number(payment.amount).toFixed(2),
    currency: payment.currency,
    returnUrl: `${config.publicApiUrl}/api/payments/sampath/return`,
    notifyUrl: `${config.publicApiUrl}/api/payments/sampath/webhook`,
    savePaymentMethod: saveValue,
  };

  const signingFields = list('SAMPATH_REQUEST_SIGNING_FIELDS', 'merchantId,transactionId,amount,currency,returnUrl,notifyUrl');
  const signature = hmac(canonicalize(values, signingFields), config.requestSecret);
  const payload = {
    [fields.merchantId]: values.merchantId,
    [fields.transactionId]: values.transactionId,
    [fields.amount]: values.amount,
    [fields.currency]: values.currency,
    [fields.returnUrl]: values.returnUrl,
    [fields.notifyUrl]: values.notifyUrl,
    [fields.signature]: signature,
  };

  const terminalId = env('SAMPATH_TERMINAL_ID');
  const terminalField = env('SAMPATH_FIELD_TERMINAL_ID');
  if (terminalId && terminalField) payload[terminalField] = terminalId;

  // Sampath must explicitly document the field/value that requests vaulting.
  // Keeping this configurable prevents us from ever collecting card data here.
  if (savePaymentMethod && saveField) {
    payload[saveField] = saveValue;
  }

  return {
    action: config.gatewayUrl,
    method: env('SAMPATH_GATEWAY_METHOD', 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST',
    fields: payload,
  };
}

/**
 * Extracts only a gateway-issued vault token and display metadata.  This is
 * intentionally opt-in and must never be used for PAN, CVV, or cardholder
 * data. Field names come from Sampath's tokenization documentation.
 */
function getSavedMethodCallbackData(payload) {
  const tokenField = env('SAMPATH_CALLBACK_FIELD_PAYMENT_TOKEN');
  if (!tokenField) return null;

  const token = String(payload?.[tokenField] || '').trim();
  if (!token || token.length > 2048) return null;

  const last4 = String(payload?.[env('SAMPATH_CALLBACK_FIELD_CARD_LAST4')] || '').replace(/\D/g, '');
  const expiryMonth = Number(payload?.[env('SAMPATH_CALLBACK_FIELD_CARD_EXPIRY_MONTH')]);
  const expiryYear = Number(payload?.[env('SAMPATH_CALLBACK_FIELD_CARD_EXPIRY_YEAR')]);

  return {
    token,
    providerCustomerReference: String(payload?.[env('SAMPATH_CALLBACK_FIELD_CUSTOMER_REFERENCE')] || '').trim().slice(0, 255) || null,
    brand: String(payload?.[env('SAMPATH_CALLBACK_FIELD_CARD_BRAND')] || '').trim().slice(0, 64) || null,
    last4: /^\d{4}$/.test(last4) ? last4 : null,
    expiryMonth: Number.isInteger(expiryMonth) && expiryMonth >= 1 && expiryMonth <= 12 ? expiryMonth : null,
    expiryYear: Number.isInteger(expiryYear) && expiryYear >= 2000 && expiryYear <= 2200 ? expiryYear : null,
  };
}

function isSavedPaymentMethodConfigured() {
  return Boolean(env('SAMPATH_FIELD_SAVE_PAYMENT_METHOD') && env('SAMPATH_CALLBACK_FIELD_PAYMENT_TOKEN'));
}

function verifyCallback(payload) {
  const callbackSecret = env('SAMPATH_CALLBACK_HMAC_SECRET');
  if (!callbackSecret) {
    throw new GatewayConfigurationError('SAMPATH_CALLBACK_HMAC_SECRET must be set before accepting gateway callbacks.');
  }

  const names = getFieldNames();
  const values = {
    merchantId: payload[names.merchantId],
    transactionId: payload[names.transactionId],
    amount: payload[names.amount],
    currency: payload[names.currency],
    status: payload[names.status],
    reference: payload[names.reference],
  };
  const signingFields = list('SAMPATH_CALLBACK_SIGNING_FIELDS', 'merchantId,transactionId,amount,currency,status,reference');
  const receivedSignature = payload[names.signature];
  const expectedSignature = hmac(canonicalize(values, signingFields), callbackSecret);
  const successValues = list('SAMPATH_SUCCESS_VALUES', 'SUCCESS,PAID,00');

  return {
    valid: constantTimeEquals(receivedSignature, expectedSignature),
    paymentCode: String(values.transactionId || ''),
    gatewayReference: String(values.reference || values.transactionId || ''),
    status: String(values.status || ''),
    successful: successValues.some((value) => value.toUpperCase() === String(values.status || '').toUpperCase()),
  };
}

function getCallbackPaymentCode(payload) {
  const names = getFieldNames();
  return String(payload?.[names.transactionId] || '');
}

function getFrontendPaymentUrl(paymentCode, outcome = 'processing') {
  const frontendUrl = env('FRONTEND_URL');
  if (!frontendUrl) throw new GatewayConfigurationError('FRONTEND_URL must be set.');
  return `${frontendUrl.replace(/\/$/, '')}/payment?code=${encodeURIComponent(paymentCode)}&gateway_return=${encodeURIComponent(outcome)}`;
}

module.exports = {
  GatewayConfigurationError,
  createHostedCheckout,
  verifyCallback,
  getCallbackPaymentCode,
  getFrontendPaymentUrl,
  getSavedMethodCallbackData,
  isSavedPaymentMethodConfigured,
};
