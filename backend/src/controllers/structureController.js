/**
 * Hierarchy Controller
 *
 * Allows logged-in admins to create and manage entities within
 * their organization.  Entities are created independently (no
 * parent codes) — the tree structure is managed separately via
 * the Organization Tree API.
 *
 * Customer admin can create:
 *   Buying Office -> customer_buying_offices
 *   Company       -> companies
 *   Cluster       -> company_clusters
 *   Factory       -> company_factories
 *   Unit          -> company_units
 *   Department    -> company_departments
 *
 * Company admin can create:
 *   Cluster    -> company_clusters
 *   Factory    -> company_factories
 *   Unit       -> company_units
 *   Department -> company_departments
 *
 * Audit Firm admin can create:
 *   (no sub-entities — Audit Firm is a flat entity)
 */

const CustomerModel = require('../models/CustomerModel');
const CompanyModel = require('../models/CompanyModel');
const AuditFirmModel = require('../models/AuditFirmModel');
const { db } = require('../config/db');
const LinkModel = require('../models/LinkModel');
const {
  generateCboCode,
  generateSupplierCode,
  generateCompClusCode,
  generateCompFactCode,
  generateCompUnitCode,
  generateCompDeptCode,
  generateCompSectionCode,
  generateAfcBranchCode,
  generateAfcDeptCode
} = require('../utils/codeGenerator');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const { getAccessibleEntityCodes } = require('../utils/accessHelper');
const LimitsEnforcer = require('../utils/limitsEnforcer');
const { findDuplicateName } = require('../utils/nameNormalizer');

// Sub-entity types allowed per account type
const ALLOWED_TYPES = {
  'Customer': ['Buying Office', 'Supplier'],
  'Company': ['Cluster', 'Factory', 'Unit', 'Department', 'Section'],
  'Audit Firm': ['Branch', 'Audit Firm Department']
};

// URL entity-type param → { table, codeField } for merge queries
const ENTITY_TYPE_TABLE_MAP = {
  'buying-office': { table: 'customer_buying_offices', codeField: 'cbo_code' },
  'supplier': { table: 'customer_suppliers', codeField: 'csup_code' },
  'company': { table: 'companies', codeField: 'comp_code' },
  'cluster': { table: 'company_clusters', codeField: 'comp_clus_code' },
  'factory': { table: 'company_factories', codeField: 'comp_fact_code' },
  'unit': { table: 'company_units', codeField: 'comp_unit_code' },
  'department': { table: 'company_departments', codeField: 'comp_dept_code' },
  'section': { table: 'company_sections', codeField: 'comp_section_code' },
  'branch': { table: 'audit_firm_company_branches', codeField: 'afc_branch_code' },
  'audit-firm-department': { table: 'audit_firm_company_departments', codeField: 'afc_dept_code' }
};

// Display name -> slug mapping
const DISPLAY_TO_SLUG = {
  'Buying Office': 'buying-office',
  'Supplier': 'supplier',
  'Company': 'company',
  'Cluster': 'cluster',
  'Factory': 'factory',
  'Unit': 'unit',
  'Department': 'department',
  'Section': 'section',
  'Branch': 'branch',
  'Audit Firm Department': 'audit-firm-department'
};

// Account type → the owner column that type uses when creating sub-entities
const PARTNER_ACCOUNT_OWNER_FIELD = {
  Customer: 'cust_code',
  'Buying Office': 'cust_code',
  Supplier: 'cust_code',
  Company: 'comp_code',
  'Audit Firm': 'afc_code',
  'Audit Firm Company': 'afc_code',
};

const COMPANY_STRUCTURE_ENTITY_TYPES = ['cluster', 'factory', 'unit', 'department', 'section'];

// Entity type (URL param) → which owner columns exist in that table
const ENTITY_TYPE_OWNER_FIELDS = {
  'buying-office': ['cust_code'],
  'supplier': ['cust_code'],
  'company': ['cust_code'],
  'cluster': ['cust_code', 'comp_code'],
  'factory': ['cust_code', 'comp_code'],
  'unit': ['cust_code', 'comp_code'],
  'department': ['cust_code', 'comp_code'],
  'section': ['cust_code', 'comp_code'],
  'branch': ['afc_code'],
  'audit-firm-department': ['afc_code']
};

// Resolve which owner column to scope a name-uniqueness check by, given the
// admin's account type and the entity-type slug (e.g. 'section', 'cluster').
function resolveOwnerField(accountType, slug) {
  const validOwnerFields = ENTITY_TYPE_OWNER_FIELDS[slug] || [];
  if (accountType === 'Company' && validOwnerFields.includes('comp_code')) return 'comp_code';
  if (accountType === 'Customer' && validOwnerFields.includes('cust_code')) return 'cust_code';
  if (validOwnerFields.length > 0) return validOwnerFields[0];
  return null;
}

// --- CREATE SUB-ENTITY ---

/**
 * POST /api/hierarchy
 *
 * Creates an entity inside the logged-in admin's organization.
 * Entities are created independently — no parent_code needed.
 * Tree relationships are managed via /api/org-tree.
 *
 * Required: entity_type, name
 * Optional: registration_number, email, phone_number, address, country
 */
const createSubEntity = async (req, res) => {
  try {
    const {
      entity_type,
      name,
      registration_number,
      email,
      phone_number,
      address_line_1,
      address_line_2,
      address_line_3,
      country
    } = req.body;

    const missing = validateRequiredFields(req.body, ['entity_type', 'name', 'email']);
    if (missing) return errorResponse(res, missing, 400);

    const accountType = req.user.accountType === 'Audit Firm Company' ? 'Audit Firm' : req.user.accountType;
    const adminCode = req.user.entityCode;

    const allowed = ALLOWED_TYPES[accountType] || [];

    if (!allowed.includes(entity_type)) {
      return errorResponse(
        res,
        `"${entity_type}" is not valid for account type "${accountType}".`,
        400
      );
    }

    // --- Subscription Plan Limits Verification ---
    const limitError = await LimitsEnforcer.checkStructureLimits(adminCode, entity_type);
    if (limitError) {
      return errorResponse(res, limitError, 403);
    }

    // --- Uniqueness check: prevent duplicate names within the same owner (company/customer/firm)
    // Names are compared case-, space-, and leading-zero-insensitively, so
    // "Section 01", "section01", "Section 1", "section1" etc. are all treated
    // as the same name and blocked as duplicates.
    try {
      const slug = DISPLAY_TO_SLUG[entity_type];
      const typeConfig = slug ? ENTITY_TYPE_TABLE_MAP[slug] : null;
      if (typeConfig) {
        const ownerField = resolveOwnerField(accountType, slug);

        if (ownerField) {
          const dup = await findDuplicateName({
            db,
            table: typeConfig.table,
            nameColumn: 'name',
            name,
            whereClauses: [`\`${ownerField}\` = ?`, 'is_active = TRUE'],
            whereParams: [adminCode]
          });
          if (dup) {
            return errorResponse(res, `An entity named "${dup.name}" already exists in your organization. Names that only differ by capitalization, spacing, or leading zeros are considered duplicates.`, 409);
          }
        }
      }
    } catch (uniqErr) {
      console.error('Structure uniqueness check failed:', uniqErr);
      // proceed — uniqueness check is best-effort but errors should not block normal flow
    }

    const common = {
      name,
      registration_number: registration_number || null,
      email: String(email).trim(),
      address_line_1: address_line_1 || null,
      address_line_2: address_line_2 || null,
      address_line_3: address_line_3 || null,
      country: country || null,
      phone_number: phone_number || null
    };
    let created, entityCode;

    // --- Customer sub-entities ---
    if (accountType === 'Customer') {

      if (entity_type === 'Buying Office') {
        entityCode = await generateCboCode();
        await CustomerModel.createBuyingOffice({ ...common, cust_code: adminCode, cbo_code: entityCode });
        created = await CustomerModel.findBuyingOfficeByCode(entityCode);

      } else if (entity_type === 'Supplier') {
        entityCode = await generateSupplierCode();
        await CustomerModel.createSupplier({ ...common, cust_code: adminCode, csup_code: entityCode });
        created = await CustomerModel.findSupplierByCode(entityCode);
      }

      // --- Company sub-entities ---
    } else if (accountType === 'Company') {

      if (entity_type === 'Cluster') {
        entityCode = await generateCompClusCode();
        await CompanyModel.createCluster({ ...common, comp_code: adminCode, comp_clus_code: entityCode });
        created = await CompanyModel.findClusterByCode(entityCode);

      } else if (entity_type === 'Factory') {
        entityCode = await generateCompFactCode();
        await CompanyModel.createFactory({ ...common, comp_code: adminCode, comp_clus_code: null, comp_fact_code: entityCode });
        created = await CompanyModel.findFactoryByCode(entityCode);

      } else if (entity_type === 'Unit') {
        entityCode = await generateCompUnitCode();
        await CompanyModel.createUnit({ ...common, comp_code: adminCode, comp_clus_code: null, comp_fact_code: null, comp_unit_code: entityCode });
        created = await CompanyModel.findUnitByCode(entityCode);

      } else if (entity_type === 'Department') {
        entityCode = await generateCompDeptCode();
        await CompanyModel.createDepartment({ ...common, comp_code: adminCode, comp_clus_code: null, comp_fact_code: null, comp_unit_code: null, comp_dept_code: entityCode });
        created = await CompanyModel.findDepartmentByCode(entityCode);
      } else if (entity_type === 'Section') {
        entityCode = await generateCompSectionCode();
        await CompanyModel.createSection({ ...common, comp_code: adminCode, comp_dept_code: null, comp_section_code: entityCode });
        created = await CompanyModel.findSectionByCode(entityCode);
      }

      // --- Audit Firm Company sub-entities ---
    } else if (accountType === 'Audit Firm') {

      if (entity_type === 'Branch') {
        entityCode = await generateAfcBranchCode();
        await AuditFirmModel.createBranch({ ...common, afc_code: adminCode, afc_branch_code: entityCode });
        created = await AuditFirmModel.findBranchByCode(entityCode);
      } else if (entity_type === 'Audit Firm Department') {
        entityCode = await generateAfcDeptCode();
        await AuditFirmModel.createDepartment({ ...common, afc_code: adminCode, afc_branch_code: null, afc_dept_code: entityCode });
        created = await AuditFirmModel.findDepartmentByCode(entityCode);
      }
    }

    if (!created) return errorResponse(res, 'Failed to create entity.', 500);

    return successResponse(res, { entity_type, ...created }, `${entity_type} "${name}" created successfully.`, 201);

  } catch (error) {
    console.error('Create sub-entity error:', error);
    return errorResponse(res, 'Failed to create entity.', 500);
  }
};

// --- UPDATE SUB-ENTITY ---

/**
 * PUT /api/hierarchy/:entityType/:code
 */
const updateSubEntity = async (req, res) => {
  try {
    const { entityType, code } = req.params;
    const accountType = req.user.accountType === 'Audit Firm Company' ? 'Audit Firm' : req.user.accountType;
    const adminCode = req.user.entityCode;
    const accessibleCodes = await getAccessibleEntityCodes(adminCode, req.user.entityType);
    let updated = false;

    if (Object.prototype.hasOwnProperty.call(req.body, 'email') && !String(req.body.email || '').trim()) {
      return errorResponse(res, 'Email is required.', 400);
    }

    // --- Uniqueness check: block renaming to a duplicate name within the same owner ---
    // Same normalized-match rule as create: case, spacing, and leading zeros are ignored.
    if (Object.prototype.hasOwnProperty.call(req.body, 'name') && String(req.body.name || '').trim()) {
      try {
        const typeConfig = ENTITY_TYPE_TABLE_MAP[entityType];
        const ownerField = resolveOwnerField(accountType, entityType);
        if (typeConfig && ownerField) {
          const dup = await findDuplicateName({
            db,
            table: typeConfig.table,
            nameColumn: 'name',
            name: req.body.name,
            whereClauses: [`\`${ownerField}\` = ?`, 'is_active = TRUE'],
            whereParams: [adminCode],
            idColumn: typeConfig.codeField,
            excludeId: code
          });
          if (dup) {
            return errorResponse(res, `An entity named "${dup.name}" already exists in your organization. Names that only differ by capitalization, spacing, or leading zeros are considered duplicates.`, 409);
          }
        }
      } catch (uniqErr) {
        console.error('Structure update uniqueness check failed:', uniqErr);
      }
    }

    if (accountType === 'Customer') {
      if (entityType === 'buying-office') {
        const bo = await CustomerModel.findBuyingOfficeByCode(code);
        if (!bo || (bo.cust_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Buying Office not found.', 404);
        updated = await CustomerModel.updateBuyingOffice(code, req.body);
      } else if (entityType === 'supplier') {
        const s = await CustomerModel.findSupplierByCode(code);
        if (!s || (s.cust_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Supplier not found.', 404);
        updated = await CustomerModel.updateSupplier(code, req.body);
      } else {
        return errorResponse(res, 'Invalid entityType for Customer.', 400);
      }

    } else if (accountType === 'Company') {
      if (entityType === 'cluster') {
        const c = await CompanyModel.findClusterByCode(code);
        if (!c || (c.comp_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Cluster not found.', 404);
        updated = await CompanyModel.updateCluster(code, req.body);
      } else if (entityType === 'factory') {
        const f = await CompanyModel.findFactoryByCode(code);
        if (!f || (f.comp_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Factory not found.', 404);
        updated = await CompanyModel.updateFactory(code, req.body);
      } else if (entityType === 'unit') {
        const u = await CompanyModel.findUnitByCode(code);
        if (!u || (u.comp_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Unit not found.', 404);
        updated = await CompanyModel.updateUnit(code, req.body);
      } else if (entityType === 'department') {
        const d = await CompanyModel.findDepartmentByCode(code);
        if (!d || (d.comp_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Department not found.', 404);
        updated = await CompanyModel.updateDepartment(code, req.body);
      } else if (entityType === 'section') {
        const s = await CompanyModel.findSectionByCode(code);
        if (!s || (s.comp_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Section not found.', 404);
        updated = await CompanyModel.updateSection(code, req.body);
      } else {
        return errorResponse(res, 'Invalid entityType for Company.', 400);
      }

    } else if (accountType === 'Audit Firm') {
      if (entityType === 'branch') {
        const b = await AuditFirmModel.findBranchByCode(code);
        if (!b || (b.afc_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Branch not found.', 404);
        updated = await AuditFirmModel.updateBranch(code, req.body);
      } else if (entityType === 'audit-firm-department') {
        const d = await AuditFirmModel.findDepartmentByCode(code);
        if (!d || (d.afc_code !== adminCode && !accessibleCodes.includes(code))) return errorResponse(res, 'Department not found.', 404);
        updated = await AuditFirmModel.updateDepartment(code, req.body);
      } else {
        return errorResponse(res, 'Invalid entityType for Audit Firm.', 400);
      }
    }

    if (!updated) return errorResponse(res, 'Nothing to update.', 400);
    return successResponse(res, null, 'Updated successfully.');

  } catch (error) {
    console.error('Update sub-entity error:', error);
    return errorResponse(res, 'Failed to update.', 500);
  }
};

// --- DEACTIVATE SUB-ENTITY ---

/**
 * DELETE /api/hierarchy/:entityType/:code
 */
const deleteSubEntity = async (req, res) => {
  try {
    const { entityType, code } = req.params;
    const accountType = req.user.accountType === 'Audit Firm Company' ? 'Audit Firm' : req.user.accountType;
    const adminCode = req.user.entityCode;
    const accessibleCodes = await getAccessibleEntityCodes(adminCode, req.user.entityType);
 
    // Prevent deactivation if the entity is mapped in the organization tree
    const [treeUsage] = await db.query(
      'SELECT id FROM organization_tree WHERE (parent_code = ? OR child_code = ?) AND is_active = TRUE LIMIT 1',
      [code, code]
    );
    if (treeUsage.length > 0) {
      return errorResponse(res, 'This entity is currently mapped in the organization tree and cannot be deleted.', 403);
    }
 
    if (accountType === 'Customer') {
      if (entityType === 'buying-office') {
        const bo = await CustomerModel.findBuyingOfficeByCode(code);
        if (!bo) return errorResponse(res, 'Buying Office not found.', 404);
        if (bo.cust_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await CustomerModel.deactivateBuyingOffice(code);
      } else if (entityType === 'supplier') {
        const s = await CustomerModel.findSupplierByCode(code);
        if (!s) return errorResponse(res, 'Supplier not found.', 404);
        if (s.cust_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await CustomerModel.deactivateSupplier(code);
      } else {
        return errorResponse(res, 'Invalid entityType for Customer.', 400);
      }

    } else if (accountType === 'Company') {
      if (entityType === 'cluster') {
        const c = await CompanyModel.findClusterByCode(code);
        if (!c) return errorResponse(res, 'Cluster not found.', 404);
        if (c.comp_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await CompanyModel.deactivateCluster(code);
      } else if (entityType === 'factory') {
        const f = await CompanyModel.findFactoryByCode(code);
        if (!f) return errorResponse(res, 'Factory not found.', 404);
        if (f.comp_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await CompanyModel.deactivateFactory(code);
      } else if (entityType === 'unit') {
        const u = await CompanyModel.findUnitByCode(code);
        if (!u) return errorResponse(res, 'Unit not found.', 404);
        if (u.comp_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await CompanyModel.deactivateUnit(code);
      } else if (entityType === 'department') {
        const d = await CompanyModel.findDepartmentByCode(code);
        if (!d) return errorResponse(res, 'Department not found.', 404);
        if (d.comp_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await CompanyModel.deactivateDepartment(code);
      } else if (entityType === 'section') {
        const s = await CompanyModel.findSectionByCode(code);
        if (!s) return errorResponse(res, 'Section not found.', 404);
        if (s.comp_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await CompanyModel.deactivateSection(code);
      } else {
        return errorResponse(res, 'Invalid entityType for Company.', 400);
      }

    } else if (accountType === 'Audit Firm') {
      if (entityType === 'branch') {
        const b = await AuditFirmModel.findBranchByCode(code);
        if (!b) return errorResponse(res, 'Branch not found.', 404);
        if (b.afc_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await AuditFirmModel.deactivateBranch(code);
      } else if (entityType === 'audit-firm-department') {
        const d = await AuditFirmModel.findDepartmentByCode(code);
        if (!d) return errorResponse(res, 'Department not found.', 404);
        if (d.afc_code !== adminCode) return errorResponse(res, 'Cannot delete a linked entity.', 403);
        await AuditFirmModel.deactivateDepartment(code);
      } else {
        return errorResponse(res, 'Invalid entityType for Audit Firm.', 400);
      }
    }

    return successResponse(res, null, 'Deleted successfully.');

  } catch (error) {
    console.error('Delete sub-entity error:', error);
    return errorResponse(res, 'Failed to delete.', 500);
  }
};

// --- LIST ALL ENTITIES OF A TYPE ---

/**
 * GET /api/hierarchy/list/:entityType
 *
 * Returns a flat list of all entities of a given type under the admin's org.
 */
const listByType = async (req, res) => {
  try {
    const { entityType } = req.params;
    const accountType = req.user.accountType === 'Audit Firm Company' ? 'Audit Firm' : req.user.accountType;
    const adminCode = req.user.entityCode;
    let items = [];

    if (accountType === 'Customer') {
      if (entityType === 'buying-office') {
        items = await CustomerModel.findBuyingOfficesByCustomer(adminCode);
      } else if (entityType === 'supplier') {
        items = await CustomerModel.findSuppliersByCustomer(adminCode);
      } else if (entityType === 'company' || COMPANY_STRUCTURE_ENTITY_TYPES.includes(entityType)) {
        // Customer accounts never own companies/clusters/etc. directly, but a
        // Supplier linked to a Company sees them (read-only) via the merge below.
        items = [];
      } else {
        return errorResponse(res, 'Invalid entityType for Customer.', 400);
      }

    } else if (accountType === 'Company') {
      if (entityType === 'cluster') {
        items = await CompanyModel.findClustersByCompany(adminCode);
      } else if (entityType === 'factory') {
        items = await CompanyModel.findFactoriesByCompany(adminCode);
      } else if (entityType === 'unit') {
        items = await CompanyModel.findUnitsByCompany(adminCode);
      } else if (entityType === 'department') {
        items = await CompanyModel.findDepartmentsByCompany(adminCode);
      } else if (entityType === 'section') {
        items = await CompanyModel.findSectionsByCompany(adminCode);
      } else {
        return errorResponse(res, 'Invalid entityType for Company.', 400);
      }

    } else if (accountType === 'Audit Firm') {
      if (entityType === 'branch') {
        items = await AuditFirmModel.findBranchesByFirm(adminCode);
      } else if (entityType === 'audit-firm-department') {
        items = await AuditFirmModel.findDepartmentsByFirm(adminCode);
      } else {
        return errorResponse(res, 'Invalid entityType for Audit Firm.', 400);
      }

    } else {
      return errorResponse(res, 'No sub-entities for this account type.', 400);
    }

    // Merge entities visible via linked partners — two complementary strategies:
    //   1. Tree-based  — via org tree accessible codes (fast path)
    //   2. Owner-based — partner's directly-created entities (works even after tree removal)
    const typeConfig = ENTITY_TYPE_TABLE_MAP[entityType];
    if (typeConfig) {
      const existingCodes = new Set(items.map(i => i[typeConfig.codeField]));

      // 1. Tree-based merge
      const accessibleCodes = await getAccessibleEntityCodes(adminCode, req.user.entityType);
      const otherCodes = accessibleCodes.filter(c => c !== adminCode);
      if (otherCodes.length > 0) {
        const placeholders = otherCodes.map(() => '?').join(',');
        const [linkedRows] = await db.query(
          `SELECT * FROM \`${typeConfig.table}\` WHERE \`${typeConfig.codeField}\` IN (${placeholders}) AND is_active = TRUE`,
          otherCodes
        );
        for (const row of linkedRows) {
          if (!existingCodes.has(row[typeConfig.codeField])) {
            items.push({ ...row, is_linked: true });
            existingCodes.add(row[typeConfig.codeField]);
          }
        }
      }

      // 2. Owner-based merge: partner's entities by their creator field, independent of org tree
      const links = await LinkModel.getAcceptedLinks(req.user.entityType, adminCode);
      const validOwnerFields = ENTITY_TYPE_OWNER_FIELDS[entityType] || [];
      for (const link of links) {
        const partnerCode = link.requester_code === adminCode ? link.target_code : link.requester_code;
        const partnerType = link.requester_code === adminCode ? link.target_type : link.requester_type;
        const partnerOwnerField = PARTNER_ACCOUNT_OWNER_FIELD[partnerType];
        if (partnerOwnerField && validOwnerFields.includes(partnerOwnerField)) {
          const [partnerRows] = await db.query(
            `SELECT * FROM \`${typeConfig.table}\` WHERE \`${partnerOwnerField}\` = ? AND is_active = TRUE`,
            [partnerCode]
          );
          for (const row of partnerRows) {
            if (!existingCodes.has(row[typeConfig.codeField])) {
              items.push({ ...row, is_linked: true });
              existingCodes.add(row[typeConfig.codeField]);
            }
          }
        }
      }
    }

    // Annotate which entities are currently mapped in the organization tree.
    // Tree-mapped entities cannot be deleted here (they must be detached from the
    // tree first), so the UI can disable the delete action up-front instead of
    // firing a request that returns 403.
    if (typeConfig && items.length > 0) {
      const codes = items.map(i => i[typeConfig.codeField]).filter(Boolean);
      if (codes.length > 0) {
        const placeholders = codes.map(() => '?').join(',');
        const [treeRows] = await db.query(
          `SELECT parent_code AS code FROM organization_tree
             WHERE parent_code IN (${placeholders}) AND is_active = TRUE
           UNION
           SELECT child_code AS code FROM organization_tree
             WHERE child_code IN (${placeholders}) AND is_active = TRUE`,
          [...codes, ...codes]
        );
        const inTree = new Set(treeRows.map(r => r.code));
        items = items.map(i => ({ ...i, in_tree: inTree.has(i[typeConfig.codeField]) }));
      }
    }

    return successResponse(res, { items, total: items.length });

  } catch (error) {
    console.error('List by type error:', error);
    return errorResponse(res, 'Failed to fetch entities.', 500);
  }
};

module.exports = {
  createSubEntity,
  updateSubEntity,
  deleteSubEntity,
  listByType
};