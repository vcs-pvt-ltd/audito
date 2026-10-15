const ContactMessageModel = require('../models/ContactMessageModel');
const PromoCodeModel = require('../models/PromoCodeModel');
const AdminModel = require('../models/AdminModel');
const PaymentModel = require('../models/PaymentModel');
const PackagePricingModel = require('../models/PackagePricingModel');
const ContactReviewModel = require('../models/ContactReviewModel');
const PromotionCampaignModel = require('../models/PromotionCampaignModel');
const PrivacyPolicyModel = require('../models/PrivacyPolicyModel');
const TokenReloadPackageModel = require('../models/TokenReloadPackageModel');
const { db } = require('../config/db');
const { sendContactReplyEmail, sendVerificationEmail, sendManualPaymentApprovedEmail } = require('../services/emailService');
// Review emails are called through the module so tests can stub outgoing email.
const emailService = require('../services/emailService');
const { auditoContact } = require('../utils/auditoContact');
const registrationLink = token => `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register/quote?token=${encodeURIComponent(token)}`;
const { settleVerifiedPayment } = require('../services/paymentSettlementService');
const { successResponse, errorResponse } = require('../utils/helpers');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateAdminUserCode } = require('../utils/codeGenerator');

function normalizeTokenPackage(body) {
  const data = {
    display_name: String(body?.display_name || '').trim(),
    token_quantity: Number(body?.token_quantity),
    bonus_token_quantity: Number(body?.bonus_token_quantity || 0),
    is_active: body?.is_active !== false && body?.is_active !== 0 && body?.is_active !== 'false',
  };
  if (!data.display_name) throw new Error('Package name is required.');
  if (!Number.isInteger(data.token_quantity) || data.token_quantity < 1) throw new Error('Token quantity must be a positive whole number.');
  if (!Number.isInteger(data.bonus_token_quantity) || data.bonus_token_quantity < 0) throw new Error('Bonus tokens must be zero or a positive whole number.');
  return data;
}

const listTokenReloadPackages = async (_req, res) => {
  try {
    return successResponse(res, { packages: await TokenReloadPackageModel.listAll() }, 'Token packages retrieved.');
  } catch (error) {
    console.error('listTokenReloadPackages error:', error);
    return errorResponse(res, 'Failed to retrieve token packages.', 500);
  }
};

const createTokenReloadPackage = async (req, res) => {
  try {
    let data;
    try { data = normalizeTokenPackage(req.body); }
    catch (validationError) { return errorResponse(res, validationError.message, 400); }
    const reloadPackage = await TokenReloadPackageModel.create(data);
    return successResponse(res, { package: reloadPackage }, 'Token package created.', 201);
  } catch (error) {
    if (error.code === '23505') return errorResponse(res, 'A package with the same token quantity and bonus already exists.', 409);
    console.error('createTokenReloadPackage error:', error);
    return errorResponse(res, 'Failed to create token package.', 500);
  }
};

const updateTokenReloadPackage = async (req, res) => {
  try {
    const packageId = String(req.params.packageId || '').trim();
    if (!await TokenReloadPackageModel.find(packageId)) return errorResponse(res, 'Token package not found.', 404);
    let data;
    try { data = normalizeTokenPackage(req.body); }
    catch (validationError) { return errorResponse(res, validationError.message, 400); }
    const reloadPackage = await TokenReloadPackageModel.update(packageId, data);
    return successResponse(res, { package: reloadPackage }, 'Token package updated.');
  } catch (error) {
    if (error.code === '23505') return errorResponse(res, 'A package with the same token quantity and bonus already exists.', 409);
    console.error('updateTokenReloadPackage error:', error);
    return errorResponse(res, 'Failed to update token package.', 500);
  }
};

const deleteTokenReloadPackage = async (req, res) => {
  try {
    const packageId = String(req.params.packageId || '').trim();
    if (!packageId) return errorResponse(res, 'Token package not found.', 404);
    if (!await TokenReloadPackageModel.remove(packageId)) return errorResponse(res, 'Token package not found.', 404);
    return successResponse(res, null, 'Token package deleted.');
  } catch (error) {
    console.error('deleteTokenReloadPackage error:', error);
    return errorResponse(res, 'Failed to delete token package.', 500);
  }
};

// --- Promotion campaigns (automatic, no promo code required) ---
async function validatePromotionCampaign(body) {
  const name = String(body?.name || '').trim();
  const description = String(body?.description || '').trim();
  const discount_type = body?.discount_type;
  const discount_value = Number(body?.discount_value);
  const priority = Number(body?.priority ?? 0);
  const startsAt = new Date(body?.starts_at);
  const endsAt = new Date(body?.ends_at);
  const applies_to_registration = false;
  const applies_to_upgrade = false;
  const applies_to_token_reload = true;

  if (!name || name.length > 100) throw new Error('Campaign name is required and must be 100 characters or fewer.');
  if (description.length > 300) throw new Error('Campaign description must be 300 characters or fewer.');
  if (!['percentage', 'fixed'].includes(discount_type)) throw new Error('Choose a percentage or fixed discount.');
  if (!Number.isFinite(discount_value) || discount_value <= 0 || (discount_type === 'percentage' && discount_value > 100)) {
    throw new Error(discount_type === 'percentage' ? 'Percentage discount must be between 0 and 100.' : 'Fixed discount must be greater than zero.');
  }
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) throw new Error('Priority must be a whole number between 0 and 1000.');
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
    throw new Error('Enter a valid start date and a later end date.');
  }
  return {
    name, description, discount_type, discount_value, priority,
    starts_at: startsAt, ends_at: endsAt, applies_to_registration, applies_to_upgrade,
    applies_to_renewal: false, applies_to_token_reload,
    is_active: body?.is_active !== false,
  };
}

const listPromotionCampaigns = async (_req, res) => {
  try {
    return successResponse(res, await PromotionCampaignModel.list(), 'Promotion campaigns retrieved.');
  } catch (error) {
    console.error('listPromotionCampaigns error:', error);
    return errorResponse(res, 'Failed to retrieve promotion campaigns.', 500);
  }
};

const createPromotionCampaign = async (req, res) => {
  try {
    const campaign = await PromotionCampaignModel.create(await validatePromotionCampaign(req.body));
    return successResponse(res, { campaign }, 'Promotion campaign created.', 201);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to create promotion campaign.', error.message ? 400 : 500);
  }
};

const updatePromotionCampaign = async (req, res) => {
  try {
    if (!await PromotionCampaignModel.find(req.params.campaignId)) return errorResponse(res, 'Promotion campaign not found.', 404);
    const campaign = await PromotionCampaignModel.update(req.params.campaignId, await validatePromotionCampaign(req.body));
    return successResponse(res, { campaign }, 'Promotion campaign updated.');
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to update promotion campaign.', error.message ? 400 : 500);
  }
};

const setPromotionCampaignStatus = async (req, res) => {
  try {
    if (!await PromotionCampaignModel.find(req.params.campaignId)) return errorResponse(res, 'Promotion campaign not found.', 404);
    const campaign = await PromotionCampaignModel.setActive(req.params.campaignId, req.body?.is_active === true);
    return successResponse(res, { campaign }, campaign.is_active ? 'Promotion campaign activated.' : 'Promotion campaign paused.');
  } catch (error) {
    console.error('setPromotionCampaignStatus error:', error);
    return errorResponse(res, 'Failed to update promotion campaign.', 500);
  }
};

// --- Versioned privacy policies ---
const validatePrivacyPolicy = (body) => {
  const title = String(body?.title || '').trim();
  const intro = String(body?.intro || '').trim();
  const sections = PrivacyPolicyModel.normalizeSections(body?.sections);
  if (!title || title.length > 160) throw new Error('A privacy policy title of 160 characters or fewer is required.');
  if (!intro || intro.length > 2000) throw new Error('A policy introduction of 2,000 characters or fewer is required.');
  if (!sections.length) throw new Error('Add at least one policy section with a title and content.');
  if (sections.length > 40 || sections.some((section) => section.title.length > 180 || section.content.length > 12000)) throw new Error('One or more policy sections are too long.');
  return { title, intro, sections };
};

const listPrivacyPolicies = async (_req, res) => {
  try { return successResponse(res, await PrivacyPolicyModel.list(), 'Privacy policies retrieved.'); }
  catch (error) { console.error('listPrivacyPolicies error:', error); return errorResponse(res, 'Failed to retrieve privacy policies.', 500); }
};

const createPrivacyPolicy = async (req, res) => {
  try {
    const policy = await PrivacyPolicyModel.create({ ...validatePrivacyPolicy(req.body), createdBy: req.user?.admin_id || null });
    return successResponse(res, { policy }, 'Privacy policy draft created.', 201);
  } catch (error) { return errorResponse(res, error.message || 'Failed to create privacy policy.', error.statusCode || 400); }
};

const updatePrivacyPolicy = async (req, res) => {
  try {
    const policy = await PrivacyPolicyModel.update(req.params.policyId, validatePrivacyPolicy(req.body));
    if (!policy) return errorResponse(res, 'Privacy policy not found.', 404);
    return successResponse(res, { policy }, 'Privacy policy updated.');
  } catch (error) { return errorResponse(res, error.message || 'Failed to update privacy policy.', error.statusCode || 400); }
};

const publishPrivacyPolicy = async (req, res) => {
  try {
    const policy = await PrivacyPolicyModel.publish(req.params.policyId);
    if (!policy) return errorResponse(res, 'Privacy policy not found.', 404);
    return successResponse(res, { policy }, 'Privacy policy published. New registrations must agree to this version.');
  } catch (error) { console.error('publishPrivacyPolicy error:', error); return errorResponse(res, 'Failed to publish privacy policy.', 500); }
};

const deletePrivacyPolicy = async (req, res) => {
  try {
    const removed = await PrivacyPolicyModel.remove(req.params.policyId);
    if (!removed) return errorResponse(res, 'Privacy policy not found.', 404);
    return successResponse(res, null, 'Privacy policy deleted.');
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to delete privacy policy.', error.statusCode || 400);
  }
};

// --- Messages Tracking ---
const listMessages = async (req, res) => {
  try {
    const messages = await ContactMessageModel.list();
    return successResponse(res, messages, 'Contact messages retrieved.');
  } catch (error) {
    console.error('List contact messages error:', error);
    return errorResponse(res, 'Failed to retrieve messages.', 500);
  }
};

const replyMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { reply_content } = req.body;

    if (!reply_content || !reply_content.trim()) {
      return errorResponse(res, 'Reply content is required.', 400);
    }

    const message = await ContactMessageModel.findById(id);
    if (!message) {
      return errorResponse(res, 'Message not found.', 404);
    }

    // Send reply email using service
    await sendContactReplyEmail(message.email, message.name, message.message, reply_content);

    // Save reply/update status in db
    await ContactMessageModel.reply(id, reply_content);

    return successResponse(res, null, 'Reply sent successfully.');
  } catch (error) {
    console.error('Reply contact message error:', error);
    return errorResponse(res, 'Failed to send reply.', 500);
  }
};

// --- Promo Codes ---
const listPromoCodes = async (req, res) => {
  try {
    const promoCodes = await PromoCodeModel.list();
    return successResponse(res, promoCodes, 'Promo codes retrieved.');
  } catch (error) {
    console.error('List promo codes error:', error);
    return errorResponse(res, 'Failed to retrieve promo codes.', 500);
  }
};

// Promo codes are entered on the payment page and take a percentage off the
// list price of a Company package, plan activation or token reload.
const createPromoCode = async (req, res) => {
  try {
    const code = PromoCodeModel.normalizeCode(req.body?.code);
    const { discount_percentage, expires_at, max_redemptions } = req.body || {};

    if (!/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(code)) {
      return errorResponse(res, 'Use 3–30 letters, numbers, dashes or underscores for the code.', 400);
    }
    const numericDiscount = Number(discount_percentage);
    if (!Number.isFinite(numericDiscount) || numericDiscount <= 0 || numericDiscount > 100 || Math.round(numericDiscount * 100) !== numericDiscount * 100) {
      return errorResponse(res, 'Discount must be more than 0 and at most 100 percent, with up to 2 decimals.', 400);
    }
    let expiresAt = null;
    if (expires_at) {
      expiresAt = new Date(expires_at);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return errorResponse(res, 'Choose an expiry date in the future, or leave it empty.', 400);
    }
    let maxRedemptions = null;
    if (max_redemptions !== undefined && max_redemptions !== null && max_redemptions !== '') {
      maxRedemptions = Number(max_redemptions);
      if (!Number.isSafeInteger(maxRedemptions) || maxRedemptions < 1) return errorResponse(res, 'Usage limit must be a whole number of 1 or more, or empty for no limit.', 400);
    }
    if (await PromoCodeModel.exists(code)) {
      return errorResponse(res, 'A promo code with this text already exists. Choose another code.', 409);
    }

    await PromoCodeModel.create({ code, discount_percentage: numericDiscount, expires_at: expiresAt, max_redemptions: maxRedemptions });

    return successResponse(res, null, `Promo code ${code} created.`, 201);
  } catch (error) {
    console.error('Create promo code error:', error);
    return errorResponse(res, 'Failed to create promo code.', 500);
  }
};

const deactivatePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    await PromoCodeModel.deactivate(id);
    return successResponse(res, null, 'Promo code deactivated successfully.');
  } catch (error) {
    console.error('Deactivate promo code error:', error);
    return errorResponse(res, 'Failed to deactivate promo code.', 500);
  }
};

const activatePromoCode = async (req, res) => {
  try {
    await PromoCodeModel.activate(req.params.id);
    return successResponse(res, null, 'Promo code activated.');
  } catch (error) {
    console.error('Activate promo code error:', error);
    return errorResponse(res, 'Failed to activate promo code.', 500);
  }
};

const deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    if (!await PromoCodeModel.delete(id)) {
      return errorResponse(res, 'This code was used on a payment, so it is kept for invoices. Deactivate it instead.', 409);
    }
    return successResponse(res, null, 'Promo code deleted successfully.');
  } catch (error) {
    console.error('Delete promo code error:', error);
    return errorResponse(res, 'Failed to delete promo code.', 500);
  }
};

// --- Admin Users (audito_admin management) ---

const listAdmins = async (req, res) => {
  try {
    const { role, is_active, search } = req.query;
    const filters = {};
    if (role) filters.role = role;
    if (is_active !== undefined) filters.is_active = is_active === 'true';
    if (search) filters.search = search;

    const admins = await AdminModel.listAll(filters);
    return successResponse(res, admins, 'Admins retrieved.');
  } catch (error) {
    console.error('List admins error:', error);
    return errorResponse(res, 'Failed to retrieve admins.', 500);
  }
};

const createAdmin = async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;

    if (!first_name || !last_name || !email) {
      return errorResponse(res, 'First name, last name, and email are required.', 400);
    }

    const existing = await AdminModel.findByEmail(email);
    if (existing) {
      return errorResponse(res, 'An account with this email already exists.', 400);
    }

    const adminId = await generateAdminUserCode();

    // Create account without password — invited user will set their own after verifying email
    await AdminModel.create({
      admin_id: adminId,
      first_name,
      last_name,
      email,
      password: null,
      account_type: null,
      entity_type: null,
      entity_code: null,
      org_level: 0,
    });

    // Set role + is_active
    const { db } = require('../config/db');
    await db.query('UPDATE admins SET role = ?, is_active = TRUE WHERE admin_id = ?', ['audito_admin', adminId]);

    // Generate verification token and send invitation email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await AdminModel.setVerificationToken(adminId, verificationToken);

    try {
      await sendVerificationEmail(email, `${first_name} ${last_name}`, verificationToken);
    } catch (emailErr) {
      console.error('Failed to send invitation email:', emailErr.message);
    }

    return successResponse(res, { admin_id: adminId }, 'Invitation sent. They will receive an email to set their password.', 201);
  } catch (error) {
    console.error('Create admin error:', error);
    return errorResponse(res, 'Failed to create admin.', 500);
  }
};

const toggleAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await AdminModel.findById(id);
    if (!admin) {
      return errorResponse(res, 'Admin not found.', 404);
    }

    const result = await AdminModel.toggleActive(id);
    return successResponse(res, result, `Admin ${result.is_active ? 'activated' : 'deactivated'} successfully.`);
  } catch (error) {
    console.error('Toggle admin status error:', error);
    return errorResponse(res, 'Failed to update admin status.', 500);
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user.userCode === id) {
      return errorResponse(res, 'You cannot delete your own account.', 400);
    }

    const admin = await AdminModel.findById(id);
    if (!admin) {
      return errorResponse(res, 'Admin not found.', 404);
    }

    await AdminModel.hardDelete(id);
    return successResponse(res, null, 'Admin deleted successfully.');
  } catch (error) {
    console.error('Delete admin error:', error);
    return errorResponse(res, 'Failed to delete admin.', 500);
  }
};

// --- Registered Organizations ---
const listOrganizations = async (req, res) => {
  try {
    // Every workspace registration (Company package or quoted account) creates a
    // registration payment; its latest row tells whether the package is paid.
    const [rows] = await db.query(`
      SELECT * FROM (
      SELECT DISTINCT ON (s.root_entity_code)
        s.root_entity_code,
        s.plan_name,
        s.status AS payment_status,
        (s.status = 'paid') AS is_active,
        s.paid_at AS activated_at,
        s.created_at,
        a.first_name,
        a.last_name,
        a.email,
        a.account_type,
        a.entity_type,
        COALESCE(
          comp.country, cus.country, csup.country, clus.country, fact.country,
          unit.country, dept.country, sec.country, afc.country, afcb.country, afcd.country,
          a.country
        ) AS country,
        COALESCE(
          comp.phone_number, cus.phone_number, csup.phone_number, clus.phone_number, fact.phone_number,
          unit.phone_number, dept.phone_number, sec.phone_number, afc.phone_number, afcb.phone_number, afcd.phone_number,
          a.phone_number
        ) AS phone_number,
        a.is_active AS admin_active,
        a.email_verified,
        COALESCE(
          comp.name, cus.name, csup.name, clus.name, fact.name,
          unit.name, dept.name, sec.name, afc.name, afcb.name, afcd.name
        ) AS org_name
      FROM payment_transactions s
      LEFT JOIN admins a ON a.entity_code = s.root_entity_code AND a.role = 'admin'
      LEFT JOIN companies comp ON comp.comp_code = s.root_entity_code
      LEFT JOIN customers cus ON cus.cust_code = s.root_entity_code
      LEFT JOIN customer_suppliers csup ON csup.csup_code = s.root_entity_code
      LEFT JOIN company_clusters clus ON clus.comp_clus_code = s.root_entity_code
      LEFT JOIN company_factories fact ON fact.comp_fact_code = s.root_entity_code
      LEFT JOIN company_units unit ON unit.comp_unit_code = s.root_entity_code
      LEFT JOIN company_departments dept ON dept.comp_dept_code = s.root_entity_code
      LEFT JOIN company_sections sec ON sec.comp_section_code = s.root_entity_code
      LEFT JOIN audit_firm_companies afc ON afc.afc_code = s.root_entity_code
      LEFT JOIN audit_firm_company_branches afcb ON afcb.afc_branch_code = s.root_entity_code
      LEFT JOIN audit_firm_company_departments afcd ON afcd.afc_dept_code = s.root_entity_code
      WHERE s.purpose = 'registration'
      ORDER BY s.root_entity_code, (s.status = 'paid') DESC, s.created_at DESC, a.id
      ) workspaces
      ORDER BY created_at DESC
    `);
    return successResponse(res, rows, 'Organizations retrieved.');
  } catch (error) {
    console.error('List organizations error:', error);
    return errorResponse(res, 'Failed to retrieve organizations.', 500);
  }
};

// --- Dashboard Stats ---
const getDashboardStats = async (req, res) => {
  try {
    const getPeriodConfig = (value) => {
      if (value === 'daily') return { dateFormat: 'YYYY-MM-DD', interval: '30 DAY' };
      if (value === 'weekly') return { dateFormat: 'IYYY-"W"IW', interval: '12 WEEK' };
      if (value === 'yearly') return { dateFormat: 'YYYY', interval: '5 YEAR' };
      return { dateFormat: 'YYYY-MM', interval: '12 MONTH' };
    };
    const registrationPeriod = req.query.period || 'monthly';
    const incomePeriod = req.query.income_period || registrationPeriod;
    const registrationConfig = getPeriodConfig(registrationPeriod);
    const incomeConfig = getPeriodConfig(incomePeriod);

    const [[msgCount]] = await db.query('SELECT COUNT(*) AS cnt FROM contact_messages');
    const [[msgUnread]] = await db.query("SELECT COUNT(*) AS cnt FROM contact_messages WHERE status = 'unread'");
    const [[promoCount]] = await db.query('SELECT COUNT(*) AS cnt FROM promo_codes');
    const [[promoActive]] = await db.query('SELECT COUNT(*) AS cnt FROM promo_codes WHERE is_active = 1');
    const [[reviewCount]] = await db.query('SELECT COUNT(*) AS cnt FROM contact_review_requests');
    const [[reviewPending]] = await db.query("SELECT COUNT(*) AS cnt FROM contact_review_requests WHERE status = 'pending' AND email_verified = 1");
    const [[orgCount]] = await db.query("SELECT COUNT(DISTINCT root_entity_code) AS cnt FROM payment_transactions WHERE purpose = 'registration'");
    const [[paidCount]] = await db.query("SELECT COUNT(DISTINCT root_entity_code) AS cnt FROM payment_transactions WHERE purpose = 'registration' AND status = 'paid'");
    const [[adminCount]] = await db.query("SELECT COUNT(*) AS cnt FROM admins WHERE role = 'audito_admin'");

    // A workspace registers once: count it at its first registration payment.
    const [monthlyRegs] = await db.query(`
      SELECT TO_CHAR(registered_at, '${registrationConfig.dateFormat}') AS period_label, COUNT(*) AS count
      FROM (
        SELECT root_entity_code, MIN(created_at) AS registered_at
        FROM payment_transactions
        WHERE purpose = 'registration'
        GROUP BY root_entity_code
      ) registrations
      WHERE registered_at >= DATE_SUB(NOW(), INTERVAL ${registrationConfig.interval})
      GROUP BY period_label
      ORDER BY period_label ASC
    `);

    // Paid workspaces by package type ('Package' = Company package, 'Custom' = quoted account)
    const [planDist] = await db.query(`
      SELECT plan_name, COUNT(DISTINCT root_entity_code) AS count
      FROM payment_transactions
      WHERE purpose = 'registration' AND status = 'paid'
      GROUP BY plan_name
    `);

    const [incomeDistribution] = await db.query(`
      SELECT TO_CHAR(COALESCE(paid_at, created_at), '${incomeConfig.dateFormat}') AS period_label,
             COALESCE(SUM(amount), 0) AS amount
      FROM payment_transactions
      WHERE status = 'paid'
        AND COALESCE(paid_at, created_at) >= DATE_SUB(NOW(), INTERVAL ${incomeConfig.interval})
      GROUP BY period_label
      ORDER BY period_label ASC
    `);

    return successResponse(res, {
      counts: {
        messages: msgCount.cnt,
        messages_unread: msgUnread.cnt,
        promo_codes: promoCount.cnt,
        promo_codes_active: promoActive.cnt,
        contact_reviews: reviewCount.cnt,
        contact_reviews_pending: reviewPending.cnt,
        organizations: orgCount.cnt,
        organizations_paid: paidCount.cnt,
        audito_admins: adminCount.cnt,
      },
      charts: {
        registrations: monthlyRegs,
        plan_distribution: planDist,
        income_distribution: incomeDistribution,
      },
    }, 'Dashboard stats retrieved.');
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard stats.', 500);
  }
};

// --- Payment Transactions ---
const listPayments = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        pt.payment_transaction_id AS transaction_id,
        pt.payment_code,
        pt.amount,
        pt.currency,
        pt.status,
        pt.gateway,
        pt.purpose,
        pt.org_name,
        pt.plan_name,
        pt.token_quantity,
        pt.bonus_token_quantity,
        pt.token_unit_price,
        pt.pricing_snapshot,
        fulfillment.fulfillment_type,
        fulfillment.token_quantity AS fulfilled_token_quantity,
        pt.invoice_number,
        pt.paid_at,
        pt.created_at,
        pt.manual_approval_status,
        pt.manual_approval_requested_at,
        pt.manual_approval_reviewed_at,
        pt.manual_approval_reviewed_by,
        reviewer.first_name AS approval_reviewer_first_name,
        reviewer.last_name AS approval_reviewer_last_name,
        a.first_name AS admin_first_name,
        a.last_name AS admin_last_name,
        a.email AS admin_email,
        a.entity_type,
        COALESCE(
          comp.name, cus.name, csup.name, clus.name, fact.name,
          unit.name, dept.name, sec.name, afc.name, afcb.name, afcd.name
        ) AS org_name_resolved
      FROM payment_transactions pt
      LEFT JOIN payment_fulfillments fulfillment ON fulfillment.payment_transaction_id = pt.payment_transaction_id
      LEFT JOIN admins a ON a.entity_code = pt.root_entity_code
      LEFT JOIN admins reviewer ON reviewer.admin_id = pt.manual_approval_reviewed_by
      LEFT JOIN companies comp ON comp.comp_code = pt.root_entity_code
      LEFT JOIN customers cus ON cus.cust_code = pt.root_entity_code
      LEFT JOIN customer_suppliers csup ON csup.csup_code = pt.root_entity_code
      LEFT JOIN company_clusters clus ON clus.comp_clus_code = pt.root_entity_code
      LEFT JOIN company_factories fact ON fact.comp_fact_code = pt.root_entity_code
      LEFT JOIN company_units unit ON unit.comp_unit_code = pt.root_entity_code
      LEFT JOIN company_departments dept ON dept.comp_dept_code = pt.root_entity_code
      LEFT JOIN company_sections sec ON sec.comp_section_code = pt.root_entity_code
      LEFT JOIN audit_firm_companies afc ON afc.afc_code = pt.root_entity_code
      LEFT JOIN audit_firm_company_branches afcb ON afcb.afc_branch_code = pt.root_entity_code
      LEFT JOIN audit_firm_company_departments afcd ON afcd.afc_dept_code = pt.root_entity_code
      ORDER BY pt.created_at DESC
    `);
    return successResponse(res, rows, 'Payments retrieved.');
  } catch (error) {
    console.error('List payments error:', error);
    return errorResponse(res, 'Failed to retrieve payments.', 500);
  }
};

const approveManualPayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByTransactionId(req.params.transactionId);
    if (!payment) return errorResponse(res, 'Payment not found.', 404);

    if (payment.status === 'paid') {
      return successResponse(res, { payment }, 'Payment is already completed.');
    }
    if (payment.manual_approval_status !== 'requested') {
      return errorResponse(res, 'This payment has not been submitted for manual approval.', 409);
    }
    if (payment.status !== 'pending') {
      return errorResponse(res, 'This payment is already being processed.', 409);
    }

    const result = await settleVerifiedPayment(payment, {
      gateway: 'manual_admin',
      gatewayReference: `MANUAL-${payment.payment_transaction_id}`,
      manualApprovalReviewedBy: req.user.userCode,
    });

    if (result.processing) {
      return errorResponse(res, 'This payment is already being processed.', 409);
    }

    if (payment.payer_email && !result.alreadyCompleted) {
      sendManualPaymentApprovedEmail(payment.payer_email, payment.payer_name, result.payment)
        .catch((emailError) => console.error('Failed to send manual payment approval email:', emailError.message));
    }

    return successResponse(res, {
      payment: result.payment,
      credit_applied: result.creditApplied || 0,
      net_amount: result.netAmount ?? Number(payment.amount),
    }, result.alreadyCompleted ? 'Payment is already completed.' : 'Payment approved and subscription activated.');
  } catch (error) {
    console.error('Approve manual payment error:', error);
    return errorResponse(res, 'Failed to approve payment.', 500);
  }
};

module.exports = {
  listContactReviews: async (_req, res) => {
    try { return successResponse(res, await ContactReviewModel.list()); }
    catch (error) { console.error('listContactReviews error:', error); return errorResponse(res, 'Failed to load requests.', 500); }
  },
  quoteContactReview: async (req, res) => {
    const price = Number(req.body?.assigned_price);
    if (!Number.isFinite(price) || price <= 0 || Math.round(price * 100) !== price * 100) return errorResponse(res, 'Enter a valid USD quote.', 400);
    try {
      const current = await ContactReviewModel.find(req.params.requestId);
      if (!current || current.status !== 'pending') return errorResponse(res, 'Pending request not found.', 404);
      if (!current.email_verified) return errorResponse(res, 'The requester must verify their email before a quote is sent.', 409);
      const adminNotes = String(req.body?.admin_notes || '').trim().slice(0, 2000);
      // Everything paid becomes tokens, as with the Company package (1 token = 1 audit line).
      const unitPrice = Number((await PackagePricingModel.get()).token_unit_price);
      const tokens = Math.round(price / unitPrice);
      if (!Number.isSafeInteger(tokens) || tokens < 1) return errorResponse(res, `The quote must include at least one token ($${unitPrice.toFixed(2)}).`, 400);
      const registrationToken = await ContactReviewModel.quote(current.request_id, { price, notes: adminNotes, tokens, unitPrice });
      if (!registrationToken) return errorResponse(res, 'This request was already quoted.', 409);
      const request = await ContactReviewModel.find(current.request_id);
      // The quote is saved first so the link in the email always works. If the
      // email fails, "Resend quote email" sends it again with a new link.
      try {
        await emailService.sendContactReviewQuoteEmail(request, auditoContact(), registrationLink(registrationToken));
      } catch (error) {
        console.error('Contact review quote email failed:', error);
        return successResponse(res, request, 'Quote saved, but the email could not be sent. Use "Resend quote email".');
      }
      return successResponse(res, request, 'Quote sent with a registration link.');
    } catch (error) { console.error('quoteContactReview error:', error); return errorResponse(res, 'Failed to send quote.', 500); }
  },
  // A lost or expired quote email: a new registration link replaces the old one.
  resendContactReviewQuote: async (req, res) => {
    try {
      const current = await ContactReviewModel.find(req.params.requestId);
      if (!current) return errorResponse(res, 'Request not found.', 404);
      if (current.status !== 'quoted') return errorResponse(res, 'Only quoted requests have a registration link.', 409);
      if (current.registered_at) return errorResponse(res, 'This organization has already registered.', 409);
      const token = await ContactReviewModel.renewRegistration(current.request_id);
      if (!token) return errorResponse(res, 'Could not create a new registration link.', 409);
      const request = await ContactReviewModel.find(current.request_id);
      await emailService.sendContactReviewQuoteEmail(request, auditoContact(), registrationLink(token));
      return successResponse(res, request, `Quote email sent again to ${current.email} with a new registration link.`);
    } catch (error) { console.error('resendContactReviewQuote error:', error); return errorResponse(res, 'Failed to send the quote email.', 500); }
  },
  closeContactReview: async (req, res) => {
    try {
      const current = await ContactReviewModel.find(req.params.requestId);
      if (!current) return errorResponse(res, 'Request not found.', 404);
      if (current.status === 'closed') return successResponse(res, current, 'Request is already closed.');
      return successResponse(res, await ContactReviewModel.close(current.request_id), 'Request closed.');
    } catch (error) { console.error('closeContactReview error:', error); return errorResponse(res, 'Failed to close the request.', 500); }
  },
  reopenContactReview: async (req, res) => {
    try {
      const current = await ContactReviewModel.find(req.params.requestId);
      if (!current) return errorResponse(res, 'Request not found.', 404);
      if (current.status !== 'closed') return successResponse(res, current, 'Request is already open.');
      return successResponse(res, await ContactReviewModel.reopen(current.request_id), 'Request reopened.');
    } catch (error) { console.error('reopenContactReview error:', error); return errorResponse(res, 'Failed to reopen the request.', 500); }
  },
  // Notes for the Audito team only; never sent to the requester.
  updateContactReviewNotes: async (req, res) => {
    try {
      const current = await ContactReviewModel.find(req.params.requestId);
      if (!current) return errorResponse(res, 'Request not found.', 404);
      const notes = String(req.body?.internal_notes || '').trim().slice(0, 4000);
      return successResponse(res, await ContactReviewModel.setInternalNotes(current.request_id, notes), 'Notes saved.');
    } catch (error) { console.error('updateContactReviewNotes error:', error); return errorResponse(res, 'Failed to save notes.', 500); }
  },
  resendContactReviewVerification: async (req, res) => {
    try {
      const current = await ContactReviewModel.find(req.params.requestId);
      if (!current) return errorResponse(res, 'Request not found.', 404);
      if (current.email_verified) return errorResponse(res, 'This email is already verified.', 409);
      const token = await ContactReviewModel.renewVerification(current.request_id);
      if (!token) return errorResponse(res, 'Closed requests cannot be verified. Reopen the request first.', 409);
      await emailService.sendContactReviewVerificationEmail(current, token, auditoContact());
      return successResponse(res, await ContactReviewModel.find(current.request_id), `Verification email sent to ${current.email}.`);
    } catch (error) { console.error('resendContactReviewVerification error:', error); return errorResponse(res, 'Failed to send the verification email.', 500); }
  },
  getPackagePricing: async (_req, res) => {
    try { return successResponse(res, await PackagePricingModel.get()); }
    catch (error) { console.error('getPackagePricing error:', error); return errorResponse(res, 'Pricing is unavailable.', 503); }
  },
  updatePackagePricing: async (req, res) => {
    try { return successResponse(res, await PackagePricingModel.update(req.body?.token_unit_price), 'Token price updated for future purchases.'); }
    catch (error) { return errorResponse(res, error.message, 400); }
  },
  listMessages,
  replyMessage,
  listPromoCodes,
  createPromoCode,
  deactivatePromoCode,
  activatePromoCode,
  deletePromoCode,
  listAdmins,
  createAdmin,
  toggleAdminStatus,
  deleteAdmin,
  getDashboardStats,
  listOrganizations,
  listPayments,
  approveManualPayment,
  listTokenReloadPackages,
  createTokenReloadPackage,
  updateTokenReloadPackage,
  deleteTokenReloadPackage,
  listPromotionCampaigns,
  createPromotionCampaign,
  updatePromotionCampaign,
  setPromotionCampaignStatus,
  listPrivacyPolicies,
  createPrivacyPolicy,
  updatePrivacyPolicy,
  publishPrivacyPolicy,
  deletePrivacyPolicy,
};
