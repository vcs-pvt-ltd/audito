/**
 * Code Generator Utility
 *
 * Generates unique sequential codes for each entity table.
 *
 * Customer:         CUST-00001    (customers)
 * Buying Office:    CBO-00001     (customer_buying_offices)
 * Supplier:         SUP-00001     (customer_suppliers)
 * Company:          COMP-00001    (companies)
 * Cluster:          CC-00001      (company_clusters)
 * Company Factory:  COMPF-00001   (company_factories)
 * Unit:             CU-00001      (company_units)
 * Department:       CD-00001      (company_departments)
 * Audit Firm:       AFC-00001     (audit_firm_companies)
 * Branch:           AFCB-00001    (audit_firm_company_branches)
 * Link:             LINK-00001    (organization_links)
 * Admin User:       USR-00000001  (admins)
 */

const { db } = require('../config/db');

/**
 * Generic code generator: queries a specific table/field to get the next sequential number.
 */
const generateCode = async (table, codeField, prefix, padLen = 5) => {
  const [rows] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(\`${codeField}\`, ${prefix.length + 2}) AS UNSIGNED)) AS max_num FROM \`${table}\``
  );
  const next = (rows[0].max_num || 0) + 1;
  return `${prefix}-${String(next).padStart(padLen, '0')}`;
};

// --- Entity code generators ---

const generateCustCode = () => generateCode('customers', 'cust_code', 'CUST');
const generateCboCode = () => generateCode('customer_buying_offices', 'cbo_code', 'CBO');
const generateSupplierCode = () => generateCode('customer_suppliers', 'csup_code', 'SUP');
const generateCompCode = () => generateCode('companies', 'comp_code', 'COMP');
const generateCompClusCode = () => generateCode('company_clusters', 'comp_clus_code', 'CC');
const generateCompFactCode = () => generateCode('company_factories', 'comp_fact_code', 'COMPF');
const generateCompUnitCode = () => generateCode('company_units', 'comp_unit_code', 'CU');
const generateCompDeptCode = () => generateCode('company_departments', 'comp_dept_code', 'CD');
const generateCompSectionCode = () => generateCode('company_sections', 'comp_section_code', 'CS');
const generateAfcCode = () => generateCode('audit_firm_companies', 'afc_code', 'AFC');
const generateAfcBranchCode = () => generateCode('audit_firm_company_branches', 'afc_branch_code', 'AFCB');
const generateAfcDeptCode = () => generateCode('audit_firm_company_departments', 'afc_dept_code', 'AFCD');
const generateLinkCode = () => generateCode('organization_links', 'link_code', 'LINK');

// --- Admin user code generator ---

const generateAdminUserCode = async () => {
  const [rows] = await db.query(
    "SELECT MAX(CAST(SUBSTRING(admin_id, 5) AS UNSIGNED)) AS max_num FROM admins WHERE admin_id LIKE 'USR-%'"
  );
  const next = (rows[0].max_num || 0) + 1;
  return `USR-${String(next).padStart(8, '0')}`;
};

/**
 * Generic [table]_id generator: prefix + zero-padded digits (e.g. ADM0001).
 */
const generateTableId = async (table, idField, prefix, padLen = 4) => {
  const [rows] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(\`${idField}\`, ${prefix.length + 1}) AS UNSIGNED)) AS max_num FROM \`${table}\``
  );
  const next = (rows[0].max_num || 0) + 1;
  return `${prefix}${String(next).padStart(padLen, '0')}`;
};

// --- [table]_id generators ---

const generateAdminId = () => generateTableId('admins', 'admin_id', 'ADM', 4);
const generateAuditorId = () => generateTableId('auditors', 'auditor_id', 'AUD', 4);
const generateEntityHeadId = () => generateTableId('entity_heads', 'entity_head_id', 'EHD', 4);
const generateAuditId = () => generateTableId('audit_assignments', 'audit_id', 'AUDT', 4);
const generateCapId = () => generateTableId('caps', 'cap_id', 'CAP', 4);
const generateChecklistTypeId = () => generateTableId('checklist_types', 'checklist_type_id', 'CHKLT', 4);
const generateChecklistId = () => generateTableId('checklists', 'checklist_id', 'CHKL', 4);
const generateChecklistQuestionId = () => generateTableId('checklist_questions', 'checklist_question_id', 'CHKQ', 4);
const generateChecklistQuestionOptionId = () => generateTableId('checklist_question_options', 'checklist_question_option_id', 'CHKQO', 5);
const generateCorrectiveActionId = () => generateTableId('corrective_actions', 'corrective_action_id', 'CA', 4);
const generateTrainingId = () => generateTableId('trainings', 'training_id', 'TRN', 4);
const generateFieldVisitId = () => generateTableId('field_visits', 'field_visit_id', 'FV', 4);
const generateEvaluationPaperId = () => generateTableId('evaluation_papers', 'evaluation_paper_id', 'EP', 4);
const generateEvaluationQuestionId = () => generateTableId('evaluation_questions', 'evaluation_question_id', 'EQ', 4);
const generateAuditorExperienceId = () => generateTableId('auditor_experiences', 'auditor_experience_id', 'AEXP', 4);
const generateAuditorQualificationId = () => generateTableId('auditor_qualifications', 'auditor_qualification_id', 'AQUAL', 4);
const generateAuditorTrainingId = () => generateTableId('auditor_trainings', 'auditor_training_id', 'ATRAIN', 4);
const generateEvaluationAttemptId = () => generateTableId('evaluation_attempts', 'evaluation_attempt_id', 'EATT', 4);
const generateEvaluationAnswerId = () => generateTableId('evaluation_answers', 'evaluation_answer_id', 'EANS', 4);
const generateOrgTreeId = () => generateTableId('organization_tree', 'org_tree_id', 'OT', 4);
const generateAuditorProfileId = () => generateTableId('auditor_profiles', 'auditor_profile_id', 'APRF', 4);
const generateNoticeId = () => generateTableId('notices', 'notice_id', 'NTC', 4);
const generateContactMessageId = () => generateTableId('contact_messages', 'contact_message_id', 'MSG', 4);
const generatePromoCodeId = () => generateTableId('promo_codes', 'promo_code_id', 'PROMO', 4);
const generateAuditResponseId = () => generateTableId('audit_responses', 'audit_response_id', 'ARES', 4);
const generateAuditEvidenceId = () => generateTableId('audit_evidence', 'audit_evidence_id', 'AEVI', 4);
const generateAuditEntityProgressId = () => generateTableId('audit_entity_progress', 'audit_entity_progress_id', 'AEP', 4);
const generateRefreshTokenId = () => generateTableId('refresh_tokens', 'refresh_token_id', 'RT', 6);
const generatePasswordResetOtpId = () => generateTableId('password_reset_otps', 'password_reset_otp_id', 'PRO', 6);
const generateCapResponseEvidenceId = () => generateTableId('cap_response_evidence', 'cap_response_evidence_id', 'CEVD', 5);

/**
 * Batch version: generates N sequential ids in one DB round-trip.
 * Required for bulk (multi-row) inserts — calling the single-id generator
 * in a loop before the insert returns the SAME id every time, since the
 * table hasn't actually been updated yet.
 */
const generateBatchIds = async (table, idField, prefix, count, padLen = 4) => {
  const [rows] = await db.query(
    `SELECT MAX(CAST(SUBSTRING(\`${idField}\`, ${prefix.length + 1}) AS UNSIGNED)) AS max_num FROM \`${table}\``
  );
  let next = (rows[0].max_num || 0) + 1;
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(`${prefix}${String(next).padStart(padLen, '0')}`);
    next++;
  }
  return ids;
};

const generateTrainingAssignmentIds = (count) => generateBatchIds('training_assignments', 'training_assignment_id', 'TA', count, 4);
const generateFieldVisitAssignmentIds = (count) => generateBatchIds('field_visit_assignments', 'field_visit_assignment_id', 'FVA', count, 4);
const generateEvaluationQuestionOptionIds = (count) => generateBatchIds('evaluation_question_options', 'evaluation_question_option_id', 'EQO', count, 4);
const generateEvaluationAssignmentIds = (count) => generateBatchIds('evaluation_assignments', 'evaluation_assignment_id', 'EA', count, 4);
const generateAuditAssignmentEntityIds = (count) => generateBatchIds('audit_assignment_entities', 'audit_assignment_entity_id', 'AAE', 5);
const generateEvaluationAnswerIds = (count) => generateBatchIds('evaluation_answers', 'evaluation_answer_id', 'EANS', count, 4);
const generateCapAssignmentEntityIds = (count) => generateBatchIds('cap_assignment_entities', 'cap_assignment_entity_id', 'CAE', 5);
const generateCapEntityProgressIds = (count) => generateBatchIds('cap_entity_progress', 'cap_entity_progress_id', 'CEP', 5);
const generateCapResponseId = () => generateTableId('cap_responses', 'cap_response_id', 'CRES', 4);
const generateOrganizationLinkId = () => generateTableId('organization_links', 'organization_link_id', 'OLNK', 5);
const generateLinkBillingCreditId = () => generateTableId('link_billing_credits', 'link_billing_credit_id', 'LBC', 5);
const generateLinkCreditApplicationId = () => generateTableId('link_credit_applications', 'link_credit_application_id', 'LCA', 5);
const generateCustomSolutionRequestId = () => generateTableId('custom_solution_requests', 'request_id', 'CSR', 6);
const generatePaymentGatewayEventId = () => generateTableId('payment_gateway_events', 'payment_gateway_event_id', 'PGE', 6);
const generatePaymentMethodId = () => generateTableId('payment_methods', 'payment_method_id', 'PM', 6);

module.exports = {
  generateTableId,
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
  generateLinkCode,
  generateAdminUserCode,
  generateAdminId,
  generateAuditorId,
  generateEntityHeadId,
  generateAuditId,
  generateCapId,
  generateChecklistTypeId,
  generateChecklistId,
  generateChecklistQuestionId,
  generateChecklistQuestionOptionId,
  generateAuditAssignmentEntityIds,
  generateCapAssignmentEntityIds,
  generateCapEntityProgressIds,
  generateCapResponseId,
  generateCorrectiveActionId,
  generateOrgTreeId,
  generateAuditorProfileId,
  generateTrainingId,
  generateFieldVisitId,
  generateEvaluationPaperId,
  generateEvaluationQuestionId,
  generateEvaluationQuestionOptionIds,
  generateTrainingAssignmentIds,
  generateFieldVisitAssignmentIds,
  generateEvaluationAssignmentIds,
  generateEvaluationAnswerIds,
  generateAuditorExperienceId,
  generateAuditorQualificationId,
  generateAuditorTrainingId,
  generateEvaluationAttemptId,
  generateEvaluationAnswerId,
  generateAuditResponseId,
  generateAuditEvidenceId,
  generateAuditEntityProgressId,
  generateRefreshTokenId,
  generateNoticeId,
  generateContactMessageId,
  generatePromoCodeId,
  generatePasswordResetOtpId,
  generateCapResponseEvidenceId,
  generateOrganizationLinkId,
  generateLinkBillingCreditId,
  generateLinkCreditApplicationId,
  generateCustomSolutionRequestId,
  generatePaymentGatewayEventId,
  generatePaymentMethodId,
};
