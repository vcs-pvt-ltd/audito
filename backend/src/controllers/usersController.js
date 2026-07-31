/**
 * Users Controller
 *
 * Admin creates users (auditors, organization users) without passwords.
 * An invitation email is sent. The invitee verifies their email and sets a password.
 *
 * Auditors  -> auditors table     (optionally assigned to a branch for Audit Firms)
 * Organization users -> organization_users table (assigned through access scopes)
 *
 * Endpoints:
 *   POST   /api/users                     Create a user (admin only)
 *   GET    /api/users?user_type=X          List users created by this admin's entity
 *   GET    /api/users/:userCode            Get single user
 *   PUT    /api/users/:userCode            Update user details
 *   DELETE /api/users/:userCode            Delete user permanently
 *   POST   /api/users/:userCode/resend     Resend invitation email
 *   POST   /api/users/verify-email         Verify email token (public)
 *   POST   /api/users/set-password         Set password after verification (public)
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AuditorModel = require('../models/AuditorModel');
const OrganizationUserModel = require('../models/OrganizationUserModel');
const OrganizationUserScopeModel = require('../models/OrganizationUserScopeModel');
const AdminModel = require('../models/AdminModel');
const AuditFirmModel = require('../models/AuditFirmModel');
const CompanyModel = require('../models/CompanyModel');
const CustomerModel = require('../models/CustomerModel');
const { successResponse, errorResponse, validateRequiredFields, isValidEmail } = require('../utils/helpers');
const { sendUserInvitationEmail } = require('../services/emailService');
const { db } = require('../config/db');
const { getAccessibleEntityCodes } = require('../utils/accessHelper');
const LimitsEnforcer = require('../utils/limitsEnforcer');
const { getOrgDetails, getCountryDialingCode } = require('../utils/orgLookup');
const { getResendCooldownSeconds, recordResend } = require('../utils/emailResendCooldown');

// ─── User code generators ────────────────────────────────────────

const generateAuditorCode = async () => {
  const [rows] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(auditor_id, 5) AS UNSIGNED)) AS max_num FROM auditors WHERE auditor_id LIKE 'ADT-%'"
  );
  const next = (rows[0].max_num || 0) + 1;
  return `ADT-${String(next).padStart(6, '0')}`;
};

const generateOrganizationUserCode = async () => {
  const [rows] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(organization_user_id, 4) AS UNSIGNED)) AS max_num FROM organization_users WHERE organization_user_id LIKE 'EH-%'"
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
  if (auditor) return { ...auditor, user_code: auditor.auditor_id, _table: 'auditor' };
  const organizationUser = await OrganizationUserModel.findByCode(userCode);
  if (organizationUser) {
    const scopes = await OrganizationUserScopeModel.listByUser(organizationUser.organization_user_id);
    return {
      ...organizationUser,
      user_code: organizationUser.organization_user_id,
      user_type: 'Organization User',
      scopes,
      scope_count: scopes.length,
      _table: 'organization_user',
    };
  }

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
  return !!(await OrganizationUserModel.findByEmail(email));
}

// What user_types can each entity_type create?
const ALLOWED_USER_TYPES = {
  'Customer':           ['Auditor', 'Organization User'],
  'Buying Office':      ['Auditor', 'Organization User'],
  'Company':            ['Auditor', 'Organization User'],
  'Cluster':            ['Auditor', 'Organization User'],
  'Factory':            ['Auditor', 'Organization User'],
  'Unit':               ['Auditor', 'Organization User'],
  'Department':         ['Auditor', 'Organization User'],
  'Supplier':           ['Auditor', 'Organization User'],
  'Audit Firm Company': ['Auditor', 'Organization User'],
};

// Map user_type to role
function getUserRole(userType) {
  if (userType === 'Auditor') return 'auditor';
  return 'organization_user';
}

// Map user_type to its assigned entity type.
// ─── CREATE USER ──────────────────────────────────────────────────

const createUser = async (req, res) => {
  let quotaLock = null;
  let connection = null;
  try {
    const {
      first_name, last_name, email, phone_number, country, user_type,
      assigned_entity_code, assigned_entity_type, assigned_org_tree_id, scopes,
    } = req.body;

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
      quotaLock = await LimitsEnforcer.acquireQuotaLock(req.user.entityCode, 'auditor');
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
    let validatedScopes = [];

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
        auditor_id: userCode,
        first_name,
        last_name,
        email,
        phone_number: phone_number || null,
        country: country || null,
        role,
        user_type: user_type,
        auditor_type: effectiveAuditorType,
        assigned_entity_type: assigned_entity_code ? (assigned_entity_type || 'Branch') : null,
        assigned_entity_code: assigned_entity_code || null,
        assigned_org_tree_id: assigned_org_tree_id || null,
        created_by_admin_id: req.user.userCode,
        created_by_entity_code: req.user.entityCode,
        email_token: emailToken,
        email_token_expires: emailTokenExpires,
      });
    } else {
      // Organization users – with entity assignment
      const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
      const scopeInput = Array.isArray(scopes) ? scopes : (
        assigned_entity_code
          ? [{
              org_tree_id: assigned_org_tree_id || null,
              entity_code: assigned_entity_code,
              entity_type: assigned_entity_type || null,
              scope_mode: 'SUBTREE',
            }]
          : []
      );
      const validation = await OrganizationUserScopeModel.validateForWorkspace(scopeInput, {
        rootEntityCode: req.user.entityCode,
        accessibleEntityCodes: accessibleCodes,
      });
      if (!validation.ok) return errorResponse(res, validation.message, 400);
      validatedScopes = validation.scopes;
      const primaryScope = validatedScopes[0];

      userCode = await generateOrganizationUserCode();
      connection = await db.getConnection();
      await connection.beginTransaction();
      id = await OrganizationUserModel.create({
        organization_user_id: userCode,
        first_name,
        last_name,
        email,
        phone_number: phone_number || null,
        country: country || null,
        role,
        user_type: 'Organization User',
        assigned_entity_type: primaryScope.entity_type || null,
        assigned_entity_code: primaryScope.entity_code,
        assigned_org_tree_id: primaryScope.org_tree_id,
        created_by_admin_id: req.user.userCode,
        created_by_entity_code: req.user.entityCode,
        email_token: emailToken,
        email_token_expires: emailTokenExpires,
      }, connection);
      await OrganizationUserScopeModel.replaceForUser(
        userCode,
        validatedScopes,
        req.user.userCode,
        connection
      );
      await connection.commit();
    }

    if (quotaLock) {
      await quotaLock.release();
      quotaLock = null;
    }

    // Send a workspace invitation with enough organization context for the recipient.
    try {
      const organizationType = req.user.entityType === 'Audit Firm'
        ? 'Audit Firm Company'
        : req.user.entityType;
      const invitedEntityType = isAuditor(user_type)
        ? assigned_entity_type
        : (validatedScopes[0]?.entity_type || assigned_entity_type);
      const invitedEntityCode = isAuditor(user_type)
        ? assigned_entity_code
        : (validatedScopes[0]?.entity_code || assigned_entity_code);
      const [organization, assignedEntity] = await Promise.all([
        getOrgDetails(organizationType, req.user.entityCode),
        !isAuditor(user_type) && invitedEntityCode && invitedEntityType
          ? getOrgDetails(invitedEntityType, invitedEntityCode)
          : Promise.resolve(null),
      ]);
      const organizationDialingCode = await getCountryDialingCode(organization?.country);
      await sendUserInvitationEmail(email, `${first_name} ${last_name}`, emailToken, {
        organizationName: organization?.name || req.user.entityCode,
        organizationEmail: organization?.email,
        organizationPhone: organization?.phoneNumber,
        organizationDialingCode,
        organizationAddress: organization?.address,
        role: isAuditor(user_type) ? user_type : 'Organization User',
        includeAssignedArea: !isAuditor(user_type),
        assignedEntityType: !isAuditor(user_type) ? invitedEntityType : null,
        assignedEntityName: !isAuditor(user_type)
          ? (validatedScopes.length > 1
              ? `${validatedScopes.length} organization areas`
              : (assignedEntity?.name || invitedEntityCode || null))
          : null,
      });
      recordResend(`verification:${email}`);
    } catch (emailErr) {
      console.error('Failed to send user invitation email:', emailErr.message);
    }

    return successResponse(res, {
      id,
      user_code: userCode,
      first_name,
      last_name,
      email,
      role,
      user_type: isAuditor(user_type) ? user_type : 'Organization User',
      scopes: validatedScopes,
    }, 'User invited. Invitation email sent.', 201);

  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) { /* transaction may already be closed */ }
    }
    console.error('Create user error:', error);
    return errorResponse(res, 'Failed to create user.', 500);
  } finally {
    if (connection) connection.release();
    if (quotaLock) await quotaLock.release();
  }
};

// ─── LIST USERS ───────────────────────────────────────────────────

/**
 * Linked company admins surfaced as read-only "Company Head" rows.
 * A Supplier linked to a Company sees that company's admin here; the company
 * itself is in `admins` (not organization_users), so we map it into the user shape.
 */
async function getLinkedCompanyHeads(accessibleCodes) {
  if (!accessibleCodes || accessibleCodes.length === 0) return [];
  const ph = accessibleCodes.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT admin_id AS id, admin_id, first_name, last_name, email, phone_number, country, entity_code, created_at
       FROM admins
      WHERE entity_type = 'Company' AND entity_code IN (${ph}) AND is_active = TRUE`,
    accessibleCodes
  );
  return rows.map((a) => ({
    id: a.id,
    user_code: a.admin_id,
    first_name: a.first_name,
    last_name: a.last_name,
    email: a.email,
    phone_number: a.phone_number || null,
    country: a.country || null,
    role: 'admin',
    user_type: 'Company Head',
    assigned_entity_type: 'Company',
    assigned_entity_code: a.entity_code,
    assigned_org_tree_id: null,
    email_verified: true,
    is_active: true,
    is_linked: true,
    created_at: a.created_at,
  }));
}

/**
 * Annotate each user with `in_use: true|false` indicating whether they're still
 * referenced by another function (so the UI can lock the delete button). Uses
 * batched IN queries — 8 queries total regardless of list size.
 */
async function annotateInUse(users) {
  const codes = users.map((u) => u.user_code).filter(Boolean);
  if (codes.length === 0) return users;
  const ph = codes.map(() => '?').join(',');

  const queries = [
    `SELECT assigned_auditor_id AS c FROM audit_assignments WHERE assigned_auditor_id IN (${ph})`,
    `SELECT auditor_id AS c FROM evaluation_assignments WHERE auditor_id IN (${ph})`,
    `SELECT auditor_id AS c FROM field_visit_assignments WHERE auditor_id IN (${ph})`,
    `SELECT auditor_id AS c FROM training_assignments WHERE auditor_id IN (${ph})`,
    `SELECT responsible_organization_user_id AS c FROM corrective_actions WHERE responsible_organization_user_id IN (${ph})`,
    `SELECT verified_by AS c FROM corrective_actions WHERE verified_by IN (${ph})`,
    `SELECT answered_by AS c FROM audit_responses WHERE answered_by IN (${ph})`,
    `SELECT responded_by AS c FROM cap_responses WHERE responded_by IN (${ph})`,
  ];

  const inUse = new Set();
  for (const sql of queries) {
    try {
      const [rows] = await db.query(sql, codes);
      for (const r of rows) if (r.c) inUse.add(r.c);
    } catch (err) {
      console.error('annotateInUse query failed:', err.message);
    }
  }

  return users.map((u) => ({ ...u, in_use: inUse.has(u.user_code) }));
}

async function attachOrganizationUserScopes(users) {
  const headIds = (users || [])
    .filter((user) => user.organization_user_id || user.role === 'organization_user')
    .map((user) => user.organization_user_id || user.user_code);
  const scopeMap = await OrganizationUserScopeModel.listByUsers(headIds);

  return (users || []).map((user) => {
    if (!user.organization_user_id && user.role !== 'organization_user') return user;
    const id = user.organization_user_id || user.user_code;
    const scopes = scopeMap.get(id) || [];
    return {
      ...user,
      user_type: 'Organization User',
      scopes,
      scope_count: scopes.length,
    };
  });
}

const listUsers = async (req, res) => {
  try {
    const userType = req.query.user_type || null;
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);

    // A Supplier (Customer account) linked to a Company sees that company's
    // admin as a read-only "Company Head".
    const includeCompanyHeads =
      req.user.accountType === 'Customer' && (!userType || userType === 'Company Head');
    const companyHeads = includeCompanyHeads ? await getLinkedCompanyHeads(accessibleCodes) : [];

    if (userType === 'Company Head') {
      return successResponse(res, { users: companyHeads });
    }

    if (userType && isAuditor(userType)) {
      const users = await AuditorModel.listByCreators(accessibleCodes);
      return successResponse(res, { users: await annotateInUse(users) });
    } else if (userType) {
      const queryType = userType === 'Organization User' ? null : userType;
      const users = await OrganizationUserModel.listByCreators(accessibleCodes, queryType);
      return successResponse(res, {
        users: await annotateInUse(await attachOrganizationUserScopes(users)),
      });
    } else {
      // No filter – list from both tables (plus any linked company organizationUsers)
      const auditors = await AuditorModel.listByCreators(accessibleCodes);
      const organizationUsers = await OrganizationUserModel.listByCreators(accessibleCodes);
      const annotated = await annotateInUse([...auditors, ...await attachOrganizationUserScopes(organizationUsers)]);
      return successResponse(res, { users: [...annotated, ...companyHeads] });
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
  let connection = null;
  try {
    const user = await findByCodeAny(req.params.userCode);
    if (!user) return errorResponse(res, 'User not found.', 404);
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(user.created_by_entity_code)) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    const Model = user._table === 'auditor' ? AuditorModel : OrganizationUserModel;
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
    if (user._table === 'organization_user' && Array.isArray(req.body.scopes)) {
      const validation = await OrganizationUserScopeModel.validateForWorkspace(req.body.scopes, {
        rootEntityCode: req.user.entityCode,
        accessibleEntityCodes: accessibleCodes,
      });
      if (!validation.ok) return errorResponse(res, validation.message, 400);

      const primaryScope = validation.scopes[0];
      connection = await db.getConnection();
      await connection.beginTransaction();
      await Model.update(user.organization_user_id, {
        ...req.body,
        assigned_entity_type: primaryScope.entity_type || null,
        assigned_entity_code: primaryScope.entity_code,
        assigned_org_tree_id: primaryScope.org_tree_id,
      }, connection);
      await OrganizationUserScopeModel.replaceForUser(
        user.organization_user_id,
        validation.scopes,
        req.user.userCode,
        connection
      );
      await connection.commit();
    } else {
      await Model.update(user.auditor_id || user.organization_user_id, req.body);
    }

    const updated = await findByCodeAny(req.params.userCode);
    return successResponse(res, { user: updated }, 'User updated.');
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) { /* transaction may already be closed */ }
    }
    console.error('Update user error:', error);
    return errorResponse(res, 'Failed to update user.', 500);
  } finally {
    if (connection) connection.release();
  }
};

// ─── DELETE USER ──────────────────────────────────────────────────

/**
 * Returns a human-readable reason if the user is still referenced by other
 * functions (assignments / submitted work), otherwise null. Used to block
 * deletion so we don't orphan rows that point at this user's code.
 */
async function getUserInUseReason(user) {
  const code = user.user_code;
  if (!code) return null;

  // Run every check for every user (an auditor will never appear in organization-user
  // columns and vice-versa, so this is safe and avoids depending on _table
  // detection). The auditor↔audit link is the first/primary check.
  const checks = [
    ['SELECT 1 FROM audit_assignments WHERE assigned_auditor_id = ? LIMIT 1',
      'assigned to one or more audits'],
    ['SELECT 1 FROM evaluation_assignments WHERE auditor_id = ? LIMIT 1',
      'assigned to one or more evaluation papers'],
    ['SELECT 1 FROM field_visit_assignments WHERE auditor_id = ? LIMIT 1',
      'assigned to one or more field visits'],
    ['SELECT 1 FROM training_assignments WHERE auditor_id = ? LIMIT 1',
      'assigned to one or more trainings'],
    ['SELECT 1 FROM corrective_actions WHERE responsible_organization_user_id = ? LIMIT 1',
      'assigned as the responsible person on one or more corrective actions'],
    ['SELECT 1 FROM corrective_actions WHERE verified_by = ? LIMIT 1',
      'the verifier on one or more corrective actions'],
    ['SELECT 1 FROM audit_responses WHERE answered_by = ? LIMIT 1',
      'has submitted audit responses'],
    ['SELECT 1 FROM cap_responses WHERE responded_by = ? LIMIT 1',
      'has submitted corrective-action responses'],
  ];

  for (const [sql, reason] of checks) {
    try {
      const [rows] = await db.query(sql, [code]);
      if (rows.length > 0) return reason;
    } catch (err) {
      // A missing column/table in a given deployment shouldn't silently skip the
      // remaining (more important) checks — log and continue.
      console.error('getUserInUseReason check failed:', sql, err.message);
    }
  }

  return null;
}

const deleteUser = async (req, res) => {
  try {
    const user = await findByCodeAny(req.params.userCode);
    if (!user) return errorResponse(res, 'User not found.', 404);
    const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
    if (!accessibleCodes.includes(user.created_by_entity_code)) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    // Block deletion while the user is still referenced by other functions,
    // otherwise those rows would point at a deleted user.
    const inUseReason = await getUserInUseReason(user);
    if (inUseReason) {
      return errorResponse(
        res,
        `This user is ${inUseReason} and cannot be removed. Reassign or remove those first.`,
        409
      );
    }

    const Model = user._table === 'auditor' ? AuditorModel : OrganizationUserModel;
    await Model.deleteById(user.auditor_id || user.organization_user_id);
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
    const cooldownSeconds = getResendCooldownSeconds(`verification:${user.email}`);
    if (cooldownSeconds > 0) {
      return errorResponse(res, `Please wait ${cooldownSeconds} second${cooldownSeconds === 1 ? '' : 's'} before resending the invitation.`, 429);
    }

    const newToken = generateEmailToken();
    const newExpires = tokenExpiry();
    const Model = user._table === 'auditor' ? AuditorModel : OrganizationUserModel;
    await Model.regenerateToken(user.auditor_id || user.organization_user_id, newToken, newExpires);

    try {
      const organization = user.created_by_entity_code
        ? await findByCodeAny(user.created_by_entity_code)
        : null;
      const assignedEntity = user._table === 'organization_user' && user.assigned_entity_code
        ? await findByCodeAny(user.assigned_entity_code)
        : null;
      const organizationDialingCode = await getCountryDialingCode(organization?.country);
      await sendUserInvitationEmail(user.email, `${user.first_name} ${user.last_name}`, newToken, {
        organizationName: organization?.name || user.created_by_entity_code || 'your organization',
        organizationEmail: organization?.email,
        organizationPhone: organization?.phone_number,
        organizationDialingCode,
        organizationAddress: organization
          ? [organization.address_line_1, organization.address_line_2, organization.address_line_3, organization.country].filter(Boolean).join(', ')
          : null,
        role: user.user_type || (user._table === 'auditor' ? 'Auditor' : 'Organization User'),
        includeAssignedArea: user._table === 'organization_user',
        assignedEntityType: user._table === 'organization_user' ? user.assigned_entity_type : null,
        assignedEntityName: user._table === 'organization_user' ? (assignedEntity?.name || user.assigned_entity_code) : null,
      });
      recordResend(`verification:${user.email}`);
    } catch (emailErr) {
      console.error('Resend email error:', emailErr.message);
      return errorResponse(res, 'Failed to send email. Please try again later.', 500);
    }

    return successResponse(res, null, 'Invitation email resent.');
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
      user = await OrganizationUserModel.findByEmailToken(token);
      Model = OrganizationUserModel;
    }
    if (!user) return errorResponse(res, 'Invalid or expired verification link.', 400);

    await Model.verifyEmail(user.auditor_id || user.organization_user_id);

    return successResponse(res, {
      user_code: user.auditor_id || user.organization_user_id,
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
    const organizationUser = await OrganizationUserModel.findByEmail(email);

    let user = null;
    let Model = null;

    // Pick the record that is verified and still needs a password
    if (auditor && auditor.email_verified && !auditor.password) {
      user = auditor;
      Model = AuditorModel;
    } else if (organizationUser && organizationUser.email_verified && !organizationUser.password) {
      user = organizationUser;
      Model = OrganizationUserModel;
    }

    // Fallback – verified record that already has a password (allow re-set)
    if (!user && auditor && auditor.email_verified) {
      user = auditor;
      Model = AuditorModel;
    } else if (!user && organizationUser && organizationUser.email_verified) {
      user = organizationUser;
      Model = OrganizationUserModel;
    }

    if (!user && (auditor || organizationUser)) return errorResponse(res, 'Please verify your email first.', 400);
    if (!user) return errorResponse(res, 'User not found.', 404);

    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);
    await Model.setPassword(user.auditor_id || user.organization_user_id, hashed);

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
  let quotaLock = null;
  let connection = null;
  try {
    const { email, user_type, assigned_entity_code, assigned_org_tree_id, scopes } = req.body;

    if (!email || !user_type) return errorResponse(res, 'Email and user_type are required.', 400);

    // Permission check
    const adminEntityType = req.user.entityType;
    let allowed = ALLOWED_USER_TYPES[adminEntityType] || [];

    if (!allowed.includes(user_type)) {
      return errorResponse(res, `You cannot create "${user_type}" users for this account type.`, 403);
    }

    if (isAuditor(user_type)) {
      quotaLock = await LimitsEnforcer.acquireQuotaLock(req.user.entityCode, 'auditor');
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
      country: admin.country || null,
      role,
      user_type,
      created_by_admin_id: req.user.userCode,
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
        auditor_id: userCode,
        user_type: user_type,
        auditor_type: effectiveAuditorType,
        assigned_entity_type: assigned_entity_code ? (req.body.assigned_entity_type || 'Branch') : null,
        assigned_entity_code: assigned_entity_code || null,
        assigned_org_tree_id: assigned_org_tree_id || null,
      });
    } else {
      const accessibleCodes = await getAccessibleEntityCodes(req.user.entityCode, req.user.entityType);
      const scopeInput = Array.isArray(scopes) ? scopes : (
        assigned_entity_code
          ? [{
              org_tree_id: assigned_org_tree_id || null,
              entity_code: assigned_entity_code,
              entity_type: req.body.assigned_entity_type || null,
              scope_mode: 'SUBTREE',
            }]
          : []
      );
      const validation = await OrganizationUserScopeModel.validateForWorkspace(scopeInput, {
        rootEntityCode: req.user.entityCode,
        accessibleEntityCodes: accessibleCodes,
      });
      if (!validation.ok) return errorResponse(res, validation.message, 400);
      const primaryScope = validation.scopes[0];

      userCode = await generateOrganizationUserCode();
      connection = await db.getConnection();
      await connection.beginTransaction();
      id = await OrganizationUserModel.createVerified({
        ...baseData,
        organization_user_id: userCode,
        user_type: 'Organization User',
        assigned_entity_type: primaryScope.entity_type || null,
        assigned_entity_code: primaryScope.entity_code,
        assigned_org_tree_id: primaryScope.org_tree_id,
      }, connection);
      await OrganizationUserScopeModel.replaceForUser(
        userCode,
        validation.scopes,
        req.user.userCode,
        connection
      );
      await connection.commit();
    }

    if (quotaLock) {
      await quotaLock.release();
      quotaLock = null;
    }

    return successResponse(res, {
      id,
      user_code: userCode,
      first_name: admin.first_name,
      last_name: admin.last_name,
      email: admin.email,
      role,
      user_type: isAuditor(user_type) ? user_type : 'Organization User',
    }, 'User created from admin account.', 201);

  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (_) { /* transaction may already be closed */ }
    }
    console.error('Create user from admin error:', error);
    return errorResponse(res, 'Failed to create user.', 500);
  } finally {
    if (connection) connection.release();
    if (quotaLock) await quotaLock.release();
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
