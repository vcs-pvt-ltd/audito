const { db } = require('../config/db');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const NotificationModel = require('../models/NotificationModel');

function ensureAdmin(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    errorResponse(res, 'Authentication required.', 401);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trainings (video links)
// ─────────────────────────────────────────────────────────────────────────────

const listTrainings = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const [rows] = await db.query(
      `SELECT t.*, (
          SELECT COUNT(*) FROM training_assignments a WHERE a.training_id = t.id
        ) AS assigned_count
       FROM trainings t
       WHERE t.afc_code = ?
       ORDER BY t.created_at DESC`,
      [req.user.entityCode]
    );

    const [assignments] = await db.query(
      `SELECT a.id AS assignment_id, a.assigned_at, a.completed_at, a.status AS assignment_status,
              t.id AS training_id, t.title AS training_title,
              u.user_code AS auditor_user_code, u.first_name AS auditor_first_name, u.last_name AS auditor_last_name, u.email AS auditor_email
       FROM training_assignments a
       JOIN trainings t ON a.training_id = t.id
       JOIN auditors u ON a.auditor_user_code = u.user_code
       WHERE t.afc_code = ?
       ORDER BY a.assigned_at DESC`,
      [req.user.entityCode]
    );

    return successResponse(res, { trainings: rows, assignments });
  } catch (err) {
    console.error('listTrainings error:', err);
    return errorResponse(res, 'Failed to list trainings.', 500);
  }
};

const createTraining = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const missing = validateRequiredFields(req.body, ['title', 'video_url']);
    if (missing) return errorResponse(res, missing, 400);

    const { title, platform, video_url, description, duration_minutes } = req.body;

    const [result] = await db.query(
      `INSERT INTO trainings (afc_code, title, platform, video_url, description, duration_minutes, created_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.entityCode, title, platform || null, video_url, description || null, duration_minutes || null, req.user.id]
    );

    return successResponse(res, { id: result.insertId }, 'Training created.', 201);
  } catch (err) {
    console.error('createTraining error:', err);
    return errorResponse(res, 'Failed to create training.', 500);
  }
};

const updateTraining = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    const { title, platform, video_url, description, duration_minutes } = req.body;

    await db.query(
      `UPDATE trainings
       SET title = COALESCE(?, title),
           platform = COALESCE(?, platform),
           video_url = COALESCE(?, video_url),
           description = COALESCE(?, description),
           duration_minutes = COALESCE(?, duration_minutes)
       WHERE id = ? AND afc_code = ?`,
      [title ?? null, platform ?? null, video_url ?? null, description ?? null, duration_minutes ?? null, id, req.user.entityCode]
    );

    return successResponse(res, null, 'Training updated.');
  } catch (err) {
    console.error('updateTraining error:', err);
    return errorResponse(res, 'Failed to update training.', 500);
  }
};

const deleteTraining = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;

    // Block deletion while the training is still assigned to auditors.
    const [assigned] = await db.query(
      'SELECT 1 FROM training_assignments WHERE training_id = ? LIMIT 1',
      [id]
    );
    if (assigned.length > 0) {
      return errorResponse(res, 'This training is assigned to one or more auditors and cannot be deleted. Remove those assignments first.', 409);
    }

    await db.query(
      'DELETE FROM trainings WHERE id = ? AND afc_code = ?',
      [id, req.user.entityCode]
    );

    return successResponse(res, null, 'Training deleted.');
  } catch (err) {
    console.error('deleteTraining error:', err);
    return errorResponse(res, 'Failed to delete training.', 500);
  }
};

const assignTraining = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    const { auditor_codes } = req.body;
    if (!Array.isArray(auditor_codes) || auditor_codes.length === 0) {
      return errorResponse(res, 'auditor_codes must be a non-empty array.', 400);
    }

    const [tRows] = await db.query('SELECT id, title FROM trainings WHERE id = ? AND afc_code = ? LIMIT 1', [id, req.user.entityCode]);
    if (tRows.length === 0) return errorResponse(res, 'Training not found.', 404);
    const trainingTitle = tRows[0].title || 'Training';

    const values = auditor_codes.map((c) => [Number(id), String(c), req.user.id]);
    await db.query(
      `INSERT INTO training_assignments (training_id, auditor_user_code, assigned_by_admin_id)
       VALUES ?
       ON DUPLICATE KEY UPDATE assigned_by_admin_id = VALUES(assigned_by_admin_id), assigned_at = CURRENT_TIMESTAMP`,
      [values]
    );

    await Promise.all(auditor_codes.map((code) =>
      NotificationModel.createIfNotExists({
        auditor_code: String(code),
        created_by_entity_code: req.user.entityCode,
        type: 'training_assigned',
        title: 'Training Assigned',
        message: `You have been assigned a training: "${trainingTitle}".`,
        notification_key: `training_assigned:${id}:${String(code)}`,
      })
    ));

    return successResponse(res, null, 'Training assigned.');
  } catch (err) {
    console.error('assignTraining error:', err);
    return errorResponse(res, 'Failed to assign training.', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Field Visits
// ─────────────────────────────────────────────────────────────────────────────

const listFieldVisits = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const [rows] = await db.query(
      `SELECT v.*, (
          SELECT COUNT(*) FROM field_visit_assignments a WHERE a.field_visit_id = v.id
        ) AS assigned_count
       FROM field_visits v
       WHERE v.afc_code = ?
       ORDER BY v.created_at DESC`,
      [req.user.entityCode]
    );

    const [assignments] = await db.query(
      `SELECT a.id AS assignment_id, a.assigned_at, a.check_in_time, a.check_out_time, a.status AS assignment_status,
              v.id AS field_visit_id, v.title AS field_visit_title, v.location_name, v.start_date, v.end_date,
              u.user_code AS auditor_user_code, u.first_name AS auditor_first_name, u.last_name AS auditor_last_name, u.email AS auditor_email
       FROM field_visit_assignments a
       JOIN field_visits v ON a.field_visit_id = v.id
       JOIN auditors u ON a.auditor_user_code = u.user_code
       WHERE v.afc_code = ?
       ORDER BY a.assigned_at DESC`,
      [req.user.entityCode]
    );

    return successResponse(res, { field_visits: rows, assignments });
  } catch (err) {
    console.error('listFieldVisits error:', err);
    return errorResponse(res, 'Failed to list field visits.', 500);
  }
};

const createFieldVisit = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const missing = validateRequiredFields(req.body, ['title']);
    if (missing) return errorResponse(res, missing, 400);

    const {
      title,
      location_name,
      address,
      latitude,
      longitude,
      start_date,
      end_date,
      notes,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO field_visits (afc_code, title, location_name, address, latitude, longitude, start_date, end_date, notes, created_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.entityCode,
        title,
        location_name || null,
        address || null,
        latitude || null,
        longitude || null,
        start_date || null,
        end_date || null,
        notes || null,
        req.user.id,
      ]
    );

    return successResponse(res, { id: result.insertId }, 'Field visit created.', 201);
  } catch (err) {
    console.error('createFieldVisit error:', err);
    return errorResponse(res, 'Failed to create field visit.', 500);
  }
};

const updateFieldVisit = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    const {
      title,
      location_name,
      address,
      latitude,
      longitude,
      start_date,
      end_date,
      notes,
    } = req.body;

    await db.query(
      `UPDATE field_visits
       SET title = COALESCE(?, title),
           location_name = COALESCE(?, location_name),
           address = COALESCE(?, address),
           latitude = COALESCE(?, latitude),
           longitude = COALESCE(?, longitude),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           notes = COALESCE(?, notes)
       WHERE id = ? AND afc_code = ?`,
      [
        title ?? null,
        location_name ?? null,
        address ?? null,
        latitude ?? null,
        longitude ?? null,
        start_date ?? null,
        end_date ?? null,
        notes ?? null,
        id,
        req.user.entityCode,
      ]
    );

    return successResponse(res, null, 'Field visit updated.');
  } catch (err) {
    console.error('updateFieldVisit error:', err);
    return errorResponse(res, 'Failed to update field visit.', 500);
  }
};

const deleteFieldVisit = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;

    // Block deletion while the field visit is still assigned to auditors.
    const [assigned] = await db.query(
      'SELECT 1 FROM field_visit_assignments WHERE field_visit_id = ? LIMIT 1',
      [id]
    );
    if (assigned.length > 0) {
      return errorResponse(res, 'This field visit is assigned to one or more auditors and cannot be deleted. Remove those assignments first.', 409);
    }

    await db.query('DELETE FROM field_visits WHERE id = ? AND afc_code = ?', [id, req.user.entityCode]);

    return successResponse(res, null, 'Field visit deleted.');
  } catch (err) {
    console.error('deleteFieldVisit error:', err);
    return errorResponse(res, 'Failed to delete field visit.', 500);
  }
};

const assignFieldVisit = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    const { auditor_codes } = req.body;
    if (!Array.isArray(auditor_codes) || auditor_codes.length === 0) {
      return errorResponse(res, 'auditor_codes must be a non-empty array.', 400);
    }

    const [vRows] = await db.query('SELECT id, title FROM field_visits WHERE id = ? AND afc_code = ? LIMIT 1', [id, req.user.entityCode]);
    if (vRows.length === 0) return errorResponse(res, 'Field visit not found.', 404);
    const visitTitle = vRows[0].title || 'Field Visit';

    const values = auditor_codes.map((c) => [Number(id), String(c), req.user.id]);
    await db.query(
      `INSERT INTO field_visit_assignments (field_visit_id, auditor_user_code, assigned_by_admin_id)
       VALUES ?
       ON DUPLICATE KEY UPDATE assigned_by_admin_id = VALUES(assigned_by_admin_id), assigned_at = CURRENT_TIMESTAMP`,
      [values]
    );

    await Promise.all(auditor_codes.map((code) =>
      NotificationModel.createIfNotExists({
        auditor_code: String(code),
        created_by_entity_code: req.user.entityCode,
        type: 'field_visit_assigned',
        title: 'Field Visit Assigned',
        message: `You have been assigned a field visit: "${visitTitle}".`,
        notification_key: `field_visit_assigned:${id}:${String(code)}`,
      })
    ));

    return successResponse(res, null, 'Field visit assigned.');
  } catch (err) {
    console.error('assignFieldVisit error:', err);
    return errorResponse(res, 'Failed to assign field visit.', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation Papers (Quiz)
// ─────────────────────────────────────────────────────────────────────────────

const listEvaluationPapers = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const [rows] = await db.query(
      `SELECT p.*, (
          SELECT COUNT(*) FROM evaluation_questions q WHERE q.paper_id = p.id
        ) AS question_count,
        (
          SELECT COUNT(*) FROM evaluation_assignments a WHERE a.paper_id = p.id
        ) AS assigned_count
       FROM evaluation_papers p
       WHERE p.afc_code = ?
       ORDER BY p.created_at DESC`,
      [req.user.entityCode]
    );

    const [assignments] = await db.query(
      `SELECT a.id AS assignment_id, a.assigned_at, a.due_date, a.status AS assignment_status,
              p.id AS paper_id, p.title AS paper_title, p.pass_marks,
              u.user_code AS auditor_user_code, u.first_name AS auditor_first_name, u.last_name AS auditor_last_name, u.email AS auditor_email,
              att.score, att.max_score, att.passed, att.submitted_at
       FROM evaluation_assignments a
       JOIN evaluation_papers p ON a.paper_id = p.id
       JOIN auditors u ON a.auditor_user_code = u.user_code
       LEFT JOIN (
         SELECT paper_id, auditor_user_code, MAX(id) AS max_attempt_id
         FROM evaluation_attempts
         GROUP BY paper_id, auditor_user_code
       ) latest_attempt ON p.id = latest_attempt.paper_id AND u.user_code = latest_attempt.auditor_user_code
       LEFT JOIN evaluation_attempts att ON latest_attempt.max_attempt_id = att.id
       WHERE p.afc_code = ?
       ORDER BY a.assigned_at DESC`,
      [req.user.entityCode]
    );

    return successResponse(res, { papers: rows, assignments });
  } catch (err) {
    console.error('listEvaluationPapers error:', err);
    return errorResponse(res, 'Failed to list evaluation papers.', 500);
  }
};

const createEvaluationPaper = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const missing = validateRequiredFields(req.body, ['title']);
    if (missing) return errorResponse(res, missing, 400);

    let { title, description, time_limit_minutes, pass_marks, available_from, available_to, is_active } = req.body;
    // normalize pass_marks to percentage (0-100)
    if (pass_marks !== undefined && pass_marks !== null) {
      const pm = Number(pass_marks);
      pass_marks = Number.isFinite(pm) ? pm : null;
      if (pass_marks != null) {
        if (pass_marks < 0) pass_marks = 0;
        if (pass_marks > 100) pass_marks = 100;
      }
    }

    const [result] = await db.query(
      `INSERT INTO evaluation_papers (afc_code, title, description, time_limit_minutes, pass_marks, available_from, available_to, is_active, created_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.entityCode,
        title,
        description || null,
        time_limit_minutes || null,
        pass_marks || null,
        available_from || null,
        available_to || null,
        is_active === undefined ? 1 : (is_active ? 1 : 0),
        req.user.id,
      ]
    );

    return successResponse(res, { id: result.insertId }, 'Evaluation paper created.', 201);
  } catch (err) {
    console.error('createEvaluationPaper error:', err);
    return errorResponse(res, 'Failed to create evaluation paper.', 500);
  }
};

const updateEvaluationPaper = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    let { title, description, time_limit_minutes, pass_marks, available_from, available_to, is_active } = req.body;
    if (pass_marks !== undefined && pass_marks !== null) {
      const pm = Number(pass_marks);
      pass_marks = Number.isFinite(pm) ? pm : null;
      if (pass_marks != null) {
        if (pass_marks < 0) pass_marks = 0;
        if (pass_marks > 100) pass_marks = 100;
      }
    }

    await db.query(
      `UPDATE evaluation_papers
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           time_limit_minutes = COALESCE(?, time_limit_minutes),
           pass_marks = COALESCE(?, pass_marks),
           available_from = COALESCE(?, available_from),
           available_to = COALESCE(?, available_to),
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND afc_code = ?`,
      [
        title ?? null,
        description ?? null,
        time_limit_minutes ?? null,
        pass_marks ?? null,
        available_from ?? null,
        available_to ?? null,
        is_active === undefined ? null : (is_active ? 1 : 0),
        id,
        req.user.entityCode,
      ]
    );

    return successResponse(res, null, 'Evaluation paper updated.');
  } catch (err) {
    console.error('updateEvaluationPaper error:', err);
    return errorResponse(res, 'Failed to update evaluation paper.', 500);
  }
};

const deleteEvaluationPaper = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;

    // Block deletion while the paper is still assigned to auditors (which would
    // also orphan their attempts/answers).
    const [assigned] = await db.query(
      'SELECT 1 FROM evaluation_assignments WHERE paper_id = ? LIMIT 1',
      [id]
    );
    if (assigned.length > 0) {
      return errorResponse(res, 'This evaluation paper is assigned to one or more auditors and cannot be deleted. Remove those assignments first.', 409);
    }

    // No assignments → safe to cascade-delete the paper's own questions/options.
    const [qRows] = await db.query('SELECT id FROM evaluation_questions WHERE paper_id = ?', [id]);
    const qIds = qRows.map((r) => r.id);
    if (qIds.length > 0) {
      const placeholders = qIds.map(() => '?').join(',');
      await db.query(`DELETE FROM evaluation_question_options WHERE question_id IN (${placeholders})`, qIds);
    }

    await db.query('DELETE FROM evaluation_questions WHERE paper_id = ?', [id]);
    await db.query('DELETE FROM evaluation_papers WHERE id = ? AND afc_code = ?', [id, req.user.entityCode]);

    return successResponse(res, null, 'Evaluation paper deleted.');
  } catch (err) {
    console.error('deleteEvaluationPaper error:', err);
    return errorResponse(res, 'Failed to delete evaluation paper.', 500);
  }
};

const setEvaluationQuestions = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return errorResponse(res, 'questions must be a non-empty array.', 400);
    }

    const [pRows] = await db.query('SELECT id FROM evaluation_papers WHERE id = ? AND afc_code = ? LIMIT 1', [id, req.user.entityCode]);
    if (pRows.length === 0) return errorResponse(res, 'Evaluation paper not found.', 404);

    const [existingCountRows] = await db.query(
      'SELECT COUNT(*) AS cnt FROM evaluation_questions WHERE paper_id = ?',
      [id]
    );
    const existingCount = existingCountRows?.[0]?.cnt ? Number(existingCountRows[0].cnt) : 0;
    if (existingCount > 0) {
      return errorResponse(res, 'Questions can only be uploaded once for a paper. Create a new paper to upload a new set of questions.', 400);
    }

    // Replace all questions/options for simplicity
    const [oldQRows] = await db.query('SELECT id FROM evaluation_questions WHERE paper_id = ?', [id]);
    const oldQIds = oldQRows.map((r) => r.id);
    if (oldQIds.length > 0) {
      const placeholders = oldQIds.map(() => '?').join(',');
      await db.query(`DELETE FROM evaluation_question_options WHERE question_id IN (${placeholders})`, oldQIds);
    }
    await db.query('DELETE FROM evaluation_questions WHERE paper_id = ?', [id]);

    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const qText = q.question_text;
      const marks = q.marks ?? 10;
      const sortOrder = q.sort_order ?? i;
      const answerTypeRaw = q.answer_type || q.answerType || q.answer_type_raw || null;
      const normalizedType = answerTypeRaw ? String(answerTypeRaw).toLowerCase().replace(/[\s_-]+/g, '') : 'singleoption';
      const ANSWER_TYPE_MAP = {
        freetext: 'free_text',
        free_text: 'free_text',
        'free text': 'free_text',
        singleoption: 'single_option',
        single_option: 'single_option',
        dropdown: 'dropdown',
        multipleoptions: 'multiple_options',
        multiple_option: 'multiple_options',
        multiple_options: 'multiple_options',
      };
      const answer_type = ANSWER_TYPE_MAP[normalizedType] || 'single_option';
      const opts = Array.isArray(q.options) ? q.options : [];

      if (!qText || !String(qText).trim()) {
        return errorResponse(res, `Invalid question_text at index ${i}.`, 400);
      }
      if (answer_type !== 'free_text') {
        if (opts.length < 2) {
          return errorResponse(res, `Each question must have at least 2 options (index ${i}).`, 400);
        }
        const marksSum = opts.reduce((s, o) => s + (Number(o.marks) || 0), 0);
        if (Math.abs(marksSum - Number(marks)) > 0.01) {
          return errorResponse(res, `Option marks must sum to ${marks} (index ${i}).`, 400);
        }
      }

      const [qRes] = await db.query(
        `INSERT INTO evaluation_questions (paper_id, question_text, answer_type, marks, question_type, sort_order)
         VALUES (?, ?, ?, ?, 'mcq_single', ?)`,
        [id, qText, answer_type, marks, sortOrder]
      );
      const questionId = qRes.insertId;

      if (answer_type !== 'free_text') {
        const optValues = opts.map((o, idx) => [
          questionId,
          String(o.option_text || ''),
          Number(o.marks) || 0,
          idx,
        ]);
        await db.query(
          `INSERT INTO evaluation_question_options (question_id, option_text, marks, order_index)
           VALUES ?`,
          [optValues]
        );
      }
    }

    return successResponse(res, null, 'Questions updated.');
  } catch (err) {
    console.error('setEvaluationQuestions error:', err);
    return errorResponse(res, 'Failed to set questions.', 500);
  }
};

function parseQuestionsFromExcelBuffer({ buffer }) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['Template'];
  if (!ws) {
    const err = new Error('Excel file must contain a "Template" sheet.');
    err.statusCode = 400;
    throw err;
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) {
    const err = new Error('No data rows found in the Template sheet.');
    err.statusCode = 400;
    throw err;
  }
  return { rows };
}

const downloadEvaluationExcelTemplate = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Audito 3.0';
    const ws = wb.addWorksheet('Template');

    ws.columns = [
      { header: 'Question', key: 'question', width: 55 },
      { header: 'answer_type', key: 'answer_type', width: 18 },
      { header: 'answer_options', key: 'answer_options', width: 45 },
      { header: 'answer_points', key: 'answer_points', width: 25 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.addRow(['Is this compliant?', 'SingleOption', 'Yes,No', '10,0']);
    ws.addRow(['Select compliance level', 'Dropdown', 'Full,Partial,None', '10,0,0']);
    ws.addRow(['Select all applicable items', 'MultipleOptions', 'A,B,C', '4,3,3']);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="evaluation_paper_questions_template.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('downloadEvaluationExcelTemplate error:', err);
    return errorResponse(res, 'Failed to generate template.', 500);
  }
};

const previewEvaluationQuestionsExcel = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;
    if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

    const { rows } = parseQuestionsFromExcelBuffer({ buffer: req.file.buffer });
    const rawHeaders = rows[0].map(h => String(h).trim());
    const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim() !== ''));
    const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

    const getColByName = (row, name) => {
      const idx = lowerHeaders.indexOf(name.toLowerCase());
      return idx >= 0 ? String(row[idx] || '').trim() : '';
    };

    const ANSWER_TYPE_MAP = {
      freetext: 'free_text',
      free_text: 'free_text',
      'free text': 'free_text',
      singleoption: 'single_option',
      single_option: 'single_option',
      dropdown: 'dropdown',
      multipleoptions: 'multiple_options',
      multiple_options: 'multiple_options',
    };

    const errors = [];
    const questions = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      const question_text = getColByName(row, 'question');
      const answer_type_raw = getColByName(row, 'answer_type');
      const answer_opts_str = getColByName(row, 'answer_options');
      const answer_pts_str = getColByName(row, 'answer_points');
      const marks = 10;

      if (!question_text || !answer_type_raw) {
        errors.push(`Row ${rowNum}: Missing required fields (Question, answer_type).`);
        continue;
      }

      const normalizedType = answer_type_raw.toLowerCase().replace(/[\s_-]+/g, '');
      const answer_type = ANSWER_TYPE_MAP[normalizedType] || ANSWER_TYPE_MAP[answer_type_raw.toLowerCase()];
      if (!answer_type || answer_type === 'free_text') {
        errors.push(`Row ${rowNum}: Invalid or unsupported answer_type "${answer_type_raw}". Free text is not allowed.`);
        continue;
      }

      const options = [];
      const optTexts = answer_opts_str.split(',').map(s => s.trim()).filter(Boolean);
      const optPoints = answer_pts_str.split(',').map(s => Number(String(s).trim()));
      if (optTexts.length === 0) {
        errors.push(`Row ${rowNum}: answer_options is required.`);
        continue;
      }
      if (optTexts.length !== optPoints.filter(n => !Number.isNaN(n)).length) {
        errors.push(`Row ${rowNum}: answer_options and answer_points must have the same number of entries.`);
        continue;
      }
      for (let o = 0; o < optTexts.length; o++) {
        options.push({ option_text: optTexts[o], marks: Number.isNaN(optPoints[o]) ? 0 : optPoints[o] });
      }
      const sum = options.reduce((s, o) => s + (Number(o.marks) || 0), 0);
      if (Math.abs(sum - 10) > 0.01) {
        errors.push(`Row ${rowNum}: answer_points must sum up to exactly 10 (got ${sum.toFixed(2)}).`);
        continue;
      }

      questions.push({
        rowNum,
        question_text,
        answer_type,
        marks,
        options,
      });
    }

    return successResponse(res, { questions, errors, total: questions.length });
  } catch (err) {
    console.error('previewEvaluationQuestionsExcel error:', err);
    return errorResponse(res, 'Failed to process Excel file.', 500);
  }
};

const uploadEvaluationQuestionsExcel = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const { id } = req.params;

    const [pRows] = await db.query('SELECT id FROM evaluation_papers WHERE id = ? AND afc_code = ? LIMIT 1', [id, req.user.entityCode]);
    if (pRows.length === 0) return errorResponse(res, 'Evaluation paper not found.', 404);

    const [existingCountRows] = await db.query(
      'SELECT COUNT(*) AS cnt FROM evaluation_questions WHERE paper_id = ?',
      [id]
    );
    const existingCount = existingCountRows?.[0]?.cnt ? Number(existingCountRows[0].cnt) : 0;
    if (existingCount > 0) {
      return errorResponse(res, 'Questions can only be uploaded once for a paper. Create a new paper to upload a new set of questions.', 400);
    }
    if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

    const { rows } = parseQuestionsFromExcelBuffer({ buffer: req.file.buffer });
    const rawHeaders = rows[0].map(h => String(h).trim());
    const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim() !== ''));
    const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

    const getColByName = (row, name) => {
      const idx = lowerHeaders.indexOf(name.toLowerCase());
      return idx >= 0 ? String(row[idx] || '').trim() : '';
    };

    const ANSWER_TYPE_MAP = {
      freetext: 'free_text',
      free_text: 'free_text',
      'free text': 'free_text',
      singleoption: 'single_option',
      single_option: 'single_option',
      dropdown: 'dropdown',
      multipleoptions: 'multiple_options',
      multiple_options: 'multiple_options',
    };

    const errors = [];
    const parsedRows = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;

      const question_text = getColByName(row, 'question');
      const answer_type_raw = getColByName(row, 'answer_type');
      const answer_opts_str = getColByName(row, 'answer_options');
      const answer_pts_str = getColByName(row, 'answer_points');
      const marks = 10;

      if (!question_text || !answer_type_raw) {
        errors.push(`Row ${rowNum}: Missing required fields (Question, answer_type).`);
        continue;
      }

      const normalizedType = answer_type_raw.toLowerCase().replace(/[\s_-]+/g, '');
      const answer_type = ANSWER_TYPE_MAP[normalizedType] || ANSWER_TYPE_MAP[answer_type_raw.toLowerCase()];
      if (!answer_type || answer_type === 'free_text') {
        errors.push(`Row ${rowNum}: Invalid or unsupported answer_type "${answer_type_raw}". Free text is not allowed.`);
        continue;
      }

      const options = [];
      const optTexts = answer_opts_str.split(',').map(s => s.trim()).filter(Boolean);
      const optPoints = answer_pts_str.split(',').map(s => Number(String(s).trim()));
      if (optTexts.length === 0) {
        errors.push(`Row ${rowNum}: answer_options is required.`);
        continue;
      }
      if (optTexts.length !== optPoints.filter(n => !Number.isNaN(n)).length) {
        errors.push(`Row ${rowNum}: answer_options and answer_points must have the same number of entries.`);
        continue;
      }
      for (let o = 0; o < optTexts.length; o++) {
        options.push({ option_text: optTexts[o], marks: Number.isNaN(optPoints[o]) ? 0 : optPoints[o] });
      }
      const sum = options.reduce((s, o) => s + (Number(o.marks) || 0), 0);
      if (Math.abs(sum - 10) > 0.01) {
        errors.push(`Row ${rowNum}: answer_points must sum up to exactly 10 (got ${sum.toFixed(2)}).`);
        continue;
      }

      parsedRows.push({ question_text, answer_type, marks, options });
    }

    if (errors.length > 0) {
      return errorResponse(res, `Validation failed in ${errors.length} row(s). No questions were imported.`, 400, errors);
    }

    // Replace existing questions/options and insert new ones
    const [oldQRows] = await db.query('SELECT id FROM evaluation_questions WHERE paper_id = ?', [id]);
    const oldQIds = oldQRows.map((r) => r.id);
    if (oldQIds.length > 0) {
      const placeholders = oldQIds.map(() => '?').join(',');
      await db.query(`DELETE FROM evaluation_question_options WHERE question_id IN (${placeholders})`, oldQIds);
    }
    await db.query('DELETE FROM evaluation_questions WHERE paper_id = ?', [id]);

    const connection = await db.getConnection();
    let created = 0;
    try {
      await connection.beginTransaction();

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const [qRes] = await connection.query(
          `INSERT INTO evaluation_questions (paper_id, question_text, answer_type, marks, question_type, sort_order)
           VALUES (?, ?, ?, ?, 'mcq_single', ?)`,
          [id, row.question_text, row.answer_type, row.marks, i]
        );
        const questionId = qRes.insertId;

        if (row.answer_type !== 'free_text') {
          const optValues = row.options.map((o, idx) => [questionId, String(o.option_text || ''), Number(o.marks) || 0, idx]);
          await connection.query(
            `INSERT INTO evaluation_question_options (question_id, option_text, marks, order_index)
             VALUES ?`,
            [optValues]
          );
        }
        created++;
      }

      await connection.commit();
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }

    return successResponse(res, { created_count: created }, `${created} question(s) uploaded.`);
  } catch (err) {
    console.error('uploadEvaluationQuestionsExcel error:', err);
    return errorResponse(res, 'Failed to process Excel file.', 500);
  }
};

const assignEvaluationPaper = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { id } = req.params;
    const { auditor_codes, due_date } = req.body;

    if (!Array.isArray(auditor_codes) || auditor_codes.length === 0) {
      return errorResponse(res, 'auditor_codes must be a non-empty array.', 400);
    }

    const [pRows] = await db.query('SELECT id, title FROM evaluation_papers WHERE id = ? AND afc_code = ? LIMIT 1', [id, req.user.entityCode]);
    if (pRows.length === 0) return errorResponse(res, 'Evaluation paper not found.', 404);
    const paperTitle = pRows[0].title || 'Evaluation Paper';

    const values = auditor_codes.map((c) => [Number(id), String(c), req.user.id, due_date || null]);
    await db.query(
      `INSERT INTO evaluation_assignments (paper_id, auditor_user_code, assigned_by_admin_id, due_date)
       VALUES ?
       ON DUPLICATE KEY UPDATE assigned_by_admin_id = VALUES(assigned_by_admin_id), assigned_at = CURRENT_TIMESTAMP, due_date = VALUES(due_date)`,
      [values]
    );

    await Promise.all(auditor_codes.map((code) =>
      NotificationModel.createIfNotExists({
        auditor_code: String(code),
        created_by_entity_code: req.user.entityCode,
        type: 'evaluation_assigned',
        title: 'Evaluation Paper Assigned',
        message: `You have been assigned an evaluation paper: "${paperTitle}".`,
        notification_key: `evaluation_assigned:${id}:${String(code)}`,
      })
    ));

    return successResponse(res, null, 'Evaluation paper assigned.');
  } catch (err) {
    console.error('assignEvaluationPaper error:', err);
    return errorResponse(res, 'Failed to assign evaluation paper.', 500);
  }
};

module.exports = {
  listTrainings,
  createTraining,
  updateTraining,
  deleteTraining,
  assignTraining,
  listFieldVisits,
  createFieldVisit,
  updateFieldVisit,
  deleteFieldVisit,
  assignFieldVisit,
  listEvaluationPapers,
  createEvaluationPaper,
  updateEvaluationPaper,
  deleteEvaluationPaper,
  setEvaluationQuestions,
  assignEvaluationPaper,
  downloadEvaluationExcelTemplate,
  previewEvaluationQuestionsExcel,
  uploadEvaluationQuestionsExcel,
};

