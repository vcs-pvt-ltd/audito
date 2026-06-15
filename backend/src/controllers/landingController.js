const { sendContactEmail } = require('../services/emailService');

/**
 * Handle Contact Form Submissions from the Landing Page
 */
const submitContactForm = async (req, res) => {
  try {
    const { name, email, company, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and message are required fields.' 
      });
    }

    // Pass data to email service
    await sendContactEmail({ name, email, company, phone, message });

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
  submitContactForm
};
