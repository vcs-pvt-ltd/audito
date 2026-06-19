const { db } = require('../config/db');
const NoticeModel = require('./NoticeModel');
const { getEntityHeadOrgTreeScope, getAccessibleEntityCodes } = require('../utils/accessHelper');

const ENTITY_TABLES = [
  { table: 'customers', code: 'cust_code', type: 'Customer' },
  { table: 'customer_buying_offices', code: 'cbo_code', type: 'Buying Office' },
  { table: 'companies', code: 'comp_code', type: 'Company' },
  { table: 'company_clusters', code: 'comp_clus_code', type: 'Cluster' },
  { table: 'company_factories', code: 'comp_fact_code', type: 'Factory' },
  { table: 'company_units', code: 'comp_unit_code', type: 'Unit' },
  { table: 'company_departments', code: 'comp_dept_code', type: 'Department' },
  { table: 'company_sections', code: 'comp_section_code', type: 'Section' },
  { table: 'audit_firm_companies', code: 'afc_code', type: 'Audit Firm Company' },
  { table: 'audit_firm_company_branches', code: 'afc_branch_code', type: 'Branch' },
  { table: 'audit_firm_company_departments', code: 'afc_dept_code', type: 'Audit Firm Department' },
];

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'pending') return 'plan';
  return value || 'plan';
}

function normalizeDateRange(query = {}) {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setMonth(defaultFrom.getMonth() - 5);

  const from = query.from || `${defaultFrom.getFullYear()}-${String(defaultFrom.getMonth() + 1).padStart(2, '0')}-01`;
  const to = query.to || today.toISOString().slice(0, 10);
  return { from, to };
}

function getAuditScope(user, orgTreeScopeIds = null, entityHeadScopeCodes = [], accessibleCodes = []) {
  const accountType = user.accountType === 'Audit Firm' ? 'Audit Firm Company' : user.accountType;

  if (user.role === 'auditor') {
    return {
      where: 'aa.assigned_auditor_code = ?',
      params: [user.userCode],
      scopeLabel: 'My assigned audits',
    };
  }

  if (user.role === 'entity_head') {
    if (!orgTreeScopeIds?.length) {
      const scopedEntityCode = user.assignedEntityCode || user.entityCode || user.createdByEntityCode || null;
      if (!scopedEntityCode) {
        return { where: '1 = 0', params: [], scopeLabel: 'Audits for my organization tree' };
      }
      const codes = entityHeadScopeCodes.length ? entityHeadScopeCodes : [scopedEntityCode];
      const ph = codes.map(() => '?').join(',');
      return {
        where: `EXISTS (
          SELECT 1
            FROM audit_assignment_entities aae
           WHERE aae.assignment_id = aa.id
             AND aae.is_active = TRUE
             AND aae.entity_code IN (${ph})
        )`,
        params: codes,
        scopeLabel: 'Audits for my organization tree',
      };
    }
    const ph = orgTreeScopeIds.map(() => '?').join(',');
    return {
      where: `EXISTS (
        SELECT 1
          FROM audit_assignment_entities aae
         WHERE aae.assignment_id = aa.id
           AND aae.is_active = TRUE
           AND aae.org_tree_id IN (${ph})
      )`,
      params: orgTreeScopeIds,
      scopeLabel: 'Audits for my organization tree',
    };
  }

  if (user.role === 'admin' && (accountType === 'Audit Firm Company' || accountType === 'Audit Firm')) {
    return {
      where: 'aa.assigned_firm_code = ?',
      params: [user.entityCode],
      scopeLabel: 'Audits assigned to firm',
    };
  }

  // Admin – use accessible codes to see partner data if linked
  const codes = accessibleCodes.length ? accessibleCodes : [user.entityCode];
  const ph = codes.map(() => '?').join(',');
  return {
    where: `aa.created_by IN (${ph})`,
    params: codes,
    scopeLabel: 'Organization audits',
  };
}

function applyFilters(baseWhere, baseParams, filters, descendantCodes = []) {
  const where = [baseWhere, 'aa.is_active = TRUE'];
  const params = [...baseParams];

  if (filters.from) {
    where.push('DATE(aa.start_date) >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('DATE(aa.start_date) <= ?');
    params.push(filters.to);
  }
  if (filters.status && filters.status !== 'all') {
    where.push('LOWER(aa.status) = ?');
    params.push(filters.status);
  }
  if (filters.audit_type && filters.audit_type !== 'all') {
    where.push('aa.audit_type = ?');
    params.push(filters.audit_type);
  }
  if (filters.audit_code && filters.audit_code !== 'all') {
    where.push('aa.audit_code = ?');
    params.push(filters.audit_code);
  }
  if (descendantCodes.length > 0) {
    const ph = descendantCodes.map(() => '?').join(',');
    where.push(`EXISTS (
      SELECT 1 FROM audit_assignment_entities aae
      WHERE aae.assignment_id = aa.id AND aae.is_active = TRUE AND aae.entity_code IN (${ph})
    )`);
    params.push(...descendantCodes);
  }

  return { whereSql: where.join(' AND '), params };
}

async function resolveEntityNames(codes) {
  const uniqueCodes = [...new Set((codes || []).filter(Boolean))];
  if (!uniqueCodes.length) return {};

  const ph = uniqueCodes.map(() => '?').join(',');
  const unions = ENTITY_TABLES.map(
    (cfg) => `SELECT ${cfg.code} AS code, name, '${cfg.type}' AS entity_type FROM ${cfg.table} WHERE ${cfg.code} IN (${ph})`
  ).join(' UNION ALL ');

  const [rows] = await db.query(unions, ENTITY_TABLES.flatMap(() => uniqueCodes));
  const map = {};
  for (const row of rows) {
    map[row.code] = {
      code: row.code,
      name: row.name?.trim?.() || row.code,
      entity_type: row.entity_type,
    };
  }
  return map;
}

async function getAuditRows(whereSql, params) {
  const [rows] = await db.query(
    `SELECT aa.id, aa.audit_code, aa.title, aa.audit_type, aa.status,
            aa.start_date, aa.end_date, aa.created_at, aa.completed_at,
            aa.created_by, aa.assigned_auditor_code, aa.assigned_firm_code,
            c.name AS checklist_name,
            COALESCE(ent.entity_count, 0) AS entity_count,
            COALESCE(progress.total_questions, 0) AS total_questions,
            COALESCE(progress.answered_questions, 0) AS answered_questions,
            COALESCE(progress.total_marks, 0) AS total_marks,
            COALESCE(progress.obtained_marks, 0) AS obtained_marks
       FROM audit_assignments aa
       LEFT JOIN checklists c ON c.id = aa.checklist_id
       LEFT JOIN (
         SELECT assignment_id, COUNT(*) AS entity_count
           FROM audit_assignment_entities
          WHERE is_active = TRUE
          GROUP BY assignment_id
       ) ent ON ent.assignment_id = aa.id
       LEFT JOIN (
         SELECT audit_id,
                SUM(total_questions) AS total_questions,
                SUM(answered_questions) AS answered_questions,
                SUM(total_marks) AS total_marks,
                SUM(obtained_marks) AS obtained_marks
           FROM audit_entity_progress
          GROUP BY audit_id
       ) progress ON progress.audit_id = aa.id
      WHERE ${whereSql}
      ORDER BY aa.start_date DESC, aa.created_at DESC`,
    params
  );

  return rows.map((row) => {
    const totalQuestions = Number(row.total_questions || 0);
    const answeredQuestions = Number(row.answered_questions || 0);
    const totalMarks = Number(row.total_marks || 0);
    const obtainedMarks = Number(row.obtained_marks || 0);
    return {
      ...row,
      status: normalizeStatus(row.status),
      entity_count: Number(row.entity_count || 0),
      total_questions: totalQuestions,
      answered_questions: answeredQuestions,
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      progress_pct: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0,
      score_pct: totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0,
    };
  });
}

async function getCapsSummary(user, filters, descendantCodes = [], orgTreeScopeIds = [], accessibleCodes = []) {
  const where = ['1 = 1'];
  const params = [];

  if (user.role === 'auditor') {
    where.push('(c.created_by = ? OR aa.assigned_auditor_code = ?)');
    params.push(user.userCode, user.userCode);
  } else if (user.role === 'entity_head') {
    if (!orgTreeScopeIds.length) {
      where.push('1 = 0');
    } else {
      const ph = orgTreeScopeIds.map(() => '?').join(',');
      where.push(`EXISTS (
        SELECT 1
          FROM cap_assignment_entities cae
         WHERE cae.cap_id = c.id
           AND cae.is_active = TRUE
           AND cae.org_tree_id IN (${ph})
      )`);
      params.push(...orgTreeScopeIds);
    }
  } else if (user.role === 'admin' && (user.accountType === 'Audit Firm' || user.accountType === 'Audit Firm Company')) {
    where.push('aa.assigned_firm_code = ?');
    params.push(user.entityCode);
  } else {
    const codes = accessibleCodes.length ? accessibleCodes : [user.entityCode];
    const ph = codes.map(() => '?').join(',');
    where.push(`aa.created_by IN (${ph})`);
    params.push(...codes);
  }

  if (filters.from) {
    where.push('DATE(c.created_at) >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('DATE(c.created_at) <= ?');
    params.push(filters.to);
  }

  if (descendantCodes.length > 0) {
    const ph = descendantCodes.map(() => '?').join(',');
    where.push(`EXISTS (
      SELECT 1 FROM audit_assignment_entities aae
      WHERE aae.assignment_id = aa.id AND aae.is_active = TRUE AND aae.entity_code IN (${ph})
    )`);
    params.push(...descendantCodes);
  }

  const [rows] = await db.query(
    `SELECT LOWER(c.status) AS status, COUNT(*) AS count
       FROM caps c
       JOIN audit_assignments aa ON aa.id = c.audit_id
      WHERE ${where.join(' AND ')}
      GROUP BY LOWER(c.status)`,
    params
  );

  const summary = { total: 0, plan: 0, in_progress: 0, completed: 0 };
  for (const row of rows) {
    const status = normalizeStatus(row.status);
    const count = Number(row.count || 0);
    summary.total += count;
    if (summary[status] !== undefined) summary[status] += count;
  }
  return summary;
}

async function getPeopleSummary(user, accessibleCodes = []) {
  if (user.role !== 'admin') return null;

  const codes = accessibleCodes.length ? accessibleCodes : [user.entityCode];
  const ph = codes.map(() => '?').join(',');

  const queries = [
    db.query(`SELECT COUNT(*) AS total FROM auditors WHERE created_by_entity_code IN (${ph}) AND is_active = TRUE`, codes),
    db.query(`SELECT COUNT(*) AS total FROM entity_heads WHERE created_by_entity_code IN (${ph}) AND is_active = TRUE`, codes),
    db.query(`SELECT COUNT(*) AS total FROM checklists WHERE created_by IN (${ph}) AND is_active = TRUE`, codes),
  ];

  const type = user.accountType;
  const labels = ['auditors', 'entity_heads', 'checklists'];
  if (type === 'Corporate' || type === 'Company') {
    queries.push(db.query(`SELECT COUNT(*) AS total FROM companies WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM company_clusters WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM company_factories WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM company_units WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM company_departments WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM company_sections WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
    labels.push('root_companies', 'clusters', 'factories', 'units', 'departments', 'sections');
  } else if (type === 'Audit Firm' || type === 'Audit Firm Company') {
    queries.push(db.query(`SELECT COUNT(*) AS total FROM audit_firm_companies WHERE afc_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM audit_firm_company_branches WHERE afc_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM audit_firm_company_departments WHERE afc_code IN (${ph}) AND is_active = TRUE`, codes));
    labels.push('firms', 'branches', 'departments');
  } else if (type === 'Customer') {
    queries.push(db.query(`SELECT COUNT(*) AS total FROM customers WHERE cust_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM customer_buying_offices WHERE cust_code IN (${ph}) AND is_active = TRUE`, codes));
    queries.push(db.query(`SELECT COUNT(*) AS total FROM customer_suppliers WHERE cust_code IN (${ph}) AND is_active = TRUE`, codes));
    labels.push('root_customers', 'buying_offices', 'suppliers');
  }

  // Supplier ↔ Company link: include the linked company's structure counts so the
  // Supplier dashboard can show Company / Cluster / Factory / Unit / Department / Section.
  let linkedCompanies = 0;
  if (type === 'Customer') {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total FROM companies WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes
    );
    linkedCompanies = Number(row?.total || 0);
    if (linkedCompanies > 0) {
      queries.push(db.query(`SELECT COUNT(*) AS total FROM company_clusters WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
      queries.push(db.query(`SELECT COUNT(*) AS total FROM company_factories WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
      queries.push(db.query(`SELECT COUNT(*) AS total FROM company_units WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
      queries.push(db.query(`SELECT COUNT(*) AS total FROM company_departments WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
      queries.push(db.query(`SELECT COUNT(*) AS total FROM company_sections WHERE comp_code IN (${ph}) AND is_active = TRUE`, codes));
      labels.push('clusters', 'factories', 'units', 'departments', 'sections');
    }
  }

  const results = await Promise.all(queries);
  const data = {};
  labels.forEach((label, i) => {
    data[label] = Number(results[i][0][0]?.total || 0);
  });

  if (linkedCompanies > 0) data.companies = linkedCompanies;

  return data;
}

function buildStatusSummary(audits) {
  const summary = { total: audits.length, plan: 0, in_progress: 0, completed: 0 };
  for (const audit of audits) {
    if (summary[audit.status] !== undefined) summary[audit.status] += 1;
  }
  return summary;
}

function buildTypeSummary(audits) {
  const byType = {};
  for (const audit of audits) {
    const key = audit.audit_type || 'unknown';
    byType[key] = (byType[key] || 0) + 1;
  }
  return Object.entries(byType).map(([name, value]) => ({ name, value }));
}

function buildMonthlyTrend(audits) {
  const byMonth = {};
  for (const audit of audits) {
    const date = audit.start_date ? new Date(audit.start_date) : null;
    if (!date || Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { month: key, plan: 0, in_progress: 0, completed: 0, total: 0 };
    byMonth[key][audit.status] = (byMonth[key][audit.status] || 0) + 1;
    byMonth[key].total += 1;
  }
  return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
}

function buildProgressBuckets(audits) {
  const buckets = [
    { label: '0%', min: 0, max: 0, count: 0 },
    { label: '1-49%', min: 1, max: 49, count: 0 },
    { label: '50-89%', min: 50, max: 89, count: 0 },
    { label: '90-100%', min: 90, max: 100, count: 0 },
  ];
  for (const audit of audits) {
    const bucket = buckets.find((b) => audit.progress_pct >= b.min && audit.progress_pct <= b.max);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

async function getEntityPerformance(audits, scopeCodes = [], scopeIds = []) {
  const auditIds = audits.map((a) => a.id);
  if (!auditIds.length) return [];

  const ph = auditIds.map(() => '?').join(',');
  const entityScopePh = scopeCodes.length ? scopeCodes.map(() => '?').join(',') : null;
  const treeScopePh = scopeIds.length ? scopeIds.map(() => '?').join(',') : null;

  let scopeWhere = '';
  const scopeParams = [];
  if (entityScopePh || treeScopePh) {
    const conditions = [];
    if (entityScopePh) {
      conditions.push(`src.entity_code IN (${entityScopePh})`);
      scopeParams.push(...scopeCodes);
    }
    if (treeScopePh) {
      conditions.push(`src.org_tree_id IN (${treeScopePh})`);
      scopeParams.push(...scopeIds);
    }
    scopeWhere = ` AND (${conditions.join(' OR ')})`;
  }

  const [rows] = await db.query(
    `SELECT src.entity_code,
            src.org_tree_id,
            aa.audit_code,
            aa.title AS audit_title,
            COUNT(DISTINCT src.audit_id) AS audit_count,
            SUM(src.total_questions) AS total_questions,
            SUM(src.answered_questions) AS answered_questions,
            SUM(src.total_marks) AS total_marks,
            SUM(src.obtained_marks) AS obtained_marks
       FROM (
            SELECT
              aae.assignment_id AS audit_id,
              aae.entity_code,
              aae.org_tree_id,
              0 AS total_questions,
              0 AS answered_questions,
              0 AS total_marks,
              0 AS obtained_marks
            FROM audit_assignment_entities aae
            WHERE aae.assignment_id IN (${ph})
              AND aae.is_active = TRUE

            UNION ALL

            SELECT
              aep.audit_id,
              aep.entity_code,
              aep.org_tree_id,
              COALESCE(aep.total_questions, 0) AS total_questions,
              COALESCE(aep.answered_questions, 0) AS answered_questions,
              COALESCE(aep.total_marks, 0) AS total_marks,
              COALESCE(aep.obtained_marks, 0) AS obtained_marks
            FROM audit_entity_progress aep
            WHERE aep.audit_id IN (${ph})
       ) src
       JOIN audit_assignments aa ON aa.id = src.audit_id
      WHERE 1=1 ${scopeWhere}
      GROUP BY src.entity_code, src.org_tree_id, aa.audit_code, aa.title
      ORDER BY audit_count DESC, src.entity_code`,
    [...auditIds, ...auditIds, ...scopeParams]
  );
  const names = await resolveEntityNames(rows.map((r) => r.entity_code));
  return rows.map((row) => {
    const totalQuestions = Number(row.total_questions || 0);
    const answeredQuestions = Number(row.answered_questions || 0);
    const totalMarks = Number(row.total_marks || 0);
    const obtainedMarks = Number(row.obtained_marks || 0);
    return {
      entity_code: row.entity_code,
      org_tree_id: row.org_tree_id,
      audit_code: row.audit_code,
      audit_title: row.audit_title,
      entity_name: names[row.entity_code]?.name || row.entity_code,
      entity_type: names[row.entity_code]?.entity_type || null,
      audit_count: Number(row.audit_count || 0),
      total_marks: totalMarks,
      obtained_marks: obtainedMarks,
      total_questions: totalQuestions,
      answered_questions: answeredQuestions,
      progress_pct: totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0,
      score_pct: totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0,
    };
  });
}

const DashboardModel = {
  normalizeDateRange,

  async getOverview(user, query = {}) {
    const filters = {
      ...normalizeDateRange(query),
      status: query.status || 'all',
      audit_type: query.audit_type || 'all',
      entity_code: query.entity_code || 'all',
      audit_code: query.audit_code || 'all',
    };

    let orgTreeScopeIds = [];
    let entityHeadScopeCodes = [];
    if (user.role === 'entity_head') {
      orgTreeScopeIds = await getEntityHeadOrgTreeScope(user.assignedOrgTreeId);
      if (!orgTreeScopeIds.length) {
        const scopedEntityCode = user.assignedEntityCode || user.entityCode || null;
        if (scopedEntityCode) {
          const [edges] = await db.query('SELECT parent_code, child_code FROM organization_tree WHERE is_active = TRUE');
          const descendants = new Set([scopedEntityCode]);
          let added = true;
          while (added) {
            added = false;
            for (const edge of edges) {
              if (descendants.has(edge.parent_code) && !descendants.has(edge.child_code)) {
                descendants.add(edge.child_code);
                added = true;
              }
            }
          }
          entityHeadScopeCodes = [...descendants];
        }
      }
    }

    let descendantCodes = [];
    if (filters.entity_code && filters.entity_code !== 'all') {
      const [edges] = await db.query('SELECT parent_code, child_code FROM organization_tree WHERE is_active = TRUE');
      const descendants = new Set([filters.entity_code]);
      let added = true;
      while (added) {
        added = false;
        for (const edge of edges) {
          if (descendants.has(edge.parent_code) && !descendants.has(edge.child_code)) {
            descendants.add(edge.child_code);
            added = true;
          }
        }
      }
      descendantCodes = [...descendants];
    }

    const accessibleCodes = await getAccessibleEntityCodes(user.entityCode, user.entityType);

    const scope = getAuditScope(user, orgTreeScopeIds, entityHeadScopeCodes, accessibleCodes);
    const scopedFilters = applyFilters(scope.where, scope.params, filters, descendantCodes);
    const audits = await getAuditRows(scopedFilters.whereSql, scopedFilters.params);
    const now = new Date();

    const chartFilters = { ...filters, entity_code: 'all' };
    const chartScopedFilters = applyFilters(scope.where, scope.params, chartFilters, []);
    const chartAudits = await getAuditRows(chartScopedFilters.whereSql, chartScopedFilters.params);

    const upcoming = audits
      .filter((audit) => audit.start_date && new Date(audit.start_date) >= now && audit.status !== 'completed')
      .slice(0, 5);
    const overdue = audits.filter((audit) => audit.end_date && new Date(audit.end_date) < now && audit.status !== 'completed');
    const recent = audits.slice(0, 8);

    // Build entity-level scope for head
    let entScopeWhere = '1=1';
    let entScopeParams = [];
    if (user.role === 'entity_head') {
      const conditions = [];
      if (entityHeadScopeCodes.length > 0) {
        conditions.push(`aae.entity_code IN (${entityHeadScopeCodes.map(() => '?').join(',')})`);
        entScopeParams.push(...entityHeadScopeCodes);
      }
      if (orgTreeScopeIds.length > 0) {
        conditions.push(`aae.org_tree_id IN (${orgTreeScopeIds.map(() => '?').join(',')})`);
        entScopeParams.push(...orgTreeScopeIds);
      }
      if (conditions.length > 0) {
         entScopeWhere = `(${conditions.join(' OR ')})`;
      }
    }

    const [caps, people, entityPerformance, notices, [assignmentEntities]] = await Promise.all([
      getCapsSummary(user, filters, descendantCodes, orgTreeScopeIds, accessibleCodes),
      getPeopleSummary(user, accessibleCodes),
      getEntityPerformance(chartAudits.filter(a => a.status === 'completed'), entityHeadScopeCodes, orgTreeScopeIds),
      user.role === 'auditor' ? NoticeModel.getNoticesForAuditor(user.createdByEntityCode, user.userCode) : Promise.resolve([]),
      db.query(
        `SELECT aa.audit_code, aae.entity_code, aae.org_tree_id
           FROM audit_assignment_entities aae
           JOIN audit_assignments aa ON aa.id = aae.assignment_id
          WHERE aae.is_active = TRUE AND aa.is_active = TRUE AND ${scope.where} AND ${entScopeWhere}`,
        [...scope.params, ...entScopeParams]
      ),
    ]);

    return {
      filters,
      scope: {
        role: user.role,
        account_type: user.accountType || null,
        entity_type: user.entityType || null,
        entity_code: (user.role === 'entity_head'
          ? (user.assignedEntityCode || user.entityCode || null)
          : (user.entityCode || null)),
        label: scope.scopeLabel,
      },
      notices: notices || [],
      summaries: {
        audits: buildStatusSummary(audits),
        caps,
        people,
        overdue: overdue.length,
        average_progress: audits.length ? Math.round(audits.reduce((s, a) => s + a.progress_pct, 0) / audits.length) : 0,
        average_score: audits.length ? Math.round(audits.reduce((s, a) => s + a.score_pct, 0) / audits.length) : 0,
      },
      charts: {
        status: [
          { name: 'Plan', value: buildStatusSummary(audits).plan, color: '#94a3b8' },
          { name: 'In progress', value: buildStatusSummary(audits).in_progress, color: '#f59e0b' },
          { name: 'Completed', value: buildStatusSummary(audits).completed, color: '#10b981' },
        ],
        audit_type: buildTypeSummary(audits),
        monthly: buildMonthlyTrend(audits),
        progress_buckets: buildProgressBuckets(audits),
        entity_performance: entityPerformance,
        assignment_entities: assignmentEntities,
      },
      lists: {
        recent_audits: recent,
        upcoming_audits: upcoming,
        overdue_audits: overdue.slice(0, 6),
      },
    };
  },
};

module.exports = DashboardModel;
