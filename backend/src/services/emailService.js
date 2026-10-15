/**
 * Email Service - Nodemailer
 *
 * Sends verification emails to newly created users.
 * Configure SMTP credentials in .env
 */

const nodemailer = require('nodemailer');

const { getEmailTemplate } = require('../utils/emailTemplates');
const { getCountryDialingCode } = require('../utils/orgLookup');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[char]));

const formatInternationalPhone = (phoneNumber, dialingCode) => {
  const phone = String(phoneNumber || '').trim();
  const code = String(dialingCode || '').trim();
  if (!phone) return '—';
  if (!code || phone.startsWith('+') || phone.startsWith(code)) return phone;
  return `${code} ${phone.replace(/^0+/, '')}`.trim();
};

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

/** Send an onboarding invitation to an Auditor or Organization User. */
const sendUserInvitationEmail = async (toEmail, userName, token, details = {}) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const organizationName = escapeHtml(details.organizationName || 'your organization');
  const role = escapeHtml(details.role || 'Team member');
  const organizationEmail = escapeHtml(details.organizationEmail || '—');
  const organizationPhone = escapeHtml(formatInternationalPhone(details.organizationPhone, details.organizationDialingCode));
  const organizationAddress = escapeHtml(details.organizationAddress || '—');
  const assignedEntityName = escapeHtml(details.assignedEntityName || '—');
  const assignedEntityType = escapeHtml(details.assignedEntityType || '');
  const showAssignedArea = details.includeAssignedArea === true;
  const safeName = escapeHtml(userName || 'there');

  const { html, attachments } = getEmailTemplate({
    title: `You’re invited to ${organizationName}`,
    subtitle: 'Accept your Audito workspace invitation',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${safeName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        You have been invited to join <strong>${organizationName}</strong> on Audito as a <strong>${role}</strong>.
        Accept the invitation to verify your email and create your secure password.
      </p>
      <table style="width: 100%; border-collapse: collapse; background-color: #f8f8f8; border-radius: 8px; margin: 18px 0; padding: 12px 16px;">
        <tr><td style="padding: 7px 0; color: #888; font-size: 12px;">Organization</td><td style="padding: 7px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${organizationName}</td></tr>
        <tr><td style="padding: 7px 0; color: #888; font-size: 12px;">Email</td><td style="padding: 7px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${organizationEmail}</td></tr>
        <tr><td style="padding: 7px 0; color: #888; font-size: 12px;">Phone number</td><td style="padding: 7px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${organizationPhone}</td></tr>
        <tr><td style="padding: 7px 0; color: #888; font-size: 12px;">Address</td><td style="padding: 7px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${organizationAddress}</td></tr>
        ${showAssignedArea ? `<tr><td style="padding: 7px 0; color: #888; font-size: 12px;">Assigned area</td><td style="padding: 7px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${assignedEntityType ? `${assignedEntityType} — ` : ''}${assignedEntityName}</td></tr>` : ''}
      </table>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${verifyUrl}" style="background-color: #12B572; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">Accept Invitation &amp; Set Password</a>
      </div>
      <p style="color: #888; font-size: 12px; line-height: 1.5;">This invitation expires in 48 hours. If you were not expecting it, you can safely ignore this email.</p>
    `,
  });

  await transporter.sendMail({
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Audito - You’re invited to ${details.organizationName || 'a workspace'}`,
    html,
    attachments,
  });
};

/** Verify a newly registered organization's email; this does not set a password. */
const sendOrganizationRegistrationVerificationEmail = async (toEmail, contactName, token, organizationName) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(contactName || 'there');
  const safeOrganizationName = escapeHtml(organizationName || 'your organization');
  const { html, attachments } = getEmailTemplate({
    title: 'Verify Your Organization Email',
    subtitle: 'Confirm your registration with Audito',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${safeName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        Thank you for registering <strong>${safeOrganizationName}</strong> with Audito. Please confirm this email address to activate your organization registration and continue with your subscription.
      </p>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${verifyUrl}" style="background-color: #12B572; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">Verify Organization Email</a>
      </div>
      <p style="color: #888; font-size: 12px; line-height: 1.5;">This link expires in 48 hours. This step only verifies your email address; it does not create or change your password.</p>
    `,
  });
  await transporter.sendMail({
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Audito - Verify Your Organization Email',
    html,
    attachments,
  });
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
  const auditTypeLabel = audit.audit_type === 'external' ? 'External' : 'Internal';

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
            <td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${auditTypeLabel}</td>
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

const sendAuditFirmAssignmentEmail = async (toEmail, adminName, audit) => {
  const safeName = adminName || 'Audit Firm Administrator';
  const startDate = String(audit.start_date || '').slice(0, 10);
  const endDate = String(audit.end_date || '').slice(0, 10);
  const { html, attachments } = getEmailTemplate({
    title: 'External Audit Assigned',
    subtitle: 'Assign an auditor from your audit firm',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${safeName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">An external audit has been assigned to your firm. Please open Audito and assign a verified auditor before the audit starts.</p>
      <div style="margin-top: 14px;"><table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 10px 0; color: #999; font-size: 12px;">Audit Title</td><td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${audit.title || ''}</td></tr>
        <tr><td style="padding: 10px 0; color: #999; font-size: 12px;">Start Date</td><td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${startDate}</td></tr>
        <tr><td style="padding: 10px 0; color: #999; font-size: 12px;">End Date</td><td style="padding: 10px 0; color: #00374B; font-size: 13px; font-weight: 700; text-align: right;">${endDate}</td></tr>
      </table></div>
    `,
  });
  await transporter.sendMail({
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Audito - External Audit Assigned to Your Firm',
    html,
    attachments,
  });
};

/**
 * Send a learning-assignment email without exposing any assessment content.
 */
const sendLearningAssignmentEmail = async (toEmail, auditorName, assignment) => {
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
  const safeName = escapeHtml(auditorName || 'Auditor');
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const learningUrl = `${baseUrl}/learning`;
  const typeLabel = escapeHtml(assignment.type || 'Learning item');
  const assignmentTitle = escapeHtml(assignment.title);
  const dueDate = escapeHtml(assignment.dueDate);

  const { html, attachments } = getEmailTemplate({
    title: `${typeLabel} Assigned`,
    subtitle: 'A new learning activity is ready for you',
    content: `
      <p style="color: #333; font-size: 16px;">Hi ${safeName},</p>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        You have been assigned a new ${typeLabel.toLowerCase()} on Audito.
      </p>
      <div style="background-color: #f8f8f8; padding: 16px 18px; border-radius: 8px; margin: 18px 0;">
        <p style="margin: 0; color: #999; font-size: 12px;">${typeLabel}</p>
        <p style="margin: 5px 0 0; color: #00374B; font-size: 15px; font-weight: 700;">${assignmentTitle}</p>
        ${dueDate ? `<p style="margin: 10px 0 0; color: #555; font-size: 13px;">Due date: <strong>${dueDate}</strong></p>` : ''}
      </div>
      <div style="text-align: center; margin: 26px 0;">
        <a href="${learningUrl}"
           style="background-color: #12B572; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block;">
          Open Learning Centre
        </a>
      </div>
    `,
  });

  await transporter.sendMail({
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Audito - ${typeLabel} Assigned`,
    html,
    attachments,
  });
};

/**
 * Send contact form submission to team/admin and thank you to the user
 */
const sendContactEmail = async ({ name, email, company, phone, country, message }) => {
  const phoneWithDialingCode = formatInternationalPhone(
    phone,
    await getCountryDialingCode(country)
  );
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
            <td style="color: #00374B; font-weight: 700;">${phoneWithDialingCode}</td>
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

const sendSubscriptionExpiryReminderEmail = async (toEmail, adminName, { planName, endDate, daysLeft }) => {
  const billingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing`;
  const endDateLabel = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(endDate));
  const { html, attachments } = getEmailTemplate({
    title: `Your plan expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
    subtitle: 'Renew now to keep your Audito workspace active',
    content: `<p style="color:#333;font-size:16px;">Hi ${adminName},</p><p style="color:#555;font-size:14px;line-height:1.6;">Your <strong>${planName}</strong> plan will expire on <strong>${endDateLabel}</strong>. Renew before then to avoid an interruption to your workspace.</p><div style="text-align:center;margin:26px 0;"><a href="${billingUrl}" style="background-color:#d64545;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">Review & Renew Plan</a></div><p style="color:#888;font-size:12px;line-height:1.5;">This is an automated account reminder from Audito.</p>`,
  });
  await transporter.sendMail({ from: `"Audito" <${process.env.EMAIL_USER}>`, to: toEmail, subject: `Audito - Your ${planName} plan expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`, html, attachments });
};

const sendManualPaymentApprovedEmail = async (toEmail, customerName, payment) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const paymentUrl = `${baseUrl}/payment?code=${encodeURIComponent(payment.payment_code)}`;
  const safeName = escapeHtml(customerName || 'there');
  const safePlan = escapeHtml(payment.plan_name || 'selected');
  const safeCycle = escapeHtml(payment.billing_cycle || '');
  const { html, attachments } = getEmailTemplate({
    title: 'Payment Approved',
    subtitle: 'Your Audito subscription is now active',
    content: `
      <p style="color:#333;font-size:16px;">Hi ${safeName},</p>
      <p style="color:#555;font-size:14px;line-height:1.6;">Audito has verified your payment and activated your <strong>${safePlan}</strong> ${safeCycle ? `(${safeCycle})` : ''} subscription.</p>
      <div style="text-align:center;margin:26px 0;"><a href="${paymentUrl}" style="background-color:#12B572;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">View Payment Confirmation</a></div>
      <p style="color:#888;font-size:12px;line-height:1.5;">You can now sign in and use your Audito workspace.</p>
    `,
  });
  await transporter.sendMail({
    from: `"Audito" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Audito - Payment Approved',
    html,
    attachments,
  });
};

// ─── Customer and Audit Firm account reviews ────────────────────────────────

const reviewRow = (label, value) => `<tr><td style="color:#888;padding:6px 0;font-size:14px;">${label}</td><td style="color:#00374B;font-weight:700;text-align:right;padding:6px 0;font-size:14px;">${value}</td></tr>`;
const reviewCount = value => (value ? Number(value).toLocaleString('en') : 'Not given');

// Request summary shared by the review emails.
function reviewSummary(request) {
  return `<table style="width:100%;background-color:#f8f8f8;padding:14px 16px;border-radius:8px;border-collapse:collapse;margin:18px 0;">
    ${reviewRow('Organization', escapeHtml(request.organization_name))}
    ${reviewRow('Account type', `${escapeHtml(request.account_type)} · ${escapeHtml(request.entity_type)}`)}
    ${request.country ? reviewRow('Country', escapeHtml(request.country)) : ''}
    ${reviewRow('Departments', reviewCount(request.departments))}
    ${reviewRow('Audit lines per audit', reviewCount(request.lines_per_audit))}
  </table>`;
}

// How to reach the Audito team: WhatsApp and email.
function reviewContactBlock(contact) {
  const whatsapp = contact.whatsapp_url
    ? `<a href="${escapeHtml(contact.whatsapp_url)}" style="color:#12B572;font-weight:700;text-decoration:none;">${escapeHtml(contact.whatsapp)}</a>`
    : escapeHtml(contact.whatsapp);
  return `<div style="border:1px solid #e3efe9;background-color:#f3faf6;border-radius:8px;padding:14px 16px;margin:18px 0;">
    <p style="margin:0 0 8px;color:#00374B;font-weight:700;font-size:14px;">Talk to the Audito team</p>
    <p style="margin:0 0 4px;color:#555;font-size:14px;">WhatsApp: ${whatsapp}</p>
    <p style="margin:0;color:#555;font-size:14px;">Email: <a href="mailto:${escapeHtml(contact.email)}" style="color:#12B572;font-weight:700;text-decoration:none;">${escapeHtml(contact.email)}</a></p>
  </div>`;
}

const button = (url, label) => `<div style="text-align:center;margin:26px 0;"><a href="${url}" style="background-color:#12B572;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;display:inline-block;">${label}</a></div>`;

module.exports = {
  /** To the requester: request received, verify the email, and how to reach the team. */
  sendContactReviewVerificationEmail: async (request, token, contact) => {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${encodeURIComponent(token)}`;
    const { html, attachments } = getEmailTemplate({
      title: 'We received your account request',
      subtitle: 'Verify your email so our team can review it',
      content: `<p style="color:#333;font-size:16px;">Hello ${escapeHtml(request.contact_name)},</p>
        <p style="color:#555;font-size:14px;line-height:1.6;">Thank you for your interest in Audito. Our team reviews ${escapeHtml(request.account_type)} account requests and prepares a quote for your organization.</p>
        ${reviewSummary(request)}
        <p style="color:#555;font-size:14px;line-height:1.6;"><strong>Next step:</strong> verify your email address. We start the review after you verify.</p>
        ${button(verifyUrl, 'Verify Email')}
        <p style="color:#888;font-size:12px;line-height:1.5;">This link expires in 48 hours.</p>
        ${reviewContactBlock(contact)}`,
    });
    await transporter.sendMail({ from: `"Audito" <${process.env.EMAIL_USER}>`, to: request.email,
      subject: 'Audito - We received your account request', html, attachments });
  },
  /** To the Audito team: a new request to review. */
  sendContactReviewRequestEmail: async (request, contact) => {
    const reviewUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin-panel/contact-reviews`;
    const { html, attachments } = getEmailTemplate({
      title: 'New account review request',
      subtitle: escapeHtml(request.account_type),
      content: `${reviewSummary(request)}
        <table style="width:100%;border-collapse:collapse;">
          ${reviewRow('Contact', escapeHtml(request.contact_name))}
          ${reviewRow('Email', escapeHtml(request.email))}
          ${reviewRow('Phone', escapeHtml(request.phone))}
        </table>
        ${request.notes ? `<p style="color:#555;font-size:14px;line-height:1.6;margin-top:16px;"><strong>Notes:</strong><br>${escapeHtml(request.notes).replace(/\n/g, '<br>')}</p>` : ''}
        <p style="color:#888;font-size:12px;">The requester must verify their email before a quote can be sent.</p>
        ${button(reviewUrl, 'Open Account Reviews')}`,
    });
    await transporter.sendMail({ from: `"Audito" <${process.env.EMAIL_USER}>`, to: contact.email || process.env.EMAIL_USER,
      subject: `[Audito] ${request.account_type} account review: ${request.organization_name}`, html, attachments });
  },
  /** To the requester: the quote, a button to register, and how to reach the team. */
  sendContactReviewQuoteEmail: async (request, contact, registerUrl) => {
    const expires = request.registration_expires_at
      ? new Intl.DateTimeFormat('en', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(request.registration_expires_at))
      : null;
    const { html, attachments } = getEmailTemplate({
      title: 'Your Audito quote is ready',
      subtitle: escapeHtml(request.organization_name),
      content: `<p style="color:#333;font-size:16px;">Hello ${escapeHtml(request.contact_name)},</p>
        <p style="color:#555;font-size:14px;line-height:1.6;">Our team reviewed your ${escapeHtml(request.account_type)} request and prepared a quote of <strong>$${Number(request.assigned_price).toFixed(2)} USD</strong>.</p>
        ${reviewSummary(request)}
        ${request.quoted_tokens ? `<p style="color:#555;font-size:14px;line-height:1.6;">This one-time payment includes <strong>${Number(request.quoted_tokens).toLocaleString('en')} audit tokens</strong> (1 token = 1 audit line).</p>` : ''}
        ${request.admin_notes ? `<p style="color:#555;font-size:14px;line-height:1.6;">${escapeHtml(request.admin_notes).replace(/\n/g, '<br>')}</p>` : ''}
        <p style="color:#555;font-size:14px;line-height:1.6;"><strong>Next step:</strong> register your organization and create your administrator account. You then pay on the secure payment page to activate the workspace.</p>
        ${registerUrl ? button(escapeHtml(registerUrl), 'Register Your Organization') : ''}
        ${registerUrl && expires ? `<p style="color:#888;font-size:12px;line-height:1.5;text-align:center;">This link can be used once and works until ${expires}. If it expires, contact us for a new one.</p>` : ''}
        ${reviewContactBlock(contact)}`,
    });
    await transporter.sendMail({ from: `"Audito" <${process.env.EMAIL_USER}>`, to: request.email, replyTo: contact.email,
      subject: 'Audito - Your account quote is ready', html, attachments });
  },
  sendVerificationEmail,
  sendUserInvitationEmail,
  sendOrganizationRegistrationVerificationEmail,
  sendPasswordResetEmail,
  sendLinkRequestEmail,
  sendOtpEmail,
  sendAuditAssignedEmail,
  sendAuditFirmAssignmentEmail,
  sendLearningAssignmentEmail,
  sendContactEmail,
  sendContactReplyEmail,
  sendSubscriptionExpiryReminderEmail,
  sendManualPaymentApprovedEmail,
};
