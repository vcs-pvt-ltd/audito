const conflictTargets = {
  audit_responses: ['audit_id', 'entity_code', 'checklist_question_id', 'org_tree_id'],
  audit_entity_progress: ['audit_id', 'org_tree_id', 'entity_code'],
  cap_assignment_entities: ['cap_id', 'entity_code', 'org_tree_id'],
  cap_questions: ['cap_id', 'corrective_action_id'],
  cap_entity_progress: ['cap_id', 'entity_code', 'org_tree_id'],
  corrective_actions: ['corrective_action_id'],
  payment_methods: ['root_entity_code', 'gateway', 'token_fingerprint'],
  training_assignments: ['training_id', 'auditor_id'],
  field_visit_assignments: ['field_visit_id', 'auditor_id'],
  evaluation_assignments: ['paper_id', 'auditor_id'],
};

let metadataPromise;

// Read the live PostgreSQL schema once. The import inventory is a conversion
// artifact and may not be deployed alongside the application.
function loadMetadata(client) {
  if (!metadataPromise) {
    metadataPromise = client.query(`
      SELECT c.relname AS table_name, a.attname AS column_name,
             a.atttypid = 'pg_catalog.bool'::regtype AS is_boolean,
             a.attidentity <> '' OR COALESCE(pg_get_expr(d.adbin, d.adrelid), '') LIKE 'nextval(%' AS generated_id
        FROM pg_catalog.pg_class AS c
        JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.oid
        LEFT JOIN pg_catalog.pg_attrdef AS d ON d.adrelid = c.oid AND d.adnum = a.attnum
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
         AND a.attnum > 0 AND NOT a.attisdropped
    `).then(({ rows }) => {
      const booleanNames = new Set();
      const idByTable = {};
      for (const row of rows) {
        if (row.is_boolean) booleanNames.add(row.column_name);
        if (row.generated_id) idByTable[row.table_name] = row.column_name;
      }
      return { booleanNames, idByTable };
    }).catch(error => {
      metadataPromise = null;
      throw error;
    });
  }
  return metadataPromise;
}

function bind(sql, params) {
  let output = '', state = 'normal', number = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], next = sql[i + 1];
    if (state === 'single') {
      output += c;
      if (c === "'" && next === "'") { output += next; i++; }
      else if (c === "'") state = 'normal';
    } else if (state === 'double') {
      output += c;
      if (c === '"') state = 'normal';
    } else if (state === 'backtick') {
      output += c === '`' ? '"' : c;
      if (c === '`') state = 'normal';
    } else if (state === 'lineComment') {
      output += c;
      if (c === '\n') state = 'normal';
    } else if (c === "'") { output += c; state = 'single'; }
    else if (c === '"') { output += c; state = 'double'; }
    else if (c === '`') { output += '"'; state = 'backtick'; }
    else if (c === '-' && next === '-') { output += '--'; i++; state = 'lineComment'; }
    else if (c === '?') { output += `$${++number}`; }
    else output += c;
  }
  if (number !== params.length) throw new Error(`SQL expected ${number} parameters, received ${params.length}`);
  return output;
}

function expandBulk(sql, params) {
  if (!/\bVALUES\s*\?/i.test(sql)) return { sql, params };
  if (params.length !== 1 || !Array.isArray(params[0]) || !params[0].length) throw new Error('Bulk insert requires nonempty rows');
  const width = params[0][0].length;
  if (!width || !params[0].every(row => Array.isArray(row) && row.length === width)) throw new Error('Bulk insert row width mismatch');
  return { sql: sql.replace(/\bVALUES\s*\?/i, `VALUES ${params[0].map(() => `(${Array(width).fill('?').join(', ')})`).join(', ')}`), params: params[0].flat() };
}

function translate(sql, inputParams = [], metadata = {}) {
  const booleanNames = metadata.booleanNames || new Set();
  const idByTable = metadata.idByTable || {};
  const expanded = expandBulk(sql, inputParams);
  sql = expanded.sql;
  const params = expanded.params;
  const insert = /^\s*INSERT\s+(?:IGNORE\s+)?INTO\s+[`"]?(\w+)[`"]?/i.exec(sql);
  const table = insert?.[1];
  const ignored = /^\s*INSERT\s+IGNORE\b/i.test(sql);
  sql = sql.replace(/^(\s*INSERT\s+)IGNORE\s+/i, '$1');
  if (/\bON DUPLICATE KEY UPDATE\b/i.test(sql)) {
    const target = conflictTargets[table];
    if (!target) throw new Error(`No PostgreSQL conflict target configured for ${table}`);
    sql = sql.replace(/\bON DUPLICATE KEY UPDATE\b/i, `ON CONFLICT (${target.map(x => `"${x}"`).join(', ')}) DO UPDATE SET`);
    sql = sql.replace(/\bVALUES\s*\(\s*([`"]?\w+[`"]?)\s*\)/gi, 'EXCLUDED.$1');
  } else if (ignored) sql += ' ON CONFLICT DO NOTHING';
  sql = sql.replace(/<=>/g, ' IS NOT DISTINCT FROM ');
  sql = sql.replace(/\b(?:NOT\s+)?IN\s*\(\s*\?\s*\)/gi, (match, offset, whole) => {
    const parameterIndex = (whole.slice(0, offset).match(/\?/g) || []).length;
    if (!Array.isArray(params[parameterIndex])) return match;
    return /^NOT/i.test(match) ? '<> ALL(?)' : '= ANY(?)';
  });
  sql = sql.replace(/([\w."`]+)\s+REGEXP\b/gi, '$1 COLLATE "C" ~');
  sql = sql.replace(/\bAS UNSIGNED\b/gi, 'AS BIGINT');
  sql = sql.replace(/\bCURDATE\(\)/gi, 'CURRENT_DATE');
  sql = sql.replace(/DATE_ADD\(\s*(NOW\(\)|CURRENT_DATE)\s*,\s*INTERVAL\s+(\?|\d+)\s+(DAY|HOUR|MINUTE)\s*\)/gi,
    (_, date, count, unit) => `(${date} + (${count} * INTERVAL '1 ${unit.toLowerCase()}'))`);
  sql = sql.replace(/DATE_SUB\(\s*(NOW\(\)|CURRENT_DATE)\s*,\s*INTERVAL\s+(\d+)\s+(DAY|WEEK|MONTH|YEAR)\s*\)/gi,
    (_, date, count, unit) => `(${date} - (${count} * INTERVAL '1 ${unit.toLowerCase()}'))`);
  sql = sql.replace(/TIMESTAMPDIFF\(\s*SECOND\s*,\s*NOW\(\)\s*,\s*(\w+)\s*\)/gi, (_, field) => `EXTRACT(EPOCH FROM (${field} - NOW()))`);
  sql = sql.replace(/GROUP_CONCAT\(\s*([\w.]+)\s*\)/gi, (_, field) => `STRING_AGG(${field}::text, ',')`);
  // The dump marks these columns as TINYINT(1); PostgreSQL stores them as boolean.
  for (const name of booleanNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sql = sql.replace(new RegExp(`(\\b(?:\\w+\\.)?["\\x60]?${escaped}["\\x60]?\\s*=\\s*)([01])\\b`, 'gi'),
      (_, head, bit) => `${head}${bit === '1' ? 'TRUE' : 'FALSE'}`);
  }
  sql = bind(sql, params);
  if (insert && !/\bRETURNING\b/i.test(sql) && idByTable[table]) sql += ` RETURNING "${idByTable[table]}"`;
  return { text: sql, values: params, table, isInsert: Boolean(insert) };
}

module.exports = { translate, bind, loadMetadata };
