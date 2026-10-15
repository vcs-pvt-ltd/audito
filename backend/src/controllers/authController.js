/**
 * Auth Controller
 *
 * Handles registration, login, token refresh, and password management.
 *
 * Registration supports ALL entity types — each registers independently:
 *
 *   Customer account:     Customer | Buying Office | Supplier
 *   Company account:      Company | Cluster | Factory | Unit | Department
 *   Audit Firm account:   Audit Firm Company
 *
 * After registration, entities link to each other via organization_links.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AdminModel = require('../models/AdminModel');
const PromoCodeModel = require('../models/PromoCodeModel');
const AuditorModel = require('../models/AuditorModel');
const OrganizationUserModel = require('../models/OrganizationUserModel');
const CustomerModel = require('../models/CustomerModel');
const CompanyModel = require('../models/CompanyModel');
const AuditFirmModel = require('../models/AuditFirmModel');
const PrivacyPolicyModel = require('../models/PrivacyPolicyModel');
const {
  generateCustCode,
  generateCboCode,
  generateSupplierCode,
  generateCompCode,
  generateCompClusCode,
  generateCompFactCode,
  generateCompUnitCode,
  generateCompDeptCode,
  generateCompSectionCode,
  generateAfcCode,
  generateAfcBranchCode,
  generateAfcDeptCode,
  generateAdminUserCode,
  generateRefreshTokenId,
  generatePasswordResetOtpId
} = require('../utils/codeGenerator');
const { successResponse, errorResponse, validateRequiredFields, isValidEmail } = require('../utils/helpers');
const { db } = require('../config/db');
const crypto = require('crypto');
const { sendOrganizationRegistrationVerificationEmail, sendUserInvitationEmail, sendOtpEmail } = require('../services/emailService');
const PaymentModel = require('../models/PaymentModel');
const { getOrgName, getOrgDetails, getCountryDialingCode } = require('../utils/orgLookup');
const { getResendCooldownSeconds, recordResend } = require('../utils/emailResendCooldown');
const SubscriptionModel = require('../models/SubscriptionModel');
const ContactReviewModel = require('../models/ContactReviewModel');
const { auditoContact } = require('../utils/auditoContact');
const PackagePricingModel = require('../models/PackagePricingModel');
const { canRegisterPackageEntry } = require('../config/packageHierarchy');
const fs = require('fs');
const path = require('path');

// ─── Entity type configuration ───────────────────────────────────
// Maps each entity_type to its account_type, org_level, code generator, and DB insert function.

const ENTITY_CONFIG = {
  'Customer': { account_type: 'Customer', org_level: 8, genCode: generateCustCode, table: 'customers', codeField: 'cust_code' },
  'Buying Office': { account_type: 'Customer', org_level: 7, genCode: generateCboCode, table: 'customer_buying_offices', codeField: 'cbo_code' },
  'Supplier': { account_type: 'Customer', org_level: 7, genCode: generateSupplierCode, table: 'customer_suppliers', codeField: 'csup_code' },
  'Company': { account_type: 'Company', org_level: 5, genCode: generateCompCode, table: 'companies', codeField: 'comp_code' },
  'Cluster': { account_type: 'Company', org_level: 4, genCode: generateCompClusCode, table: 'company_clusters', codeField: 'comp_clus_code' },
  'Factory': { account_type: 'Company', org_level: 3, genCode: generateCompFactCode, table: 'company_factories', codeField: 'comp_fact_code' },
  'Unit': { account_type: 'Company', org_level: 2, genCode: generateCompUnitCode, table: 'company_units', codeField: 'comp_unit_code' },
  'Department': { account_type: 'Company', org_level: 1, genCode: generateCompDeptCode, table: 'company_departments', codeField: 'comp_dept_code' },
  'Section': { account_type: 'Company', org_level: 1, genCode: generateCompSectionCode, table: 'company_sections', codeField: 'comp_section_code' },
  // Audit Firm: keep entity_type as "Audit Firm Company" (table: audit_firm_companies),
  // but normalize account_type to "Audit Firm" everywhere in auth/session.
  'Audit Firm Company': { account_type: 'Audit Firm', org_level: 6, genCode: generateAfcCode, table: 'audit_firm_companies', codeField: 'afc_code' },
  'Branch': { account_type: 'Audit Firm', org_level: 3, genCode: generateAfcBranchCode, table: 'audit_firm_company_branches', codeField: 'afc_branch_code' }
  ,
  'Audit Firm Department': { account_type: 'Audit Firm', org_level: 1, genCode: generateAfcDeptCode, table: 'audit_firm_company_departments', codeField: 'afc_dept_code' }
};

const VALID_ENTITY_TYPES = Object.keys(ENTITY_CONFIG);

const ORGANIZATION_LOGO_PREFIX = '/uploads/organization-logos/';
const MAX_ORGANIZATION_LOGO_BYTES = 700 * 1024;

const saveOrganizationLogo = (entityCode, base64Image) => {
  if (!base64Image) return null;

  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=\s]+)$/i.exec(base64Image);
  if (!match) {
    throw new Error('Organization logo must be a PNG or JPEG image.');
  }

  const imageBuffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!imageBuffer.length || imageBuffer.length > MAX_ORGANIZATION_LOGO_BYTES) {
    throw new Error('Organization logo must be 700 KB or smaller.');
  }

  const extension = match[1].toLowerCase() === 'image/jpeg' ? 'jpg' : 'png';
  const targetDir = path.join(__dirname, '..', 'public', 'uploads', 'organization-logos');
  fs.mkdirSync(targetDir, { recursive: true });

  const filename = `organization_${entityCode}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(targetDir, filename), imageBuffer, { flag: 'wx' });
  return `${ORGANIZATION_LOGO_PREFIX}${filename}`;
};

const deleteOrganizationLogo = (logoPath) => {
  if (!logoPath || !logoPath.startsWith(ORGANIZATION_LOGO_PREFIX)) return;
  const filename = path.basename(logoPath);
  const filePath = path.join(__dirname, '..', 'public', 'uploads', 'organization-logos', filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

// Helper: get entity code from admin (now just entity_code)
const getEntityCode = (admin) => admin.entity_code || null;

const normalizeUserRole = (role) => (
  role === 'entity_head' ? 'organization_user' : role
);

// ─── Generate JWT tokens (supports all roles) ────────────────────

const generateTokens = (admin) => generateTokensForRole('admin', admin);

function normalizeAccountType(accountType, entityType) {
  if (accountType === 'Audit Firm Company') return 'Audit Firm';
  // Safety: if legacy data has null account_type but entity_type is audit firm root
  if (!accountType && entityType === 'Audit Firm Company') return 'Audit Firm';
  return accountType;
}

// Sessions started from the Audito Auditor Android app carry this client marker.
// They stay auditor sessions through refresh and cannot switch to another role.
const AUDITOR_APP_CLIENT = 'auditor_app';

function generateTokensForRole(role, record, client = null) {
  let payload;
  const actualRole = normalizeUserRole(record.role || role);

  if (actualRole === 'admin' || actualRole === 'audito_admin') {
    payload = {
      userId: record.admin_id,
      userCode: record.admin_id,
      email: record.email,
      role: actualRole,
      accountType: actualRole === 'audito_admin' ? 'audito_admin' : normalizeAccountType(record.account_type, record.entity_type),
      entityType: record.entity_type || null,
      entityCode: record.entity_code || null,
      orgLevel: record.org_level || 0,
    };
  } else if (actualRole === 'auditor') {
    payload = {
      userId: record.auditor_id,
      userCode: record.auditor_id,
      email: record.email,
      role: 'auditor',
      userType: record.user_type,
      auditorType: record.auditor_type || null,
      assignedEntityType: record.assigned_entity_type,
      assignedEntityCode: record.assigned_entity_code,
      createdByEntityCode: record.created_by_entity_code,
    };
  } else {
    // organization_user
    payload = {
      userId: record.organization_user_id,
      userCode: record.organization_user_id,
      email: record.email,
      role: 'organization_user',
      userType: record.user_type,
      assignedEntityType: record.assigned_entity_type,
      assignedEntityCode: record.assigned_entity_code,
      createdByEntityCode: record.created_by_entity_code,
    };
  }

  if (client) payload.client = client;

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

  const refreshToken = jwt.sign(
    { userId: payload.userId, userCode: payload.userCode, role: actualRole, ...(client ? { client } : {}) },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// ─── Helpers: build user response & collect accounts ─────────────

function buildUserResponse(role, record) {
  const actualRole = normalizeUserRole(record.role || role);
  if (actualRole === 'admin' || actualRole === 'audito_admin') {
    return {
      id: record.admin_id,
      first_name: record.first_name,
      last_name: record.last_name,
      email: record.email,
      phone_number: record.phone_number || null,
      country: record.country || null,
      role: actualRole,
      account_type: actualRole === 'audito_admin' ? 'audito_admin' : normalizeAccountType(record.account_type, record.entity_type),
      entity_type: record.entity_type || null,
      entity_code: record.entity_code || null,
      org_level: record.org_level || 0,
      user_type: null,
      assigned_entity_type: null,
      assigned_entity_code: null,
      created_by_entity_code: null,
      onboarding_completed: !!record.onboarding_completed,
      onboarding_skipped: !!record.onboarding_skipped,
      onboarding_completed_at: record.onboarding_completed_at || null,
      profile_image: record.profile_image || null,
    };
  }
  // auditor or organization_user
  return {
    id: role === 'auditor' ? record.auditor_id : record.organization_user_id,
    first_name: record.first_name,
    last_name: record.last_name,
    email: record.email,
    phone_number: record.phone_number || null,
    country: record.country || null,
    role,
    account_type: null,
    entity_type: record.assigned_entity_type || null,
    entity_code: role === 'organization_user'
      ? (record.assigned_entity_code || record.created_by_entity_code)
      : record.created_by_entity_code,
    org_level: 0,
    user_type: record.user_type,
    auditor_type: record.auditor_type || null,
    assigned_entity_type: record.assigned_entity_type || null,
    assigned_entity_code: record.assigned_entity_code || null,
    assigned_org_tree_id: role === 'organization_user' ? (record.assigned_org_tree_id || null) : null,
    created_by_entity_code: record.created_by_entity_code,
    onboarding_completed: !!record.onboarding_completed,
    onboarding_skipped: !!record.onboarding_skipped,
    onboarding_completed_at: record.onboarding_completed_at || null,
    profile_image: record.profile_image || null,
  };
}

function getRootEntityCode(role, record) {
  if (role === 'audito_admin') return null;
  return role === 'admin' ? record.entity_code : record.created_by_entity_code;
}

async function getPlanLimitsForUser(role, record) {
  const rootCode = getRootEntityCode(role, record);
  if (!rootCode) return { ...SubscriptionModel.DEFAULT_LIMITS };
  return await SubscriptionModel.getLimits(rootCode);
}

/** The workspace package status returned with the session. */
async function resolveSubscriptionStatus(role, record) {
  return SubscriptionModel.getStatus(getRootEntityCode(role, record));
}

async function collectAccounts(email) {
  const accounts = [];

  const admin = await AdminModel.findByEmail(email);
  if (admin && admin.is_active) {
    const actualRole = admin.role || 'admin';
    accounts.push({
      role: actualRole,
      user_code: admin.admin_id,
      first_name: admin.first_name,
      last_name: admin.last_name,
      account_type: actualRole === 'audito_admin' ? 'audito_admin' : normalizeAccountType(admin.account_type, admin.entity_type),
      entity_type: admin.entity_type || null,
      entity_code: admin.entity_code || null,
      org_level: admin.org_level || 0,
      user_type: null,
    });
  }

  const auditor = await AuditorModel.findByEmail(email);
  if (auditor && auditor.is_active && auditor.email_verified && auditor.password) {
    accounts.push({
      role: 'auditor',
      user_code: auditor.auditor_id,
      first_name: auditor.first_name,
      last_name: auditor.last_name,
      account_type: null,
      entity_type: auditor.assigned_entity_type || null,
      entity_code: auditor.created_by_entity_code,
      org_level: 0,
      user_type: auditor.user_type,
      auditor_type: auditor.auditor_type || null,
    });
  }

  const organizationUser = await OrganizationUserModel.findByEmail(email);
  if (organizationUser && organizationUser.is_active && organizationUser.email_verified && organizationUser.password) {
    accounts.push({
      role: 'organization_user',
      user_code: organizationUser.organization_user_id,
      first_name: organizationUser.first_name,
      last_name: organizationUser.last_name,
      account_type: null,
      entity_type: organizationUser.assigned_entity_type || null,
      entity_code: organizationUser.assigned_entity_code || organizationUser.created_by_entity_code,
      org_level: 0,
      user_type: organizationUser.user_type,
    });
  }

  return accounts;
}

// ─── REGISTER ────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * Registers any entity type independently and creates its admin user.
 *
 * Standard plans require an administrator. Custom plans verify the organization
 * email first and collect administrator details after price approval, before payment.
 * Optional: registration_number, org_email, address, country, org_phone_number, nic, phone_number
 *
 * entity_type: Customer | Buying Office | Supplier | Company | Cluster | Factory |
 *              Unit | Department | Audit Firm Company
 */
const register = async (req, res) => {
  const connection = await db.getConnection();
  let savedOrganizationLogoPath = null;

  try {
    const {
      entity_type,
      org_name,
      registration_number,
      org_email,
      country,
      org_phone_number,
      first_name,
      last_name,
      email,
      phone_number,
      company_type,
      password,
      plan_name,
      timezone,
      promo_code,
      organization_logo,
      privacy_policy_id
    } = req.body;

    // Self-service registration is always a configurable Company package.
    if (plan_name !== 'Package') {
      return errorResponse(res, 'Choose a Company package or contact the Audito team.', 400);
    }
    if (promo_code) return errorResponse(res, 'Promo codes are not available for Company packages.', 400);
    const packagePricing = await PackagePricingModel.get();
    if (Number(req.body.package_selection?.pricing_version) !== packagePricing.pricing_version) {
      return errorResponse(res, 'Package pricing has changed. Return to pricing and review your selection before registering.', 409);
    }
    if (Number(req.body.package_selection?.expected_token_unit_price) !== packagePricing.token_unit_price) {
      return errorResponse(res, 'The token price changed. Refresh the package summary and try again.', 409);
    }
    let packageQuote;
    try { packageQuote = PackagePricingModel.quote(req.body.package_selection, packagePricing.token_unit_price); }
    catch (error) { return errorResponse(res, error.message, 400); }
    if (!(packageQuote.total_price > 0)) return errorResponse(res, 'The selected package has no price. Review your package selection.', 400);
    if (!canRegisterPackageEntry(entity_type, packageQuote.company_levels)) {
      return errorResponse(res, `${entity_type || 'This account type'} is unavailable with the selected company hierarchy. Add Cluster or Company in pricing, or choose an included starting type.`, 403);
    }

    const customOnlyEntityTypes = new Set([
      'Customer', 'Buying Office', 'Supplier',
      'Audit Firm Company', 'Branch', 'Audit Firm Department',
    ]);
    const missing = validateRequiredFields(req.body, ['entity_type', 'org_name', 'first_name', 'last_name', 'email', 'password', 'plan_name']);
    if (missing) return errorResponse(res, missing, 400);

    const activePrivacyPolicy = await PrivacyPolicyModel.getPublished();
    if (!activePrivacyPolicy) return errorResponse(res, 'Registration is temporarily unavailable because no privacy policy has been published.', 503);
    if (!privacy_policy_id || privacy_policy_id !== activePrivacyPolicy.privacy_policy_id) {
      return errorResponse(res, 'Please review and agree to the current Privacy Policy before registering.', 400);
    }

    if (customOnlyEntityTypes.has(entity_type)) {
      return errorResponse(res, 'Customer and Audit Firm accounts require review by the Audito team.', 400);
    }

    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      return errorResponse(
        res,
        `Invalid entity_type. Allowed: ${VALID_ENTITY_TYPES.join(', ')}`,
        400
      );
    }

    const registrationEmail = email;
    if (!isValidEmail(registrationEmail)) return errorResponse(res, 'Invalid email address.', 400);
    if (!/^[+()\d\s.-]{7,60}$/.test(String(phone_number || ''))) {
      return errorResponse(res, 'Enter a valid phone number.', 400);
    }

    // Strong password validation: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(password)) {
      return errorResponse(res, 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.', 400);
    }

    if (await AdminModel.emailExists(email)) {
      return errorResponse(res, 'Email already registered.', 409);
    }

    // Check duplicate registration number in the specific entity table
    if (registration_number) {
      const config = ENTITY_CONFIG[entity_type];
      const [existing] = await db.query(
        `SELECT id FROM \`${config.table}\` WHERE registration_number = ?`,
        [registration_number]
      );
      if (existing.length > 0) {
        return errorResponse(res, 'Registration number already exists for this entity type.', 409);
      }
    }

    const config = ENTITY_CONFIG[entity_type];
    const orgCode = await config.genCode();
    const userCode = await generateAdminUserCode();
    const hashedPw = await bcrypt.hash(password, await bcrypt.genSalt(12));

    // Transaction: insert entity + admin
    await connection.beginTransaction();

    // Build the org insert - all entity tables share the same base columns
    const orgData = {
      name: org_name,
      registration_number: registration_number || null,
      email: org_email || null,
      address_line_1: req.body.address_line_1 || null,
      address_line_2: req.body.address_line_2 || null,
      address_line_3: req.body.address_line_3 || null,
      country: country || null,
      phone_number: org_phone_number || null,
      company_type: entity_type === 'Company' ? (company_type || null) : null,
      organization_logo: null
    };

    if (organization_logo) {
      try {
        orgData.organization_logo = saveOrganizationLogo(orgCode, organization_logo);
        savedOrganizationLogoPath = orgData.organization_logo;
      } catch (logoError) {
        return errorResponse(res, logoError.message, 400);
      }
    }

    if (entity_type === 'Company') {
      await connection.query(
        `INSERT INTO \`${config.table}\` (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, \`${config.codeField}\`, company_type, timezone, organization_logo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orgData.name, orgData.registration_number, orgData.email,
        orgData.address_line_1, orgData.address_line_2, orgData.address_line_3,
        orgData.country, orgData.phone_number, orgCode, orgData.company_type, timezone || null, orgData.organization_logo]
      );
    } else {
      await connection.query(
        `INSERT INTO \`${config.table}\` (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, \`${config.codeField}\`, timezone, organization_logo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orgData.name, orgData.registration_number, orgData.email,
        orgData.address_line_1, orgData.address_line_2, orgData.address_line_3,
        orgData.country, orgData.phone_number, orgCode, timezone || null, orgData.organization_logo]
      );
    }

    // Insert admin with generic entity_code
    const adminId = await AdminModel.create({
      admin_id: userCode,
      first_name,
      last_name,
      email,
      country: country || null,
      phone_number: phone_number || null,
      password: hashedPw,
      account_type: config.account_type,
      entity_type,
      entity_code: orgCode,
      org_level: config.org_level
    });

    // The package (its limits and tokens) is activated when this payment settles.
    const planAmount = packageQuote.total_price;
    const listAmount = planAmount;

    await PrivacyPolicyModel.recordAgreement(connection, {
      privacyPolicyId: activePrivacyPolicy.privacy_policy_id,
      adminId,
      rootEntityCode: orgCode,
      email: registrationEmail,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    await connection.commit();

    // Generate Verification Token and Send Email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await AdminModel.setVerificationToken(adminId, verificationToken);

    // Dispatch email
    sendOrganizationRegistrationVerificationEmail(email, first_name, verificationToken, org_name).catch(err => {
      console.error('Failed to send organization verification email:', err);
    });
    recordResend(`verification:${email}`);

    // For a paid plan, create the pending registration payment so the client
    // can redirect into the payment flow.
    let payment = null;
    if (planAmount > 0) {
      const created = await PaymentModel.create({
        rootEntityCode: orgCode,
        purpose: 'registration',
        planName: 'Package',
        billingCycle: 'None',
        amount: planAmount,
        tokenQuantity: packageQuote.total_tokens,
        tokenUnitPrice: packageQuote.token_unit_price,
        pricingSnapshot: {
          purchase_type: 'company_package',
          ...packageQuote,
        },
        payerName: `${first_name} ${last_name}`,
        payerEmail: email,
        orgName: org_name,
        listAmount,
      });
      payment = {
        payment_code: created.payment_code,
        plan_name: created.plan_name,
        billing_cycle: created.billing_cycle,
        amount: Number(created.amount),
        currency: created.currency,
      };
    }

    return successResponse(res, { payment }, 'Registration successful. Please check your email to verify your account.', 201);

  } catch (error) {
    await connection.rollback();
    deleteOrganizationLogo(savedOrganizationLogoPath);
    console.error('Registration error:', error);
    return errorResponse(res, 'Registration failed. Please try again.', 500);
  } finally {
    connection.release();
  }
};

// ─── LOGIN ───────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password, preferred_role?, required_role? }
 *
 * Unified login — checks admins, auditors, and organization_users tables.
 * If the email exists in multiple tables, returns all available accounts
 * and logs into the first one whose password matches. A previous-role preference
 * may be supplied by the client, but it never bypasses password verification.
 *
 * required_role: "auditor" (sent by the Audito Auditor Android app) signs in to
 * the auditor account only. It never falls back to another role for the same
 * email, and the session it creates cannot switch roles.
 */
const login = async (req, res) => {
  try {
    const { email, password, preferred_role: preferredRole, required_role: requiredRoleInput } = req.body;

    const missing = validateRequiredFields(req.body, ['email', 'password']);
    if (missing) return errorResponse(res, missing, 400);

    const requiredRole = requiredRoleInput == null || requiredRoleInput === '' ? null : String(requiredRoleInput).trim();
    if (requiredRole && requiredRole !== 'auditor') return errorResponse(res, 'Unsupported required_role.', 400);

    // Find the email in all 3 tables
    const adminRec = await AdminModel.findByEmail(email);
    const auditorRec = await AuditorModel.findByEmail(email);
    const organizationUserRecord = await OrganizationUserModel.findByEmail(email);

    // Build candidate list — { role, record } — with password-check candidates
    const candidates = [];
    const unverifiedCandidates = [];
    if (adminRec && adminRec.is_active && adminRec.password) {
      if (adminRec.is_verified) candidates.push({ role: adminRec.role || 'admin', record: adminRec });
      else unverifiedCandidates.push({ role: adminRec.role || 'admin', record: adminRec });
    }
    if (organizationUserRecord && organizationUserRecord.is_active && organizationUserRecord.password) {
      if (organizationUserRecord.email_verified) candidates.push({ role: 'organization_user', record: organizationUserRecord });
      else unverifiedCandidates.push({ role: 'organization_user', record: organizationUserRecord });
    }
    if (auditorRec && auditorRec.is_active && auditorRec.password) {
      if (auditorRec.email_verified) candidates.push({ role: 'auditor', record: auditorRec });
      else unverifiedCandidates.push({ role: 'auditor', record: auditorRec });
    }
    if (requiredRole) {
      // Only the required role's account may be signed in to, whatever else shares the email.
      for (const list of [candidates, unverifiedCandidates]) {
        const kept = list.filter((candidate) => normalizeUserRole(candidate.role) === requiredRole);
        list.splice(0, list.length, ...kept);
      }
    }

    // A user can legitimately have more than one account role under the same
    // email address. Prefer the last role they used when it is available, while
    // retaining the existing fallback order and password checks for every role.
    if (typeof preferredRole === 'string' && preferredRole.trim()) {
      const normalizedPreferredRole = normalizeUserRole(preferredRole.trim());
      candidates.sort((a, b) => {
        if (a.role === normalizedPreferredRole) return -1;
        if (b.role === normalizedPreferredRole) return 1;
        return 0;
      });
    }

    // Try the given password against each candidate in the preferred order.
    let activeRole = null;
    let activeRecord = null;
    for (const c of candidates) {
      if (await bcrypt.compare(password, c.record.password)) {
        activeRole = c.role;
        activeRecord = c.record;
        break;
      }
    }

    if (!activeRole) {
      for (const candidate of unverifiedCandidates) {
        if (await bcrypt.compare(password, candidate.record.password)) {
          return successResponse(
            res,
            { email_verification_required: true, email: candidate.record.email },
            'Please verify your email address before signing in.'
          );
        }
      }
      return errorResponse(res, requiredRole ? 'No auditor account matches this email and password.' : 'Invalid email or password.', 401);
    }

    // Block login if the registration payment was never completed (paid plan
    // registered but not yet paid). Route the admin into the payment flow.
    if (activeRole === 'admin') {
      const pendingReg = await PaymentModel.findPendingByOrgPurpose(activeRecord.entity_code, 'registration');
      if (pendingReg) {
        return successResponse(
          res,
          {
            payment_required: true,
            payment: {
              payment_code: pendingReg.payment_code,
              plan_name: pendingReg.plan_name,
              billing_cycle: pendingReg.billing_cycle,
              amount: Number(pendingReg.amount),
              currency: pendingReg.currency,
            },
          },
          'Please complete your subscription payment to continue.'
        );
      }
    }

    // Generate tokens for the matched account
    const tokens = generateTokensForRole(activeRole, activeRecord, requiredRole ? AUDITOR_APP_CLIENT : null);

    // Store refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const recordId = activeRole === 'admin' || activeRole === 'audito_admin'
      ? activeRecord.admin_id
      : activeRole === 'auditor'
        ? activeRecord.auditor_id
        : activeRecord.organization_user_id;
        const refreshTokenId = await generateRefreshTokenId();

    await db.query(
      'INSERT INTO refresh_tokens (refresh_token_id, admin_id, user_role, token, expires_at) VALUES (?, ?, ?, ?, ?)',
      [refreshTokenId, recordId, activeRole, tokens.refreshToken, refreshExpiry]
    );

    if (activeRole === 'admin') {
      await AdminModel.updateLastLogin(recordId);
    }

    // Collect ALL available accounts for this email (regardless of password match).
    // An auditor-only sign-in does not reveal the email's other accounts.
    const allAccounts = await collectAccounts(email);
    const accounts = requiredRole ? allAccounts.filter((account) => account.role === requiredRole) : allAccounts;

    const plan_limits = await getPlanLimitsForUser(activeRole, activeRecord);
    const subscription = await resolveSubscriptionStatus(activeRole, activeRecord);

    return successResponse(res, {
      admin: { ...buildUserResponse(activeRole, activeRecord), plan_limits },
      accounts,
      subscription,
      tokens,
    }, 'Login successful.');

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse(res, 'Login failed. Please try again.', 500);
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────

/**
 * POST /api/auth/refresh-token
 * Body: { refresh_token, required_role? }
 *
 * required_role: "auditor" refuses to refresh any session that is not an
 * auditor's. Auditor app sessions stay auditor app sessions.
 */
const refreshToken = async (req, res) => {
  try {
    const { refresh_token, required_role: requiredRoleInput } = req.body;
    if (!refresh_token) return errorResponse(res, 'Refresh token is required.', 400);
    const requiredRole = requiredRoleInput == null || requiredRoleInput === '' ? null : String(requiredRoleInput).trim();
    if (requiredRole && requiredRole !== 'auditor') return errorResponse(res, 'Unsupported required_role.', 400);

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);

    const role = normalizeUserRole(decoded.role || 'admin');
    const userId = decoded.userId || decoded.adminId;  // backward compat
    const client = decoded.client === AUDITOR_APP_CLIENT ? AUDITOR_APP_CLIENT : null;
    if ((requiredRole && role !== requiredRole) || (client === AUDITOR_APP_CLIENT && role !== 'auditor')) {
      return errorResponse(res, 'This session is not an auditor session.', 401);
    }

    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE admin_id = ? AND token = ? AND expires_at > NOW()',
      [userId, refresh_token]
    );
    if (rows.length === 0) return errorResponse(res, 'Invalid or expired refresh token.', 401);

    let record;
    if (role === 'admin' || role === 'audito_admin') {
      record = await AdminModel.findById(userId);
    } else if (role === 'auditor') {
      record = await AuditorModel.findById(userId);
    } else if (role === 'organization_user') {
      record = await OrganizationUserModel.findById(userId);
    }
    if (!record || !record.is_active) return errorResponse(res, 'Account not found or deactivated.', 401);

    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);

    const tokens = generateTokensForRole(role, record, client);

    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const recordId = role === 'admin' || role === 'audito_admin'
      ? record.admin_id
      : role === 'auditor'
        ? record.auditor_id
        : record.organization_user_id;
const refreshTokenId = await generateRefreshTokenId();

    await db.query(
      'INSERT INTO refresh_tokens (refresh_token_id, admin_id, user_role, token, expires_at) VALUES (?, ?, ?, ?, ?)',
      [refreshTokenId, recordId, role, tokens.refreshToken, refreshExpiry]
    );

    return successResponse(res, { tokens }, 'Token refreshed.');

  } catch (error) {
    if (error.name === 'TokenExpiredError') return errorResponse(res, 'Refresh token expired.', 401);
    if (error.name === 'JsonWebTokenError') return errorResponse(res, 'Invalid refresh token.', 401);
    console.error('Refresh token error:', error);
    return errorResponse(res, 'Token refresh failed.', 500);
  }
};

// ─── LOGOUT ──────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Body: { refresh_token }
 */
const logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);
    }
    return successResponse(res, null, 'Logged out successfully.');
  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse(res, 'Logout failed.', 500);
  }
};

// ─── GET ME ──────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Returns the logged-in user's profile (works for all roles).
 */
const getMe = async (req, res) => {
  try {
    const role = req.user.role;
    const email = req.user.email;
    let userResponse, organization = null;

    if (role === 'admin' || role === 'audito_admin') {
      const admin = await AdminModel.findById(req.user.userCode);
      if (!admin) return errorResponse(res, 'Admin not found.', 404);
      userResponse = buildUserResponse(role, admin);

      const config = ENTITY_CONFIG[admin.entity_type];
      if (config) {
        const [orgRows] = await db.query(
          `SELECT name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, organization_logo FROM \`${config.table}\` WHERE \`${config.codeField}\` = ?`,
          [admin.entity_code]
        );
        if (orgRows.length > 0) {
          organization = {
            ...orgRows[0],
            code: admin.entity_code,
            entity_type: admin.entity_type,
            account_type: admin.account_type,
            org_level: admin.org_level,
          };
        }
      }
    } else if (role === 'auditor') {
      const auditor = await AuditorModel.findById(req.user.userCode);
      if (!auditor) return errorResponse(res, 'Auditor not found.', 404);
      userResponse = buildUserResponse('auditor', auditor);
    } else if (role === 'organization_user') {
      const organizationUser = await OrganizationUserModel.findById(req.user.userCode);
      if (!organizationUser) return errorResponse(res, 'Organization user not found.', 404);
      userResponse = buildUserResponse('organization_user', organizationUser);
    } else {
      return errorResponse(res, 'Invalid role.', 400);
    }

    // Collect available accounts for this email (auditor app sessions see only their own).
    const allAccounts = await collectAccounts(email);
    const accounts = req.user.client === AUDITOR_APP_CLIENT ? allAccounts.filter((account) => account.role === 'auditor') : allAccounts;

    // Fetch plan limits
    const record = (role === 'admin' || role === 'audito_admin') ? await AdminModel.findById(req.user.userCode) :
      role === 'auditor' ? await AuditorModel.findById(req.user.userCode) :
        await OrganizationUserModel.findById(req.user.userCode);

    // Identify & handle plan expiry first so plan limits reflect any downgrade.
    const subscription = await resolveSubscriptionStatus(role, record);
    const plan_limits = await getPlanLimitsForUser(role, record);

    return successResponse(res, {
      admin: { ...userResponse, plan_limits },
      organization,
      accounts,
      subscription
    });
  } catch (error) {
    console.error('Get me error:', error);
    return errorResponse(res, 'Failed to fetch profile.', 500);
  }
};

/**
 * PUT /api/auth/organization
 * Body: { name, registration_number, email, address, country, phone_number, organization_logo }
 * Only works for 'admin' role on their own organization.
 */
const updateOrganization = async (req, res) => {
  let newLogoPath = null;
  try {
    if (req.user.role !== 'admin') {
      return errorResponse(res, 'Only administrators can update organization details.', 403);
    }

    const { name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, organization_logo } = req.body;
    if (!name) return errorResponse(res, 'Organization name is required.', 400);

    const admin = await AdminModel.findById(req.user.userCode);
    if (!admin) return errorResponse(res, 'Admin not found.', 404);

    const config = ENTITY_CONFIG[admin.entity_type];
    if (!config) return errorResponse(res, 'Invalid entity type configuration.', 400);

    const [existingRows] = await db.query(
      `SELECT organization_logo FROM \`${config.table}\` WHERE \`${config.codeField}\` = ? LIMIT 1`,
      [admin.entity_code]
    );
    if (!existingRows.length) return errorResponse(res, 'Organization not found.', 404);

    const currentLogo = existingRows[0].organization_logo || null;
    const hasLogoUpdate = Object.prototype.hasOwnProperty.call(req.body, 'organization_logo');
    let finalLogo = currentLogo;
    if (hasLogoUpdate) {
      if (organization_logo === null || organization_logo === '') {
        finalLogo = null;
      } else if (typeof organization_logo === 'string' && organization_logo.startsWith('data:image/')) {
        try {
          newLogoPath = saveOrganizationLogo(admin.entity_code, organization_logo);
          finalLogo = newLogoPath;
        } catch (logoError) {
          return errorResponse(res, logoError.message, 400);
        }
      } else if (organization_logo !== currentLogo) {
        return errorResponse(res, 'Invalid organization logo.', 400);
      }
    }

    await db.query(
      `UPDATE \`${config.table}\` 
       SET name = ?, registration_number = ?, email = ?, address_line_1 = ?, address_line_2 = ?, address_line_3 = ?, country = ?, phone_number = ?, organization_logo = ? 
       WHERE \`${config.codeField}\` = ?`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, finalLogo, admin.entity_code]
    );

    if (currentLogo && currentLogo !== finalLogo) deleteOrganizationLogo(currentLogo);

    return successResponse(res, null, 'Organization details updated successfully.');
  } catch (error) {
    deleteOrganizationLogo(newLogoPath);
    console.error('Update organization error:', error);
    return errorResponse(res, 'Failed to update organization details.', 500);
  }
};

// ─── CHANGE PASSWORD ─────────────────────────────────────────────

/**
 * PUT /api/auth/change-password
 * Body: { current_password, new_password }
 * Works for all roles.
 */
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const missing = validateRequiredFields(req.body, ['current_password', 'new_password']);
    if (missing) return errorResponse(res, missing, 400);
    if (new_password.length < 8) return errorResponse(res, 'New password must be at least 8 characters.', 400);

    const role = req.user.role;
    let record;

    if (role === 'admin' || role === 'audito_admin') {
      record = await AdminModel.findByEmail(req.user.email);
    } else if (role === 'auditor') {
      record = await AuditorModel.findByEmail(req.user.email);
    } else if (role === 'organization_user') {
      record = await OrganizationUserModel.findByEmail(req.user.email);
    }
    if (!record) return errorResponse(res, 'User not found.', 404);

    const isMatch = await bcrypt.compare(current_password, record.password);
    if (!isMatch) return errorResponse(res, 'Current password is incorrect.', 400);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    if (role === 'admin' || role === 'audito_admin') {
      await AdminModel.updatePassword(record.admin_id, hashedPassword);
    } else if (role === 'auditor') {
      await AuditorModel.setPassword(record.auditor_id, hashedPassword);
    } else if (role === 'organization_user') {
      await OrganizationUserModel.setPassword(record.organization_user_id, hashedPassword);
    }

    return successResponse(res, null, 'Password changed successfully.');
  } catch (error) {
    console.error('Change password error:', error);
    return errorResponse(res, 'Failed to change password.', 500);
  }
};

// ─── SWITCH ACCOUNT ──────────────────────────────────────────────

/**
 * POST /api/auth/switch-account
 * Body: { target_role: 'admin'|'auditor'|'organization_user', password }
 *
 * Switches the active session to a different role's account.
 * Requires the password for the target account (may differ per role).
 */
const switchAccount = async (req, res) => {
  try {
    const { target_role: requestedTargetRole, password } = req.body;
    const target_role = normalizeUserRole(requestedTargetRole);

    if (!requestedTargetRole || !password) {
      return errorResponse(res, 'target_role and password are required.', 400);
    }
    if (!['admin', 'auditor', 'organization_user'].includes(target_role)) {
      return errorResponse(res, 'Invalid target_role.', 400);
    }
    if (req.user.client === AUDITOR_APP_CLIENT) {
      return errorResponse(res, 'Switching accounts is not available in the Audito app.', 403);
    }

    // Derive email from the current session
    const email = req.user.email;

    let record;
    if (target_role === 'admin') {
      record = await AdminModel.findByEmail(email);
      if (!record || !record.is_active) return errorResponse(res, 'Admin account not found or deactivated.', 404);
    } else if (target_role === 'auditor') {
      record = await AuditorModel.findByEmail(email);
      if (!record || !record.is_active || !record.email_verified) return errorResponse(res, 'Auditor account not found or not verified.', 404);
    } else {
      record = await OrganizationUserModel.findByEmail(email);
      if (!record || !record.is_active || !record.email_verified) return errorResponse(res, 'Organization user account not found or not verified.', 404);
    }

    if (!record.password) return errorResponse(res, 'Target account has no password set.', 400);

    const isMatch = await bcrypt.compare(password, record.password);
    if (!isMatch) return errorResponse(res, 'Invalid password.', 401);

    // Generate new tokens for the target role
    const tokens = generateTokensForRole(target_role, record);

    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const recordId = target_role === 'admin' || target_role === 'audito_admin'
      ? record.admin_id
      : target_role === 'auditor'
        ? record.auditor_id
        : record.organization_user_id;
        const refreshTokenId = await generateRefreshTokenId();

    await db.query(
      'INSERT INTO refresh_tokens (refresh_token_id, admin_id, user_role, token, expires_at) VALUES (?, ?, ?, ?, ?)',
      [refreshTokenId, recordId, target_role, tokens.refreshToken, refreshExpiry]
    );

    if (target_role === 'admin') {
      await AdminModel.updateLastLogin(recordId);
    }

    // Identify & handle plan expiry first so plan limits reflect any downgrade.
    const subscription = await resolveSubscriptionStatus(target_role, record);

    // Fetch plan limits
    const plan_limits = await getPlanLimitsForUser(target_role, record);

    return successResponse(res, {
      admin: { ...buildUserResponse(target_role, record), plan_limits },
      subscription,
      tokens,
    }, 'Account switched successfully.');
  } catch (error) {
    console.error('Switch account error:', error);
    return errorResponse(res, 'Failed to switch account.', 500);
  }
};

// ─── FORGOT PASSWORD (Send OTP) ──────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Sends a 6-digit OTP to the email address for any verified login account.
 */
const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return errorResponse(res, 'Email is required.', 400);
    if (!isValidEmail(email)) return errorResponse(res, 'Invalid email address.', 400);
    const cooldownSeconds = getResendCooldownSeconds(`password-reset:${email}`);
    if (cooldownSeconds > 0) {
      return errorResponse(res, `Please wait ${cooldownSeconds} second${cooldownSeconds === 1 ? '' : 's'} before requesting another code.`, 429);
    }

    // A single email can be used by an administrator, auditor, and/or entity
    // organizationUser. Every active, verified account that can sign in must be able to
    // request a password reset, not only organization administrators.
    const [admin, auditor, organizationUser] = await Promise.all([
      AdminModel.findByEmail(email),
      AuditorModel.findByEmail(email),
      OrganizationUserModel.findByEmail(email),
    ]);
    const recipient = [
      admin && admin.is_active && admin.is_verified ? admin : null,
      auditor && auditor.is_active && auditor.email_verified && auditor.password ? auditor : null,
      organizationUser && organizationUser.is_active && organizationUser.email_verified && organizationUser.password ? organizationUser : null,
    ].find(Boolean);

    if (!recipient) {
      // Don't reveal whether account exists
      return successResponse(res, null, 'If an account exists with that email, an OTP has been sent.');
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unused OTPs for this email
    await db.query('UPDATE password_reset_otps SET used = TRUE WHERE email = ? AND used = FALSE', [email]);

    // Store OTP
   const passwordResetOtpId = await generatePasswordResetOtpId();
await db.query(
  'INSERT INTO password_reset_otps (password_reset_otp_id, email, otp, expires_at) VALUES (?, ?, ?, ?)',
  [passwordResetOtpId, email, otp, expiresAt]
);

    // Send OTP email
    try {
      const recipientName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ') || 'there';
      await sendOtpEmail(email, recipientName, otp);
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr.message);
      return errorResponse(res, 'Failed to send OTP email. Please try again.', 500);
    }

    recordResend(`password-reset:${email}`);
    return successResponse(res, null, 'If an account exists with that email, an OTP has been sent.');
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse(res, 'Failed to process request.', 500);
  }
};

// ─── VERIFY OTP ──────────────────────────────────────────────────

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 * Verifies the OTP and returns a temporary reset token.
 */
/** Resends a pending organization, invitation, or custom-plan verification email. */
const resendVerificationEmail = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return errorResponse(res, 'Email is required.', 400);
    if (!isValidEmail(email)) return errorResponse(res, 'Invalid email address.', 400);

    const cooldownKey = `verification:${email}`;
    const cooldownSeconds = getResendCooldownSeconds(cooldownKey);
    if (cooldownSeconds > 0) {
      return errorResponse(res, `Please wait ${cooldownSeconds} second${cooldownSeconds === 1 ? '' : 's'} before resending the verification email.`, 429);
    }

    const admin = await AdminModel.findByEmail(email);
    if (admin && !admin.is_verified) {
      const token = crypto.randomBytes(32).toString('hex');
      await AdminModel.setVerificationToken(admin.admin_id, token);
      const organizationName = await getOrgName(admin.entity_type, admin.entity_code);
      await sendOrganizationRegistrationVerificationEmail(admin.email, admin.first_name, token, organizationName || admin.entity_code);
      recordResend(cooldownKey);
      return successResponse(res, null, 'A verification email has been sent if the account is awaiting verification.');
    }

    const resendInvitation = async (record, type) => {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const model = type === 'auditor' ? AuditorModel : OrganizationUserModel;
      const recordId = type === 'auditor' ? record.auditor_id : record.organization_user_id;
      await model.regenerateToken(recordId, token, expiresAt);

      const ownerAdmin = record.created_by_entity_code
        ? await AdminModel.findByEntityCode(record.created_by_entity_code)
        : null;
      const organization = ownerAdmin
        ? await getOrgDetails(ownerAdmin.entity_type, record.created_by_entity_code)
        : null;
      const dialingCode = await getCountryDialingCode(organization?.country);
      await sendUserInvitationEmail(record.email, `${record.first_name} ${record.last_name}`, token, {
        organizationName: organization?.name || record.created_by_entity_code || 'your organization',
        organizationEmail: organization?.email,
        organizationPhone: organization?.phoneNumber,
        organizationDialingCode: dialingCode,
        organizationAddress: organization?.address,
        role: record.user_type || (type === 'auditor' ? 'Auditor' : 'Organization User'),
        includeAssignedArea: type === 'organization_user',
        assignedEntityType: type === 'organization_user' ? record.assigned_entity_type : null,
        assignedEntityName: type === 'organization_user' ? record.assigned_entity_code : null,
      });
    };

    const auditor = await AuditorModel.findByEmail(email);
    if (auditor && !auditor.email_verified && auditor.is_active) {
      await resendInvitation(auditor, 'auditor');
      recordResend(cooldownKey);
      return successResponse(res, null, 'A verification email has been sent if the account is awaiting verification.');
    }

    const organizationUser = await OrganizationUserModel.findByEmail(email);
    if (organizationUser && !organizationUser.email_verified && organizationUser.is_active) {
      await resendInvitation(organizationUser, 'organization_user');
      recordResend(cooldownKey);
      return successResponse(res, null, 'A verification email has been sent if the account is awaiting verification.');
    }

    return successResponse(res, null, 'A verification email has been sent if the account is awaiting verification.');
  } catch (error) {
    console.error('Resend verification email error:', error);
    return errorResponse(res, 'Unable to resend the verification email. Please try again.', 500);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const email = String(req.body?.email || '').trim().toLowerCase();
    const missing = validateRequiredFields({ email, otp }, ['email', 'otp']);
    if (missing) return errorResponse(res, missing, 400);

    const [rows] = await db.query(
      'SELECT * FROM password_reset_otps WHERE email = ? AND otp = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Invalid or expired OTP.', 400);
    }

    // Mark OTP as used
    await db.query('UPDATE password_reset_otps SET used = TRUE WHERE password_reset_otp_id = ?', [rows[0].password_reset_otp_id]);

    // Generate a temporary reset token (valid for 5 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Store reset token in a new OTP row (reuse table with special otp value)
   const resetRowId = await generatePasswordResetOtpId();
await db.query(
  'INSERT INTO password_reset_otps (password_reset_otp_id, email, otp, expires_at, used) VALUES (?, ?, ?, ?, FALSE)',
  [resetRowId, email, `RST-${resetToken}`, resetExpiry]
);

    return successResponse(res, { reset_token: resetToken }, 'OTP verified. You can now reset your password.');
  } catch (error) {
    console.error('Verify OTP error:', error);
    return errorResponse(res, 'Verification failed.', 500);
  }
};

// ─── RESET PASSWORD ──────────────────────────────────────────────

/**
 * POST /api/auth/reset-password
 * Body: { email, reset_token, new_password }
 * Resets the password after OTP verification.
 */
const resetPassword = async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;
    const email = String(req.body?.email || '').trim().toLowerCase();
    const missing = validateRequiredFields({ email, reset_token, new_password }, ['email', 'reset_token', 'new_password']);
    if (missing) return errorResponse(res, missing, 400);

    if (new_password.length < 8) return errorResponse(res, 'Password must be at least 8 characters.', 400);

    // Verify reset token
    const [rows] = await db.query(
      'SELECT * FROM password_reset_otps WHERE email = ? AND otp = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, `RST-${reset_token}`]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Invalid or expired reset token. Please start over.', 400);
    }

    // Mark token as used
    await db.query('UPDATE password_reset_otps SET used = TRUE WHERE password_reset_otp_id = ?', [rows[0].password_reset_otp_id]);

    // Find admin — required (forgot password is admin-initiated)
    const [admin, auditor, organizationUser] = await Promise.all([
      AdminModel.findByEmail(email),
      AuditorModel.findByEmail(email),
      OrganizationUserModel.findByEmail(email),
    ]);
    const accounts = [
      { type: 'admin', record: admin },
      { type: 'auditor', record: auditor },
      { type: 'organization_user', record: organizationUser },
    ].filter(({ record }) => record?.is_active);

    if (accounts.length === 0) return errorResponse(res, 'Account not found.', 404);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    // Keep every active role sharing this email in sync after a reset.
    await Promise.all(accounts.map(({ type, record }) => {
      if (type === 'admin') return AdminModel.updatePassword(record.admin_id, hashedPassword);
      if (type === 'auditor') return AuditorModel.setPassword(record.auditor_id, hashedPassword);
      return OrganizationUserModel.setPassword(record.organization_user_id, hashedPassword);
    }));

    return successResponse(res, null, 'Password reset successfully. You can now log in.');
  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse(res, 'Failed to reset password.', 500);
  }
};

// ─── VERIFY EMAIL ────────────────────────────────────────────────

async function getVerifiedAdminResponseData(admin) {
  const pendingPayment = await PaymentModel.findPendingByOrgPurpose(admin.entity_code, 'registration');

  return {
    email: admin.email,
    first_name: admin.first_name,
    needs_password: false,
    payment: pendingPayment
      ? {
          payment_code: pendingPayment.payment_code,
          plan_name: pendingPayment.plan_name,
          billing_cycle: pendingPayment.billing_cycle,
          amount: Number(pendingPayment.amount),
        }
      : null,
  };
}

/**
 * POST /api/auth/verify-email
 * Body: { token }
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return errorResponse(res, 'Verification token is required.', 400);

    // 1. Check Admins (uses verification_token)
    const admin = await AdminModel.findByVerificationToken(token);
    if (admin) {
      const needsPassword = !admin.password;
      if (needsPassword) {
        // Invited admin — return info so frontend can show set-password form
        return successResponse(res, {
          email: admin.email,
          first_name: admin.first_name,
          needs_password: true,
          admin_id: admin.admin_id,
        }, 'Email verified. Please set your password.', 200);
      }
      await AdminModel.markAsVerified(admin.admin_id, token);
      return successResponse(res, await getVerifiedAdminResponseData(admin), 'Email verified successfully. You may now log in.', 200);
    }

    const alreadyVerifiedAdmin = await AdminModel.findByConsumedVerificationToken(token);
    if (alreadyVerifiedAdmin) {
      return successResponse(res, {
        ...await getVerifiedAdminResponseData(alreadyVerifiedAdmin),
        already_verified: true,
      }, 'This email address is already verified.', 200);
    }

    if (await ContactReviewModel.verify(token)) {
      return successResponse(res, { contact_review_verified: true, contact: auditoContact() }, 'Email verified. The Audito team will review your request.', 200);
    }

    // 2. Check Auditors (uses email_token + expires)
    const auditor = await AuditorModel.findByEmailToken(token);
    if (auditor) {
      await AuditorModel.verifyEmail(auditor.auditor_id);
      return successResponse(res, {
        email: auditor.email,
        first_name: auditor.first_name,
        needs_password: !auditor.password
      }, 'Email verified successfully.', 200);
    }

    // 3. Check Organization Users (uses email_token + expires)
    const organizationUser = await OrganizationUserModel.findByEmailToken(token);
    if (organizationUser) {
      await OrganizationUserModel.verifyEmail(organizationUser.organization_user_id);
      return successResponse(res, {
        email: organizationUser.email,
        first_name: organizationUser.first_name,
        needs_password: !organizationUser.password
      }, 'Email verified successfully.', 200);
    }

    return errorResponse(res, 'Invalid or expired verification token.', 400);
  } catch (error) {
    console.error('Verify email error:', error);
    return errorResponse(res, 'Verification failed.', 500);
  }
};

// ─── UPDATE PROFILE ─────────────────────────────────────────────

/**
 * PUT /api/auth/profile
 * Updates the logged-in user's name, phone, NIC and country.
 */
const saveProfileImage = (role, userId, base64Str) => {
  if (!base64Str) return null;

  if (base64Str.startsWith('/uploads/profile-images/')) {
    return base64Str;
  }

  const matches = base64Str.match(/^data:image\/([A-Za-z0-9-+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid image base64 format');
  }

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const dataBuffer = Buffer.from(matches[2], 'base64');

  const targetDir = path.join(__dirname, '..', 'public', 'uploads', 'profile-images');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filename = `avatar_${role}_${userId}_${Date.now()}.${ext}`;
  const filePath = path.join(targetDir, filename);

  fs.writeFileSync(filePath, dataBuffer);

  return `/uploads/profile-images/${filename}`;
};

const updateProfile = async (req, res) => {
  try {
    const role = req.user.role;
    const { first_name, last_name, phone_number, country, profile_image } = req.body;

    if (!first_name || !last_name) {
      return errorResponse(res, 'first_name and last_name are required.', 400);
    }

    // 1. Fetch old profile_image path
    let oldProfileImage = null;
    if (role === 'admin' || role === 'audito_admin') {
      const [rows] = await db.query('SELECT profile_image FROM admins WHERE admin_id = ?', [req.user.userCode]);
      if (rows && rows.length > 0) oldProfileImage = rows[0].profile_image;
    } else if (role === 'auditor') {
      const [rows] = await db.query('SELECT profile_image FROM auditors WHERE auditor_id = ?', [req.user.userCode]);
      if (rows && rows.length > 0) oldProfileImage = rows[0].profile_image;
    } else if (role === 'organization_user') {
      const [rows] = await db.query('SELECT profile_image FROM organization_users WHERE organization_user_id = ?', [req.user.userCode]);
      if (rows && rows.length > 0) oldProfileImage = rows[0].profile_image;
    }

    // 2. Process image path and write file to disk if base64
    let finalProfileImagePath = null;
    if (profile_image) {
      if (profile_image.startsWith('data:image/')) {
        finalProfileImagePath = saveProfileImage(role, req.user.userCode, profile_image);

        // Delete old image file
        if (oldProfileImage && oldProfileImage.startsWith('/uploads/profile-images/')) {
          const oldFilePath = path.join(__dirname, '..', 'public', oldProfileImage);
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
            } catch (err) {
              console.error('Failed to delete old avatar:', err);
            }
          }
        }
      } else {
        finalProfileImagePath = profile_image;
      }
    } else {
      // User removed their avatar
      finalProfileImagePath = null;
      if (oldProfileImage && oldProfileImage.startsWith('/uploads/profile-images/')) {
        const oldFilePath = path.join(__dirname, '..', 'public', oldProfileImage);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (err) {
            console.error('Failed to delete old avatar:', err);
          }
        }
      }
    }

    // 3. Update in Database
    if (role === 'admin' || role === 'audito_admin') {
      await db.query(
        'UPDATE admins SET first_name = ?, last_name = ?, phone_number = ?, country = ?, profile_image = ? WHERE admin_id = ?',
        [first_name.trim(), last_name.trim(), phone_number || null, country || null, finalProfileImagePath, req.user.userCode]
      );
    } else if (role === 'auditor') {
      await db.query(
        'UPDATE auditors SET first_name = ?, last_name = ?, phone_number = ?, country = ?, profile_image = ? WHERE auditor_id = ?',
        [first_name.trim(), last_name.trim(), phone_number || null, country || null, finalProfileImagePath, req.user.userCode]
      );
    } else if (role === 'organization_user') {
      await db.query(
        'UPDATE organization_users SET first_name = ?, last_name = ?, phone_number = ?, country = ?, profile_image = ? WHERE organization_user_id = ?',
        [first_name.trim(), last_name.trim(), phone_number || null, country || null, finalProfileImagePath, req.user.userCode]
      );
    } else {
      return errorResponse(res, 'Invalid role.', 400);
    }

    return successResponse(res, null, 'Profile updated successfully.');
  } catch (error) {
    console.error('updateProfile error:', error);
    return errorResponse(res, 'Failed to update profile.', 500);
  }
};

/**
 * GET /api/auth/onboarding
 * Returns onboarding status for current admin.
 */
const getOnboardingStatus = async (req, res) => {
  try {
    const role = req.user.role;
    let record = null;
    let status = null;

    if (role === 'admin') {
      record = await AdminModel.findById(req.user.userCode);
      status = await AdminModel.getOnboardingStatus(req.user.userCode);
    } else if (role === 'auditor') {
      record = await AuditorModel.findById(req.user.userCode);
      status = await AuditorModel.getOnboardingStatus(req.user.userCode);
    } else if (role === 'organization_user') {
      record = await OrganizationUserModel.findById(req.user.userCode);
      status = await OrganizationUserModel.getOnboardingStatus(req.user.userCode);
    } else {
      return errorResponse(res, 'Only valid system users can access onboarding status.', 403);
    }

    if (!record) return errorResponse(res, `${role.replace('_', ' ')} not found.`, 404);
    if (!status) return errorResponse(res, 'Onboarding status not available.', 404);

    return successResponse(res, {
      onboarding_completed: !!status.onboarding_completed,
      onboarding_skipped: !!status.onboarding_skipped,
      onboarding_completed_at: status.onboarding_completed_at || null,
    });
  } catch (error) {
    console.error('getOnboardingStatus error:', error);
    return errorResponse(res, 'Failed to fetch onboarding status.', 500);
  }
};

/**
 * PUT /api/auth/onboarding
 * Body: { action: 'complete' | 'skip' | 'reset' }
 */
const updateOnboardingStatus = async (req, res) => {
  try {
    const role = req.user.role;
    const { action } = req.body;
    if (!['complete', 'skip', 'reset'].includes(action)) {
      return errorResponse(res, "Invalid action. Use 'complete', 'skip', or 'reset'.", 400);
    }

    let record = null;
    if (role === 'admin') {
      record = await AdminModel.findById(req.user.userCode);
    } else if (role === 'auditor') {
      record = await AuditorModel.findById(req.user.userCode);
    } else if (role === 'organization_user') {
      record = await OrganizationUserModel.findById(req.user.userCode);
    } else {
      return errorResponse(res, 'Only valid system users can update onboarding status.', 403);
    }

    if (!record) return errorResponse(res, `${role.replace('_', ' ')} not found.`, 404);

    if (role === 'admin') {
      if (action === 'complete') {
        await AdminModel.updateOnboardingStatus(record.admin_id, { completed: true, skipped: false });
      } else if (action === 'skip') {
        await AdminModel.updateOnboardingStatus(record.admin_id, { completed: false, skipped: true });
      } else {
        await AdminModel.resetOnboardingStatus(record.admin_id);
      }
    } else if (role === 'auditor') {
      if (action === 'complete') {
        await AuditorModel.updateOnboardingStatus(record.auditor_id, { completed: true, skipped: false });
      } else if (action === 'skip') {
        await AuditorModel.updateOnboardingStatus(record.auditor_id, { completed: false, skipped: true });
      } else {
        await AuditorModel.resetOnboardingStatus(record.auditor_id);
      }
    } else if (role === 'organization_user') {
      if (action === 'complete') {
        await OrganizationUserModel.updateOnboardingStatus(record.organization_user_id, { completed: true, skipped: false });
      } else if (action === 'skip') {
        await OrganizationUserModel.updateOnboardingStatus(record.organization_user_id, { completed: false, skipped: true });
      } else {
        await OrganizationUserModel.resetOnboardingStatus(record.organization_user_id);
      }
    }

    const updatedStatus =
      role === 'admin'
        ? await AdminModel.getOnboardingStatus(record.admin_id)
        : role === 'auditor'
          ? await AuditorModel.getOnboardingStatus(record.auditor_id)
          : await OrganizationUserModel.getOnboardingStatus(record.organization_user_id);

    return successResponse(res, {
      onboarding_completed: !!updatedStatus.onboarding_completed,
      onboarding_skipped: !!updatedStatus.onboarding_skipped,
      onboarding_completed_at: updatedStatus.onboarding_completed_at || null,
    }, 'Onboarding status updated.');
  } catch (error) {
    console.error('updateOnboardingStatus error:', error);
    return errorResponse(res, 'Failed to update onboarding status.', 500);
  }
};

const validatePromoCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return errorResponse(res, 'Promo code is required.', 400);
    }

    const promo = await PromoCodeModel.findByCode(code);
    if (!promo) {
      return errorResponse(res, 'Invalid or expired promo code.', 404);
    }

    return successResponse(res, {
      code: promo.code,
      discount_percentage: parseFloat(promo.discount_percentage)
    }, 'Promo code is valid.');
  } catch (error) {
    console.error('Validate promo code error:', error);
    return errorResponse(res, 'Failed to validate promo code.', 500);
  }
};

// ─── SET ADMIN PASSWORD (PUBLIC) ────────────────────────────────

/**
 * POST /api/auth/set-admin-password
 * Body: { token, password }
 *
 * Invited admin sets their password after email verification.
 */
const setAdminPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return errorResponse(res, 'Token and password are required.', 400);
    }

    if (password.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters.', 400);
    }

    const admin = await AdminModel.findByVerificationToken(token);
    if (!admin) {
      return errorResponse(res, 'Invalid or expired verification link.', 400);
    }

    // If already has a password and is verified, this is a re-use
    if (admin.password && admin.is_verified) {
      return errorResponse(res, 'Password already set. Please log in.', 400);
    }

    const hashed = await bcrypt.hash(password, 12);
    await AdminModel.setAdminPassword(admin.admin_id, hashed);

    return successResponse(res, {
      email: admin.email,
      first_name: admin.first_name,
    }, 'Password set successfully. You can now log in.');
  } catch (error) {
    console.error('Set admin password error:', error);
    return errorResponse(res, 'Failed to set password.', 500);
  }
};

/**
 * POST /api/auth/check-registration-email
 * Checks the organization email that will also be used for the initial admin.
 */
const checkRegistrationEmail = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse(res, 'Enter a valid organization email address.', 400);
    }
    if (await AdminModel.emailExists(email)) {
      return errorResponse(res, 'This organization email is already registered. Please use a different email.', 409);
    }
    return successResponse(res, { available: true }, 'Email is available.');
  } catch (error) {
    console.error('checkRegistrationEmail error:', error);
    return errorResponse(res, 'Unable to check email availability.', 500);
  }
};

module.exports = {
  ENTITY_CONFIG,
  register,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  switchAccount,
  forgotPassword,
  resendVerificationEmail,
  verifyOtp,
  resetPassword,
  verifyEmail,
  setAdminPassword,
  checkRegistrationEmail,
  updateProfile,
  updateOrganization,
  getOnboardingStatus,
  updateOnboardingStatus,
  validatePromoCode,
};
