/**
 * Checklist Model
 *
 * Handles DB operations for:
 *   checklist_types
 *   checklists
 *   checklist_questions
 *   checklist_question_options
 */

const { db } = require('../config/db');

const ChecklistModel = {

  // ── CHECKLIST TYPES ──────────────────────────────────────────────

  async createType({ name, description, created_by }) {
    const [res] = await db.query(
      `INSERT INTO checklist_types (name, description, created_by)
       VALUES (?, ?, ?)`,
      [name, description || null, created_by]
    );
    return res.insertId;
  },

  async findTypeById(id) {
    const [rows] = await db.query(
      'SELECT * FROM checklist_types WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async listTypes(created_by) {
    const codes = Array.isArray(created_by) ? created_by : [created_by];
    const ph = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT * FROM checklist_types WHERE created_by IN (${ph}) AND is_active = TRUE ORDER BY created_at DESC`,
      codes
    );
    return rows;
  },

  async updateType(id, { name, description }) {
    const [res] = await db.query(
      'UPDATE checklist_types SET name = ?, description = ? WHERE id = ?',
      [name, description || null, id]
    );
    return res.affectedRows > 0;
  },

  async deactivateType(id) {
    await db.query(
      'UPDATE checklist_types SET is_active = FALSE WHERE id = ?',
      [id]
    );
  },

  // ── CHECKLISTS ───────────────────────────────────────────────────

  async create({ name, description, media_path, checklist_type_id,
                 time_period_value, time_period_unit,
                 repeat_duration_value, repeat_duration_unit,
                 budget, currency, num_workers, created_by }) {
    const [res] = await db.query(
      `INSERT INTO checklists
         (name, description, media_path, checklist_type_id,
          time_period_value, time_period_unit,
          repeat_duration_value, repeat_duration_unit,
          budget, currency, num_workers, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, media_path || null,
       checklist_type_id || null,
       time_period_value || null, time_period_unit || null,
       repeat_duration_value || null, repeat_duration_unit || null,
       budget || null, currency || '$', num_workers || null, created_by]
    );
    return res.insertId;
  },

  async findById(id) {
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS checklist_type_name
       FROM checklists c
       LEFT JOIN checklist_types ct ON c.checklist_type_id = ct.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async list(created_by) {
    const codes = Array.isArray(created_by) ? created_by : [created_by];
    const ph = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS checklist_type_name,
              (
                SELECT COUNT(*)
                FROM audit_assignments aa
                WHERE aa.checklist_id = c.id
                  AND aa.is_active = TRUE
                  AND aa.status != 'cancelled'
              ) AS assigned_audit_count
       FROM checklists c
       LEFT JOIN checklist_types ct ON c.checklist_type_id = ct.id
       WHERE c.created_by IN (${ph}) AND c.is_active = TRUE
       ORDER BY c.created_at DESC`,
      codes
    );
    return rows;
  },

  async update(id, { name, description, media_path, checklist_type_id,
                     time_period_value, time_period_unit,
                     repeat_duration_value, repeat_duration_unit,
                     budget, currency, num_workers }) {
    const [res] = await db.query(
      `UPDATE checklists
       SET name = ?, description = ?, media_path = ?, checklist_type_id = ?,
           time_period_value = ?, time_period_unit = ?,
           repeat_duration_value = ?, repeat_duration_unit = ?,
           budget = ?, currency = ?, num_workers = ?
       WHERE id = ?`,
      [name, description || null, media_path || null, checklist_type_id || null,
       time_period_value || null, time_period_unit || null,
       repeat_duration_value || null, repeat_duration_unit || null,
       budget || null, currency || '$', num_workers || null,
       id]
    );
    return res.affectedRows > 0;
  },

  async deactivate(id) {
    await db.query('UPDATE checklists SET is_active = FALSE WHERE id = ?', [id]);
  },

  async deleteChecklistCascade(id) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `DELETE qo
         FROM checklist_question_options qo
         INNER JOIN checklist_questions qq ON qq.id = qo.question_id
         WHERE qq.checklist_id = ?`,
        [id]
      );

      await conn.query(
        'DELETE FROM checklist_questions WHERE checklist_id = ?',
        [id]
      );

      await conn.query(
        'DELETE FROM checklists WHERE id = ?',
        [id]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  // ── QUESTIONS ────────────────────────────────────────────────────

  async createQuestion({ checklist_id, entity_code, org_tree_id, entity_type,
                          entity_name, question_text, answer_type, total_marks, order_index }, executor = db) {
    const [res] = await executor.query(
      `INSERT INTO checklist_questions
         (checklist_id, entity_code, org_tree_id, entity_type, entity_name,
          question_text, answer_type, total_marks, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checklist_id,
        entity_code,
        org_tree_id ?? null,
        entity_type,
        entity_name || null,
        question_text,
        answer_type,
        total_marks || 10,
        order_index || 0,
      ]
    );
    return res.insertId;
  },

  async findQuestionById(id) {
    const [rows] = await db.query(
      'SELECT * FROM checklist_questions WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  async listQuestions(checklist_id) {
    const [rows] = await db.query(
      `SELECT * FROM checklist_questions
       WHERE checklist_id = ? AND is_active = TRUE
       ORDER BY entity_code, org_tree_id, order_index`,
      [checklist_id]
    );
    return rows;
  },

  async deleteQuestion(id) {
    await db.query('DELETE FROM checklist_questions WHERE id = ?', [id]);
  },

  async deleteQuestionsByChecklist(checklist_id) {
    await db.query('DELETE FROM checklist_questions WHERE checklist_id = ?', [checklist_id]);
  },

  // ── QUESTION OPTIONS ─────────────────────────────────────────────

  async createOption({ question_id, option_text, marks, order_index }, executor = db) {
    const [res] = await executor.query(
      `INSERT INTO checklist_question_options (question_id, option_text, marks, order_index)
       VALUES (?, ?, ?, ?)`,
      [question_id, option_text, marks || 0, order_index || 0]
    );
    return res.insertId;
  },

  async listOptions(question_id) {
    const [rows] = await db.query(
      'SELECT * FROM checklist_question_options WHERE question_id = ? ORDER BY order_index',
      [question_id]
    );
    return rows;
  },

  async deleteOptions(question_id) {
    await db.query('DELETE FROM checklist_question_options WHERE question_id = ?', [question_id]);
  },

  async updateQuestion(id, { question_text, answer_type, entity_code, org_tree_id, entity_type, entity_name, total_marks, order_index }) {
    const [res] = await db.query(
      `UPDATE checklist_questions 
       SET question_text = ?, answer_type = ?, entity_code = ?, org_tree_id = ?, entity_type = ?, 
           entity_name = ?, total_marks = ?, order_index = ?
       WHERE id = ?`,
      [
        question_text,
        answer_type,
        entity_code,
        org_tree_id ?? null,
        entity_type,
        entity_name || null,
        total_marks || 10,
        order_index || 0,
        id,
      ]
    );
    return res.affectedRows > 0;
  },

  // ── BULK HELPERS ─────────────────────────────────────────────────

  async getChecklistWithQuestions(checklist_id) {
    const checklist = await this.findById(checklist_id);
    if (!checklist) return null;

    const questions = await this.listQuestions(checklist_id);

    for (const q of questions) {
      q.options = await this.listOptions(q.id);
    }

    const entitiesMap = {};
    for (const q of questions) {
      const k = `${q.entity_code}__${q.org_tree_id ?? 'null'}`;
      if (!entitiesMap[k]) {
        entitiesMap[k] = {
          entity_code: q.entity_code,
          org_tree_id: q.org_tree_id ?? null,
          entity_type: q.entity_type,
          entity_name: q.entity_name,
          questions: []
        };
      }
      entitiesMap[k].questions.push(q);
    }

    return {
      ...checklist,
      entity_questions: Object.values(entitiesMap)
    };
  }
};

module.exports = ChecklistModel;
