/**
 * Email Service - Nodemailer
 *
 * Sends verification emails to newly created users.
 * Configure SMTP credentials in .env
 */

const nodemailer = require('nodemailer');

const { getEmailTemplate } = require('../utils/emailTemplates');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send email verification link to a newly created user
 */
const sendVerificationEmail = async (toEmail, userName, token) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const { html, attachments } = getEmailTemplate({
    title: 'Welcome to Audito',
    subtitle: 'Verify your email & set password',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${userName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        An account has been created for you on the Audito platform.
        Please verify your email address and set your password by clicking the button below.
      </p>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${verifyUrl}"
           style="background-color: #12B572; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
          Verify Email & Set Password
        </a>
      </div>
      <p style="color: #888; font-size: 12px; line-height: 1.5;">
        This link will expire in 48 hours. If you did not expect this email, you can safely ignore it.
      </p>
    `,
  });

  const mailOptions = {
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Audito - Verify Your Email & Set Password',
    html,
    attachments,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send password reset email (for resend verification)
 */
const sendPasswordResetEmail = async (toEmail, userName, token) => {
  // Reuses the same verification flow
  await sendVerificationEmail(toEmail, userName, token);
};

/**
 * Send link request notification to the target entity's admin
 */
const sendLinkRequestEmail = async (toEmail, adminName, requesterType, requesterCode, linkCode) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const linksUrl = `${baseUrl}/links`;

  const { html, attachments } = getEmailTemplate({
    title: 'New Link Request',
    subtitle: 'Organization linking request received',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${adminName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        A <strong>${requesterType}</strong> entity (<strong>${requesterCode}</strong>) has requested to link with your organization on the Audito platform.
      </p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        Link Code: <strong>${linkCode}</strong>
      </p>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${linksUrl}"
           style="background-color: #12B572; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
          Review Link Request
        </a>
      </div>
    `,
  });

  const mailOptions = {
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Audito - New Organization Link Request',
    html,
    attachments,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send OTP code for password reset
 */
const sendOtpEmail = async (toEmail, userName, otp) => {

  const { html, attachments } = getEmailTemplate({
    title: 'Password Reset',
    subtitle: 'OTP Verification Code',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${userName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        You requested a password reset. Use the OTP code below to verify your identity.
      </p>
      <div style="text-align: center; margin: 26px 0;">
        <div style="background-color: #f5f5f5; padding: 18px 34px; border-radius: 12px; display: inline-block;">
          <span style="font-size: 28px; font-weight: 800; letter-spacing: 8px; color: #00374B;">${otp}</span>
        </div>
      </div>
      <p style="color: #888; font-size: 12px; line-height: 1.5;">
        This code will expire in 10 minutes. If you did not request this, you can safely ignore this email.
      </p>
    `,
  });

  const mailOptions = {
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Audito - Password Reset OTP',
    html,
    attachments,
  };

  await transporter.sendMail(mailOptions);
};

const sendAuditAssignedEmail = async (toEmail, auditorName, audit) => {
  const safeName = auditorName || 'Auditor';

  const formatDateOnly = (value) => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const s = String(value);
    const m = s.match(/^\d{4}-\d{2}-\d{2}/);
    if (m) return m[0];
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  };

  const startDate = formatDateOnly(audit.start_date);
  const endDate = formatDateOnly(audit.end_date);

  const { html, attachments } = getEmailTemplate({
    title: 'Audit Assigned',
    subtitle: 'You have been assigned a new audit',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${safeName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        An audit has been assigned to you with the following details:
      </p>
      <div style="margin-top: 14px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #999; font-size: 12px;">Audit Title</td>
            <td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${audit.title || ''}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #999; font-size: 12px;">Audit Type</td>
            <td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${audit.audit_type || ''}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #999; font-size: 12px;">Start Date</td>
            <td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${startDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #999; font-size: 12px;">End Date</td>
            <td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${endDate}</td>
          </tr>
        </table>
      </div>
    `,
  });

  const mailOptions = {
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Audito - Audit Assigned',
    html,
    attachments,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send contact form submission to team/admin and thank you to the user
 */
const sendContactEmail = async ({ name, email, company, phone, country, message }) => {
  // 1. Email to the team (Audito Admin)
  const teamEmailHtml = getEmailTemplate({
    title: 'New Contact Request',
    subtitle: `From ${name} - ${company || 'N/A'}`,
    content: `
      <div style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; margin-top: 20px;">
        <h3 style="color: #00374B; margin-top: 0;">Contact Details:</h3>
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="color: #999; padding: 5px 0;">Name:</td>
            <td style="color: #00374B; font-weight: 700;">${name}</td>
          </tr>
          <tr>
            <td style="color: #999; padding: 5px 0;">Email:</td>
            <td style="color: #00374B; font-weight: 700;">${email}</td>
          </tr>
          <tr>
            <td style="color: #999; padding: 5px 0;">Company:</td>
            <td style="color: #00374B; font-weight: 700;">${company || 'N/A'}</td>
          </tr>
          <tr>
            <td style="color: #999; padding: 5px 0;">Phone:</td>
            <td style="color: #00374B; font-weight: 700;">${phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="color: #999; padding: 5px 0;">Country:</td>
            <td style="color: #00374B; font-weight: 700;">${country || 'N/A'}</td>
          </tr>
        </table>
        <h3 style="color: #00374B; margin-top: 20px; margin-bottom: 10px;">Message:</h3>
        <p style="color: #555; background: white; padding: 15px; border-radius: 6px; border: 1px solid #eee; margin: 0;">
          ${message}
        </p>
      </div>
    `,
  });

  const mailOptionsToAdmin = {
    from: `"Audito Contact" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `[Audito] New Contact Form: ${name}`,
    html: teamEmailHtml.html,
    attachments: teamEmailHtml.attachments,
  };

  // 2. Thank you email to the user
  const userThankYouHtml = getEmailTemplate({
    title: 'Thank You for Reaching Out',
    subtitle: "We've received your message!",
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${name},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        Thank you for contacting Audito. We have received your inquiry and our team will get back to you within 24 hours.
      </p>
    `,
  });

  const mailOptionsToUser = {
    from: `"Audito Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Thank you for contacting Audito',
    html: userThankYouHtml.html,
    attachments: userThankYouHtml.attachments,
  };

  // Send both emails
  await Promise.all([
    transporter.sendMail(mailOptionsToAdmin),
    transporter.sendMail(mailOptionsToUser),
  ]);
};

/**
 * Send reply to contact form submission
 */
const sendContactReplyEmail = async (toEmail, userName, originalMessage, replyContent) => {
  const { html, attachments } = getEmailTemplate({
    title: 'Audito Support Reply',
    subtitle: 'Reply to your inquiry',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${userName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6; white-space: pre-line;">
        ${replyContent}
      </p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0 20px 0;" />
      <p style="color: #999; font-size: 12px;"><strong>Original Message:</strong></p>
      <blockquote style="color: #777; border-left: 3px solid #ccc; padding-left: 10px; margin-left: 0; font-style: italic;">
        ${originalMessage}
      </blockquote>
    `,
  });

  const mailOptions = {
    from: `"Audito Support" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Re: Thank you for contacting Audito',
    html,
    attachments,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendLinkRequestEmail,
  sendOtpEmail,
  sendAuditAssignedEmail,
  sendContactEmail,
  sendContactReplyEmail
};
