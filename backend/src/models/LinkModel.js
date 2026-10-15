const { db } = require('../config/db');

const LinkModel = {
  async create({
    organization_link_id,
    link_code,
    requester_type,
    requester_code,
    requester_level,
    target_type,
    target_code,
    target_level,
    target_workspace_type,
    target_workspace_code,
    target_org_tree_id = null,
    verification_key_hash,
  }) {
    const [result] = await db.query(
      `INSERT INTO organization_links
        (organization_link_id, link_code, requester_type, requester_code, requester_level,
         target_type, target_code, target_level, target_workspace_type, target_workspace_code,
         target_org_tree_id, verification_key_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organization_link_id,
        link_code,
        requester_type,
        requester_code,
        requester_level,
        target_type,
        target_code,
        target_level,
        target_workspace_type,
        target_workspace_code,
        target_org_tree_id,
        verification_key_hash || null,
      ]
    );
    return result;
  },

  async findByCode(link_code) {
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
    const [result] = await db.query(
      `UPDATE organization_links
       SET status = ?,
           responded_at = NOW(),
           verification_key_verified_at = CASE WHEN ? THEN NOW() ELSE verification_key_verified_at END
       WHERE link_code = ?`,
      [status, Boolean(markKeyVerified), link_code]
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

  async removeRejectedLink(requester_type, requester_code, target_type, target_code) {
    const [result] = await db.query(
      `DELETE FROM organization_links
       WHERE requester_type = ? AND requester_code = ?
         AND target_type = ? AND target_code = ?
         AND status = 'rejected'`,
      [requester_type, requester_code, target_type, target_code]
    );
    return result;
  },

  async updateVerificationKey(link_code, verification_key_hash) {
    const [result] = await db.query(
      `UPDATE organization_links
       SET verification_key_hash = ?, verification_key_verified_at = NULL
       WHERE link_code = ?`,
      [verification_key_hash || null, link_code]
    );
    return result;
  },

  async getLinksForEntity(entity_type, entity_code) {
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE ((requester_type = ? AND requester_code = ?)
          OR (target_type = ? AND target_code = ?)
          OR (COALESCE(target_workspace_type, target_type) = ?
              AND COALESCE(target_workspace_code, target_code) = ?))
         AND is_active = TRUE
       ORDER BY created_at DESC`,
      [entity_type, entity_code, entity_type, entity_code, entity_type, entity_code]
    );
    return rows;
  },

  async getAcceptedLinks(entity_type, entity_code) {
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE ((requester_type = ? AND requester_code = ?)
          OR (target_type = ? AND target_code = ?)
          OR (COALESCE(target_workspace_type, target_type) = ?
              AND COALESCE(target_workspace_code, target_code) = ?))
         AND status = 'accepted' AND is_active = TRUE`,
      [entity_type, entity_code, entity_type, entity_code, entity_type, entity_code]
    );
    return rows;
  },

  /**
   * Every accepted organization link is directional for token pooling: the
   * requester's wallet joins the workspace that approved the target entity.
   * For child targets, target_workspace_code identifies that approving root.
   */
  async getAcceptedTokenSponsors(target_workspace_code) {
    const [rows] = await db.query(
      `SELECT org_link.link_code, org_link.requester_type, org_link.requester_code,
              org_link.target_type, org_link.target_code,
              COALESCE(org_link.target_workspace_code, org_link.target_code) AS target_workspace_code
         FROM organization_links org_link
        WHERE COALESCE(org_link.target_workspace_code, org_link.target_code) = ?
          AND org_link.status = 'accepted'
          AND org_link.is_active = TRUE
        ORDER BY org_link.created_at ASC`,
      [target_workspace_code]
    );
    return rows;
  },

  async getPendingRequests(entity_type, entity_code) {
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE COALESCE(target_workspace_type, target_type) = ?
         AND COALESCE(target_workspace_code, target_code) = ?
         AND status = 'pending' AND is_active = TRUE
       ORDER BY requested_at DESC`,
      [entity_type, entity_code]
    );
    return rows;
  },

  async findActiveByTargetTreeIds(target_org_tree_ids) {
    const ids = [...new Set((target_org_tree_ids || []).filter(Boolean))];
    if (ids.length === 0) return null;
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT * FROM organization_links
       WHERE target_org_tree_id IN (${placeholders})
         AND status IN ('pending', 'accepted')
         AND is_active = TRUE
       LIMIT 1`,
      ids
    );
    return rows[0] || null;
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
