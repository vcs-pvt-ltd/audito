const ContactMessageModel = require('../models/ContactMessageModel');
const PackagePricingModel = require('../models/PackagePricingModel');
const ContactReviewModel = require('../models/ContactReviewModel');
const AdminModel = require('../models/AdminModel');
const NotificationModel = require('../models/NotificationModel');
const PrivacyPolicyModel = require('../models/PrivacyPolicyModel');
const { sendContactEmail } = require('../services/emailService');
// Called through the module so tests can stub outgoing email.
const emailService = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/helpers');
const { auditoContact } = require('../utils/auditoContact');

const getPublishedPrivacyPolicy = async (_req, res) => {
  try {
    const policy = await PrivacyPolicyModel.getPublished();
    if (!policy) return errorResponse(res, 'No privacy policy is currently published.', 404);
    return successResponse(res, policy, 'Privacy policy retrieved.');
  } catch (error) {
    console.error('getPublishedPrivacyPolicy error:', error);
    return errorResponse(res, 'Failed to retrieve privacy policy.', 500);
  }
};

/**
 * Handle Contact Form Submissions from the Landing Page
 */
const submitContactForm = async (req, res) => {
  try {
    const { name, email, company, phone, country, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and message are required fields.' 
      });
    }

    // Save message to database
    await ContactMessageModel.create({ name, email, company, phone, country, message });

    // Pass data to email service
    await sendContactEmail({ name, email, company, phone, country, message });

    return res.status(200).json({ 
      success: true, 
      message: 'Thank you for contacting us. We will get back to you soon.' 
    });
  } catch (error) {
    console.error('Error handling contact form:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to send message. Please try again later.' 
    });
  }
};

// Same ranges as the Company package so quotes compare with package pricing.
const REVIEW_LIMITS = { departments: [1, 10000], lines_per_audit: [1, 1000000] };
const wholeNumberIn = (value, [min, max]) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
};

module.exports = {
  // Customer and Audit Firm accounts are priced by the Audito team.
  submitContactReview: async (req, res) => {
    const value = (key, max = 255) => String(req.body?.[key] || '').trim().slice(0, max);
    const request = {
      account_type: value('account_type', 60), entity_type: value('entity_type', 60),
      organization_name: value('organization_name'), contact_name: value('contact_name'),
      email: value('email'), phone: value('phone', 60), country: value('country', 100), notes: value('notes', 2000),
      departments: wholeNumberIn(req.body?.departments, REVIEW_LIMITS.departments),
      lines_per_audit: wholeNumberIn(req.body?.lines_per_audit, REVIEW_LIMITS.lines_per_audit),
    };
    const allowed = {
      Customer: ['Customer', 'Buying Office', 'Supplier'],
      'Audit Firm': ['Audit Firm Company', 'Branch', 'Audit Firm Department'],
      Company: ['Cluster', 'Factory', 'Unit', 'Department', 'Section'],
    };
    if (!allowed[request.account_type]?.includes(request.entity_type) ||
      !request.organization_name || !request.contact_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email) ||
      !/^[+()\d\s.-]{7,60}$/.test(request.phone)) {
      return errorResponse(res, 'Enter a valid account type, organization, name, email, and phone number.', 400);
    }
    if (!request.country) return errorResponse(res, 'Select your country.', 400);
    if (!request.departments) return errorResponse(res, 'Enter the number of departments, from 1 to 10,000.', 400);
    if (!request.lines_per_audit) return errorResponse(res, 'Enter the audit lines per audit, from 1 to 1,000,000.', 400);
    const contact = auditoContact();
    let created;
    try {
      created = await ContactReviewModel.create(request);
    } catch (error) {
      console.error('submitContactReview error:', error);
      return errorResponse(res, 'Your request could not be submitted. Please try again.', 500);
    }
    // The request is saved. Email or notification problems must not make the
    // user submit it again, so they are reported instead of failing the request.
    let emailSent = true;
    try { await emailService.sendContactReviewVerificationEmail(request, created.verificationToken, contact); }
    catch (error) { emailSent = false; console.error('Contact review verification email failed:', error); }
    try {
      const admins = await AdminModel.listAll({ role: 'audito_admin', is_active: true });
      await Promise.all(admins.map((admin) => NotificationModel.createIfNotExists({
        recipient_user_code: admin.admin_id, recipient_role: 'audito_admin', type: 'contact_review',
        title: 'New account review request', message: `${request.account_type}: ${request.organization_name}`,
        notification_key: `contact-review:${created.id}:${admin.admin_id}`,
      })));
      await emailService.sendContactReviewRequestEmail(request, contact);
    } catch (error) { console.error('Contact review team notification failed:', error); }
    return successResponse(res, { request_id: created.id, email_sent: emailSent, contact },
      emailSent ? 'Request received. Please verify your email address.' : 'Request received, but we could not send the verification email. Contact the Audito team to continue.', 201);
  },
  getContactDetails: (_req, res) => successResponse(res, auditoContact()),
  submitContactForm,
  getPublishedPrivacyPolicy,
  getPackagePricing: async (_req, res) => {
    try { return successResponse(res, await PackagePricingModel.get()); }
    catch (error) { console.error('getPackagePricing error:', error); return errorResponse(res, 'Pricing is unavailable.', 503); }
  },
};
