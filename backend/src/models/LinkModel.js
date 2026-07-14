const { db } = require('../config/db');

let securityColumnsReady = false;

async function ensureSecurityColumns() {
  if (securityColumnsReady) return;

  const [keyHashCols] = await db.query(
    `SHOW COLUMNS FROM organization_links LIKE 'verification_key_hash'`
  );
  if (keyHashCols.length === 0) {
    await db.query(
      `ALTER TABLE organization_links ADD COLUMN verification_key_hash varchar(64) NULL AFTER target_level`
    );
  }

  const [verifiedAtCols] = await db.query(
    `SHOW COLUMNS FROM organization_links LIKE 'verification_key_verified_at'`
  );
  if (verifiedAtCols.length === 0) {
    await db.query(
      `ALTER TABLE organization_links ADD COLUMN verification_key_verified_at timestamp NULL DEFAULT NULL AFTER verification_key_hash`
    );
  }

  securityColumnsReady = true;
}

const LinkModel = {
  async create({ organization_link_id, link_code, requester_type, requester_code, requester_level, target_type, target_code, target_level, verification_key_hash }) {
    await ensureSecurityColumns();
    const [result] = await db.query(
      `INSERT INTO organization_links (organization_link_id, link_code, requester_type, requester_code, requester_level, target_type, target_code, target_level, verification_key_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [organization_link_id, link_code, requester_type, requester_code, requester_level, target_type, target_code, target_level, verification_key_hash || null]
    );
    return result;
  },

  async findByCode(link_code) {
    await ensureSecurityColumns();
    const [rows] = await db.query(
      `SELECT * FROM organization_links WHERE link_code = ?`,
      [link_code]
    );
    return rows[0] || null;
  },

  async findExistingLink(requester_type, requester_code, target_type, target_code) {
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE requester_type = ? AND requester_code = ? AND target_type = ? AND target_code = ?
         AND is_active = TRUE`,
      [requester_type, requester_code, target_type, target_code]
    );
    return rows[0] || null;
  },

  async updateStatus(link_code, status, { markKeyVerified = false } = {}) {
    await ensureSecurityColumns();
    const [result] = await db.query(
      `UPDATE organization_links
       SET status = ?,
           responded_at = NOW(),
           verification_key_verified_at = CASE WHEN ? THEN NOW() ELSE verification_key_verified_at END
       WHERE link_code = ?`,
      [status, markKeyVerified ? 1 : 0, link_code]
    );
    return result;
  },

  async findExistingActiveLinkBetween(codeA, codeB) {
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE ((requester_code = ? AND target_code = ?) OR (requester_code = ? AND target_code = ?))
         AND status IN ('pending', 'accepted')
         AND is_active = TRUE
       LIMIT 1`,
      [codeA, codeB, codeB, codeA]
    );
    return rows[0] || null;
  },

  async updateVerificationKey(link_code, verification_key_hash) {
    await ensureSecurityColumns();
    const [result] = await db.query(
      `UPDATE organization_links
       SET verification_key_hash = ?, verification_key_verified_at = NULL
       WHERE link_code = ?`,
      [verification_key_hash || null, link_code]
    );
    return result;
  },

  async getLinksForEntity(entity_type, entity_code) {
    await ensureSecurityColumns();
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE ((requester_type = ? AND requester_code = ?) OR (target_type = ? AND target_code = ?))
         AND is_active = TRUE
       ORDER BY created_at DESC`,
      [entity_type, entity_code, entity_type, entity_code]
    );
    return rows;
  },

  async getAcceptedLinks(entity_type, entity_code) {
    await ensureSecurityColumns();
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE ((requester_type = ? AND requester_code = ?) OR (target_type = ? AND target_code = ?))
         AND status = 'accepted' AND is_active = TRUE`,
      [entity_type, entity_code, entity_type, entity_code]
    );
    return rows;
  },

  async getPendingRequests(entity_type, entity_code) {
    await ensureSecurityColumns();
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE target_type = ? AND target_code = ? AND status = 'pending' AND is_active = TRUE
       ORDER BY requested_at DESC`,
      [entity_type, entity_code]
    );
    return rows;
  },

  async remove(link_code) {
    const [result] = await db.query(
      `DELETE FROM organization_links WHERE link_code = ?`,
      [link_code]
    );
    return result;
  }
};

module.exports = LinkModel;
