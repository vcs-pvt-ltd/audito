const ChecklistModel = require('../models/ChecklistModel');
const LimitsEnforcer = require('../utils/limitsEnforcer');
const { generateChecklistId, generateChecklistQuestionId, generateChecklistQuestionOptionId } = require('../utils/codeGenerator');
const { validateChecklist } = require('./onboardingDraftService');
const { normalizeEntityName } = require('../utils/nameNormalizer');

async function publishChecklist(connection, session, nodes, created) {
  const draft = validateChecklist(session.onboarding_draft, nodes);
  const c = draft.checklist;
  const limitError = await LimitsEnforcer.checkChecklistLimit(session.root_entity_code);
  if (limitError) { const error = new Error(limitError); error.statusCode = 403; throw error; }
  const [types] = await connection.query('SELECT checklist_type_id FROM checklist_types WHERE checklist_type_id = ? AND created_by = ? AND is_active = TRUE', [c.checklist_type_id, session.root_entity_code]);
  if (!types.length) throw new Error('Choose a checklist type belonging to your organization.');
  const [duplicates] = await connection.query('SELECT name FROM checklists WHERE created_by = ? AND is_active = TRUE', [session.root_entity_code]);
  if (duplicates.some(row => normalizeEntityName(row.name) === normalizeEntityName(c.name))) throw new Error('A checklist with this name already exists. Choose another name.');
  const id = await generateChecklistId(connection);
  await ChecklistModel.create({ ...c, checklist_id: id, created_by: session.root_entity_code }, connection);
  for (let index = 0; index < draft.questions.length; index++) {
    const q = draft.questions[index];
    const target = q.node_id === '__root__' ? { code: session.root_entity_code, edge_id: null, entity_type: session.root_entity_type } : created.get(q.node_id);
    if (!target) throw new Error('A question points to an unavailable organization area.');
    const questionId = await generateChecklistQuestionId(connection);
    await ChecklistModel.createQuestion({ checklist_question_id: questionId, checklist_id: id, entity_code: target.code,
      org_tree_id: target.edge_id, entity_type: target.entity_type, entity_name: target.name || null,
      question_text: q.question_text, answer_type: q.answer_type, total_marks: 10, order_index: index }, connection);
    for (let optionIndex = 0; optionIndex < q.options.length; optionIndex++) {
      await ChecklistModel.createOption({ ...q.options[optionIndex], checklist_question_option_id: await generateChecklistQuestionOptionId(connection),
        checklist_question_id: questionId, order_index: optionIndex }, connection);
    }
  }
  return id;
}
module.exports = { publishChecklist };
