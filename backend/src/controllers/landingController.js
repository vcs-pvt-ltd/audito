const ContactMessageModel = require('../models/ContactMessageModel');
const PlanSettingsModel = require('../models/PlanSettingsModel');
const PromotionCampaignModel = require('../models/PromotionCampaignModel');
const { sendContactEmail } = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/helpers');

const getPublicPlanSettings = async (_req, res) => {
  try {
    const [catalog, active_promotions] = await Promise.all([
      PlanSettingsModel.list(),
      PromotionCampaignModel.list({ activeOnly: true }),
    ]);
    return successResponse(res, { ...catalog, active_promotions });
  } catch (error) {
    console.error('getPublicPlanSettings error:', error);
    return errorResponse(res, 'Failed to retrieve plan settings.', 500);
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

module.exports = {
  submitContactForm,
  getPublicPlanSettings,
};
