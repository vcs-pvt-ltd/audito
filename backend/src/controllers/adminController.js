const ContactMessageModel = require('../models/ContactMessageModel');
const PromoCodeModel = require('../models/PromoCodeModel');
const AdminModel = require('../models/AdminModel');
const { sendContactReplyEmail, sendVerificationEmail } = require('../services/emailService');
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
};
