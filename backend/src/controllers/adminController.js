const ContactMessageModel = require('../models/ContactMessageModel');
const PromoCodeModel = require('../models/PromoCodeModel');
const AdminModel = require('../models/AdminModel');
const CustomSolutionModel = require('../models/CustomSolutionModel');
const PaymentModel = require('../models/PaymentModel');
const { db } = require('../config/db');
const { sendContactReplyEmail, sendVerificationEmail, sendCustomSolutionPriceEmail } = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/helpers');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateAdminUserCode } = require('../utils/codeGenerator');

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
    const paymentUrl = `${baseUrl}/payment?code=${payment.payment_code}`;
    const admin = await AdminModel.findById(request.admin_id);
    const userName = admin ? `${admin.first_name}` : 'there';

    sendCustomSolutionPriceEmail(request.org_email, userName, {
      orgName: request.org_name,
      price: parseFloat(assigned_price),
      billingCycle: assigned_billing_cycle,
      paymentUrl,
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
    const period = req.query.period || 'monthly'; // daily, weekly, monthly, yearly

    const [[msgCount]] = await db.query('SELECT COUNT(*) AS cnt FROM contact_messages');
    const [[msgUnread]] = await db.query("SELECT COUNT(*) AS cnt FROM contact_messages WHERE status = 'unread'");
    const [[promoCount]] = await db.query('SELECT COUNT(*) AS cnt FROM promo_codes');
    const [[promoActive]] = await db.query('SELECT COUNT(*) AS cnt FROM promo_codes WHERE is_active = 1');
    const [[csrCount]] = await db.query('SELECT COUNT(*) AS cnt FROM custom_solution_requests');
    const [[csrPending]] = await db.query("SELECT COUNT(*) AS cnt FROM custom_solution_requests WHERE status = 'pending'");
    const [[orgCount]] = await db.query('SELECT COUNT(DISTINCT root_entity_code) AS cnt FROM subscriptions');
    const [[paidCount]] = await db.query("SELECT COUNT(DISTINCT root_entity_code) AS cnt FROM payment_transactions WHERE status = 'paid'");
    const [[adminCount]] = await db.query("SELECT COUNT(*) AS cnt FROM admins WHERE role = 'audito_admin'");

    // Registration trend based on period
    let regQuery;
    let regInterval;
    let regDateFormat;
    if (period === 'daily') {
      regDateFormat = '%Y-%m-%d';
      regInterval = '30 DAY';
    } else if (period === 'weekly') {
      regDateFormat = '%x-W%v';
      regInterval = '12 WEEK';
    } else if (period === 'yearly') {
      regDateFormat = '%Y';
      regInterval = '5 YEAR';
    } else {
      regDateFormat = '%Y-%m';
      regInterval = '12 MONTH';
    }
    const [monthlyRegs] = await db.query(`
      SELECT DATE_FORMAT(created_at, '${regDateFormat}') AS period_label, COUNT(*) AS count
      FROM subscriptions
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${regInterval})
      GROUP BY period_label
      ORDER BY period_label ASC
    `);

    // Plan distribution
    const [planDist] = await db.query(`
      SELECT plan_name, COUNT(*) AS count
      FROM subscriptions
      GROUP BY plan_name
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
};
