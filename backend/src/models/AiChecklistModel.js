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

module.exports = { createGenerationJob, saveSuggestions, completeGenerationJob, failGenerationJob };
