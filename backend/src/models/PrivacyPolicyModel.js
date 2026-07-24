const { db } = require('../config/db');
const { generatePrivacyPolicyId, generatePrivacyPolicyAgreementId } = require('../utils/codeGenerator');

const normalizeSections = (sections) => (Array.isArray(sections) ? sections : []).map((section) => ({
  title: String(section?.title || '').trim(),
  content: String(section?.content || '').trim(),
})).filter((section) => section.title && section.content);

const PrivacyPolicyModel = {
  normalizeSections,

  async getPublished() {
    const [rows] = await db.query(
      `SELECT privacy_policy_id, title, version, intro, sections_json, effective_date, published_at
       FROM privacy_policies WHERE status = 'published' AND is_current = 1 LIMIT 1`
    );
    if (!rows[0]) return null;
    return { ...rows[0], sections: typeof rows[0].sections_json === 'string' ? JSON.parse(rows[0].sections_json) : rows[0].sections_json || [] };
  },

  async list() {
    const [rows] = await db.query(
      `SELECT p.privacy_policy_id, p.title, p.version, p.intro, p.sections_json, p.status, p.is_current,
              p.effective_date, p.published_at, p.created_at, p.updated_at,
              COUNT(a.id) AS agreement_count
       FROM privacy_policies p
       LEFT JOIN privacy_policy_agreements a ON a.privacy_policy_id = p.privacy_policy_id
       GROUP BY p.id ORDER BY p.created_at DESC`
    );
    return rows.map((row) => ({ ...row, agreement_count: Number(row.agreement_count), sections: typeof row.sections_json === 'string' ? JSON.parse(row.sections_json) : row.sections_json || [] }));
  },

  async find(policyId) {
    const [rows] = await db.query('SELECT * FROM privacy_policies WHERE privacy_policy_id = ? LIMIT 1', [policyId]);
    if (!rows[0]) return null;
    return { ...rows[0], sections: typeof rows[0].sections_json === 'string' ? JSON.parse(rows[0].sections_json) : rows[0].sections_json || [] };
  },

  async create({ title, intro, sections, createdBy }) {
    const privacyPolicyId = await generatePrivacyPolicyId();
    const [versionRow] = await db.query('SELECT COUNT(*) AS count FROM privacy_policies');
    const version = `v${Number(versionRow[0].count) + 1}.0`;
    await db.query(
      `INSERT INTO privacy_policies (privacy_policy_id, title, version, intro, sections_json, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [privacyPolicyId, title, version, intro, JSON.stringify(normalizeSections(sections)), createdBy]
    );
    return this.find(privacyPolicyId);
  },

  async update(policyId, { title, intro, sections }) {
    const policy = await this.find(policyId);
    if (!policy) return null;
    const [agreements] = await db.query('SELECT COUNT(*) AS count FROM privacy_policy_agreements WHERE privacy_policy_id = ?', [policyId]);
    if (policy.status !== 'draft' && Number(agreements[0].count) > 0) {
      const error = new Error('This published policy is locked because users have already agreed to it. Create a new policy version instead.');
      error.statusCode = 409;
      throw error;
    }
    await db.query(
      `UPDATE privacy_policies SET title = ?, intro = ?, sections_json = ? WHERE privacy_policy_id = ?`,
      [title, intro, JSON.stringify(normalizeSections(sections)), policyId]
    );
    return this.find(policyId);
  },

  async publish(policyId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query('SELECT privacy_policy_id FROM privacy_policies WHERE privacy_policy_id = ? FOR UPDATE', [policyId]);
      if (!rows[0]) {
        await connection.rollback();
        return null;
      }
      await connection.query("UPDATE privacy_policies SET status = 'archived', is_current = 0 WHERE status = 'published' AND privacy_policy_id <> ?", [policyId]);
      await connection.query("UPDATE privacy_policies SET status = 'published', is_current = 1, effective_date = CURDATE(), published_at = NOW() WHERE privacy_policy_id = ?", [policyId]);
      await connection.commit();
      return this.find(policyId);
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  },

  async remove(policyId) {
    const policy = await this.find(policyId);
    if (!policy) return null;

    const [agreements] = await db.query(
      'SELECT COUNT(*) AS count FROM privacy_policy_agreements WHERE privacy_policy_id = ?',
      [policyId]
    );
    if (Number(agreements[0].count) > 0) {
      const error = new Error('This privacy policy cannot be deleted because registrations have already accepted it.');
      error.statusCode = 409;
      throw error;
    }
    if (policy.status === 'published' && policy.is_current) {
      const error = new Error('Publish another privacy policy before deleting the current registration policy.');
      error.statusCode = 409;
      throw error;
    }

    await db.query('DELETE FROM privacy_policies WHERE privacy_policy_id = ?', [policyId]);
    return true;
  },

  async recordAgreement(connection, { privacyPolicyId, adminId, rootEntityCode, email, ipAddress, userAgent }) {
    const agreementId = await generatePrivacyPolicyAgreementId();
    await connection.query(
      `INSERT INTO privacy_policy_agreements
       (privacy_policy_agreement_id, privacy_policy_id, admin_id, root_entity_code, accepted_by_email, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [agreementId, privacyPolicyId, adminId || null, rootEntityCode, email, ipAddress || null, userAgent || null]
    );
  },
};

module.exports = PrivacyPolicyModel;
