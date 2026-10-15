const { db } = require('../config/db');
const TokenWalletModel = require('../models/TokenWalletModel');
const PaymentModel = require('../models/PaymentModel');
const PromotionCampaignModel = require('../models/PromotionCampaignModel');
const AdminModel = require('../models/AdminModel');
const { getOrgName } = require('../utils/orgLookup');
const { successResponse, errorResponse } = require('../utils/helpers');
const SubscriptionModel = require('../models/SubscriptionModel');
const PackagePricingModel = require('../models/PackagePricingModel');
const { settleVerifiedPayment } = require('../services/paymentSettlementService');

function walletProjection(wallet) {
  return {
    root_entity_code: wallet.root_entity_code,
    available_tokens: Number(wallet.available_tokens || 0),
    held_tokens: Number(wallet.held_tokens || 0),
    lifetime_burned_tokens: Number(wallet.lifetime_burned_tokens || 0),
    plan_name: wallet.plan.plan_name,
    token_unit_price: Number(wallet.plan.token_unit_price || 0),
    daily_free_tokens: Number(wallet.plan.daily_free_tokens || 0),
    wallet_members: (wallet.wallet_members || []).map((member) => ({
      root_entity_code: member.root_entity_code,
      source: member.source,
      link_code: member.link_code,
      display_name: member.display_name,
      entity_type: member.entity_type,
      available_tokens: Number(member.available_tokens || 0),
      held_tokens: Number(member.held_tokens || 0),
      lifetime_burned_tokens: Number(member.lifetime_burned_tokens || 0),
    })),
  };
}

const getWallet = async (req, res) => {
  try {
    const wallet = await TokenWalletModel.getWallet(req.user.entityCode);
    return successResponse(res, { wallet: walletProjection(wallet) });
  } catch (error) {
    console.error('getTokenWallet error:', error);
    return errorResponse(res, 'Failed to load the token wallet.', 500);
  }
};

const listLedger = async (req, res) => {
  try {
    const entries = await TokenWalletModel.listLedger(req.user.entityCode, req.query.limit);
    return successResponse(res, { entries });
  } catch (error) {
    console.error('listTokenLedger error:', error);
    return errorResponse(res, 'Failed to load token history.', 500);
  }
};

const listPackages = async (req, res) => {
  try {
    const wallet = await TokenWalletModel.getWallet(req.user.entityCode);
    const [packages] = await db.query(
      `SELECT token_reload_package_id, display_name, token_quantity, bonus_token_quantity
         FROM token_reload_packages
        WHERE is_active = 1
        ORDER BY token_quantity, bonus_token_quantity, display_name`
    );
    const unitPrice = Number(wallet.plan.token_unit_price || 0);
    return successResponse(res, {
      plan_name: wallet.plan.plan_name,
      token_unit_price: unitPrice,
      packages: packages.map((item) => ({
        ...item,
        token_quantity: Number(item.token_quantity),
        bonus_token_quantity: Number(item.bonus_token_quantity),
        amount: Math.round(Number(item.token_quantity) * unitPrice * 100) / 100,
        currency: 'USD',
      })),
    });
  } catch (error) {
    console.error('listTokenPackages error:', error);
    return errorResponse(res, 'Failed to load token reload packages.', 500);
  }
};

const createReloadCheckout = async (req, res) => {
  try {
    const packageId = String(req.body?.package_id || '');
    const wallet = await TokenWalletModel.getWallet(req.user.entityCode);
    const [rows] = await db.query(
      `SELECT token_reload_package_id, display_name, token_quantity, bonus_token_quantity
         FROM token_reload_packages
        WHERE token_reload_package_id = ? AND is_active = 1
        LIMIT 1`,
      [packageId]
    );
    const reloadPackage = rows[0];
    if (!reloadPackage) return errorResponse(res, 'The selected token package is not available.', 404);

    const quantity = Number(reloadPackage.token_quantity);
    const bonus = Number(reloadPackage.bonus_token_quantity || 0);
    const unitPrice = Number(wallet.plan.token_unit_price || 0);
    if (unitPrice <= 0) return errorResponse(res, 'Token pricing is not configured for this plan.', 409);
    const listAmount = Math.round(quantity * unitPrice * 100) / 100;
    const campaignOffer = await PromotionCampaignModel.resolveBestOffer({
      purpose: 'token_reload',
      listAmount,
    });
    const amount = campaignOffer?.final_amount ?? listAmount;
    const admin = await AdminModel.findById(req.user.userCode);
    const payment = await PaymentModel.create({
      rootEntityCode: req.user.entityCode,
      purpose: 'token_reload',
      planName: wallet.plan.plan_name,
      billingCycle: 'None',
      amount,
      tokenQuantity: quantity,
      bonusTokenQuantity: bonus,
      tokenUnitPrice: unitPrice,
      pricingSnapshot: {
        package_id: reloadPackage.token_reload_package_id,
        package_name: reloadPackage.display_name,
        plan_name: wallet.plan.plan_name,
        token_quantity: quantity,
        bonus_token_quantity: bonus,
        token_unit_price: unitPrice,
        list_amount: listAmount,
        promotion_campaign_id: campaignOffer?.campaign_id || null,
        promotion_discount_amount: campaignOffer?.discount_amount || 0,
      },
      payerName: admin ? `${admin.first_name} ${admin.last_name}`.trim() : null,
      payerEmail: req.user.email,
      orgName: await getOrgName(req.user.entityType, req.user.entityCode),
      promotionCampaignId: campaignOffer?.campaign_id || null,
      listAmount,
      promotionDiscountAmount: campaignOffer?.discount_amount || 0,
    });
    return successResponse(res, {
      payment: {
        payment_code: payment.payment_code,
        purpose: payment.purpose,
        plan_name: payment.plan_name,
        amount: Number(payment.amount),
        currency: payment.currency,
        token_quantity: Number(payment.token_quantity),
        bonus_token_quantity: Number(payment.bonus_token_quantity),
        token_unit_price: Number(payment.token_unit_price),
        status: payment.status,
      },
    }, 'Token reload checkout created.', 201);
  } catch (error) {
    console.error('createTokenReloadCheckout error:', error);
    return errorResponse(res, 'Failed to create token reload checkout.', 500);
  }
};

// ─── Department upgrade ─────────────────────────────────────────────

// Departments the workspace has created (company and audit firm departments).
async function usedDepartments(rootEntityCode) {
  const [[company]] = await db.query('SELECT COUNT(*) AS count FROM company_departments WHERE comp_code = ? AND is_active = TRUE', [rootEntityCode]);
  const [[firm]] = await db.query('SELECT COUNT(*) AS count FROM audit_firm_company_departments WHERE afc_code = ? AND is_active = TRUE', [rootEntityCode]);
  return Number(company.count || 0) + Number(firm.count || 0);
}

// The current department limit and the price of raising it to `departments`.
async function departmentUpgradeQuote(rootEntityCode, departments) {
  const active = await SubscriptionModel.getActivePackage(rootEntityCode);
  if (!active) { const error = new Error('Complete your package payment before adding departments.'); error.statusCode = 409; throw error; }
  const current = Number(active.limits.department);
  const pricing = await PackagePricingModel.get();
  const target = departments === undefined ? current + 1 : Number(departments);
  try {
    return { current, used: await usedDepartments(rootEntityCode), quote: PackagePricingModel.quoteDepartmentUpgrade(current, target, pricing.token_unit_price), plan_name: active.plan_name };
  } catch (error) { error.statusCode = 400; throw error; }
}

/**
 * GET /api/tokens/department-upgrade?departments=N
 * The current department limit, departments in use, and the price of N departments.
 */
const getDepartmentUpgrade = async (req, res) => {
  try {
    return successResponse(res, await departmentUpgradeQuote(req.user.entityCode, req.query.departments === undefined || req.query.departments === '' ? undefined : req.query.departments));
  } catch (error) {
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    console.error('getDepartmentUpgrade error:', error);
    return errorResponse(res, 'Failed to price the department upgrade.', 500);
  }
};

/**
 * POST /api/tokens/department-upgrade  { departments }
 * Creates the payment for more departments. Within the free departments it applies at once.
 */
const createDepartmentUpgrade = async (req, res) => {
  try {
    const { quote, plan_name: planName } = await departmentUpgradeQuote(req.user.entityCode, req.body?.departments);
    // One open upgrade at a time: an earlier unpaid one is replaced.
    await db.query(
      `UPDATE payment_transactions SET status = 'cancelled'
        WHERE root_entity_code = ? AND purpose = 'plan_upgrade' AND status = 'pending' AND manual_approval_status <> 'requested'`,
      [req.user.entityCode]
    );
    const admin = await AdminModel.findById(req.user.userCode);
    const payment = await PaymentModel.create({
      rootEntityCode: req.user.entityCode,
      purpose: 'plan_upgrade',
      planName,
      billingCycle: 'None',
      amount: quote.total_price,
      tokenQuantity: quote.total_tokens,
      tokenUnitPrice: quote.token_unit_price,
      pricingSnapshot: quote,
      payerName: admin ? `${admin.first_name} ${admin.last_name}`.trim() : null,
      payerEmail: req.user.email,
      orgName: await getOrgName(req.user.entityType, req.user.entityCode),
      listAmount: quote.total_price,
    });
    if (quote.total_price <= 0) {
      await settleVerifiedPayment(payment, { gateway: 'free' });
      return successResponse(res, { applied: true, departments: quote.departments }, `Your workspace now has ${quote.departments} departments.`, 201);
    }
    return successResponse(res, { applied: false, payment: { payment_code: payment.payment_code, amount: Number(payment.amount), currency: payment.currency } }, 'Department upgrade checkout created.', 201);
  } catch (error) {
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    console.error('createDepartmentUpgrade error:', error);
    return errorResponse(res, 'Failed to create the department upgrade.', 500);
  }
};

module.exports = { getWallet, listLedger, listPackages, createReloadCheckout, getDepartmentUpgrade, createDepartmentUpgrade };
