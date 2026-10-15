const { db } = require('../config/db');

const createGenerationJob = async (job) => {
  await db.query(
    `INSERT INTO ai_checklist_generation_jobs
       (ai_checklist_job_id, entity_code, requested_by, scope_entity_code, source_file_name,
        source_mime, focus, checklist_type, model_name, requested_question_count, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing')`,
    [
      job.ai_checklist_job_id, job.entity_code, job.requested_by, job.scope_entity_code || null,
      job.source_file_name, job.source_mime, job.focus || null, job.checklist_type || null,
      job.model_name, job.requested_question_count,
    ]
  );
};

const saveSuggestions = async (jobId, suggestions) => {
  if (!suggestions.length) return;
  const values = suggestions.map((item) => [
    item.ai_checklist_suggestion_id, jobId, item.entity_code, item.org_tree_id || null,
    item.entity_type, item.entity_name, item.question_text, item.answer_type,
    JSON.stringify(item.options || []), item.source_reference || null, item.rationale || null,
  ]);
  await db.query(
    `INSERT INTO ai_checklist_question_suggestions
       (ai_checklist_suggestion_id, ai_checklist_job_id, entity_code, org_tree_id, entity_type,
        entity_name, question_text, answer_type, options_json, source_reference, rationale)
     VALUES ?`,
    [values]
  );
};

const completeGenerationJob = (jobId, generatedCount, issues) => db.query(
  `UPDATE ai_checklist_generation_jobs
   SET status = 'completed', generated_question_count = ?, issues_json = ?, completed_at = NOW()
   WHERE ai_checklist_job_id = ?`,
  [generatedCount, JSON.stringify(issues || []), jobId]
);

const failGenerationJob = (jobId, message) => db.query(
  `UPDATE ai_checklist_generation_jobs
   SET status = 'failed', error_message = ?, completed_at = NOW()
   WHERE ai_checklist_job_id = ?`,
  [String(message || 'Generation failed.').slice(0, 500), jobId]
);

const finalizeSuggestions = async ({ jobId, entityCode, requestedBy, acceptedIds = [] }) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [jobs] = await connection.query(
      `SELECT ai_checklist_job_id
         FROM ai_checklist_generation_jobs
        WHERE ai_checklist_job_id = ? AND entity_code = ? AND requested_by = ?
        FOR UPDATE`,
      [jobId, entityCode, requestedBy]
    );
    if (!jobs.length) {
      const error = new Error('AI generation session not found.');
      error.statusCode = 404;
      throw error;
    }

    await connection.query(
      `UPDATE ai_checklist_question_suggestions
          SET status = 'discarded'
        WHERE ai_checklist_job_id = ?`,
      [jobId]
    );

    const ids = [...new Set((acceptedIds || []).map(String).filter(Boolean))].slice(0, 250);
    let acceptedCount = 0;
    if (ids.length) {
      const marks = ids.map(() => '?').join(',');
      const [result] = await connection.query(
        `UPDATE ai_checklist_question_suggestions
            SET status = 'accepted'
          WHERE ai_checklist_job_id = ?
            AND ai_checklist_suggestion_id IN (${marks})`,
        [jobId, ...ids]
      );
      acceptedCount = result.affectedRows;
    }

    await connection.commit();
    return acceptedCount;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = { createGenerationJob, saveSuggestions, completeGenerationJob, failGenerationJob, finalizeSuggestions };
