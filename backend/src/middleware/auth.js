/**
 * Authentication Middleware
 * 
 * Verifies JWT tokens and attaches user info to request.
 * Supports all roles: admin, auditor, entity_head.
 */

const jwt = require('jsonwebtoken');
const AdminModel = require('../models/AdminModel');
const AuditorModel = require('../models/AuditorModel');
const EntityHeadModel = require('../models/EntityHeadModel');
const { errorResponse } = require('../utils/helpers');

/**
 * Verify JWT token and attach user to req.user
 * Works for admin, auditor, and entity_head tokens.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const role = decoded.role || 'admin'; // backward compat for old tokens

    if (role === 'admin') {
      const adminId = decoded.userId || decoded.adminId; // backward compat
      const admin = await AdminModel.findById(adminId);
      if (!admin) return errorResponse(res, 'User not found.', 401);
      if (!admin.is_active) return errorResponse(res, 'Account is deactivated.', 403);

      req.user = {
        id:          admin.id,
        userCode:    admin.user_id,
        email:       admin.email,
        role:        'admin',
        accountType: admin.account_type,
        entityType:  admin.entity_type,
        entityCode:  admin.entity_code,
        orgLevel:    admin.org_level,
      };

    } else if (role === 'auditor') {
      const auditor = await AuditorModel.findById(decoded.userId);
      if (!auditor) return errorResponse(res, 'User not found.', 401);
      if (!auditor.is_active) return errorResponse(res, 'Account is deactivated.', 403);

      req.user = {
        id:                  auditor.id,
        userCode:            auditor.user_code,
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

    } else if (role === 'entity_head') {
      const head = await EntityHeadModel.findById(decoded.userId);
      if (!head) return errorResponse(res, 'User not found.', 401);
      if (!head.is_active) return errorResponse(res, 'Account is deactivated.', 403);

      req.user = {
        id:                  head.id,
        userCode:            head.user_code,
        email:               head.email,
        role:                'entity_head',
        userType:            head.user_type,
        accountType:         null,
        entityType:          head.assigned_entity_type || null,
        entityCode:          head.assigned_entity_code || head.created_by_entity_code,
        orgLevel:            0,
        assignedEntityType:  head.assigned_entity_type,
        assignedEntityCode:  head.assigned_entity_code,
        assignedOrgTreeId:   head.assigned_org_tree_id || null,
        createdByEntityCode: head.created_by_entity_code,
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
