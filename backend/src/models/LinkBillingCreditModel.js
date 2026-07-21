/**
 * LinkBillingCreditModel
 *
 * Manages billing credits generated when Elite organizations link.
 * Only Elite plans support company-to-company linking; both parties
 * must be on Elite. The credit is computed from the requester's
 * remaining subscription value and applied to the target's next
 * subscription payment.
 */

const { db } = require('../config/db');
const {
  generateLinkBillingCreditId,
  generateLinkCreditApplicationId,
} = require('../utils/codeGenerator');
const { computeAmount, normalizePlanName } = require('./SubscriptionModel');

const LinkBillingCreditModel = {
  /**
   * Generate a billing credit when a link is accepted.
   * Both requester and target must be on Elite.
   * Returns the generated credit row, or null if ineligible.
   */
  async generateCreditOnAccept(link) {
    const requesterCode = link.requester_code;
    const targetCode = link.target_code;

    // Fetch active subscriptions for both parties
    const [reqSubs] = await db.query(
      `SELECT plan_name, billing_cycle, start_date, end_date, is_active
       FROM subscriptions
       WHERE root_entity_code = ? AND is_active = 1 AND end_date > NOW()
       ORDER BY subscription_id DESC LIMIT 1`,
      [requesterCode]
    );
    const [tgtSubs] = await db.query(
      `SELECT plan_name, billing_cycle, start_date, end_date, is_active
       FROM subscriptions
       WHERE root_entity_code = ? AND is_active = 1 AND end_date > NOW()
       ORDER BY subscription_id DESC LIMIT 1`,
      [targetCode]
    );

    const reqSub = reqSubs[0];
    const tgtSub = tgtSubs[0];

    // Both must be Elite
    if (!reqSub || normalizePlanName(reqSub.plan_name) !== 'Elite') return null;
    if (!tgtSub || normalizePlanName(tgtSub.plan_name) !== 'Elite') return null;

    // Only yearly billing generates credits
    if (reqSub.billing_cycle !== 'Yearly') return null;

    // Compute remaining months from requester's end_date
    const endDate = new Date(reqSub.end_date);
    const now = new Date();
    const remainingMs = endDate.getTime() - now.getTime();
    const remainingMonths = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24 * 30.44)));

    if (remainingMonths <= 0) return null;

    // Yearly billed amount for the requester
    const yearlyBilled = await computeAmount('Elite', 'Yearly');

    // Monthly rate = total yearly / 12
    const monthlyRate = yearlyBilled / 12;

    // Credit amount = monthly_rate × remaining_months (capped at the yearly billed)
    const creditAmount = Math.min(Math.round(monthlyRate * remainingMonths * 100) / 100, yearlyBilled);

    if (creditAmount <= 0) return null;

    const creditId = await generateLinkBillingCreditId();
    const organizationLinkId = link.organization_link_id || link.link_code;

    await db.query(
      `INSERT INTO link_billing_credits
        (link_billing_credit_id, organization_link_id, credit_for_entity_code, credit_from_entity_code,
         source_plan_name, source_billing_cycle, source_yearly_billed,
         remaining_months, credit_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        creditId,
        organizationLinkId,
        targetCode,
        requesterCode,
        reqSub.plan_name,
        reqSub.billing_cycle,
        yearlyBilled,
        remainingMonths,
        creditAmount,
      ]
    );

    return {
      link_billing_credit_id: creditId,
      credit_for_entity_code: targetCode,
      credit_from_entity_code: requesterCode,
      source_plan_name: reqSub.plan_name,
      source_billing_cycle: reqSub.billing_cycle,
      source_yearly_billed: yearlyBilled,
      remaining_months: remainingMonths,
      credit_amount: creditAmount,
      applied_amount: 0,
      status: 'active',
    };
  },

  /**
   * Reverse all credits for a link when it is removed.
   * Only active credits are reversed; already-applied credits
   * keep their applications (they've already been consumed).
   */
  async reverseCreditsForLink(linkCode, organizationLinkId) {
    const matchId = organizationLinkId || linkCode;
    const [result] = await db.query(
      `UPDATE link_billing_credits
       SET status = 'reversed', reversed_at = NOW()
       WHERE organization_link_id = ? AND status = 'active'`,
      [matchId]
    );
    return result.affectedRows;
  },

  /**
   * Get all credits (active + applied + reversed) for an entity.
   */
  async listCreditsForEntity(entityCode) {
    const [rows] = await db.query(
      `SELECT * FROM link_billing_credits
       WHERE credit_for_entity_code = ?
       ORDER BY created_at DESC`,
      [entityCode]
    );
    return rows;
  },

  /**
   * Get total available (unapplied) credit amount for an entity.
   */
  async getAvailableCreditAmount(entityCode) {
    const [rows] = await db.query(
      `SELECT COALESCE(SUM(credit_amount - applied_amount), 0) AS available
       FROM link_billing_credits
       WHERE credit_for_entity_code = ? AND status = 'active' AND credit_amount > applied_amount`,
      [entityCode]
    );
    return Number(rows[0]?.available || 0);
  },

  /**
   * Apply available credits to a payment, up to maxAmount.
   * Returns the total applied and records each application.
   */
  async applyCredits(entityCode, paymentTransactionId, maxAmount) {
    const [credits] = await db.query(
      `SELECT link_billing_credit_id, credit_amount, applied_amount
       FROM link_billing_credits
       WHERE credit_for_entity_code = ? AND status = 'active'
         AND credit_amount > applied_amount
       ORDER BY created_at ASC`,
      [entityCode]
    );

    let remaining = maxAmount;
    const applications = [];

    for (const credit of credits) {
      if (remaining <= 0) break;

      const available = Number(credit.credit_amount) - Number(credit.applied_amount);
      if (available <= 0) continue;

      const applyAmount = Math.min(remaining, available);
      const appId = await generateLinkCreditApplicationId();

      await db.query(
        `INSERT INTO link_credit_applications
          (link_credit_application_id, link_billing_credit_id, payment_transaction_id, applied_amount)
         VALUES (?, ?, ?, ?)`,
        [appId, credit.link_billing_credit_id, paymentTransactionId, applyAmount]
      );

      // Update applied_amount on the credit
      const newApplied = Number(credit.applied_amount) + applyAmount;
      const newStatus = newApplied >= Number(credit.credit_amount) ? 'fully_applied' : 'active';
      await db.query(
        `UPDATE link_billing_credits SET applied_amount = ?, status = ? WHERE link_billing_credit_id = ?`,
        [newApplied, newStatus, credit.link_billing_credit_id]
      );

      remaining = Math.round((remaining - applyAmount) * 100) / 100;
      applications.push({
        link_credit_application_id: appId,
        link_billing_credit_id: credit.link_billing_credit_id,
        applied_amount: applyAmount,
      });
    }

    return {
      total_applied: Math.round((maxAmount - remaining) * 100) / 100,
      applications,
    };
  },

  /**
   * Get credit application history for an entity (for billing page display).
   */
  async getCreditApplications(entityCode) {
    const [rows] = await db.query(
      `SELECT lbc.link_billing_credit_id, lbc.credit_for_entity_code, lbc.credit_from_entity_code,
              lbc.source_plan_name, lbc.credit_amount, lbc.applied_amount, lbc.status,
              lbc.created_at,
              lca.link_credit_application_id, lca.payment_transaction_id, lca.applied_amount AS app_amount,
              lca.created_at AS applied_at
       FROM link_billing_credits lbc
       LEFT JOIN link_credit_applications lca ON lca.link_billing_credit_id = lbc.link_billing_credit_id
       WHERE lbc.credit_for_entity_code = ?
       ORDER BY lbc.created_at DESC, lca.created_at ASC`,
      [entityCode]
    );
    return rows;
  },

  /**
   * Get a single credit by ID.
   */
  async findById(creditId) {
    const [rows] = await db.query(
      `SELECT * FROM link_billing_credits WHERE link_billing_credit_id = ?`,
      [creditId]
    );
    return rows[0] || null;
  },
};

module.exports = LinkBillingCreditModel;
