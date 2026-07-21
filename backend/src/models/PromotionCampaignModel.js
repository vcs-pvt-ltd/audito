const { db } = require('../config/db');
const { generatePromotionCampaignId } = require('../utils/codeGenerator');

const PURPOSE_COLUMNS = {
  registration: 'applies_to_registration',
  upgrade: 'applies_to_upgrade',
  renewal: 'applies_to_renewal',
};

function mapCampaigns(campaigns, planRows) {
  const plansByCampaign = planRows.reduce((result, row) => {
    (result[row.campaign_id] ||= []).push({ plan_name: row.plan_name, billing_cycle: row.billing_cycle });
    return result;
  }, {});
  return campaigns.map((campaign) => ({
    ...campaign,
    discount_value: Number(campaign.discount_value),
    priority: Number(campaign.priority || 0),
    is_active: Boolean(campaign.is_active),
    applies_to_registration: Boolean(campaign.applies_to_registration),
    applies_to_upgrade: Boolean(campaign.applies_to_upgrade),
    applies_to_renewal: Boolean(campaign.applies_to_renewal),
    plans: plansByCampaign[campaign.campaign_id] || [],
  }));
}

const PromotionCampaignModel = {
  async list({ activeOnly = false } = {}) {
    const where = activeOnly
      ? 'WHERE is_active = 1 AND starts_at <= NOW() AND ends_at > NOW()'
      : '';
    const [campaigns] = await db.query(
      `SELECT campaign_id, name, description, discount_type, discount_value, priority,
              starts_at, ends_at, applies_to_registration, applies_to_upgrade,
              applies_to_renewal, is_active, created_at, updated_at
       FROM promotion_campaigns ${where}
       ORDER BY is_active DESC, starts_at DESC, campaign_id DESC`
    );
    if (!campaigns.length) return [];
    const ids = campaigns.map((campaign) => campaign.campaign_id);
    const [planRows] = await db.query(
      `SELECT campaign_id, plan_name, billing_cycle
       FROM promotion_campaign_plans WHERE campaign_id IN (?)
       ORDER BY plan_name, billing_cycle`,
      [ids]
    );
    return mapCampaigns(campaigns, planRows);
  },

  async find(campaignId) {
    const [campaigns] = await db.query(
      `SELECT campaign_id, name, description, discount_type, discount_value, priority,
              starts_at, ends_at, applies_to_registration, applies_to_upgrade,
              applies_to_renewal, is_active, created_at, updated_at
       FROM promotion_campaigns WHERE campaign_id = ? LIMIT 1`,
      [campaignId]
    );
    if (!campaigns[0]) return null;
    const [planRows] = await db.query(
      'SELECT campaign_id, plan_name, billing_cycle FROM promotion_campaign_plans WHERE campaign_id = ?',
      [campaignId]
    );
    return mapCampaigns(campaigns, planRows)[0];
  },

  async create(data) {
    const campaignId = await generatePromotionCampaignId();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO promotion_campaigns
         (campaign_id, name, description, discount_type, discount_value, priority,
          starts_at, ends_at, applies_to_registration, applies_to_upgrade, applies_to_renewal, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [campaignId, data.name, data.description || null, data.discount_type, data.discount_value,
          data.priority, data.starts_at, data.ends_at, data.applies_to_registration ? 1 : 0,
          data.applies_to_upgrade ? 1 : 0, data.applies_to_renewal ? 1 : 0, data.is_active ? 1 : 0]
      );
      await connection.query(
        `INSERT INTO promotion_campaign_plans (campaign_id, plan_name, billing_cycle)
         VALUES ?`,
        [data.plans.map((plan) => [campaignId, plan.plan_name, plan.billing_cycle])]
      );
      await connection.commit();
      return this.find(campaignId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async update(campaignId, data) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `UPDATE promotion_campaigns
         SET name = ?, description = ?, discount_type = ?, discount_value = ?, priority = ?,
             starts_at = ?, ends_at = ?, applies_to_registration = ?, applies_to_upgrade = ?,
             applies_to_renewal = ?, is_active = ?
         WHERE campaign_id = ?`,
        [data.name, data.description || null, data.discount_type, data.discount_value, data.priority,
          data.starts_at, data.ends_at, data.applies_to_registration ? 1 : 0,
          data.applies_to_upgrade ? 1 : 0, data.applies_to_renewal ? 1 : 0,
          data.is_active ? 1 : 0, campaignId]
      );
      await connection.query('DELETE FROM promotion_campaign_plans WHERE campaign_id = ?', [campaignId]);
      await connection.query(
        'INSERT INTO promotion_campaign_plans (campaign_id, plan_name, billing_cycle) VALUES ?',
        [data.plans.map((plan) => [campaignId, plan.plan_name, plan.billing_cycle])]
      );
      await connection.commit();
      return this.find(campaignId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async setActive(campaignId, isActive) {
    await db.query('UPDATE promotion_campaigns SET is_active = ? WHERE campaign_id = ?', [isActive ? 1 : 0, campaignId]);
    return this.find(campaignId);
  },

  async resolveBestOffer({ planName, billingCycle, purpose, listAmount }) {
    const purposeColumn = PURPOSE_COLUMNS[purpose];
    if (!purposeColumn || Number(listAmount) <= 0) return null;
    const [campaigns] = await db.query(
      `SELECT c.campaign_id, c.name, c.description, c.discount_type, c.discount_value, c.priority, c.ends_at
       FROM promotion_campaigns c
       INNER JOIN promotion_campaign_plans cp ON cp.campaign_id = c.campaign_id
       WHERE c.is_active = 1 AND c.starts_at <= NOW() AND c.ends_at > NOW()
         AND c.${purposeColumn} = 1 AND cp.plan_name = ?
         AND cp.billing_cycle IN ('Any', ?)
       ORDER BY c.priority DESC, c.starts_at DESC, c.campaign_id DESC`,
      [planName, billingCycle]
    );
    const offer = campaigns.reduce((best, campaign) => {
      const raw = campaign.discount_type === 'percentage'
        ? Number(listAmount) * (Number(campaign.discount_value) / 100)
        : Number(campaign.discount_value);
      const discountAmount = Math.min(Number(listAmount), Math.max(0, Math.round(raw * 100) / 100));
      if (!discountAmount || (best && discountAmount <= best.discount_amount)) return best;
      return {
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        description: campaign.description,
        discount_type: campaign.discount_type,
        discount_value: Number(campaign.discount_value),
        ends_at: campaign.ends_at,
        discount_amount: discountAmount,
        final_amount: Math.round((Number(listAmount) - discountAmount) * 100) / 100,
      };
    }, null);
    return offer;
  },
};

module.exports = PromotionCampaignModel;
