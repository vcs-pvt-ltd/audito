/**
 * Users Controller
 *
 * Admin creates users (auditors, entity heads) without passwords.
 * A verification email is sent. After verifying, the user sets their password.
 *
 * Auditors  -> auditors table     (optionally assigned to a branch for Audit Firms)
 * Heads     -> entity_heads table (assigned to a specific entity)
 *
 * Endpoints:
 *   POST   /api/users                     Create a user (admin only)
 *   GET    /api/users?user_type=X          List users created by this admin's entity
 *   GET    /api/users/:userCode            Get single user
 *   PUT    /api/users/:userCode            Update user details
 *   DELETE /api/users/:userCode            Delete user permanently
 *   POST   /api/users/:userCode/resend     Resend verification email
 *   POST   /api/users/verify-email         Verify email token (public)
 *   POST   /api/users/set-password         Set password after verification (public)
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AuditorModel = require('../models/AuditorModel');
const EntityHeadModel = require('../models/EntityHeadModel');
const AdminModel = require('../models/AdminModel');
const AuditFirmModel = require('../models/AuditFirmModel');
const CompanyModel = require('../models/CompanyModel');
const CustomerModel = require('../models/CustomerModel');
const { successResponse, errorResponse, validateRequiredFields, isValidEmail } = require('../utils/helpers');
const { sendVerificationEmail } = require('../services/emailService');
const { db } = require('../config/db');
const { getAccessibleEntityCodes } = require('../utils/accessHelper');
const LimitsEnforcer = require('../utils/limitsEnforcer');

// ─── User code generators ────────────────────────────────────────

const generateAuditorCode = async () => {
  const [rows] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(user_code, 5) AS UNSIGNED)) AS max_num FROM auditors WHERE user_code LIKE 'ADT-%'"
  );
  const next = (rows[0].max_num || 0) + 1;
  return `ADT-${String(next).padStart(6, '0')}`;
};

const generateHeadCode = async () => {
  const [rows] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(user_code, 4) AS UNSIGNED)) AS max_num FROM entity_heads WHERE user_code LIKE 'EH-%'"
  );
  const next = (rows[0].max_num || 0) + 1;
  return `EH-${String(next).padStart(6, '0')}`;
};

// ─── Helpers ──────────────────────────────────────────────────────

function generateEmailToken() {
  return crypto.randomBytes(32).toString('hex');
}

function tokenExpiry() {
  return new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
}

function isAuditor(userType) {
  return userType === 'Auditor';
}

async function validateAuditFirmAuditorAssignment(createdByFirmCode, assigned_entity_type, assigned_entity_code) {
  if (!assigned_entity_code) return { ok: true };
  if (!assigned_entity_type) return { ok: false, message: 'assigned_entity_type is required when assigned_entity_code is provided.' };
  if (!['Branch', 'Audit Firm Department'].includes(assigned_entity_type)) {
    return { ok: false, message: 'For Audit Firm auditors, assigned_entity_type must be "Branch" or "Audit Firm Department".' };
  }

  if (assigned_entity_type === 'Branch') {
    const b = await AuditFirmModel.findBranchByCode(assigned_entity_code);
    if (!b || b.afc_code !== createdByFirmCode) return { ok: false, message: 'Invalid branch for this audit firm.' };
    return { ok: true };
  }

  const d = await AuditFirmModel.findDepartmentByCode(assigned_entity_code);
  if (!d || d.afc_code !== createdByFirmCode) return { ok: false, message: 'Invalid department for this audit firm.' };
  return { ok: true };
}

/** Find a user by code across both tables */
async function findByCodeAny(userCode) {
  const auditor = await AuditorModel.findByCode(userCode);
  if (auditor) return { ...auditor, _table: 'auditor' };
  const head = await EntityHeadModel.findByCode(userCode);
  if (head) return { ...head, _table: 'entity_head' };

  // Check audit firms
  const firm = await AuditFirmModel.findFirmByCode(userCode);
  if (firm) return { ...firm, _table: 'audit_firm', user_code: firm.afc_code, is_org: true };
  const branch = await AuditFirmModel.findBranchByCode(userCode);
  if (branch) return { ...branch, _table: 'audit_firm_branch', user_code: branch.afc_branch_code, is_org: true };
  const dept = await AuditFirmModel.findDepartmentByCode(userCode);
  if (dept) return { ...dept, _table: 'audit_firm_dept', user_code: dept.afc_dept_code, is_org: true };

  // Check companies
  const comp = await CompanyModel.findCompanyByCode(userCode);
  if (comp) return { ...comp, _table: 'company', user_code: comp.comp_code, is_org: true };
  const clus = await CompanyModel.findClusterByCode(userCode);
  if (clus) return { ...clus, _table: 'cluster', user_code: clus.comp_clus_code, is_org: true };
  const fact = await CompanyModel.findFactoryByCode(userCode);
  if (fact) return { ...fact, _table: 'factory', user_code: fact.comp_fact_code, is_org: true };
  const unit = await CompanyModel.findUnitByCode(userCode);
  if (unit) return { ...unit, _table: 'unit', user_code: unit.comp_unit_code, is_org: true };
  const compDept = await CompanyModel.findDepartmentByCode(userCode);
  if (compDept) return { ...compDept, _table: 'department', user_code: compDept.comp_dept_code, is_org: true };
  const sect = await CompanyModel.findSectionByCode(userCode);
  if (sect) return { ...sect, _table: 'section', user_code: sect.comp_section_code, is_org: true };

  // Check customers
  const cust = await CustomerModel.findCustomerByCode(userCode);
  if (cust) return { ...cust, _table: 'customer', user_code: cust.cust_code, is_org: true };
  const bo = await CustomerModel.findBuyingOfficeByCode(userCode);
  if (bo) return { ...bo, _table: 'buying_office', user_code: bo.cbo_code, is_org: true };
  const sup = await CustomerModel.findSupplierByCode(userCode);
  if (sup) return { ...sup, _table: 'supplier', user_code: sup.csup_code, is_org: true };

  return null;
}

/** Check if email already exists in the target table for this user type */
async function emailExistsInTable(email, userType) {
  if (isAuditor(userType)) {
    return !!(await AuditorModel.findByEmail(email));
  }
  return !!(await EntityHeadModel.findByEmail(email));
}

// What user_types can each entity_type create?
const ALLOWED_USER_TYPES = {
  'Customer':           ['Auditor', 'Buying Office Head', 'Supplier Head'],
  'Buying Office':      ['Auditor', 'Supplier Head'],
  'Company':            ['Auditor', 'Cluster Head', 'Factory Head', 'Unit Head', 'Department Head'],
  'Cluster':            ['Auditor', 'Factory Head'],
  'Factory':            ['Auditor', 'Unit Head'],
  'Unit':               ['Auditor', 'Department Head'],
  'Department':         ['Auditor'],
  'Supplier':           ['Auditor'],
  'Audit Firm Company': ['Auditor', 'Branch Head', 'Audit Firm Department Head'],
};

// Map user_type to role
function getUserRole(userType) {
  if (userType === 'Auditor') return 'auditor';
  return 'entity_head';
}

// Map user_type to assigned entity type (for heads)
const HEAD_TO_ENTITY = {
  'Buying Office Head': 'Buying Office',
  'Supplier Head':      'Supplier',
  'Company Head':       'Company',
  'Cluster Head':       'Cluster',
  'Factory Head':       'Factory',
  'Unit Head':          'Unit',
  'Department Head':    'Department',
  'Section Head':       'Section',
  'Branch Head':        'Branch',
  'Audit Firm Department Head': 'Audit Firm Department',
};

// ─── CREATE USER ──────────────────────────────────────────────────

const createUser = async (req, res) => {
  try {
    const { first_name, last_name, email, phone_number, nic, country, user_type, assigned_entity_code, assigned_entity_type, assigned_org_tree_id } = req.body;

    const missing = validateRequiredFields(req.body, ['first_name', 'last_name', 'email', 'user_type']);
    if (missing) return errorResponse(res, missing, 400);

    if (!isValidEmail(email)) return errorResponse(res, 'Invalid email address.', 400);

    // Check admin can create this user_type
    const adminEntityType = req.user.entityType;
    let allowed = ALLOWED_USER_TYPES[adminEntityType] || [];

    if (!allowed.includes(user_type)) {
      return errorResponse(res, `You cannot create "${user_type}" users for this account type.`, 403);
    }

    if (isAuditor(user_type)) {
      const limitError = await LimitsEnforcer.checkAuditorLimit(req.user.entityCode);
      if (limitError) return errorResponse(res, limitError, 403);
    }

    // Check email not already used in the same table
    if (await emailExistsInTable(email, user_type)) {
      return errorResponse(res, 'This email is already registered as this user type.', 409);
    }

    const role = getUserRole(user_type);
    const emailToken = generateEmailToken();
    const emailTokenExpires = tokenExpiry();

    let userCode, id;

    if (isAuditor(user_type)) {
      // Auditors – optionally assigned to a branch (for Audit Firm)
      // Determine auditor_type for backend normalization (separate from user_type label)
      const effectiveAuditorType = (req.user.accountType === 'Audit Firm' && user_type === 'Auditor')
        ? 'audit_firm'
        : 'internal';

      if (req.user.accountType === 'Audit Firm') {
        const v = await validateAuditFirmAuditorAssignment(req.user.entityCode, assigned_entity_type, assigned_entity_code);
        if (!v.ok) return errorResponse(res, v.message, 400);
      }

      userCode = await generateAuditorCode();
      id = await AuditorModel.create({
        user_code: userCode,
        first_name,
        last_name,
        email,
        phone_number: phone_number || null,
        nic: nic || null,
        country: country || null,
        role,
        user_type: user_type,
        auditor_type: effectiveAuditorType,
        assigned_entity_type: assigned_entity_code ? (assigned_entity_type || 'Branch') : null,
        assigned_entity_code: assigned_entity_code || null,
        assigned_org_tree_id: assigned_org_tree_id || null,
        created_by_admin_id: req.user.id,
        created_by_entity_code: req.user.entityCode,
        email_token: emailToken,
        email_token_expires: emailTokenExpires,
      });
    } else {
      // Entity heads – with entity assignment
      const assignedEntityType = HEAD_TO_ENTITY[user_type] || null;
      userCode = await generateHeadCode();
      id = await EntityHeadModel.create({
        user_code: userCode,
        first_name,
        last_name,
        email,
        phone_number: phone_number || null,
        nic: nic || null,
        country: country || null,
        role,
        user_type,
        assigned_entity_type: assignedEntityType,
        assigned_entity_code: assigned_entity_code || null,
        assigned_org_tree_id: assigned_org_tree_id || null,
        created_by_admin_id: req.user.id,
        created_by_entity_code: req.user.entityCode,
        email_token: emailToken,
        email_token_expires: emailTokenExpires,
      });
    }

    // Send verification email
    try {
      await sendVerificationEmail(email, `${first_name} ${last_name}`, emailToken);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
    }

    return successResponse(res, {
      id,
      user_code: userCode,
      first_name,
      last_name,
      email,
      role,
      user_type,
    }, 'User created. Verification email sent.', 201);

  } catch (error) {
    console.error('Create user error:', error);
    return errorResponse(res, 'Failed to create user.', 500);
  }
};

// ─── LIST USERS ───────────────────────────────────────────────────

const listUsers = async (req, res) => {
  try {
    const userType = req.query.user_type || null;
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);

    if (userType && isAuditor(userType)) {
      const users = await AuditorModel.listByCreators(accessibleCodes);
      return successResponse(res, { users });
    } else if (userType) {
      const users = await EntityHeadModel.listByCreators(accessibleCodes, userType);
      return successResponse(res, { users });
    } else {
      // No filter – list from both tables
      const auditors = await AuditorModel.listByCreators(accessibleCodes);
      const heads = await EntityHeadModel.listByCreators(accessibleCodes);
      return successResponse(res, { users: [...auditors, ...heads] });
    }
  } catch (error) {
    console.error('List users error:', error);
    return errorResponse(res, 'Failed to list users.', 500);
  }
};

// ─── GET USER ─────────────────────────────────────────────────────

const getUser = async (req, res) => {
  try {
    const user = await findByCodeAny(req.params.userCode);
    if (!user) return errorResponse(res, 'User not found.', 404);
    
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    
    // For organizations, check if their code is in our accessible list
    // For users, check if their creator is in our accessible list
    const targetCode = user.is_org ? req.params.userCode : user.created_by_entity_code;

    if (!accessibleCodes.includes(targetCode)) {
      return errorResponse(res, 'Not authorized.', 403);
    }
    return successResponse(res, { user });
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse(res, 'Failed to get user.', 500);
  }
};

// ─── UPDATE USER ──────────────────────────────────────────────────

const updateUser = async (req, res) => {
  try {
    const user = await findByCodeAny(req.params.userCode);
    if (!user) return errorResponse(res, 'User not found.', 404);
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(user.created_by_entity_code)) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const Model = user._table === 'auditor' ? AuditorModel : EntityHeadModel;
    // Audit Firm auditor reassignment validation
    if (
      user._table === 'auditor' &&
      req.user.role === 'admin' &&
      req.user.accountType === 'Audit Firm' &&
      (req.body.assigned_entity_code !== undefined || req.body.assigned_entity_type !== undefined)
    ) {
      const v = await validateAuditFirmAuditorAssignment(
        req.user.entityCode,
        req.body.assigned_entity_type,
        req.body.assigned_entity_code
      );
      if (!v.ok) return errorResponse(res, v.message, 400);
    }
    await Model.update(user.id, req.body);

    const updated = await findByCodeAny(req.params.userCode);
    return successResponse(res, { user: updated }, 'User updated.');
  } catch (error) {
    console.error('Update user error:', error);
    return errorResponse(res, 'Failed to update user.', 500);
  }
};

// ─── DELETE USER ──────────────────────────────────────────────────

const deleteUser = async (req, res) => {
  try {
    const user = await findByCodeAny(req.params.userCode);
    if (!user) return errorResponse(res, 'User not found.', 404);
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(user.created_by_entity_code)) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const Model = user._table === 'auditor' ? AuditorModel : EntityHeadModel;
    await Model.deleteById(user.id);
    return successResponse(res, null, 'User deleted.');
  } catch (error) {
    console.error('Delete user error:', error);
    return errorResponse(res, 'Failed to delete user.', 500);
  }
};

// ─── RESEND VERIFICATION ──────────────────────────────────────────

const resendVerification = async (req, res) => {
  try {
    const user = await findByCodeAny(req.params.userCode);
    if (!user) return errorResponse(res, 'User not found.', 404);
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(user.created_by_entity_code)) {
      return errorResponse(res, 'Not authorized.', 403);
    }
    if (user.email_verified) {
      return errorResponse(res, 'Email is already verified.', 400);
    }

    const newToken = generateEmailToken();
    const newExpires = tokenExpiry();
    const Model = user._table === 'auditor' ? AuditorModel : EntityHeadModel;
    await Model.regenerateToken(user.id, newToken, newExpires);

    try {
      await sendVerificationEmail(user.email, `${user.first_name} ${user.last_name}`, newToken);
    } catch (emailErr) {
      console.error('Resend email error:', emailErr.message);
      return errorResponse(res, 'Failed to send email. Please try again later.', 500);
    }

    return successResponse(res, null, 'Verification email resent.');
  } catch (error) {
    console.error('Resend verification error:', error);
    return errorResponse(res, 'Failed to resend.', 500);
  }
};

// ─── VERIFY EMAIL (PUBLIC) ────────────────────────────────────────

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return errorResponse(res, 'Token is required.', 400);

    // Search both tables for the token
    let user = await AuditorModel.findByEmailToken(token);
    let Model = AuditorModel;
    if (!user) {
      user = await EntityHeadModel.findByEmailToken(token);
      Model = EntityHeadModel;
    }
    if (!user) return errorResponse(res, 'Invalid or expired verification link.', 400);

    await Model.verifyEmail(user.id);

    return successResponse(res, {
      user_code: user.user_code,
      email: user.email,
      first_name: user.first_name,
      needs_password: !user.password,
    }, 'Email verified successfully.');
  } catch (error) {
    console.error('Verify email error:', error);
    return errorResponse(res, 'Verification failed.', 500);
  }
};

// ─── SET PASSWORD (PUBLIC) ────────────────────────────────────────

const setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const missing = validateRequiredFields(req.body, ['email', 'password']);
    if (missing) return errorResponse(res, missing, 400);

    if (password.length < 8) return errorResponse(res, 'Password must be at least 8 characters.', 400);

    // Search both tables – prefer the verified record that still needs a password
    const auditor = await AuditorModel.findByEmail(email);
    const head = await EntityHeadModel.findByEmail(email);

    let user = null;
    let Model = null;

    // Pick the record that is verified and still needs a password
    if (auditor && auditor.email_verified && !auditor.password) {
      user = auditor;
      Model = AuditorModel;
    } else if (head && head.email_verified && !head.password) {
      user = head;
      Model = EntityHeadModel;
    }

    // Fallback – verified record that already has a password (allow re-set)
    if (!user && auditor && auditor.email_verified) {
      user = auditor;
      Model = AuditorModel;
    } else if (!user && head && head.email_verified) {
      user = head;
      Model = EntityHeadModel;
    }

    if (!user && (auditor || head)) return errorResponse(res, 'Please verify your email first.', 400);
    if (!user) return errorResponse(res, 'User not found.', 404);

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);
    await Model.setPassword(user.id, hashed);

    return successResponse(res, null, 'Password set successfully. You can now log in.');
  } catch (error) {
    console.error('Set password error:', error);
    return errorResponse(res, 'Failed to set password.', 500);
  }
};

// ─── CHECK ADMIN EMAIL ────────────────────────────────────────────

const checkAdminEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email is required.', 400);

    const admin = await AdminModel.findByEmail(email);
    if (!admin) return successResponse(res, { found: false });

    return successResponse(res, {
      found: true,
      admin: {
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        phone_number: admin.phone_number || null,
        nic: admin.nic || null,
        country: admin.country || null,
      },
    });
  } catch (error) {
    console.error('Check admin email error:', error);
    return errorResponse(res, 'Failed to check email.', 500);
  }
};

// ─── CREATE USER FROM ADMIN ───────────────────────────────────────

const createUserFromAdmin = async (req, res) => {
  try {
    const { email, user_type, assigned_entity_code, assigned_org_tree_id } = req.body;

    if (!email || !user_type) return errorResponse(res, 'Email and user_type are required.', 400);

    // Permission check
    const adminEntityType = req.user.entityType;
    let allowed = ALLOWED_USER_TYPES[adminEntityType] || [];

    if (!allowed.includes(user_type)) {
      return errorResponse(res, `You cannot create "${user_type}" users for this account type.`, 403);
    }

    if (isAuditor(user_type)) {
      const limitError = await LimitsEnforcer.checkAuditorLimit(req.user.entityCode);
      if (limitError) return errorResponse(res, limitError, 403);
    }

    // Find admin by email
    const admin = await AdminModel.findByEmail(email);
    if (!admin) return errorResponse(res, 'No admin found with this email.', 404);

    // Check not already registered as this user type
    if (await emailExistsInTable(email, user_type)) {
      return errorResponse(res, 'This email is already registered as this user type.', 409);
    }

    const role = getUserRole(user_type);
    const baseData = {
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      phone_number: admin.phone_number || null,
      nic: admin.nic || null,
      country: admin.country || null,
      role,
      user_type,
      created_by_admin_id: req.user.id,
      created_by_entity_code: req.user.entityCode,
      password: admin.password,
    };

    let userCode, id;

    if (isAuditor(user_type)) {
      userCode = await generateAuditorCode();
      const effectiveAuditorType = (req.user.accountType === 'Audit Firm' && user_type === 'Auditor')
        ? 'audit_firm'
        : 'internal';
      id = await AuditorModel.createVerified({
        ...baseData,
        user_code: userCode,
        user_type: user_type,
        auditor_type: effectiveAuditorType,
        assigned_entity_type: assigned_entity_code ? (req.body.assigned_entity_type || 'Branch') : null,
        assigned_entity_code: assigned_entity_code || null,
        assigned_org_tree_id: assigned_org_tree_id || null,
      });
    } else {
      const assignedEntityType = HEAD_TO_ENTITY[user_type] || null;
      userCode = await generateHeadCode();
      id = await EntityHeadModel.createVerified({
        ...baseData,
        user_code: userCode,
        assigned_entity_type: assignedEntityType,
        assigned_entity_code: assigned_entity_code || null,
        assigned_org_tree_id: assigned_org_tree_id || null,
      });
    }

    return successResponse(res, {
      id,
      user_code: userCode,
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      role,
      user_type,
    }, 'User created from admin account.', 201);

  } catch (error) {
    console.error('Create user from admin error:', error);
    return errorResponse(res, 'Failed to create user.', 500);
  }
};

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  resendVerification,
  verifyEmail,
  setPassword,
  checkAdminEmail,
  createUserFromAdmin,
};
