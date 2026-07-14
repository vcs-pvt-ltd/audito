/**
 * Name Normalization & Duplicate Detection Utility
 *
 * Provides one consistent rule for deciding whether two names are
 * "the same" for uniqueness-checking purposes, so that entries like:
 *
 *    Section 01, section 01, Section 1, section 1,
 *    Section1,   section1,   Section01, section01
 *
 * are all recognised as duplicates of one another, regardless of:
 *   - letter case          (Section vs section)
 *   - spacing              (Section 01 vs Section01)
 *   - leading zeros in numbers (01 vs 1)
 *
 * The normalization is ONLY used for comparison. The original,
 * user-typed name (with its own casing/spacing) is always what gets
 * stored and displayed.
 */

/**
 * Normalize a name for duplicate comparison.
 *  1. Lower-cases the string
 *  2. Strips ALL whitespace ("Section 01" -> "section01")
 *  3. Strips leading zeros from numeric runs ("01" -> "1", "007" -> "7")
 *
 * @param {string} name
 * @returns {string} normalized comparison key
 */
function normalizeEntityName(name) {
  if (name === null || name === undefined) return '';
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')          // remove all spaces/tabs/newlines
    .replace(/0+(\d)/g, '$1');    // strip leading zeros in number runs
}

/**
 * Checks whether a normalized-duplicate of `name` already exists in `table`,
 * scoped by whatever extra WHERE conditions the caller supplies (e.g. the
 * owning organization's code, an is_active flag, etc).
 *
 * Because the "same name" rule (case/space/leading-zero insensitive) can't
 * be expressed as a portable, indexable SQL predicate, this fetches the
 * (small, org-scoped) candidate rows and compares normalized keys in JS.
 *
 * @param {object} opts
 * @param {object} opts.db             - db pool/connection exposing .query(sql, params)
 * @param {string} opts.table          - table to search
 * @param {string} opts.nameColumn     - column holding the name/title
 * @param {string} opts.name           - the new name being validated
 * @param {string[]} [opts.whereClauses] - extra raw SQL conditions, e.g. ["created_by = ?", "is_active = TRUE"]
 * @param {Array}  [opts.whereParams]    - params matching whereClauses, in the same order
 * @param {string} [opts.idColumn]     - identifying column to return/exclude on (default 'id')
 * @param {*}      [opts.excludeId]    - value of idColumn to exclude (used on update, to allow saving a record with its own unchanged name)
 *
 * @returns {Promise<{id: *, name: string}|null>} the conflicting row, or null if no duplicate
 */
async function findDuplicateName({
  db,
  table,
  nameColumn,
  name,
  whereClauses = [],
  whereParams = [],
  idColumn = 'id',
  excludeId = null
}) {
  const normalizedInput = normalizeEntityName(name);
  if (!normalizedInput) return null;

  let query = `SELECT \`${idColumn}\` AS _id, \`${nameColumn}\` AS _name FROM \`${table}\` WHERE 1=1`;
  const params = [];

  for (const clause of whereClauses) {
    query += ` AND ${clause}`;
  }
  params.push(...whereParams);

  if (excludeId !== null && excludeId !== undefined) {
    query += ` AND \`${idColumn}\` != ?`;
    params.push(excludeId);
  }

  const [rows] = await db.query(query, params);

  for (const row of rows) {
    if (normalizeEntityName(row._name) === normalizedInput) {
      return { id: row._id, name: row._name };
    }
  }
  return null;
}

module.exports = { normalizeEntityName, findDuplicateName };