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

  async createType({ checklist_type_id, name, description, created_by }) {
    await db.query(
      `INSERT INTO checklist_types (checklist_type_id, name, description, created_by)
       VALUES (?, ?, ?, ?)`,
      [checklist_type_id, name, description || null, created_by]
    );
    return checklist_type_id;
  },

  async findTypeById(checklist_type_id) {
    const [rows] = await db.query(
      'SELECT * FROM checklist_types WHERE checklist_type_id = ?',
      [checklist_type_id]
    );
    return rows[0] || null;
  },

  async listTypes(created_by) {
    const codes = Array.isArray(created_by) ? created_by : [created_by];
    const ph = codes.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT ct.*,
              (SELECT COUNT(*) FROM checklists c
                WHERE c.checklist_type_id = ct.checklist_type_id AND c.is_active = TRUE) AS checklist_count
       FROM checklist_types ct
       WHERE ct.created_by IN (${ph}) AND ct.is_active = TRUE
       ORDER BY ct.created_at DESC`,
      codes
    );
    return rows;
  },

  async updateType(checklist_type_id, { name, description }) {
    const [res] = await db.query(
      'UPDATE checklist_types SET name = ?, description = ? WHERE checklist_type_id = ?',
      [name, description || null, checklist_type_id]
    );
    return res.affectedRows > 0;
  },

  async deactivateType(checklist_type_id) {
    await db.query(
      'UPDATE checklist_types SET is_active = FALSE WHERE checklist_type_id = ?',
      [checklist_type_id]
    );
  },

  // ── CHECKLISTS ───────────────────────────────────────────────────

  async create({ checklist_id, name, description, media_path, checklist_type_id,
                 time_period_value, time_period_unit,
                 repeat_duration_value, repeat_duration_unit,
                 budget, currency, num_workers, created_by }) {
    await db.query(
      `INSERT INTO checklists
         (checklist_id, name, description, media_path, checklist_type_id,
          time_period_value, time_period_unit,
          repeat_duration_value, repeat_duration_unit,
          budget, currency, num_workers, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [checklist_id, name, description || null, media_path || null,
       checklist_type_id || null,
       time_period_value || null, time_period_unit || null,
       repeat_duration_value || null, repeat_duration_unit || null,
       budget || null, currency || '$', num_workers || null, created_by]
    );
    return checklist_id;
  },

  async findById(checklist_id) {
    const [rows] = await db.query(
      `SELECT c.*, ct.name AS checklist_type_name
       FROM checklists c
       LEFT JOIN checklist_types ct ON c.checklist_type_id = ct.checklist_type_id
       WHERE c.checklist_id = ?`,
      [checklist_id]
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
                 WHERE aa.checklist_id = c.checklist_id
                   AND aa.is_active = TRUE
                   AND aa.status != 'cancelled'
               ) AS assigned_audit_count
        FROM checklists c
        LEFT JOIN checklist_types ct ON c.checklist_type_id = ct.checklist_type_id
        WHERE c.created_by IN (${ph}) AND c.is_active = TRUE
        ORDER BY c.created_at DESC`,
      codes
    );
    return rows;
  },

  async update(checklist_id, { name, description, media_path, checklist_type_id,
                     time_period_value, time_period_unit,
                     repeat_duration_value, repeat_duration_unit,
                     budget, currency, num_workers }) {
    const [res] = await db.query(
      `UPDATE checklists
       SET name = ?, description = ?, media_path = ?, checklist_type_id = ?,
           time_period_value = ?, time_period_unit = ?,
           repeat_duration_value = ?, repeat_duration_unit = ?,
           budget = ?, currency = ?, num_workers = ?
       WHERE checklist_id = ?`,
      [name, description || null, media_path || null, checklist_type_id || null,
       time_period_value || null, time_period_unit || null,
       repeat_duration_value || null, repeat_duration_unit || null,
       budget || null, currency || '$', num_workers || null,
       checklist_id]
    );
    return res.affectedRows > 0;
  },

  async deactivate(checklist_id) {
    await db.query('UPDATE checklists SET is_active = FALSE WHERE checklist_id = ?', [checklist_id]);
  },

  async deleteChecklistCascade(checklist_id) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `DELETE qo
         FROM checklist_question_options qo
         INNER JOIN checklist_questions qq ON qq.checklist_question_id = qo.checklist_question_id
         WHERE qq.checklist_id = ?`,
        [checklist_id]
      );

      await conn.query(
        'DELETE FROM checklist_questions WHERE checklist_id = ?',
        [checklist_id]
      );

      await conn.query(
        'DELETE FROM checklists WHERE checklist_id = ?',
        [checklist_id]
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

  async createQuestion({ checklist_question_id, checklist_id, entity_code, org_tree_id, entity_type,
                          entity_name, question_text, answer_type, total_marks, order_index }, executor = db) {
    await executor.query(
      `INSERT INTO checklist_questions
         (checklist_question_id, checklist_id, entity_code, org_tree_id, entity_type, entity_name,
          question_text, answer_type, total_marks, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checklist_question_id,
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
    return checklist_question_id;
  },

  async findQuestionById(checklist_question_id) {
    const [rows] = await db.query(
      'SELECT * FROM checklist_questions WHERE checklist_question_id = ?',
      [checklist_question_id]
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

  async deleteQuestion(checklist_question_id) {
    await db.query('DELETE FROM checklist_questions WHERE checklist_question_id = ?', [checklist_question_id]);
  },

  async deleteQuestionsByChecklist(checklist_id) {
    await db.query('DELETE FROM checklist_questions WHERE checklist_id = ?', [checklist_id]);
  },

  // ── QUESTION OPTIONS ─────────────────────────────────────────────

  async createOption({ checklist_question_option_id, checklist_question_id, option_text, marks, order_index }, executor = db) {
    await executor.query(
      `INSERT INTO checklist_question_options (checklist_question_option_id, checklist_question_id, option_text, marks, order_index)
       VALUES (?, ?, ?, ?, ?)`,
      [checklist_question_option_id, checklist_question_id, option_text, marks || 0, order_index || 0]
    );
    return checklist_question_option_id;
  },

  async listOptions(checklist_question_id) {
    const [rows] = await db.query(
      'SELECT * FROM checklist_question_options WHERE checklist_question_id = ? ORDER BY order_index',
      [checklist_question_id]
    );
    return rows;
  },

  async deleteOptions(checklist_question_id) {
    await db.query('DELETE FROM checklist_question_options WHERE checklist_question_id = ?', [checklist_question_id]);
  },

  async updateQuestion(checklist_question_id, { question_text, answer_type, entity_code, org_tree_id, entity_type, entity_name, total_marks, order_index }) {
    const [res] = await db.query(
      `UPDATE checklist_questions 
       SET question_text = ?, answer_type = ?, entity_code = ?, org_tree_id = ?, entity_type = ?, 
           entity_name = ?, total_marks = ?, order_index = ?
       WHERE checklist_question_id = ?`,
      [
        question_text,
        answer_type,
        entity_code,
        org_tree_id ?? null,
        entity_type,
        entity_name || null,
        total_marks || 10,
        order_index || 0,
        checklist_question_id,
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
      q.options = await this.listOptions(q.checklist_question_id);
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
