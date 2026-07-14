/**
 * Link Controller
 *
 * Handles organization link requests between independently registered entities.
 * e.g. Supplier requests to join a Buying Office,
 *      Department requests to join a Unit/Factory/Company, etc.
 */

const LinkModel = require('../models/LinkModel');
const AdminModel = require('../models/AdminModel');
const AuditorModel = require('../models/AuditorModel');
const EntityHeadModel = require('../models/EntityHeadModel');
const OrganizationTreeModel = require('../models/OrganizationTreeModel');
const crypto = require('crypto');
const { generateLinkCode, generateOrganizationLinkId } = require('../utils/codeGenerator');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const { sendLinkRequestEmail } = require('../services/emailService');
const { db } = require('../config/db');
const LinkBillingCreditModel = require('../models/LinkBillingCreditModel');
const {
  ORG_LEVELS,
  canCreateLink,
  isValidLinkTargetType,
  isBidirectionalLink,
  isCompanySupplierLink,
  getAccountType,
} = require('../utils/linkRules');
const { getPartnerAccountCodes } = require('../utils/accessHelper');

function generateVerificationKey() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashVerificationKey(key) {
  const secret = process.env.LINK_KEY_SECRET || process.env.JWT_SECRET || 'audito-link-key';
  return crypto.createHash('sha256').update(`${secret}:${String(key).trim()}`).digest('hex');
}

function safeCompareHash(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * On accept: attach linked entities in the org tree.
 * Supplier ↔ Company: only supplier tree shows the linked company.
 * Peer Company ↔ Company: both trees show each other.
 * Other links: requester attaches under target.
 */
async function syncLinkTreeEdges(link, createdBy, action) {
  const peerLink = isBidirectionalLink(link.requester_type, link.target_type);
  const companySupplierLink = isCompanySupplierLink(link.requester_type, link.target_type);

  if (companySupplierLink) {
    const supplierCode = link.requester_type === 'Supplier' ? link.requester_code : link.target_code;
    const companyCode = link.requester_type === 'Company' ? link.requester_code : link.target_code;

    if (action === 'accept') {
      // Only the target's (Supplier) tree shows the requester (Company).
      // The requester's tree must NOT show the target back.
      const supplierTreeEdge = await OrganizationTreeModel.findEdgeForRoot(
        supplierCode, companyCode, supplierCode
      );
      if (!supplierTreeEdge) {
        await OrganizationTreeModel.addNode({
          parent_type: 'Supplier',
          parent_code: supplierCode,
          child_type: 'Company',
          child_code: companyCode,
          created_by: createdBy,
          root_entity_code: supplierCode,
        });
      }

      // Remove any legacy reverse edge so the Company tree no longer shows the Supplier.
      const companyTreeEdge = await OrganizationTreeModel.findEdgeForRoot(
        companyCode, supplierCode, companyCode
      );
      if (companyTreeEdge) await OrganizationTreeModel.removeNode(companyTreeEdge.org_tree_id);
    } else if (action === 'remove') {
      const supplierTreeEdge = await OrganizationTreeModel.findEdgeForRoot(supplierCode, companyCode, supplierCode);
      if (supplierTreeEdge) await OrganizationTreeModel.removeNode(supplierTreeEdge.org_tree_id);

      const companyTreeEdge = await OrganizationTreeModel.findEdgeForRoot(companyCode, supplierCode, companyCode);
      if (companyTreeEdge) await OrganizationTreeModel.removeNode(companyTreeEdge.org_tree_id);
    }
    return;
  }

  if (action === 'accept') {
    const existing = await OrganizationTreeModel.findEdgeForRoot(
      link.target_code, link.requester_code, link.target_code
    );
    if (!existing) {
      await OrganizationTreeModel.addNode({
        parent_type: link.target_type,
        parent_code: link.target_code,
        child_type: link.requester_type,
        child_code: link.requester_code,
        created_by: createdBy,
        root_entity_code: link.target_code,
      });
    }

    if (peerLink) {
      const reverseExisting = await OrganizationTreeModel.findEdgeForRoot(
        link.requester_code, link.target_code, link.requester_code
      );
      if (!reverseExisting) {
        await OrganizationTreeModel.addNode({
          parent_type: link.requester_type,
          parent_code: link.requester_code,
          child_type: link.target_type,
          child_code: link.target_code,
          created_by: createdBy,
          root_entity_code: link.requester_code,
        });
      }
    }
    return;
  }

  if (action === 'remove') {
    const edge = await OrganizationTreeModel.findEdgeForRoot(
      link.target_code, link.requester_code, link.target_code
    );
    if (edge) await OrganizationTreeModel.removeNode(edge.org_tree_id);

    if (peerLink) {
      const reverseEdge = await OrganizationTreeModel.findEdgeForRoot(
        link.requester_code, link.target_code, link.requester_code
      );
      if (reverseEdge) await OrganizationTreeModel.removeNode(reverseEdge.org_tree_id);
    }
  }
}

/**
 * POST /api/links
 * Create a link request from the requester to a target entity via organization email.
 * Body: { target_email }
 */
const createLink = async (req, res) => {
  try {
    const { target_email } = req.body;

    const missing = validateRequiredFields(req.body, ['target_email']);
    if (missing) return errorResponse(res, missing, 400);

    const requester_type = req.user.entityType;
    const requester_code = req.user.entityCode;

    if (!requester_type || !requester_code) {
      return errorResponse(res, 'Unable to determine requester entity.', 400);
    }

    const resolved = await resolveLinkTargetByEmail(requester_type, requester_code, target_email);
    if (!resolved.ok) return errorResponse(res, resolved.message, resolved.status);

    const { targetAdmin, targetType: target_type, targetCode: target_code } = resolved;

    const requester_level = ORG_LEVELS[requester_type] || 0;
    const target_level = ORG_LEVELS[target_type] || 0;

    const linkCode = await generateLinkCode();
    const organizationLinkId = await generateOrganizationLinkId();
    const verificationKey = generateVerificationKey();
    const verificationKeyHash = hashVerificationKey(verificationKey);

    await LinkModel.create({
      organization_link_id: organizationLinkId,
      link_code: linkCode,
      requester_type,
      requester_code,
      requester_level,
      target_type,
      target_code,
      target_level,
      verification_key_hash: verificationKeyHash,
    });

    // Send notification email to target entity's admin
    try {
      await sendLinkRequestEmail(
        targetAdmin.email,
        `${targetAdmin.first_name} ${targetAdmin.last_name}`,
        requester_type,
        requester_code,
        linkCode
      );
    } catch (emailErr) {
      console.error('Failed to send link request email:', emailErr.message);
    }

    return successResponse(res, {
      link_code: linkCode,
      requester_type,
      requester_level,
      target_type,
      target_level,
      status: 'pending',
      verification_key: verificationKey,
      target: resolved.summary,
    }, 'Link request sent.', 201);

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 'A link request already exists between these entities.', 409);
    }
    console.error('Create link error:', error);
    return errorResponse(res, 'Failed to create link request.', 500);
  }
};

/**
 * Helper to enrich link objects with entity names
 */
async function enrichLinkNames(links) {
  const enriched = [];
  for (const link of links) {
    const l = { ...link };
    
    // Resolve requester name
    const reqMapping = ENTITY_TABLE_MAP[link.requester_type];
    if (reqMapping) {
      const [rows] = await db.query(
        `SELECT * FROM \`${reqMapping.table}\` WHERE \`${reqMapping.codeField}\` = ?`,
        [link.requester_code]
      );
      const requester = rows[0] || null;
      l.requester_name = requester?.name || null;
      l.requester_email = requester?.email || null;
      l.requester_phone_number = requester?.phone_number || null;
      l.requester_address = requester
        ? [requester.address_line_1, requester.address_line_2, requester.address_line_3].filter(Boolean).join(', ') || null
        : null;
      l.requester_country = requester?.country || null;

      const requesterAdmin = await AdminModel.findByEntityCode(link.requester_code);
      l.requester_admin_name = requesterAdmin ? `${requesterAdmin.first_name} ${requesterAdmin.last_name}` : null;
      l.requester_admin_email = requesterAdmin?.email || null;
      l.requester_admin_phone_number = requesterAdmin?.phone_number || null;
    }

    // Resolve target name
    const targetMapping = ENTITY_TABLE_MAP[link.target_type];
    if (targetMapping) {
      const [rows] = await db.query(
        `SELECT name FROM \`${targetMapping.table}\` WHERE \`${targetMapping.codeField}\` = ?`,
        [link.target_code]
      );
      l.target_name = rows[0]?.name || null;
    }

    enriched.push(l);
  }
  return enriched;
}

function formatEntitySummary(row) {
  return {
    name: row.name,
    registration_number: row.registration_number || null,
    email: row.email || null,
    phone_number: row.phone_number || null,
    address: [row.address_line_1, row.address_line_2, row.address_line_3].filter(Boolean).join(', ') || null,
    country: row.country || null,
  };
}

async function resolveLinkTargetByEmail(requesterType, requesterCode, targetEmail) {
  const targetAdmin = await AdminModel.findByEmail(targetEmail);
  if (!targetAdmin || !targetAdmin.is_active) {
    return { ok: false, status: 404, message: 'No active organization found with this email.' };
  }

  const targetType = targetAdmin.entity_type;
  if (!isValidLinkTargetType(targetType)) {
    return { ok: false, status: 400, message: 'This organization type cannot receive link requests.' };
  }

  const targetCode = targetAdmin.entity_code;
  if (requesterCode === targetCode) {
    return { ok: false, status: 400, message: 'Cannot link to yourself.' };
  }

  const linkCheck = canCreateLink(requesterType, targetType);
  if (!linkCheck.ok) {
    return { ok: false, status: 400, message: linkCheck.reason };
  }

  const existing = await LinkModel.findExistingActiveLinkBetween(requesterCode, targetCode);
  if (existing) {
    return { ok: false, status: 409, message: 'A pending or accepted link already exists with this organization.' };
  }

  const mapping = ENTITY_TABLE_MAP[targetType];
  if (!mapping) return { ok: false, status: 400, message: 'Unknown target organization type.' };

  const [entityRows] = await db.query(
    `SELECT * FROM \`${mapping.table}\` WHERE \`${mapping.codeField}\` = ? AND is_active = TRUE`,
    [targetCode]
  );
  const entity = entityRows[0] || null;
  if (!entity) return { ok: false, status: 404, message: 'Target organization record was not found.' };

  return {
    ok: true,
    targetAdmin,
    targetType,
    targetCode,
    entity,
    summary: {
      entity_type: targetType,
      entity_code: targetCode,
      entity: formatEntitySummary(entity),
      admin: {
        first_name: targetAdmin.first_name,
        last_name: targetAdmin.last_name,
        email: targetAdmin.email,
        phone_number: targetAdmin.phone_number || null,
      },
    },
  };
}

const previewLinkTarget = async (req, res) => {
  try {
    const { target_email } = req.body;
    const missing = validateRequiredFields(req.body, ['target_email']);
    if (missing) return errorResponse(res, missing, 400);

    const resolved = await resolveLinkTargetByEmail(req.user.entityType, req.user.entityCode, target_email);
    if (!resolved.ok) return errorResponse(res, resolved.message, resolved.status);

    return successResponse(res, resolved.summary);
  } catch (error) {
    console.error('Preview link target error:', error);
    return errorResponse(res, 'Failed to verify target organization.', 500);
  }
};

/**
 * GET /api/links
 * Get all links for the current user's entity.
 */
const getMyLinks = async (req, res) => {
  try {
    const entityCode = req.user.entityCode;
    const entityType = req.user.entityType;
    if (!entityCode) return errorResponse(res, 'Entity code not found.', 400);

    const links = await LinkModel.getLinksForEntity(entityType, entityCode);
    const enriched = await enrichLinkNames(links);
    return successResponse(res, { links: enriched });
  } catch (error) {
    console.error('Get links error:', error);
    return errorResponse(res, 'Failed to fetch links.', 500);
  }
};

/**
 * GET /api/links/pending
 * Get pending link requests targeting the current user's entity.
 */
const getPendingLinks = async (req, res) => {
  try {
    const entityCode = req.user.entityCode;
    const entityType = req.user.entityType;
    if (!entityCode) return errorResponse(res, 'Entity code not found.', 400);

    const links = await LinkModel.getPendingRequests(entityType, entityCode);
    const enriched = await enrichLinkNames(links);
    return successResponse(res, { links: enriched });
  } catch (error) {
    console.error('Get pending links error:', error);
    return errorResponse(res, 'Failed to fetch pending links.', 500);
  }
};

/**
 * PUT /api/links/:linkCode/respond
 * Accept or reject a link request.
 * Body: { action: 'accept' | 'reject', verification_key?: '123456' }
 */
const respondToLink = async (req, res) => {
  try {
    const { linkCode } = req.params;
    const { action, verification_key } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return errorResponse(res, 'Action must be "accept" or "reject".', 400);
    }

    const link = await LinkModel.findByCode(linkCode);
    if (!link) return errorResponse(res, 'Link not found.', 404);
    if (link.status !== 'pending') return errorResponse(res, 'Link already responded to.', 400);

    // Only the target entity's admin can respond
    const entityCode = req.user.entityCode;
    if (link.target_code !== entityCode) {
      return errorResponse(res, 'Not authorized to respond to this link.', 403);
    }

    if (action === 'accept') {
      const key = String(verification_key || '').trim();
      if (!/^\d{6}$/.test(key)) {
        return errorResponse(res, 'Enter the 6-digit verification key to accept this request.', 400);
      }
      const submittedHash = hashVerificationKey(key);
      if (!safeCompareHash(link.verification_key_hash, submittedHash)) {
        return errorResponse(res, 'Invalid verification key.', 403);
      }
    }

    const status = action === 'accept' ? 'accepted' : 'rejected';
    await LinkModel.updateStatus(linkCode, status, { markKeyVerified: action === 'accept' });

    if (status === 'accepted') {
      try {
        await syncLinkTreeEdges(link, entityCode, 'accept');
      } catch (treeErr) {
        console.error('Failed to merge tree on link accept:', treeErr.message);
      }

      // Generate billing credit for Elite-to-Elite links
      try {
        const credit = await LinkBillingCreditModel.generateCreditOnAccept(link);
        if (credit) {
          console.log(`Generated billing credit ${credit.link_billing_credit_id} for ${credit.credit_for_entity_code}: $${credit.credit_amount}`);
        }
      } catch (creditErr) {
        console.error('Failed to generate link billing credit:', creditErr.message);
      }
    }

    return successResponse(res, { link_code: linkCode, status }, `Link ${status}.`);
  } catch (error) {
    console.error('Respond to link error:', error);
    return errorResponse(res, 'Failed to respond to link.', 500);
  }
};

/**
 * DELETE /api/links/:linkCode
 * Remove/cancel a link.
 */
const removeLink = async (req, res) => {
  try {
    const { linkCode } = req.params;

    const link = await LinkModel.findByCode(linkCode);
    if (!link) return errorResponse(res, 'Link not found.', 404);

    const entityCode = req.user.entityCode;
    const isRequester = link.requester_code === entityCode;
    const isTarget = link.target_code === entityCode;

    if (!isRequester && !isTarget) {
      return errorResponse(res, 'Not authorized.', 403);
    }

    // Requester may only cancel their own pending request
    if (isRequester && link.status !== 'pending') {
      return errorResponse(res, 'Only the target entity can remove an accepted link.', 403);
    }

    // Target may remove at any non-rejected status (pending or accepted)

    if (link.status === 'accepted') {
      try {
        await syncLinkTreeEdges(link, entityCode, 'remove');
      } catch (treeErr) {
        console.error('Failed to remove tree edge on link remove:', treeErr.message);
      }

      // Reverse any billing credits associated with this link
      try {
        const reversed = await LinkBillingCreditModel.reverseCreditsForLink(link.link_code, link.organization_link_id);
        if (reversed) console.log(`Reversed ${reversed} billing credit(s) for link ${link.link_code}`);
      } catch (creditErr) {
        console.error('Failed to reverse link billing credits:', creditErr.message);
      }
    }

    await LinkModel.remove(linkCode);
    return successResponse(res, null, 'Link removed.');
  } catch (error) {
    console.error('Remove link error:', error);
    return errorResponse(res, 'Failed to remove link.', 500);
  }
};

// ─── Entity type → table + code field mapping ────────────────────

const ENTITY_TABLE_MAP = {
  'Customer': { table: 'customers', codeField: 'cust_code' },
  'Buying Office': { table: 'customer_buying_offices', codeField: 'cbo_code' },
  'Supplier': { table: 'customer_suppliers', codeField: 'csup_code' },
  'Company': { table: 'companies', codeField: 'comp_code' },
  'Cluster': { table: 'company_clusters', codeField: 'comp_clus_code' },
  'Factory': { table: 'company_factories', codeField: 'comp_fact_code' },
  'Unit': { table: 'company_units', codeField: 'comp_unit_code' },
  'Department': { table: 'company_departments', codeField: 'comp_dept_code' },
  'Section': { table: 'company_sections', codeField: 'comp_section_code' },
  'Audit Firm Company': { table: 'audit_firm_companies', codeField: 'afc_code' },
  'Branch': { table: 'audit_firm_company_branches', codeField: 'afc_branch_code' },
};

/**
 * GET /api/links/:linkCode/data
 * Get the linked entity's full data (entity info, admin, users).
 * Only available for accepted links. The target (upper level) sees the requester's data.
 */
const getLinkedEntityData = async (req, res) => {
  try {
    const { linkCode } = req.params;
    const myCode = req.user.entityCode;

    const link = await LinkModel.findByCode(linkCode);
    if (!link) return errorResponse(res, 'Link not found.', 404);
    if (link.status !== 'accepted') return errorResponse(res, 'Link is not accepted.', 400);
    if (link.requester_code === myCode) {
      return errorResponse(res, 'Requester cannot view target organization data.', 403);
    }

    // Determine which side the caller is on, and show the OTHER side's data
    let linkedEntityType, linkedEntityCode;
    if (link.target_code === myCode) {
      // I'm the target (upper) → show requester's (lower) data
      linkedEntityType = link.requester_type;
      linkedEntityCode = link.requester_code;
    } else if (link.requester_code === myCode) {
      // I'm the requester (lower) → show target's (upper) data
      linkedEntityType = link.target_type;
      linkedEntityCode = link.target_code;
    } else {
      return errorResponse(res, 'Not authorized.', 403);
    }

    // 1. Fetch entity record from the correct table
    const mapping = ENTITY_TABLE_MAP[linkedEntityType];
    if (!mapping) return errorResponse(res, 'Unknown entity type.', 400);

    const [entityRows] = await db.query(
      `SELECT * FROM \`${mapping.table}\` WHERE \`${mapping.codeField}\` = ? AND is_active = TRUE`,
      [linkedEntityCode]
    );
    const entity = entityRows[0] || null;

    const accountCodes = await getPartnerAccountCodes(linkedEntityType, linkedEntityCode);

    // 2. Fetch admin of the linked root entity
    const admin = await AdminModel.findByEntityCode(linkedEntityCode);

    // 3. All users across the partner account
    const auditors = await AuditorModel.listByCreators(accountCodes);
    const heads = await EntityHeadModel.listByCreators(accountCodes);

    const formatEntity = (row) => ({
      name: row.name,
      registration_number: row.registration_number,
      email: row.email,
      phone_number: row.phone_number,
      address: [row.address_line_1, row.address_line_2, row.address_line_3]
        .filter(Boolean)
        .join(', ') || null,
      country: row.country,
    });

    const structure = {
      buying_offices: [],
      suppliers: [],
      clusters: [],
      factories: [],
      units: [],
      departments: [],
    };

    const ph = accountCodes.map(() => '?').join(',');
    const partnerAccountType = getAccountType(linkedEntityType);

    if (partnerAccountType === 'Customer' && ph) {
      const [bos] = await db.query(
        `SELECT cbo_code AS code, name FROM customer_buying_offices
         WHERE is_active = TRUE AND (cbo_code IN (${ph}) OR cust_code IN (${ph}))
         ORDER BY name`,
        [...accountCodes, ...accountCodes]
      );
      structure.buying_offices = bos;

      const [sups] = await db.query(
        `SELECT csup_code AS code, name FROM customer_suppliers
         WHERE is_active = TRUE AND (csup_code IN (${ph}) OR cust_code IN (${ph}))
         ORDER BY name`,
        [...accountCodes, ...accountCodes]
      );
      structure.suppliers = sups;
    }

    if (partnerAccountType === 'Company' && ph) {
      const companyStructure = [
        ['clusters', 'company_clusters', 'comp_clus_code'],
        ['factories', 'company_factories', 'comp_fact_code'],
        ['units', 'company_units', 'comp_unit_code'],
        ['departments', 'company_departments', 'comp_dept_code'],
      ];
      for (const [key, table, field] of companyStructure) {
        const [rows] = await db.query(
          `SELECT \`${field}\` AS code, name FROM \`${table}\`
           WHERE is_active = TRUE AND (comp_code IN (${ph}) OR \`${field}\` IN (${ph}))
           ORDER BY name`,
          [...accountCodes, ...accountCodes]
        );
        structure[key] = rows;
      }
    }

    return successResponse(res, {
      link_code: link.link_code,
      entity_type: linkedEntityType,
      entity_code: linkedEntityCode,
      account_codes: accountCodes,
      entity: entity ? formatEntity(entity) : null,
      admin: admin ? {
        first_name: admin.first_name,
        last_name: admin.last_name,
        email: admin.email,
        phone_number: admin.phone_number,
      } : null,
      users: [...auditors, ...heads],
      structure,
    });
  } catch (error) {
    console.error('Get linked entity data error:', error);
    return errorResponse(res, 'Failed to fetch linked entity data.', 500);
  }
};

module.exports = { createLink, previewLinkTarget, getMyLinks, getPendingLinks, respondToLink, removeLink, getLinkedEntityData };
