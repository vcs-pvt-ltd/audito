/**
 * Registration from an Audito quote.
 *
 * Customer and Audit Firm accounts are priced by the Audito team. The quote
 * email carries a one-time link; the requester registers the organization and
 * its administrator here, then pays through the normal payment page. The link
 * went to the requester's verified email, so the administrator account (which
 * uses that email) starts verified and goes straight to payment.
 */
const bcrypt = require('bcryptjs');
const { db } = require('../config/db');
const ContactReviewModel = require('../models/ContactReviewModel');
const PaymentModel = require('../models/PaymentModel');
const AdminModel = require('../models/AdminModel');
const PrivacyPolicyModel = require('../models/PrivacyPolicyModel');
const NotificationModel = require('../models/NotificationModel');
const { ENTITY_CONFIG } = require('./authController');
const { generateAdminUserCode } = require('../utils/codeGenerator');
const { successResponse, errorResponse } = require('../utils/helpers');
const { auditoContact } = require('../utils/auditoContact');

const QUOTED_ENTITY_TYPES = {
  Customer: ['Customer', 'Buying Office', 'Supplier'],
  'Audit Firm': ['Audit Firm Company', 'Branch', 'Audit Firm Department'],
};
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
const PHONE_RULE = /^[+()\d\s.-]{7,60}$/;

function requestError(message, statusCode) { const error = new Error(message); error.statusCode = statusCode; return error; }

// Why a registration link cannot be used, or '' when it can.
function linkProblem(request) {
  if (!request) return ['This registration link is not valid or was already used. Sign in if you already registered, or contact the Audito team.', 404];
  if (request.registered_at) return ['This organization is already registered. Sign in to continue.', 409];
  if (request.status !== 'quoted') return ['This quote is no longer open. Contact the Audito team for help.', 410];
  if (!request.registration_expires_at || new Date(request.registration_expires_at) <= new Date()) return ['This registration link has expired. Contact the Audito team for a new one.', 410];
  if (!QUOTED_ENTITY_TYPES[request.account_type]?.includes(request.entity_type) || !ENTITY_CONFIG[request.entity_type]) return ['This quote cannot be registered online. Contact the Audito team.', 409];
  return null;
}

function quoteView(request) {
  return {
    organization_name: request.organization_name, contact_name: request.contact_name, email: request.email, phone: request.phone,
    account_type: request.account_type, entity_type: request.entity_type, country: request.country || '',
    departments: request.departments, lines_per_audit: request.lines_per_audit,
    price: Number(request.assigned_price), tokens: Number(request.quoted_tokens || 0), token_unit_price: Number(request.token_unit_price || 0),
    currency: 'USD', message: request.admin_notes || '', expires_at: request.registration_expires_at,
  };
}

/** GET /api/auth/quote-registration/:token */
const getQuoteRegistration = async (req, res) => {
  try {
    const request = await ContactReviewModel.findByRegistrationToken(req.params.token);
    const problem = linkProblem(request);
    if (problem) return res.status(problem[1]).json({ success: false, message: problem[0], data: { contact: auditoContact() } });
    return successResponse(res, { quote: quoteView(request), contact: auditoContact() });
  } catch (error) {
    console.error('getQuoteRegistration error:', error);
    return errorResponse(res, 'Could not open this registration link.', 500);
  }
};

/** POST /api/auth/quote-registration  Body: { token, organization fields, administrator fields, privacy_policy_id } */
const registerFromQuote = async (req, res) => {
  const body = req.body || {};
  const text = (key, max = 255) => String(body[key] || '').trim().slice(0, max);
  // The organization and administrator use the email the quote was sent to;
  // any other email in the request is ignored.
  const fields = {
    org_name: text('org_name'), registration_number: text('registration_number', 100), org_phone_number: text('org_phone_number', 60),
    country: text('country', 100), address_line_1: text('address_line_1'), address_line_2: text('address_line_2'), address_line_3: text('address_line_3'), timezone: text('timezone', 64),
    first_name: text('first_name', 100), last_name: text('last_name', 100), phone_number: text('phone_number', 60),
  };
  if (!fields.org_name || !PHONE_RULE.test(fields.org_phone_number) || !fields.country || !fields.address_line_1 || !fields.address_line_2) {
    return errorResponse(res, 'Complete the required organization details, including country and address.', 400);
  }
  if (!fields.first_name || !fields.last_name || !PHONE_RULE.test(fields.phone_number)) return errorResponse(res, 'Complete your administrator details.', 400);
  if (!PASSWORD_RULE.test(String(body.password || ''))) {
    return errorResponse(res, 'Password needs 8 characters, uppercase, lowercase, a number, and a special character.', 400);
  }

  let connection;
  try {
    const policy = await PrivacyPolicyModel.getPublished();
    if (!policy) return errorResponse(res, 'Registration is temporarily unavailable because no privacy policy has been published.', 503);
    if (body.privacy_policy_id !== policy.privacy_policy_id) return errorResponse(res, 'Please review and agree to the current Privacy Policy before registering.', 400);
    const passwordHash = await bcrypt.hash(String(body.password), await bcrypt.genSalt(12));

    connection = await db.getConnection();
    await connection.beginTransaction();
    // Locked so two submissions of the same link cannot create two workspaces.
    const request = await ContactReviewModel.findByRegistrationToken(body.token, connection, { lock: true });
    const problem = linkProblem(request);
    if (problem) throw requestError(...problem);
    const config = ENTITY_CONFIG[request.entity_type];
    // The administrator signs in with the email the quote was sent to.
    if (await AdminModel.emailExists(request.email)) {
      throw requestError(`An Audito account already uses ${request.email}. Sign in, or contact the Audito team.`, 409);
    }
    if (fields.registration_number) {
      const [existing] = await connection.query(`SELECT id FROM \`${config.table}\` WHERE registration_number = ?`, [fields.registration_number]);
      if (existing.length) throw requestError('Registration number already exists for this organization type.', 409);
    }

    const orgCode = await config.genCode();
    await connection.query(
      `INSERT INTO \`${config.table}\` (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, \`${config.codeField}\`, timezone, organization_logo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [fields.org_name, fields.registration_number || null, request.email, fields.address_line_1, fields.address_line_2, fields.address_line_3 || null,
        fields.country, fields.org_phone_number, orgCode, fields.timezone || null]
    );
    const adminId = await generateAdminUserCode();
    await connection.query(
      `INSERT INTO admins (admin_id, first_name, last_name, email, country, phone_number, password, account_type, entity_type, entity_code, org_level, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [adminId, fields.first_name, fields.last_name, request.email, fields.country, fields.phone_number, passwordHash,
        config.account_type, request.entity_type, orgCode, config.org_level]
    );
    await PrivacyPolicyModel.recordAgreement(connection, {
      privacyPolicyId: policy.privacy_policy_id, adminId, rootEntityCode: orgCode, email: request.email, ipAddress: req.ip, userAgent: req.get?.('user-agent'),
    });

    const price = Number(request.assigned_price);
    const tokens = Number(request.quoted_tokens);
    const payment = await PaymentModel.create({
      rootEntityCode: orgCode, purpose: 'registration', planName: 'Custom', billingCycle: 'None',
      amount: price, listAmount: price, tokenQuantity: tokens, tokenUnitPrice: Number(request.token_unit_price),
      pricingSnapshot: {
        purchase_type: 'quoted_account', request_id: request.request_id, account_type: request.account_type, entity_type: request.entity_type,
        departments: Number(request.departments), lines_per_audit: Number(request.lines_per_audit),
        total_price: price, total_tokens: tokens, token_unit_price: Number(request.token_unit_price),
      },
      payerName: `${fields.first_name} ${fields.last_name}`, payerEmail: request.email, orgName: fields.org_name,
    }, connection);
    await ContactReviewModel.markRegistered(request.request_id, { rootEntityCode: orgCode, paymentCode: payment.payment_code }, connection);
    await connection.commit();

    try {
      const admins = await AdminModel.listAll({ role: 'audito_admin', is_active: true });
      await Promise.all(admins.map(admin => NotificationModel.createIfNotExists({
        recipient_user_code: admin.admin_id, recipient_role: 'audito_admin', type: 'contact_review',
        title: 'Quoted account registered', message: `${fields.org_name} registered from its quote and can now pay.`,
        notification_key: `contact-review-registered:${request.request_id}:${admin.admin_id}`,
      })));
    } catch (error) { console.error('Quote registration notification failed:', error); }

    return successResponse(res, {
      payment: { payment_code: payment.payment_code, plan_name: payment.plan_name, amount: Number(payment.amount), currency: payment.currency },
    }, 'Your organization is registered. Complete payment to activate the workspace.', 201);
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    if (error.statusCode) return errorResponse(res, error.message, error.statusCode);
    console.error('registerFromQuote error:', error);
    return errorResponse(res, 'Registration failed. Please try again.', 500);
  } finally {
    connection?.release();
  }
};

module.exports = { getQuoteRegistration, registerFromQuote, linkProblem };
