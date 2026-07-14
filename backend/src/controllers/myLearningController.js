const { db } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');
const { generateEvaluationAttemptId, generateEvaluationAnswerId, generateEvaluationAnswerIds } = require('../utils/codeGenerator');

// Ensure the user is an auditor
function ensureAuditor(req, res) {
  if (!req.user || req.user.role !== 'auditor') {
    errorResponse(res, 'Auditor authentication required.', 403);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// My Trainings
// ─────────────────────────────────────────────────────────────────────────────

const listMyTrainings = async (req, res) => {
  try {
    if (!ensureAuditor(req, res)) return;

    const [rows] = await db.query(
      `SELECT a.training_assignment_id AS assignment_id, a.status AS status, a.assigned_at, a.completed_at,
              t.training_id, t.title, t.platform, t.video_url, t.description, t.duration_minutes
       FROM training_assignments a
       JOIN trainings t ON a.training_id = t.training_id
       WHERE a.auditor_id = ?
       ORDER BY a.assigned_at DESC`,
      [req.user.userCode]
    );

    return successResponse(res, { trainings: rows });
  } catch (err) {
    console.error('listMyTrainings error:', err);
    return errorResponse(res, 'Failed to fetch your trainings.', 500);
  }
};

const completeTraining = async (req, res) => {
  try {
    if (!ensureAuditor(req, res)) return;

    const { assignmentId } = req.params;

    const [result] = await db.query(
      `UPDATE training_assignments
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE training_assignment_id = ? AND auditor_id = ?`,
      [assignmentId, req.user.userCode]
    );

    if (result.affectedRows === 0) {
      return errorResponse(res, 'Training assignment not found or unauthorized.', 404);
    }

    return successResponse(res, null, 'Training marked as completed.');
  } catch (err) {
    console.error('completeTraining error:', err);
    return errorResponse(res, 'Failed to complete training.', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// My Field Visits
// ─────────────────────────────────────────────────────────────────────────────

const listMyFieldVisits = async (req, res) => {
  try {
    if (!ensureAuditor(req, res)) return;

    const [rows] = await db.query(
      `SELECT a.field_visit_assignment_id AS assignment_id, a.status AS status, a.assigned_at, a.check_in_time, a.check_out_time,
              v.field_visit_id, v.title, v.location_name, v.address, v.latitude, v.longitude, v.start_date, v.end_date, v.notes
       FROM field_visit_assignments a
       JOIN field_visits v ON a.field_visit_id = v.field_visit_id
       WHERE a.auditor_id = ?
       ORDER BY a.assigned_at DESC`,
      [req.user.userCode]
    );

    return successResponse(res, { field_visits: rows });
  } catch (err) {
    console.error('listMyFieldVisits error:', err);
    return errorResponse(res, 'Failed to fetch your field visits.', 500);
  }
};

const completeFieldVisit = async (req, res) => {
  try {
    if (!ensureAuditor(req, res)) return;

    const { assignmentId } = req.params;

    const [result] = await db.query(
      `UPDATE field_visit_assignments
       SET status = 'completed', check_in_time = COALESCE(check_in_time, CURRENT_TIMESTAMP), check_out_time = CURRENT_TIMESTAMP
       WHERE field_visit_assignment_id = ? AND auditor_id = ?`,
      [assignmentId, req.user.userCode]
    );

    if (result.affectedRows === 0) {
      return errorResponse(res, 'Field visit assignment not found or unauthorized.', 404);
    }

    return successResponse(res, null, 'Field visit marked as completed.');
  } catch (err) {
    console.error('completeFieldVisit error:', err);
    return errorResponse(res, 'Failed to complete field visit.', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// My Evaluation Papers
// ─────────────────────────────────────────────────────────────────────────────

const listMyEvaluationPapers = async (req, res) => {
  try {
    if (!ensureAuditor(req, res)) return;

    const [rows] = await db.query(
      `SELECT a.evaluation_assignment_id AS assignment_id, a.status AS status, a.assigned_at, a.due_date,
              p.evaluation_paper_id AS paper_id, p.title, p.description, p.time_limit_minutes, p.pass_marks,
              (SELECT COUNT(*) FROM evaluation_questions q WHERE q.paper_id = p.evaluation_paper_id) AS question_count,
              att.submitted_at AS last_submitted_at, att.score AS last_score, att.max_score AS last_max_score
       FROM evaluation_assignments a
       JOIN evaluation_papers p ON a.paper_id = p.evaluation_paper_id
       LEFT JOIN (
         SELECT paper_id, auditor_id, MAX(evaluation_attempt_id) AS max_attempt_id
         FROM evaluation_attempts
         WHERE auditor_id = ?
         GROUP BY paper_id, auditor_id
       ) latest_attempt ON p.evaluation_paper_id = latest_attempt.paper_id
       LEFT JOIN evaluation_attempts att ON latest_attempt.max_attempt_id = att.evaluation_attempt_id
       WHERE a.auditor_id = ? AND p.is_active = 1
       ORDER BY a.assigned_at DESC`,
      [req.user.userCode, req.user.userCode]
    );

    return successResponse(res, { papers: rows });
  } catch (err) {
    console.error('listMyEvaluationPapers error:', err);
    return errorResponse(res, 'Failed to fetch evaluation papers.', 500);
  }
};

const getMyEvaluationPaper = async (req, res) => {
  try {
    if (!ensureAuditor(req, res)) return;

    const { paperId } = req.params;

    // Check assignment
    const [assignments] = await db.query(
      `SELECT evaluation_assignment_id AS id, due_date, status FROM evaluation_assignments
       WHERE paper_id = ? AND auditor_id = ? LIMIT 1`,
      [paperId, req.user.userCode]
    );

    if (assignments.length === 0) {
      return errorResponse(res, 'You are not assigned to this evaluation paper.', 403);
    }

    const assignment = assignments[0];

    // Get paper
    const [papers] = await db.query(
      `SELECT evaluation_paper_id AS id, title, description, time_limit_minutes, pass_marks
       FROM evaluation_papers
       WHERE evaluation_paper_id = ? AND is_active = 1 LIMIT 1`,
      [paperId]
    );

    if (papers.length === 0) {
      return errorResponse(res, 'Evaluation paper not found.', 404);
    }

    // Get questions
    const [questions] = await db.query(
      `SELECT evaluation_question_id AS id, question_text, marks, sort_order
       FROM evaluation_questions
       WHERE paper_id = ?
       ORDER BY sort_order ASC, evaluation_question_id ASC`,
      [paperId]
    );

    // Get options for each question
    const qIds = questions.map((q) => q.id);
    let options = [];
    if (qIds.length > 0) {
      const placeholders = qIds.map(() => '?').join(',');
      [options] = await db.query(
        `SELECT evaluation_question_option_id AS id, question_id, option_text, marks
         FROM evaluation_question_options
         WHERE question_id IN (${placeholders})
         ORDER BY evaluation_question_option_id ASC`,
        qIds
      );
    }

    // Map options to questions
    const mappedQuestions = questions.map((q) => {
      return {
        ...q,
        answer_type: 'single_option', // Evaluation paper questions are MCQ Single Option
        options: options.filter((o) => o.question_id === q.id),
      };
    });

    return successResponse(res, {
      paper: {
        ...papers[0],
        due_date: assignment.due_date,
        assignment_status: assignment.status,
      },
      questions: mappedQuestions,
    });
  } catch (err) {
    console.error('getMyEvaluationPaper error:', err);
    return errorResponse(res, 'Failed to fetch evaluation paper details.', 500);
  }
};

const submitMyEvaluationPaper = async (req, res) => {
  try {
    if (!ensureAuditor(req, res)) return;

    const { paperId } = req.params;
    const { answers } = req.body; // Array of { question_id, selected_option_id }

    if (!Array.isArray(answers)) {
      return errorResponse(res, 'answers must be an array.', 400);
    }

    // Check assignment
    const [assignments] = await db.query(
      `SELECT evaluation_assignment_id AS id, due_date FROM evaluation_assignments
       WHERE paper_id = ? AND auditor_id = ? LIMIT 1`,
      [paperId, req.user.userCode]
    );

    if (assignments.length === 0) {
      return errorResponse(res, 'You are not assigned to this evaluation paper.', 403);
    }

    const assignment = assignments[0];

    // Check closing date
    if (assignment.due_date && new Date() > new Date(assignment.due_date)) {
      return errorResponse(res, 'The closing date for this evaluation paper has passed. Submission is no longer allowed.', 400);
    }

    // Get paper
    const [papers] = await db.query(
      `SELECT evaluation_paper_id AS id, pass_marks FROM evaluation_papers WHERE evaluation_paper_id = ? AND is_active = 1 LIMIT 1`,
      [paperId]
    );
    if (papers.length === 0) {
      return errorResponse(res, 'Evaluation paper not found.', 404);
    }
    const paper = papers[0];

    // Get all questions and correct options
    const [questions] = await db.query(
      `SELECT evaluation_question_id AS id, marks FROM evaluation_questions WHERE paper_id = ?`,
      [paperId]
    );

    const qIds = questions.map((q) => q.id);
    let allOptions = [];
    if (qIds.length > 0) {
      const placeholders = qIds.map(() => '?').join(',');
      [allOptions] = await db.query(
        `SELECT evaluation_question_option_id AS id, question_id, marks FROM evaluation_question_options WHERE question_id IN (${placeholders})`,
        qIds
      );
    }

    // Calculate score
    let totalScore = 0;
    let maxScore = questions.reduce((sum, q) => sum + Number(q.marks || 0), 0);

    const processedAnswers = [];

    for (const q of questions) {
      const ans = answers.find((a) => String(a.question_id) === String(q.id));
      const selectedOptionId = ans ? String(ans.selected_option_id) : null;

      let isCorrect = 0;
      let marksAwarded = 0;

      if (selectedOptionId) {
        const opt = allOptions.find((o) => String(o.id) === selectedOptionId && String(o.question_id) === String(q.id));
        if (opt) {
          marksAwarded = Number(opt.marks || 0);
          if (marksAwarded === Number(q.marks)) {
            isCorrect = 1;
          }
          totalScore += marksAwarded;
        }
      }

      processedAnswers.push({
        question_id: q.id,
        selected_option_id: selectedOptionId,
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
      });
    }

    // Calculate percentage score and determine pass/fail against pass_marks (which is stored as percent)
    const percentScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const passed = paper.pass_marks != null ? (percentScore >= Number(paper.pass_marks) ? 1 : 0) : null;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Create evaluation attempt
      const attemptId = await generateEvaluationAttemptId();
      await connection.query(
        `INSERT INTO evaluation_attempts (evaluation_attempt_id, paper_id, auditor_id, score, max_score, passed, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [attemptId, paperId, req.user.userCode, totalScore, maxScore, passed]
      );

      // Create evaluation answers
      if (processedAnswers.length > 0) {
  const answerIds = await generateEvaluationAnswerIds(processedAnswers.length);
  const answerValues = processedAnswers.map((ans, i) => [
    answerIds[i],
    attemptId,
    ans.question_id,
    ans.selected_option_id,
    ans.is_correct,
    ans.marks_awarded,
  ]);

  await connection.query(
    `INSERT INTO evaluation_answers (evaluation_answer_id, attempt_id, question_id, selected_option_id, is_correct, marks_awarded)
     VALUES ?`,
    [answerValues]
  );
}

      // Update assignment status to 'submitted'
      await connection.query(
        `UPDATE evaluation_assignments
         SET status = 'submitted'
         WHERE evaluation_assignment_id = ?`,
        [assignment.id]
      );

      await connection.commit();

      return successResponse(res, {
        score: totalScore,
        max_score: maxScore,
        percent: percentScore,
        passed: passed === 1,
      }, 'Evaluation paper submitted successfully.');
    } catch (txErr) {
      await connection.rollback();
      throw txErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('submitMyEvaluationPaper error:', err);
    return errorResponse(res, 'Failed to submit evaluation paper.', 500);
  }
};

module.exports = {
  listMyTrainings,
  completeTraining,
  listMyFieldVisits,
  completeFieldVisit,
  listMyEvaluationPapers,
  getMyEvaluationPaper,
  submitMyEvaluationPaper,
};
