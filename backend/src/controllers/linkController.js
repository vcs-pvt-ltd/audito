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
const OrganizationUserModel = require('../models/OrganizationUserModel');
const OrganizationTreeModel = require('../models/OrganizationTreeModel');
const crypto = require('crypto');
const { generateLinkCode, generateOrganizationLinkId } = require('../utils/codeGenerator');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const { sendLinkRequestEmail } = require('../services/emailService');
const { db } = require('../config/db');
const LinkBillingCreditModel = require('../models/LinkBillingCreditModel');
const SubscriptionModel = require('../models/SubscriptionModel');
const {
  ORG_LEVELS,
  canCreateLink,
  isBidirectionalLink,
  isCompanySupplierLink,
  getAccountType,
  getAllowedLinkTargetTypes,
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
  const targetWorkspaceCode = link.target_workspace_code || link.target_code;
  const targetParentEdgeId = link.target_org_tree_id || null;

  if (companySupplierLink) {
    const supplierCode = link.requester_type === 'Supplier' ? link.requester_code : link.target_code;
    const companyCode = link.requester_type === 'Company' ? link.requester_code : link.target_code;

    if (action === 'accept') {
      // Only the target workspace tree shows the requester (Company).
      // The requester's tree must NOT show the target back.
      const supplierTreeEdge = await OrganizationTreeModel.findEdgeForRoot(
        supplierCode, companyCode, targetWorkspaceCode
      );
      if (!supplierTreeEdge) {
        await OrganizationTreeModel.addNode({
          parent_type: 'Supplier',
          parent_code: supplierCode,
          child_type: 'Company',
          child_code: companyCode,
          created_by: createdBy,
          root_entity_code: targetWorkspaceCode,
          parent_edge_id: targetParentEdgeId,
        });
      }

      // Remove any legacy reverse edge so the Company tree no longer shows the Supplier.
      const companyTreeEdge = await OrganizationTreeModel.findEdgeForRoot(
        companyCode, supplierCode, companyCode
      );
      if (companyTreeEdge) await OrganizationTreeModel.removeNode(companyTreeEdge.org_tree_id);
    } else if (action === 'remove') {
      const supplierTreeEdge = await OrganizationTreeModel.findEdgeForRoot(supplierCode, companyCode, targetWorkspaceCode);
      if (supplierTreeEdge) await OrganizationTreeModel.removeNode(supplierTreeEdge.org_tree_id);

      const companyTreeEdge = await OrganizationTreeModel.findEdgeForRoot(companyCode, supplierCode, companyCode);
      if (companyTreeEdge) await OrganizationTreeModel.removeNode(companyTreeEdge.org_tree_id);
    }
    return;
  }

  if (action === 'accept') {
    const existing = await OrganizationTreeModel.findEdgeForRoot(
      link.target_code, link.requester_code, targetWorkspaceCode
    );
    if (!existing) {
      await OrganizationTreeModel.addNode({
        parent_type: link.target_type,
        parent_code: link.target_code,
        child_type: link.requester_type,
        child_code: link.requester_code,
        created_by: createdBy,
        root_entity_code: targetWorkspaceCode,
        parent_edge_id: targetParentEdgeId,
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
      link.target_code, link.requester_code, targetWorkspaceCode
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
 * Body: { target_email, target_entity_type, target_entity_code, target_org_tree_id? }
 */
const createLink = async (req, res) => {
  try {
    const {
      target_email,
      target_entity_type,
      target_entity_code,
      target_org_tree_id = null,
    } = req.body;

    const missing = validateRequiredFields(req.body, ['target_email']);
    if (missing) return errorResponse(res, missing, 400);

    const requester_type = req.user.entityType;
    const requester_code = req.user.entityCode;

    if (!requester_type || !requester_code) {
      return errorResponse(res, 'Unable to determine requester entity.', 400);
    }

    const resolved = await resolveLinkTargetByEmail(requester_type, requester_code, target_email, {
      targetEntityType: target_entity_type,
      targetEntityCode: target_entity_code,
      targetOrgTreeId: target_org_tree_id,
      requireSelection: true,
    });
    if (!resolved.ok) return errorResponse(res, resolved.message, resolved.status);

    const {
      targetAdmin,
      targetType: target_type,
      targetCode: target_code,
      targetOrgTreeId,
      targetWorkspaceType,
      targetWorkspaceCode,
    } = resolved;

    // Keep the existing Company-to-Company plan feature server-enforced. Normal
    // hierarchy links (for example Company -> Supplier) are not paywalled by it.
    if (requester_type === 'Company' && target_type === 'Company') {
      const limits = await SubscriptionModel.getActiveLimits(requester_code);
      if (!limits?.company_to_company) {
        return errorResponse(res, 'Your current plan does not allow Company-to-Company links.', 403);
      }
    }

    const requester_level = ORG_LEVELS[requester_type] || 0;
    const target_level = ORG_LEVELS[target_type] || 0;

    const linkCode = await generateLinkCode();
    const organizationLinkId = await generateOrganizationLinkId();
    const verificationKey = generateVerificationKey();
    const verificationKeyHash = hashVerificationKey(verificationKey);

    // The schema keeps one directional record per entity pair. A fresh request
    // replaces a previously rejected record while pending/accepted links remain blocked.
    await LinkModel.removeRejectedLink(requester_type, requester_code, target_type, target_code);

    await LinkModel.create({
      organization_link_id: organizationLinkId,
      link_code: linkCode,
      requester_type,
      requester_code,
      requester_level,
      target_type,
      target_code,
      target_level,
      target_workspace_type: targetWorkspaceType,
      target_workspace_code: targetWorkspaceCode,
      target_org_tree_id: targetOrgTreeId,
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
      target_workspace_type: targetWorkspaceType,
      target_workspace_code: targetWorkspaceCode,
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

async function findActiveEntity(entityType, entityCode) {
  const mapping = ENTITY_TABLE_MAP[entityType];
  if (!mapping) return null;
  const [rows] = await db.query(
    `SELECT * FROM \`${mapping.table}\` WHERE \`${mapping.codeField}\` = ? AND is_active = TRUE`,
    [entityCode]
  );
  return rows[0] || null;
}

function workspaceAccountType(targetAdmin) {
  if (targetAdmin.account_type === 'Audit Firm Company') return 'Audit Firm';
  return targetAdmin.account_type;
}

async function buildPathLabel(rootEntity, edge, edgesById) {
  const names = [rootEntity.name];
  for (const edgeId of String(edge.edge_path || edge.org_tree_id).split(',')) {
    const pathEdge = edgesById.get(edgeId);
    if (!pathEdge) continue;
    const entity = await findActiveEntity(pathEdge.child_type, pathEdge.child_code);
    if (entity?.name) names.push(entity.name);
  }
  return names.join(' > ');
}

async function listEligibleWorkspaceTargets(targetAdmin, requesterType, requesterCode) {
  const requiredTargetTypes = getAllowedLinkTargetTypes(requesterType);
  if (requiredTargetTypes.length === 0) {
    return { ok: false, status: 400, message: 'Your entity type cannot create link requests.' };
  }

  const targetWorkspaceType = targetAdmin.entity_type;
  const targetWorkspaceCode = targetAdmin.entity_code;
  const rootEntity = await findActiveEntity(targetWorkspaceType, targetWorkspaceCode);
  if (!rootEntity) {
    return { ok: false, status: 404, message: 'Target workspace record was not found.' };
  }

  const rawCandidates = [];
  if (requiredTargetTypes.includes(targetWorkspaceType) && targetWorkspaceCode !== requesterCode) {
    rawCandidates.push({
      entity_type: targetWorkspaceType,
      entity_code: targetWorkspaceCode,
      target_org_tree_id: null,
      entity: rootEntity,
      path_label: rootEntity.name,
    });
  }

  const edges = await OrganizationTreeModel.getTreeDescendants(
    targetWorkspaceCode,
    [targetWorkspaceCode]
  );
  const edgesById = new Map(edges.map((edge) => [String(edge.org_tree_id), edge]));
  const ownerField = WORKSPACE_OWNER_FIELDS[workspaceAccountType(targetAdmin)] || null;

  for (const edge of edges) {
    if (!requiredTargetTypes.includes(edge.child_type) || edge.child_code === requesterCode) continue;
    const entity = await findActiveEntity(edge.child_type, edge.child_code);
    if (!entity) continue;

    // A workspace may see independently linked partner records in its tree.
    // Only locally-owned entities can be selected through that workspace email.
    if (!ownerField || String(entity[ownerField] || '') !== String(targetWorkspaceCode)) continue;

    rawCandidates.push({
      entity_type: edge.child_type,
      entity_code: edge.child_code,
      target_org_tree_id: edge.org_tree_id,
      entity,
      path_label: await buildPathLabel(rootEntity, edge, edgesById),
    });
  }

  const candidates = [];
  const seen = new Set();
  for (const candidate of rawCandidates) {
    const identity = `${candidate.entity_type}:${candidate.entity_code}:${candidate.target_org_tree_id || 'root'}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const existing = await LinkModel.findExistingActiveLinkBetween(requesterCode, candidate.entity_code);
    if (existing) continue;

    candidates.push({
      entity_type: candidate.entity_type,
      entity_code: candidate.entity_code,
      target_org_tree_id: candidate.target_org_tree_id,
      entity: formatEntitySummary(candidate.entity),
      path_label: candidate.path_label,
    });
  }

  candidates.sort((a, b) =>
    a.entity_type.localeCompare(b.entity_type) || a.path_label.localeCompare(b.path_label)
  );

  if (candidates.length === 0) {
    return {
      ok: false,
      status: 404,
      message: `This workspace has no available ${requiredTargetTypes.join(' or ')} entity placed in its hierarchy. Links must follow the hierarchy one level at a time.`,
    };
  }

  return {
    ok: true,
    targetAdmin,
    targetWorkspaceType,
    targetWorkspaceCode,
    rootEntity,
    requiredTargetTypes,
    candidates,
  };
}

async function resolveLinkTargetByEmail(
  requesterType,
  requesterCode,
  targetEmail,
  { targetEntityType, targetEntityCode, targetOrgTreeId = null, requireSelection = false } = {}
) {
  const targetAdmin = await AdminModel.findByEmail(targetEmail);
  if (!targetAdmin || !targetAdmin.is_active) {
    return { ok: false, status: 404, message: 'No active workspace found with this administrator email.' };
  }

  if (requesterCode === targetAdmin.entity_code) {
    return { ok: false, status: 400, message: 'Cannot request a link within your own workspace.' };
  }

  const workspace = await listEligibleWorkspaceTargets(targetAdmin, requesterType, requesterCode);
  if (!workspace.ok) return workspace;

  const hasSelection = Boolean(targetEntityType && targetEntityCode);
  if (!hasSelection && !requireSelection) return workspace;
  if (!hasSelection && workspace.candidates.length > 1) {
    return { ok: false, status: 400, message: 'Select the organization entity you want to link with.' };
  }

  const selected = hasSelection
    ? workspace.candidates.find((candidate) =>
        candidate.entity_type === targetEntityType
        && candidate.entity_code === targetEntityCode
        && String(candidate.target_org_tree_id || '') === String(targetOrgTreeId || '')
      )
    : workspace.candidates[0];

  if (!selected) {
    return {
      ok: false,
      status: 400,
      message: 'The selected entity is not an eligible immediate parent in this workspace hierarchy.',
    };
  }

  const linkCheck = canCreateLink(requesterType, selected.entity_type);
  if (!linkCheck.ok) return { ok: false, status: 400, message: linkCheck.reason };

  return {
    ok: true,
    targetAdmin,
    targetType: selected.entity_type,
    targetCode: selected.entity_code,
    targetOrgTreeId: selected.target_org_tree_id,
    targetWorkspaceType: workspace.targetWorkspaceType,
    targetWorkspaceCode: workspace.targetWorkspaceCode,
    summary: {
      ...selected,
      workspace: {
        entity_type: workspace.targetWorkspaceType,
        entity_code: workspace.targetWorkspaceCode,
        entity: formatEntitySummary(workspace.rootEntity),
      },
      admin: {
        first_name: targetAdmin.first_name,
        last_name: targetAdmin.last_name,
        email: targetAdmin.email,
        phone_number: targetAdmin.phone_number || null,
      },
    },
  };
}

async function isLinkTargetStillPlaced(link) {
  if (!link.target_org_tree_id) {
    return (link.target_workspace_code || link.target_code) === link.target_code;
  }

  const edge = await OrganizationTreeModel.findById(link.target_org_tree_id);
  return Boolean(
    edge
    && edge.child_type === link.target_type
    && edge.child_code === link.target_code
    && edge.root_entity_code === (link.target_workspace_code || link.target_code)
  );
}

const previewLinkTarget = async (req, res) => {
  try {
    const { target_email } = req.body;
    const missing = validateRequiredFields(req.body, ['target_email']);
    if (missing) return errorResponse(res, missing, 400);

    const resolved = await resolveLinkTargetByEmail(req.user.entityType, req.user.entityCode, target_email);
    if (!resolved.ok) return errorResponse(res, resolved.message, resolved.status);

    return successResponse(res, {
      workspace: {
        entity_type: resolved.targetWorkspaceType,
        entity_code: resolved.targetWorkspaceCode,
        entity: formatEntitySummary(resolved.rootEntity),
        admin: {
          first_name: resolved.targetAdmin.first_name,
          last_name: resolved.targetAdmin.last_name,
          email: resolved.targetAdmin.email,
          phone_number: resolved.targetAdmin.phone_number || null,
        },
      },
      required_target_types: resolved.requiredTargetTypes,
      eligible_targets: resolved.candidates,
    });
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
 * POST /api/links/:linkCode/key
 * Generate a new displayable verification key for the pending requester.
 * Plaintext keys are never stored, so opening this action safely rotates the key.
 */
const regenerateLinkVerificationKey = async (req, res) => {
  try {
    const { linkCode } = req.params;
    const link = await LinkModel.findByCode(linkCode);

    if (!link || !link.is_active) return errorResponse(res, 'Link request not found.', 404);
    if (link.requester_code !== req.user.entityCode) {
      return errorResponse(res, 'Only the requester can generate this verification key.', 403);
    }
    if (link.status !== 'pending') {
      return errorResponse(res, 'Verification keys are available only for pending link requests.', 400);
    }

    const verificationKey = generateVerificationKey();
    await LinkModel.updateVerificationKey(linkCode, hashVerificationKey(verificationKey));

    return successResponse(res, {
      link_code: linkCode,
      verification_key: verificationKey,
    }, 'A new verification key was generated.');
  } catch (error) {
    console.error('Generate link verification key error:', error);
    return errorResponse(res, 'Failed to generate verification key.', 500);
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

    // The selected entity may be a child without its own login. Its owning
    // workspace administrator is the approver recorded with the request.
    const entityCode = req.user.entityCode;
    const targetWorkspaceCode = link.target_workspace_code || link.target_code;
    if (targetWorkspaceCode !== entityCode) {
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

      if (!await isLinkTargetStillPlaced(link)) {
        return errorResponse(
          res,
          'The selected target is no longer in this workspace hierarchy. Ask the requester to create a new link request.',
          409
        );
      }
    }

    const status = action === 'accept' ? 'accepted' : 'rejected';

    if (status === 'accepted') {
      await syncLinkTreeEdges(link, entityCode, 'accept');
    }

    await LinkModel.updateStatus(linkCode, status, { markKeyVerified: action === 'accept' });

    if (status === 'accepted') {
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
    const isTarget = (link.target_workspace_code || link.target_code) === entityCode;

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
  'Audit Firm Department': { table: 'audit_firm_company_departments', codeField: 'afc_dept_code' },
};

const WORKSPACE_OWNER_FIELDS = {
  Customer: 'cust_code',
  Company: 'comp_code',
  'Audit Firm': 'afc_code',
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
    if ((link.target_workspace_code || link.target_code) === myCode) {
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
    const organizationUsers = await OrganizationUserModel.listByCreators(accountCodes);

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
      sections: [],
      branches: [],
      audit_firm_departments: [],
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
        ['sections', 'company_sections', 'comp_section_code'],
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

    if (partnerAccountType === 'Audit Firm' && ph) {
      const auditFirmStructure = [
        ['branches', 'audit_firm_company_branches', 'afc_branch_code'],
        ['audit_firm_departments', 'audit_firm_company_departments', 'afc_dept_code'],
      ];
      for (const [key, table, field] of auditFirmStructure) {
        const [rows] = await db.query(
          `SELECT \`${field}\` AS code, name FROM \`${table}\`
           WHERE is_active = TRUE AND (afc_code IN (${ph}) OR \`${field}\` IN (${ph}))
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
      users: [...auditors, ...organizationUsers],
      structure,
    });
  } catch (error) {
    console.error('Get linked entity data error:', error);
    return errorResponse(res, 'Failed to fetch linked entity data.', 500);
  }
};

module.exports = {
  createLink,
  previewLinkTarget,
  getMyLinks,
  getPendingLinks,
  regenerateLinkVerificationKey,
  respondToLink,
  removeLink,
  getLinkedEntityData,
};
