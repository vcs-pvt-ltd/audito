const ContactMessageModel = require('../models/ContactMessageModel');
const PromoCodeModel = require('../models/PromoCodeModel');
const AdminModel = require('../models/AdminModel');
const CustomSolutionModel = require('../models/CustomSolutionModel');
const PaymentModel = require('../models/PaymentModel');
const PlanSettingsModel = require('../models/PlanSettingsModel');
const PromotionCampaignModel = require('../models/PromotionCampaignModel');
const { db } = require('../config/db');
const { sendContactReplyEmail, sendVerificationEmail, sendCustomSolutionPriceEmail } = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/helpers');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateAdminUserCode } = require('../utils/codeGenerator');

const PLAN_FIELDS = ['monthly_price', 'max_company_levels', 'max_departments', 'max_audits', 'max_checklists', 'max_auditors'];

const listPlanSettings = async (_req, res) => {
  try {
    return successResponse(res, await PlanSettingsModel.list(), 'Plan settings retrieved.');
  } catch (error) {
    console.error('listPlanSettings error:', error);
    return errorResponse(res, 'Failed to retrieve plan settings.', 500);
  }
};

const updatePlanSettings = async (req, res) => {
  try {
    const { planName } = req.params;
    if (!await PlanSettingsModel.find(planName)) return errorResponse(res, 'Plan not found.', 404);
    const data = { ...req.body };
    for (const field of PLAN_FIELDS) {
      data[field] = Number(data[field]);
      if (!Number.isFinite(data[field]) || data[field] < 0 || (field !== 'monthly_price' && !Number.isInteger(data[field]))) return errorResponse(res, `Invalid ${field.replaceAll('_', ' ')}.`, 400);
    }
    if ([data.max_company_levels, data.max_departments, data.max_audits, data.max_checklists, data.max_auditors].some((value) => value < 1)) return errorResponse(res, 'All plan limits must be at least 1.', 400);
    data.allow_auditor_eval = data.allow_auditor_eval === true || data.allow_auditor_eval === 1 || data.allow_auditor_eval === 'true';
    data.allow_company_to_company = data.allow_company_to_company === true || data.allow_company_to_company === 1 || data.allow_company_to_company === 'true';
    data.is_active = data.is_active !== false && data.is_active !== 0 && data.is_active !== 'false';
    const plan = await PlanSettingsModel.updatePlan(planName, data);
    return successResponse(res, { plan }, 'Plan settings updated. New values apply to future registrations, renewals, and upgrades.');
  } catch (error) {
    console.error('updatePlanSettings error:', error);
    return errorResponse(res, 'Failed to update plan settings.', 500);
  }
};

const createPlanSettings = async (req, res) => {
  try {
    const plan_name = String(req.body?.plan_name || '').trim().replace(/\s+/g, ' ');
    const display_name = String(req.body?.display_name || plan_name).trim();
    if (!/^[A-Za-z][A-Za-z0-9 -]{1,38}$/.test(plan_name) || !display_name) {
      return errorResponse(res, 'Enter a plan name using letters, numbers, spaces, or hyphens.', 400);
    }
    if (await PlanSettingsModel.find(plan_name)) return errorResponse(res, 'A plan with this name already exists.', 409);
    const data = { ...req.body, plan_name, display_name };
    for (const field of PLAN_FIELDS) {
      data[field] = Number(data[field]);
      if (!Number.isFinite(data[field]) || data[field] < 0 || (field !== 'monthly_price' && !Number.isInteger(data[field]))) {
        return errorResponse(res, `Invalid ${field.replaceAll('_', ' ')}.`, 400);
      }
    }
    if ([data.max_company_levels, data.max_departments, data.max_audits, data.max_checklists, data.max_auditors].some((value) => value < 1)) {
      return errorResponse(res, 'All plan limits must be at least 1.', 400);
    }
    data.allow_auditor_eval = Boolean(data.allow_auditor_eval);
    data.allow_company_to_company = Boolean(data.allow_company_to_company);
    data.is_active = data.is_active !== false;
    const plan = await PlanSettingsModel.createPlan(data);
    return successResponse(res, { plan }, 'Plan created successfully.');
  } catch (error) {
    console.error('createPlanSettings error:', error);
    return errorResponse(res, 'Failed to create plan.', 500);
  }
};

const updateYearlyDiscount = async (req, res) => {
  try {
    const yearlyDiscountPercent = Number(req.body?.yearly_discount_percent);
    if (!Number.isFinite(yearlyDiscountPercent) || yearlyDiscountPercent < 0 || yearlyDiscountPercent > 100) {
      return errorResponse(res, 'Yearly discount must be between 0 and 100%.', 400);
    }
    const catalog = await PlanSettingsModel.updateYearlyDiscount(yearlyDiscountPercent);
    return successResponse(res, catalog, 'Yearly discount updated for all plans.');
  } catch (error) {
    console.error('updateYearlyDiscount error:', error);
    return errorResponse(res, 'Failed to update yearly discount.', 500);
  }
};

const updateEntryPrice = async (req, res) => {
  try {
    const allowed = ['Customer', 'Buying Office', 'Supplier', 'Audit Firm Company', 'Branch', 'Audit Firm Department'];
    const { entityType } = req.params;
    const monthlyPrice = Number(req.body?.monthly_price);
    if (!allowed.includes(entityType) || !Number.isFinite(monthlyPrice) || monthlyPrice < 0) return errorResponse(res, 'Invalid entry price.', 400);
    const entryPrice = await PlanSettingsModel.updateEntryPrice(entityType, monthlyPrice);
    return successResponse(res, { entry_price: entryPrice }, 'Entry price updated.');
  } catch (error) {
    console.error('updateEntryPrice error:', error);
    return errorResponse(res, 'Failed to update entry price.', 500);
  }
};

// --- Promotion campaigns (automatic, no promo code required) ---
const PROMOTION_CYCLES = new Set(['Monthly', 'Yearly', 'Any']);

async function validatePromotionCampaign(body) {
  const name = String(body?.name || '').trim();
  const description = String(body?.description || '').trim();
  const discount_type = body?.discount_type;
  const discount_value = Number(body?.discount_value);
  const priority = Number(body?.priority ?? 0);
  const startsAt = new Date(body?.starts_at);
  const endsAt = new Date(body?.ends_at);
  const plans = Array.isArray(body?.plans) ? body.plans : [];
  const applies_to_registration = body?.applies_to_registration !== false;
  const applies_to_upgrade = body?.applies_to_upgrade === true;
  const applies_to_renewal = body?.applies_to_renewal === true;

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
  if (!applies_to_registration && !applies_to_upgrade && !applies_to_renewal) throw new Error('Choose at least one purchase type.');
  if (!plans.length) throw new Error('Select at least one eligible plan.');

  const catalog = await PlanSettingsModel.list();
  const availablePlans = new Set(catalog.plans.filter((plan) => plan.plan_name !== 'Custom').map((plan) => plan.plan_name));
  const seen = new Set();
  const normalizedPlans = plans.map((plan) => {
    const plan_name = String(plan?.plan_name || '').trim();
    const billing_cycle = String(plan?.billing_cycle || '').trim();
    const key = `${plan_name}:${billing_cycle}`;
    if (!availablePlans.has(plan_name) || !PROMOTION_CYCLES.has(billing_cycle)) throw new Error('Campaign includes an invalid plan or billing cycle.');
    if (seen.has(key)) throw new Error('Each plan and billing cycle can only be selected once.');
    seen.add(key);
    return { plan_name, billing_cycle };
  });

  return {
    name, description, discount_type, discount_value, priority,
    starts_at: startsAt, ends_at: endsAt, applies_to_registration, applies_to_upgrade,
    applies_to_renewal, is_active: body?.is_active !== false, plans: normalizedPlans,
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

const createPromoCode = async (req, res) => {
  try {
    const { code, discount_percentage, expires_at } = req.body;

    if (!code || !discount_percentage) {
      return errorResponse(res, 'Promo code and discount percentage are required.', 400);
    }

    const numericDiscount = parseFloat(discount_percentage);
    if (isNaN(numericDiscount) || numericDiscount <= 0 || numericDiscount > 100) {
      return errorResponse(res, 'Discount percentage must be a number between 0 and 100.', 400);
    }

    // Check if code already exists and is active
    const existing = await PromoCodeModel.findByCode(code);
    if (existing) {
      return errorResponse(res, 'Promo code already exists and is currently active.', 400);
    }

    await PromoCodeModel.create({ code, discount_percentage: numericDiscount, expires_at });

    return successResponse(res, null, 'Promo code generated successfully.', 201);
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

const deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    await PromoCodeModel.delete(id);
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

// --- Custom Solution Requests ---

const listCustomSolutions = async (req, res) => {
  try {
    const { status } = req.query;
    let requests;
    if (status && ['pending', 'priced', 'accepted', 'rejected'].includes(status)) {
      requests = await CustomSolutionModel.listByStatus(status);
    } else {
      requests = await CustomSolutionModel.list();
    }
    return successResponse(res, requests, 'Custom solution requests retrieved.');
  } catch (error) {
    console.error('List custom solutions error:', error);
    return errorResponse(res, 'Failed to retrieve custom solutions.', 500);
  }
};

const getCustomSolution = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await CustomSolutionModel.findByRequestId(requestId);
    if (!request) return errorResponse(res, 'Custom solution request not found.', 404);
    if (!request.email_verified) {
      return errorResponse(res, 'The organization must verify its email before this request can be priced.', 409);
    }
    return successResponse(res, request);
  } catch (error) {
    console.error('Get custom solution error:', error);
    return errorResponse(res, 'Failed to retrieve custom solution.', 500);
  }
};

const assignCustomSolutionPrice = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { assigned_price, assigned_billing_cycle, admin_notes } = req.body;

    if (!assigned_price || assigned_price <= 0) {
      return errorResponse(res, 'A valid price is required.', 400);
    }
    if (!assigned_billing_cycle || !['Monthly', 'Yearly'].includes(assigned_billing_cycle)) {
      return errorResponse(res, 'Billing cycle must be Monthly or Yearly.', 400);
    }

    const request = await CustomSolutionModel.findByRequestId(requestId);
    if (!request) return errorResponse(res, 'Custom solution request not found.', 404);
    if (request.status !== 'pending') {
      return errorResponse(res, 'This request has already been processed.', 400);
    }

    // Create payment transaction
    const payment = await PaymentModel.create({
      rootEntityCode: request.root_entity_code,
      purpose: 'registration',
      planName: 'Custom',
      billingCycle: assigned_billing_cycle,
      amount: parseFloat(assigned_price),
      payerName: request.org_name,
      payerEmail: request.org_email,
      orgName: request.org_name,
    });

    // Update custom solution request with price and payment code
    await CustomSolutionModel.assignPrice(requestId, {
      assigned_price: parseFloat(assigned_price),
      assigned_billing_cycle,
      admin_notes: admin_notes || null,
    });
    await CustomSolutionModel.updatePaymentCode(requestId, payment.payment_code);

    // Send email notification to user
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // The administrator account is configured before checkout. The setup page
    // redirects the verified organization directly to the payment screen.
    const paymentUrl = `${baseUrl}/custom-solution/setup-admin?code=${payment.payment_code}`;
    const userName = request.org_name;

    sendCustomSolutionPriceEmail(request.org_email, userName, {
      orgName: request.org_name,
      price: parseFloat(assigned_price),
      billingCycle: assigned_billing_cycle,
      paymentUrl,
      limits: {
        max_company_levels: request.max_company_levels,
        max_departments: request.max_departments,
        max_audits: request.max_audits,
        max_checklists: request.max_checklists,
        max_auditors: request.max_auditors,
      },
    }).catch(err => console.error('Failed to send custom solution price email:', err));

    return successResponse(res, { payment_code: payment.payment_code }, 'Price assigned and notification sent.');
  } catch (error) {
    console.error('Assign custom solution price error:', error);
    return errorResponse(res, 'Failed to assign price.', 500);
  }
};

// --- Registered Organizations ---
const listOrganizations = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        s.root_entity_code,
        s.plan_name,
        s.billing_cycle,
        s.is_active,
        s.start_date,
        s.end_date,
        s.created_at,
        a.first_name,
        a.last_name,
        a.email,
        a.account_type,
        a.entity_type,
        a.country,
        a.is_active AS admin_active,
        a.email_verified,
        COALESCE(
          comp.name, cus.name, csup.name, clus.name, fact.name,
          unit.name, dept.name, sec.name, afc.name, afcb.name, afcd.name
        ) AS org_name
      FROM subscriptions s
      LEFT JOIN admins a ON a.entity_code = s.root_entity_code
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
      ORDER BY s.created_at DESC
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
      if (value === 'daily') return { dateFormat: '%Y-%m-%d', interval: '30 DAY' };
      if (value === 'weekly') return { dateFormat: '%x-W%v', interval: '12 WEEK' };
      if (value === 'yearly') return { dateFormat: '%Y', interval: '5 YEAR' };
      return { dateFormat: '%Y-%m', interval: '12 MONTH' };
    };
    const registrationPeriod = req.query.period || 'monthly';
    const incomePeriod = req.query.income_period || registrationPeriod;
    const registrationConfig = getPeriodConfig(registrationPeriod);
    const incomeConfig = getPeriodConfig(incomePeriod);

    const [[msgCount]] = await db.query('SELECT COUNT(*) AS cnt FROM contact_messages');
    const [[msgUnread]] = await db.query("SELECT COUNT(*) AS cnt FROM contact_messages WHERE status = 'unread'");
    const [[promoCount]] = await db.query('SELECT COUNT(*) AS cnt FROM promo_codes');
    const [[promoActive]] = await db.query('SELECT COUNT(*) AS cnt FROM promo_codes WHERE is_active = 1');
    const [[csrCount]] = await db.query('SELECT COUNT(*) AS cnt FROM custom_solution_requests');
    const [[csrPending]] = await db.query("SELECT COUNT(*) AS cnt FROM custom_solution_requests WHERE status = 'pending'");
    const [[orgCount]] = await db.query('SELECT COUNT(DISTINCT root_entity_code) AS cnt FROM subscriptions');
    const [[paidCount]] = await db.query("SELECT COUNT(DISTINCT root_entity_code) AS cnt FROM payment_transactions WHERE status = 'paid'");
    const [[adminCount]] = await db.query("SELECT COUNT(*) AS cnt FROM admins WHERE role = 'audito_admin'");

    const [monthlyRegs] = await db.query(`
      SELECT DATE_FORMAT(created_at, '${registrationConfig.dateFormat}') AS period_label, COUNT(*) AS count
      FROM subscriptions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${registrationConfig.interval})
      GROUP BY period_label
      ORDER BY period_label ASC
    `);

    // Plan distribution
    const [planDist] = await db.query(`
      SELECT plan_name, COUNT(*) AS count
      FROM subscriptions
      GROUP BY plan_name
    `);

    const [incomeDistribution] = await db.query(`
      SELECT DATE_FORMAT(COALESCE(paid_at, created_at), '${incomeConfig.dateFormat}') AS period_label,
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
        custom_solutions: csrCount.cnt,
        custom_solutions_pending: csrPending.cnt,
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
        pt.amount,
        pt.currency,
        pt.status,
        pt.gateway,
        pt.purpose,
        pt.org_name,
        pt.plan_name,
        pt.billing_cycle,
        pt.invoice_number,
        pt.paid_at,
        pt.created_at,
        a.first_name AS admin_first_name,
        a.last_name AS admin_last_name,
        a.email AS admin_email,
        a.entity_type,
        COALESCE(
          comp.name, cus.name, csup.name, clus.name, fact.name,
          unit.name, dept.name, sec.name, afc.name, afcb.name, afcd.name
        ) AS org_name_resolved
      FROM payment_transactions pt
      LEFT JOIN admins a ON a.entity_code = pt.root_entity_code
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

module.exports = {
  listMessages,
  replyMessage,
  listPromoCodes,
  createPromoCode,
  deactivatePromoCode,
  deletePromoCode,
  listAdmins,
  createAdmin,
  toggleAdminStatus,
  deleteAdmin,
  listCustomSolutions,
  getCustomSolution,
  assignCustomSolutionPrice,
  getDashboardStats,
  listOrganizations,
  listPayments,
  listPlanSettings,
  updatePlanSettings,
  createPlanSettings,
  updateYearlyDiscount,
  updateEntryPrice,
  listPromotionCampaigns,
  createPromotionCampaign,
  updatePromotionCampaign,
  setPromotionCampaignStatus,
};
