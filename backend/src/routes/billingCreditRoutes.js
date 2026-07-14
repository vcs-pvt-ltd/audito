const express = require('express');
const router = express.Router();
const LinkBillingCreditModel = require('../models/LinkBillingCreditModel');
const { authenticate, authorize } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/helpers');

/**
 * GET /api/billing/credits
 * Admin — list all credits for the current organization and available balance.
 */
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const entityCode = req.user.entityCode;
    if (!entityCode) return errorResponse(res, 'No organization found.', 400);

    const credits = await LinkBillingCreditModel.listCreditsForEntity(entityCode);
    const available = await LinkBillingCreditModel.getAvailableCreditAmount(entityCode);

    return successResponse(res, {
      credits,
      available_amount: available,
    });
  } catch (error) {
    console.error('List billing credits error:', error);
    return errorResponse(res, 'Failed to fetch billing credits.', 500);
  }
});

/**
 * GET /api/billing/credits/preview/:linkCode
 * Admin — preview the credit that would be generated (or already exists) for a specific link.
 */
router.get('/preview/:linkCode', authenticate, authorize('admin'), async (req, res) => {
  try {
    const entityCode = req.user.entityCode;
    const { linkCode } = req.params;

    // Find the credit already generated for this link (if any)
    const { db } = require('../config/db');
    const [rows] = await db.query(
      `SELECT * FROM link_billing_credits
       WHERE organization_link_id = ? AND credit_for_entity_code = ?
       ORDER BY created_at DESC LIMIT 1`,
      [linkCode, entityCode]
    );

    if (rows.length > 0) {
      return successResponse(res, { credit: rows[0] });
    }

    return successResponse(res, { credit: null });
  } catch (error) {
    console.error('Preview billing credit error:', error);
    return errorResponse(res, 'Failed to preview billing credit.', 500);
  }
});

module.exports = router;
