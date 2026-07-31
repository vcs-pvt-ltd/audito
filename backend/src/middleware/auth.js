/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens and attaches user info to request.
 * Supports all roles: admin, auditor, organization_user.
 */

const jwt = require('jsonwebtoken');
const AdminModel = require('../models/AdminModel');
const AuditorModel = require('../models/AuditorModel');
const OrganizationUserModel = require('../models/OrganizationUserModel');
const { errorResponse } = require('../utils/helpers');

/**
 * Verify JWT token and attach user to req.user
 * Works for admin, auditor, and organization_user tokens.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const tokenRole = decoded.role || 'admin';
    // Keep sessions issued before the terminology migration valid until expiry.
    const role = tokenRole === 'entity_head' ? 'organization_user' : tokenRole;

    if (role === 'admin' || role === 'audito_admin') {
      const adminId = decoded.userId || decoded.adminId; // backward compat
      const admin = await AdminModel.findById(adminId);
      if (!admin) return errorResponse(res, 'User not found.', 401);
      if (!admin.is_active) return errorResponse(res, 'Account is deactivated.', 403);

      // Use the role from the JWT token (preserves audito_admin)
      const resolvedRole = admin.role || role;

      req.user = {
        id:          admin.id,
        userCode:    admin.admin_id,
        email:       admin.email,
        role:        resolvedRole,
        accountType: admin.account_type,
        entityType:  admin.entity_type || null,
        entityCode:  admin.entity_code || null,
        orgLevel:    admin.org_level || 0,
      };

    } else if (role === 'auditor') {
      const auditor = await AuditorModel.findById(decoded.userId);
      if (!auditor) return errorResponse(res, 'User not found.', 401);
      if (!auditor.is_active) return errorResponse(res, 'Account is deactivated.', 403);

      req.user = {
        id:                  auditor.id,
        userCode:            auditor.auditor_id,
        email:               auditor.email,
        role:                'auditor',
        userType:            auditor.user_type,
        accountType:         null,
        entityType:          auditor.assigned_entity_type || null,
        entityCode:          auditor.created_by_entity_code,
        orgLevel:            0,
        assignedEntityType:  auditor.assigned_entity_type,
        assignedEntityCode:  auditor.assigned_entity_code,
        createdByEntityCode: auditor.created_by_entity_code,
      };

    } else if (role === 'organization_user') {
      const organizationUser = await OrganizationUserModel.findById(decoded.userId);
      if (!organizationUser) return errorResponse(res, 'User not found.', 401);
      if (!organizationUser.is_active) return errorResponse(res, 'Account is deactivated.', 403);

      req.user = {
        id:                  organizationUser.id,
        userCode:            organizationUser.organization_user_id,
        email:               organizationUser.email,
        role:                'organization_user',
        userType:            organizationUser.user_type,
        accountType:         null,
        entityType:          organizationUser.assigned_entity_type || null,
        entityCode:          organizationUser.assigned_entity_code || organizationUser.created_by_entity_code,
        orgLevel:            0,
        assignedEntityType:  organizationUser.assigned_entity_type,
        assignedEntityCode:  organizationUser.assigned_entity_code,
        assignedOrgTreeId:   organizationUser.assigned_org_tree_id || null,
        createdByEntityCode: organizationUser.created_by_entity_code,
      };

    } else {
      return errorResponse(res, 'Invalid token role.', 401);
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token has expired.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token.', 401);
    }
    return errorResponse(res, 'Authentication failed.', 500);
  }
};

/**
 * Authorize by role(s)
 * Usage: authorize('admin', 'auditor')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Insufficient permissions.', 403);
    }

    next();
  };
};

module.exports = { authenticate, authorize };
