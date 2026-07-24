const PlanSettingsModel = require('../models/PlanSettingsModel');

const PUBLIC_KNOWLEDGE = [
  {
    topic: 'Platform overview',
    content: 'Audito is an audit management platform for planning audits, structuring organizations, assigning auditors, collecting evidence, managing corrective actions, and reporting on audit performance.',
  },
  {
    topic: 'Organization structure',
    content: 'Audito supports company-layer management and department structures. Organizations can create company entities and departments, assign department heads, and use the same entity structure across multiple relevant places in the workspace.',
  },
  {
    topic: 'Audit workflow',
    content: 'A typical workflow is: create a checklist, assign an audit to an auditor, collect answers and evidence during execution, review the audit outcome, create corrective actions where needed, and monitor completion and reports.',
  },
  {
    topic: 'Checklists and evidence',
    content: 'Teams can create reusable audit checklists and use them during audits. Evidence can be attached to audit and corrective-action work. Available evidence formats depend on the organization plan.',
  },
  {
    topic: 'Corrective actions and reports',
    content: 'Audito helps teams record corrective actions, assign due dates, monitor progress, and use audit and CAP information in reports. It supports visibility for administrators and relevant entity heads.',
  },
  {
    topic: 'Auditors and analytics',
    content: 'Auditors can complete assigned audits, submit evidence, and follow corrective actions. Eligible plans also include auditor performance analytics and evaluation capabilities.',
  },
  {
    topic: 'Cross-company audits',
    content: 'Eligible plans can support audits across companies such as suppliers, partners, or external organizations for compliance and quality assurance.',
  },
  {
    topic: 'Registration and custom solutions',
    content: 'Visitors can register for a standard plan or submit a custom solution request. Custom solutions are reviewed before a price is assigned, and are suitable for organizations with specific requirements.',
  },
  {
    topic: 'Privacy and support',
    content: 'New registrations must agree to the current Privacy Policy. Visitors can use the Contact Us section for product questions, custom requirements, and sales support.',
  },
];

const formatPlanKnowledge = async () => {
  const catalog = await PlanSettingsModel.list();
  const plans = (catalog.plans || []).filter((plan) => Number(plan.is_active) === 1).map((plan) => {
    const details = [
      `${plan.plan_name}: $${Number(plan.monthly_price).toLocaleString()} per month`,
      `${plan.max_company_levels} company levels`,
      `${plan.max_departments} departments`,
      `${plan.max_audits} audits`,
      `${plan.max_checklists} checklists`,
      `${plan.max_auditors} auditors`,
    ];
    if (plan.plan_name === 'Basic') details.unshift('Basic: first month is free; the configured monthly price applies from the second month');
    if (plan.allow_auditor_eval) details.push('includes auditor evaluation');
    if (plan.allow_company_to_company) details.push('includes cross-company audits');
    return details.join(', ');
  });
  return plans.length ? { topic: 'Current plans and limits', content: plans.join('\n') } : null;
};

const getApprovedKnowledge = async () => {
  let planKnowledge = null;
  try {
    planKnowledge = await formatPlanKnowledge();
  } catch (_) {
    // The public guide can still answer general product questions if plan data is temporarily unavailable.
  }
  return [...PUBLIC_KNOWLEDGE, ...(planKnowledge ? [planKnowledge] : [])];
};

module.exports = { getApprovedKnowledge };
