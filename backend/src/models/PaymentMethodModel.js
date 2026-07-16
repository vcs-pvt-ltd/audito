/**
 * Stores gateway-issued payment tokens only. Card numbers, CVV, expiry data
 * beyond optional display metadata, and bank credentials must never reach this model.
 */
const crypto = require('crypto');
const { db } = require('../config/db');
const { generatePaymentMethodId } = require('../utils/codeGenerator');

function encryptionKey() {
  const raw = String(process.env.PAYMENT_TOKEN_ENCRYPTION_KEY || '').trim();
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('PAYMENT_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 value or 64-character hex value.');
  }
  return key;
}

function encryptToken(token) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    tokenFingerprint: crypto.createHmac('sha256', key).update(token, 'utf8').digest('hex'),
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

const PaymentMethodModel = {
  isEncryptionConfigured() {
    try {
      encryptionKey();
      return true;
    } catch {
      return false;
    }
  },

  async saveGatewayToken({ rootEntityCode, gateway, token, providerCustomerReference, brand, last4, expiryMonth, expiryYear }) {
    const encrypted = encryptToken(token);
    const [existing] = await db.query(
      `SELECT payment_method_id FROM payment_methods
       WHERE root_entity_code = ? AND gateway = ? AND token_fingerprint = ? AND revoked_at IS NULL LIMIT 1`,
      [rootEntityCode, gateway, encrypted.tokenFingerprint]
    );
    const [hasMethod] = await db.query(
      `SELECT payment_method_id FROM payment_methods
       WHERE root_entity_code = ? AND revoked_at IS NULL LIMIT 1`,
      [rootEntityCode]
    );
    const id = existing[0]?.payment_method_id || await generatePaymentMethodId();
    await db.query(
      `INSERT INTO payment_methods
       (payment_method_id, root_entity_code, gateway, token_ciphertext, token_iv, token_auth_tag, token_fingerprint,
        provider_customer_reference, card_brand, card_last4, expiry_month, expiry_year, is_default, consented_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE token_ciphertext = VALUES(token_ciphertext), token_iv = VALUES(token_iv),
         token_auth_tag = VALUES(token_auth_tag), provider_customer_reference = VALUES(provider_customer_reference),
         card_brand = VALUES(card_brand), card_last4 = VALUES(card_last4), expiry_month = VALUES(expiry_month),
         expiry_year = VALUES(expiry_year), revoked_at = NULL, updated_at = NOW()`,
      [id, rootEntityCode, gateway, encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.tokenFingerprint,
        providerCustomerReference, brand, last4, expiryMonth, expiryYear, hasMethod.length ? 0 : 1]
    );
    return this.findActiveById(id, rootEntityCode);
  },

  async findActiveById(paymentMethodId, rootEntityCode) {
    const [rows] = await db.query(
      `SELECT payment_method_id, gateway, card_brand, card_last4, expiry_month, expiry_year, is_default, consented_at, created_at
       FROM payment_methods WHERE payment_method_id = ? AND root_entity_code = ? AND revoked_at IS NULL LIMIT 1`,
      [paymentMethodId, rootEntityCode]
    );
    return rows[0] || null;
  },

  async listActive(rootEntityCode) {
    const [rows] = await db.query(
      `SELECT payment_method_id, gateway, card_brand, card_last4, expiry_month, expiry_year, is_default, consented_at, created_at
       FROM payment_methods WHERE root_entity_code = ? AND revoked_at IS NULL
       ORDER BY is_default DESC, created_at DESC`,
      [rootEntityCode]
    );
    return rows;
  },

  async setDefault(paymentMethodId, rootEntityCode) {
    const method = await this.findActiveById(paymentMethodId, rootEntityCode);
    if (!method) return null;
    await db.query(
      `UPDATE payment_methods SET is_default = CASE WHEN payment_method_id = ? THEN 1 ELSE 0 END, updated_at = NOW()
       WHERE root_entity_code = ? AND revoked_at IS NULL`,
      [paymentMethodId, rootEntityCode]
    );
    return this.findActiveById(paymentMethodId, rootEntityCode);
  },

  async revoke(paymentMethodId, rootEntityCode) {
    const [result] = await db.query(
      `UPDATE payment_methods SET revoked_at = NOW(), is_default = 0, updated_at = NOW()
       WHERE payment_method_id = ? AND root_entity_code = ? AND revoked_at IS NULL`,
      [paymentMethodId, rootEntityCode]
    );
    return result.affectedRows === 1;
  },
};

module.exports = PaymentMethodModel;
