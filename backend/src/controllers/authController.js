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
const AuditorModel = require('../models/AuditorModel');
const EntityHeadModel = require('../models/EntityHeadModel');
const CustomerModel = require('../models/CustomerModel');
const CompanyModel = require('../models/CompanyModel');
const AuditFirmModel = require('../models/AuditFirmModel');
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
  generateAdminUserCode
} = require('../utils/codeGenerator');
const { successResponse, errorResponse, validateRequiredFields, isValidEmail } = require('../utils/helpers');
const { db } = require('../config/db');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../services/emailService');
const SubscriptionModel = require('../models/SubscriptionModel');
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

// Helper: get entity code from admin (now just entity_code)
const getEntityCode = (admin) => admin.entity_code || null;

// ─── Generate JWT tokens (supports all roles) ────────────────────

const generateTokens = (admin) => generateTokensForRole('admin', admin);

function normalizeAccountType(accountType, entityType) {
  if (accountType === 'Audit Firm Company') return 'Audit Firm';
  // Safety: if legacy data has null account_type but entity_type is audit firm root
  if (!accountType && entityType === 'Audit Firm Company') return 'Audit Firm';
  return accountType;
}

function generateTokensForRole(role, record) {
  let payload;

  if (role === 'admin') {
    payload = {
      userId: record.id,
      userCode: record.user_id,
      email: record.email,
      role: 'admin',
      accountType: normalizeAccountType(record.account_type, record.entity_type),
      entityType: record.entity_type,
      entityCode: record.entity_code,
      orgLevel: record.org_level,
    };
  } else if (role === 'auditor') {
    payload = {
      userId: record.id,
      userCode: record.user_code,
      email: record.email,
      role: 'auditor',
      userType: record.user_type,
      auditorType: record.auditor_type || null,
      assignedEntityType: record.assigned_entity_type,
      assignedEntityCode: record.assigned_entity_code,
      createdByEntityCode: record.created_by_entity_code,
    };
  } else {
    // entity_head
    payload = {
      userId: record.id,
      userCode: record.user_code,
      email: record.email,
      role: 'entity_head',
      userType: record.user_type,
      assignedEntityType: record.assigned_entity_type,
      assignedEntityCode: record.assigned_entity_code,
      createdByEntityCode: record.created_by_entity_code,
    };
  }

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

  const refreshToken = jwt.sign(
    { userId: record.id, userCode: payload.userCode, role },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// ─── Helpers: build user response & collect accounts ─────────────

function buildUserResponse(role, record) {
  if (role === 'admin') {
    return {
      id: record.user_id,
      first_name: record.first_name,
      last_name: record.last_name,
      email: record.email,
      phone_number: record.phone_number || null,
      nic: record.nic || null,
      country: record.country || null,
      role: 'admin',
      account_type: normalizeAccountType(record.account_type, record.entity_type),
      entity_type: record.entity_type,
      entity_code: record.entity_code,
      org_level: record.org_level,
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
  // auditor or entity_head
  return {
    id: record.user_code,
    first_name: record.first_name,
    last_name: record.last_name,
    email: record.email,
    phone_number: record.phone_number || null,
    nic: record.nic || null,
    country: record.country || null,
    role,
    account_type: null,
    entity_type: record.assigned_entity_type || null,
    entity_code: role === 'entity_head'
      ? (record.assigned_entity_code || record.created_by_entity_code)
      : record.created_by_entity_code,
    org_level: 0,
    user_type: record.user_type,
    auditor_type: record.auditor_type || null,
    assigned_entity_type: record.assigned_entity_type || null,
    assigned_entity_code: record.assigned_entity_code || null,
    assigned_org_tree_id: role === 'entity_head' ? (record.assigned_org_tree_id || null) : null,
    created_by_entity_code: record.created_by_entity_code,
    profile_image: record.profile_image || null,
  };
}

async function getPlanLimitsForUser(role, record) {
  const rootCode = role === 'admin'
    ? record.entity_code
    : record.created_by_entity_code;
  if (!rootCode) return SubscriptionModel.PLAN_LIMITS['Basic'];
  return await SubscriptionModel.getLimits(rootCode);
}

async function collectAccounts(email) {
  const accounts = [];

  const admin = await AdminModel.findByEmail(email);
  if (admin && admin.is_active) {
    accounts.push({
      role: 'admin',
      user_code: admin.user_id,
      first_name: admin.first_name,
      last_name: admin.last_name,
      account_type: normalizeAccountType(admin.account_type, admin.entity_type),
      entity_type: admin.entity_type,
      entity_code: admin.entity_code,
      org_level: admin.org_level,
      user_type: null,
    });
  }

  const auditor = await AuditorModel.findByEmail(email);
  if (auditor && auditor.is_active && auditor.email_verified && auditor.password) {
    accounts.push({
      role: 'auditor',
      user_code: auditor.user_code,
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

  const head = await EntityHeadModel.findByEmail(email);
  if (head && head.is_active && head.email_verified && head.password) {
    accounts.push({
      role: 'entity_head',
      user_code: head.user_code,
      first_name: head.first_name,
      last_name: head.last_name,
      account_type: null,
      entity_type: head.assigned_entity_type || null,
      entity_code: head.assigned_entity_code || head.created_by_entity_code,
      org_level: 0,
      user_type: head.user_type,
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
 * Required: entity_type, org_name, first_name, last_name, email, password
 * Optional: registration_number, org_email, address, country, org_phone_number, nic, phone_number
 *
 * entity_type: Customer | Buying Office | Supplier | Company | Cluster | Factory |
 *              Unit | Department | Audit Firm Company
 */
const register = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      entity_type,
      org_name,
      registration_number,
      org_email,
      address,
      country,
      org_phone_number,
      first_name,
      last_name,
      nic,
      email,
      phone_number,
      company_type,
      password,
      plan_name,
      billing_cycle
    } = req.body;

    // Validate required fields
    const missing = validateRequiredFields(req.body, [
      'entity_type', 'org_name', 'first_name', 'last_name', 'email', 'password', 'plan_name'
    ]);
    if (missing) return errorResponse(res, missing, 400);

    if (!VALID_ENTITY_TYPES.includes(entity_type)) {
      return errorResponse(
        res,
        `Invalid entity_type. Allowed: ${VALID_ENTITY_TYPES.join(', ')}`,
        400
      );
    }

    if (!isValidEmail(email)) return errorResponse(res, 'Invalid email address.', 400);

    // Strong password validation: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(password)) {
      return errorResponse(res, 'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.', 400);
    }

    // Check duplicate admin email
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

    // Generate entity code + admin user code
    const config = ENTITY_CONFIG[entity_type];
    const orgCode = await config.genCode();
    const userCode = await generateAdminUserCode();
    const salt = await bcrypt.genSalt(12);
    const hashedPw = await bcrypt.hash(password, salt);

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
      company_type: entity_type === 'Company' ? (company_type || null) : null
    };

    if (entity_type === 'Company') {
      await connection.query(
        `INSERT INTO \`${config.table}\` (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, \`${config.codeField}\`, company_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orgData.name, orgData.registration_number, orgData.email,
        orgData.address_line_1, orgData.address_line_2, orgData.address_line_3,
        orgData.country, orgData.phone_number, orgCode, orgData.company_type]
      );
    } else {
      await connection.query(
        `INSERT INTO \`${config.table}\` (name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number, \`${config.codeField}\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orgData.name, orgData.registration_number, orgData.email,
        orgData.address_line_1, orgData.address_line_2, orgData.address_line_3,
        orgData.country, orgData.phone_number, orgCode]
      );
    }

    // Insert admin with generic entity_code
    const adminId = await AdminModel.create({
      user_id: userCode,
      first_name,
      last_name,
      nic: nic || null,
      email,
      country: country || null,
      phone_number: phone_number || null,
      password: hashedPw,
      account_type: config.account_type,
      entity_type,
      entity_code: orgCode,
      org_level: config.org_level
    });

    // Create Subscription
    await SubscriptionModel.createSubscription(connection, orgCode, plan_name, billing_cycle || 'None');

    await connection.commit();

    // Generate Verification Token and Send Email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    await AdminModel.setVerificationToken(adminId, verificationToken);

    // Dispatch email
    sendVerificationEmail(email, first_name, verificationToken).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    return successResponse(res, null, 'Registration successful. Please check your email to verify your account.', 201);

  } catch (error) {
    await connection.rollback();
    console.error('Registration error:', error);
    return errorResponse(res, 'Registration failed. Please try again.', 500);
  } finally {
    connection.release();
  }
};

// ─── LOGIN ───────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Unified login — checks admins, auditors, and entity_heads tables.
 * If the email exists in multiple tables, returns all available accounts
 * and logs into the first one whose password matches (priority: admin > entity_head > auditor).
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const missing = validateRequiredFields(req.body, ['email', 'password']);
    if (missing) return errorResponse(res, missing, 400);

    // Find the email in all 3 tables
    const adminRec = await AdminModel.findByEmail(email);
    const auditorRec = await AuditorModel.findByEmail(email);
    const headRec = await EntityHeadModel.findByEmail(email);

    // Build candidate list — { role, record } — with password-check candidates
    const candidates = [];
    if (adminRec && adminRec.is_active && adminRec.password) {
      if (!adminRec.is_verified) {
        return errorResponse(res, 'Please verify your email address. Check your inbox for the verification link.', 403);
      }
      candidates.push({ role: 'admin', record: adminRec });
    }
    if (headRec && headRec.is_active && headRec.email_verified && headRec.password) {
      candidates.push({ role: 'entity_head', record: headRec });
    }
    if (auditorRec && auditorRec.is_active && auditorRec.email_verified && auditorRec.password) {
      candidates.push({ role: 'auditor', record: auditorRec });
    }

    if (candidates.length === 0) {
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    // Try the given password against each candidate (priority order above)
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
      return errorResponse(res, 'Invalid email or password.', 401);
    }

    // Generate tokens for the matched account
    const tokens = generateTokensForRole(activeRole, activeRecord);

    // Store refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (admin_id, user_role, token, expires_at) VALUES (?, ?, ?, ?)',
      [activeRecord.id, activeRole, tokens.refreshToken, refreshExpiry]
    );

    if (activeRole === 'admin') {
      await AdminModel.updateLastLogin(activeRecord.id);
    }

    // Collect ALL available accounts for this email (regardless of password match)
    const accounts = await collectAccounts(email);

    // Fetch plan limits
    const plan_limits = await getPlanLimitsForUser(activeRole, activeRecord);

    return successResponse(res, {
      admin: { ...buildUserResponse(activeRole, activeRecord), plan_limits },
      accounts,
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
 * Body: { refresh_token }
 */
const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return errorResponse(res, 'Refresh token is required.', 400);

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);

    const role = decoded.role || 'admin';           // backward compat
    const userId = decoded.userId || decoded.adminId;  // backward compat

    const [rows] = await db.query(
      'SELECT * FROM refresh_tokens WHERE admin_id = ? AND token = ? AND expires_at > NOW()',
      [userId, refresh_token]
    );
    if (rows.length === 0) return errorResponse(res, 'Invalid or expired refresh token.', 401);

    let record;
    if (role === 'admin') {
      record = await AdminModel.findById(userId);
    } else if (role === 'auditor') {
      record = await AuditorModel.findById(userId);
    } else if (role === 'entity_head') {
      record = await EntityHeadModel.findById(userId);
    }
    if (!record || !record.is_active) return errorResponse(res, 'Account not found or deactivated.', 401);

    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [refresh_token]);

    const tokens = generateTokensForRole(role, record);

    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (admin_id, user_role, token, expires_at) VALUES (?, ?, ?, ?)',
      [record.id, role, tokens.refreshToken, refreshExpiry]
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

    if (role === 'admin') {
      const admin = await AdminModel.findById(req.user.id);
      if (!admin) return errorResponse(res, 'Admin not found.', 404);
      userResponse = buildUserResponse('admin', admin);

      const config = ENTITY_CONFIG[admin.entity_type];
      if (config) {
        const [orgRows] = await db.query(
          `SELECT name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number FROM \`${config.table}\` WHERE \`${config.codeField}\` = ?`,
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
      const auditor = await AuditorModel.findById(req.user.id);
      if (!auditor) return errorResponse(res, 'Auditor not found.', 404);
      userResponse = buildUserResponse('auditor', auditor);
    } else if (role === 'entity_head') {
      const head = await EntityHeadModel.findById(req.user.id);
      if (!head) return errorResponse(res, 'Entity head not found.', 404);
      userResponse = buildUserResponse('entity_head', head);
    } else {
      return errorResponse(res, 'Invalid role.', 400);
    }

    // Collect available accounts for this email
    const accounts = await collectAccounts(email);

    // Fetch plan limits
    const record = role === 'admin' ? await AdminModel.findById(req.user.id) :
      role === 'auditor' ? await AuditorModel.findById(req.user.id) :
        await EntityHeadModel.findById(req.user.id);
    const plan_limits = await getPlanLimitsForUser(role, record);

    return successResponse(res, {
      admin: { ...userResponse, plan_limits },
      organization,
      accounts
    });
  } catch (error) {
    console.error('Get me error:', error);
    return errorResponse(res, 'Failed to fetch profile.', 500);
  }
};

/**
 * PUT /api/auth/organization
 * Body: { name, registration_number, email, address, country, phone_number }
 * Only works for 'admin' role on their own organization.
 */
const updateOrganization = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return errorResponse(res, 'Only administrators can update organization details.', 403);
    }

    const { name, registration_number, email, address_line_1, address_line_2, address_line_3, country, phone_number } = req.body;
    if (!name) return errorResponse(res, 'Organization name is required.', 400);

    const admin = await AdminModel.findById(req.user.id);
    if (!admin) return errorResponse(res, 'Admin not found.', 404);

    const config = ENTITY_CONFIG[admin.entity_type];
    if (!config) return errorResponse(res, 'Invalid entity type configuration.', 400);

    await db.query(
      `UPDATE \`${config.table}\` 
       SET name = ?, registration_number = ?, email = ?, address_line_1 = ?, address_line_2 = ?, address_line_3 = ?, country = ?, phone_number = ? 
       WHERE \`${config.codeField}\` = ?`,
      [name, registration_number || null, email || null, address_line_1 || null, address_line_2 || null, address_line_3 || null, country || null, phone_number || null, admin.entity_code]
    );

    return successResponse(res, null, 'Organization details updated successfully.');
  } catch (error) {
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

    if (role === 'admin') {
      record = await AdminModel.findByEmail(req.user.email);
    } else if (role === 'auditor') {
      record = await AuditorModel.findByEmail(req.user.email);
    } else if (role === 'entity_head') {
      record = await EntityHeadModel.findByEmail(req.user.email);
    }
    if (!record) return errorResponse(res, 'User not found.', 404);

    const isMatch = await bcrypt.compare(current_password, record.password);
    if (!isMatch) return errorResponse(res, 'Current password is incorrect.', 400);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    if (role === 'admin') {
      await AdminModel.updatePassword(record.id, hashedPassword);
    } else if (role === 'auditor') {
      await AuditorModel.setPassword(record.id, hashedPassword);
    } else if (role === 'entity_head') {
      await EntityHeadModel.setPassword(record.id, hashedPassword);
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
 * Body: { target_role: 'admin'|'auditor'|'entity_head', password }
 *
 * Switches the active session to a different role's account.
 * Requires the password for the target account (may differ per role).
 */
const switchAccount = async (req, res) => {
  try {
    const { target_role, password } = req.body;

    if (!target_role || !password) {
      return errorResponse(res, 'target_role and password are required.', 400);
    }
    if (!['admin', 'auditor', 'entity_head'].includes(target_role)) {
      return errorResponse(res, 'Invalid target_role.', 400);
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
      record = await EntityHeadModel.findByEmail(email);
      if (!record || !record.is_active || !record.email_verified) return errorResponse(res, 'Entity head account not found or not verified.', 404);
    }

    if (!record.password) return errorResponse(res, 'Target account has no password set.', 400);

    const isMatch = await bcrypt.compare(password, record.password);
    if (!isMatch) return errorResponse(res, 'Invalid password.', 401);

    // Generate new tokens for the target role
    const tokens = generateTokensForRole(target_role, record);

    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (admin_id, user_role, token, expires_at) VALUES (?, ?, ?, ?)',
      [record.id, target_role, tokens.refreshToken, refreshExpiry]
    );

    if (target_role === 'admin') {
      await AdminModel.updateLastLogin(record.id);
    }

    // Fetch plan limits
    const plan_limits = await getPlanLimitsForUser(target_role, record);

    return successResponse(res, {
      admin: { ...buildUserResponse(target_role, record), plan_limits },
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
 * Sends a 6-digit OTP to the admin's email address.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email is required.', 400);
    if (!isValidEmail(email)) return errorResponse(res, 'Invalid email address.', 400);

    const admin = await AdminModel.findByEmail(email);
    if (!admin) {
      // Don't reveal whether account exists
      return successResponse(res, null, 'If an account exists with that email, an OTP has been sent.');
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate previous unused OTPs for this email
    await db.query('UPDATE password_reset_otps SET used = TRUE WHERE email = ? AND used = FALSE', [email]);

    // Store OTP
    await db.query(
      'INSERT INTO password_reset_otps (email, otp, expires_at) VALUES (?, ?, ?)',
      [email, otp, expiresAt]
    );

    // Send OTP email
    try {
      const { sendOtpEmail } = require('../services/emailService');
      await sendOtpEmail(email, `${admin.first_name} ${admin.last_name}`, otp);
    } catch (emailErr) {
      console.error('Failed to send OTP email:', emailErr.message);
      return errorResponse(res, 'Failed to send OTP email. Please try again.', 500);
    }

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
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const missing = validateRequiredFields(req.body, ['email', 'otp']);
    if (missing) return errorResponse(res, missing, 400);

    const [rows] = await db.query(
      'SELECT * FROM password_reset_otps WHERE email = ? AND otp = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );

    if (rows.length === 0) {
      return errorResponse(res, 'Invalid or expired OTP.', 400);
    }

    // Mark OTP as used
    await db.query('UPDATE password_reset_otps SET used = TRUE WHERE id = ?', [rows[0].id]);

    // Generate a temporary reset token (valid for 5 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Store reset token in a new OTP row (reuse table with special otp value)
    await db.query(
      'INSERT INTO password_reset_otps (email, otp, expires_at, used) VALUES (?, ?, ?, FALSE)',
      [email, `RST-${resetToken}`, resetExpiry]
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
    const { email, reset_token, new_password } = req.body;
    const missing = validateRequiredFields(req.body, ['email', 'reset_token', 'new_password']);
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
    await db.query('UPDATE password_reset_otps SET used = TRUE WHERE id = ?', [rows[0].id]);

    // Find admin and update password
    const admin = await AdminModel.findByEmail(email);
    if (!admin) return errorResponse(res, 'Account not found.', 404);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await AdminModel.updatePassword(admin.id, hashedPassword);

    return successResponse(res, null, 'Password reset successfully. You can now log in.');
  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse(res, 'Failed to reset password.', 500);
  }
};

// ─── VERIFY EMAIL ────────────────────────────────────────────────

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
      await AdminModel.markAsVerified(admin.id);
      return successResponse(res, {
        email: admin.email,
        first_name: admin.first_name,
        needs_password: false
      }, 'Email verified successfully. You may now log in.', 200);
    }

    // 2. Check Auditors (uses email_token + expires)
    const auditor = await AuditorModel.findByEmailToken(token);
    if (auditor) {
      await AuditorModel.verifyEmail(auditor.id);
      return successResponse(res, {
        email: auditor.email,
        first_name: auditor.first_name,
        needs_password: !auditor.password
      }, 'Email verified successfully.', 200);
    }

    // 3. Check Entity Heads (uses email_token + expires)
    const head = await EntityHeadModel.findByEmailToken(token);
    if (head) {
      await EntityHeadModel.verifyEmail(head.id);
      return successResponse(res, {
        email: head.email,
        first_name: head.first_name,
        needs_password: !head.password
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
    const { first_name, last_name, phone_number, nic, country, profile_image } = req.body;

    if (!first_name || !last_name) {
      return errorResponse(res, 'first_name and last_name are required.', 400);
    }

    // 1. Fetch old profile_image path
    let oldProfileImage = null;
    if (role === 'admin') {
      const [rows] = await db.query('SELECT profile_image FROM admins WHERE id = ?', [req.user.id]);
      if (rows && rows.length > 0) oldProfileImage = rows[0].profile_image;
    } else if (role === 'auditor') {
      const [rows] = await db.query('SELECT profile_image FROM auditors WHERE id = ?', [req.user.id]);
      if (rows && rows.length > 0) oldProfileImage = rows[0].profile_image;
    } else if (role === 'entity_head') {
      const [rows] = await db.query('SELECT profile_image FROM entity_heads WHERE id = ?', [req.user.id]);
      if (rows && rows.length > 0) oldProfileImage = rows[0].profile_image;
    }

    // 2. Process image path and write file to disk if base64
    let finalProfileImagePath = null;
    if (profile_image) {
      if (profile_image.startsWith('data:image/')) {
        finalProfileImagePath = saveProfileImage(role, req.user.id, profile_image);

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
    if (role === 'admin') {
      await db.query(
        'UPDATE admins SET first_name = ?, last_name = ?, phone_number = ?, nic = ?, country = ?, profile_image = ? WHERE id = ?',
        [first_name.trim(), last_name.trim(), phone_number || null, nic || null, country || null, finalProfileImagePath, req.user.id]
      );
    } else if (role === 'auditor') {
      await db.query(
        'UPDATE auditors SET first_name = ?, last_name = ?, phone_number = ?, nic = ?, country = ?, profile_image = ? WHERE id = ?',
        [first_name.trim(), last_name.trim(), phone_number || null, nic || null, country || null, finalProfileImagePath, req.user.id]
      );
    } else if (role === 'entity_head') {
      await db.query(
        'UPDATE entity_heads SET first_name = ?, last_name = ?, phone_number = ?, nic = ?, country = ?, profile_image = ? WHERE id = ?',
        [first_name.trim(), last_name.trim(), phone_number || null, nic || null, country || null, finalProfileImagePath, req.user.id]
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
    if (req.user.role !== 'admin') {
      return errorResponse(res, 'Only administrators can access onboarding status.', 403);
    }
    const admin = await AdminModel.findById(req.user.id);
    if (!admin) return errorResponse(res, 'Admin not found.', 404);

    return successResponse(res, {
      onboarding_completed: !!admin.onboarding_completed,
      onboarding_skipped: !!admin.onboarding_skipped,
      onboarding_completed_at: admin.onboarding_completed_at || null,
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
    if (req.user.role !== 'admin') {
      return errorResponse(res, 'Only administrators can update onboarding status.', 403);
    }
    const { action } = req.body;
    if (!['complete', 'skip', 'reset'].includes(action)) {
      return errorResponse(res, "Invalid action. Use 'complete', 'skip', or 'reset'.", 400);
    }
    const admin = await AdminModel.findById(req.user.id);
    if (!admin) return errorResponse(res, 'Admin not found.', 404);

    if (action === 'complete') {
      await AdminModel.updateOnboardingStatus(admin.id, { completed: true, skipped: false });
    } else if (action === 'skip') {
      await AdminModel.updateOnboardingStatus(admin.id, { completed: false, skipped: true });
    } else {
      await db.query(
        `UPDATE admins
         SET onboarding_completed = 0, onboarding_skipped = 0, onboarding_completed_at = NULL
         WHERE id = ?`,
        [admin.id]
      );
    }

    const updated = await AdminModel.findById(admin.id);
    return successResponse(res, {
      onboarding_completed: !!updated.onboarding_completed,
      onboarding_skipped: !!updated.onboarding_skipped,
      onboarding_completed_at: updated.onboarding_completed_at || null,
    }, 'Onboarding status updated.');
  } catch (error) {
    console.error('updateOnboardingStatus error:', error);
    return errorResponse(res, 'Failed to update onboarding status.', 500);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  switchAccount,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyEmail,
  updateProfile,
  updateOrganization,
  getOnboardingStatus,
  updateOnboardingStatus,
};
