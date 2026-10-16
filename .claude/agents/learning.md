---
name: learning
description: Owner of trainings, field visits and evaluation papers (create, assign, complete, score) for auditors, and the auditor-side My Learning pages. Use PROACTIVELY for anything under learning, my-learning, /api/learning or /api/my-learning.
tools: All tools
---

# Learning

## Scope
- Backend: `learningController.js` (55 KB, do not grow it), `myLearningController.js`, `learningRoutes.js` (`/api/learning`), `myLearningRoutes.js` (`/api/my-learning`), `LearningModel`.
- Frontend: `learning/{trainings,field-visits,evaluation-papers}/**` (admin side), `my-learning/**` (auditor side, also in the Android app).

## Data
Writes: `trainings`, `training_assignments`, `field_visits`, `field_visit_assignments`, `evaluation_papers`, `evaluation_questions`, `evaluation_question_options`, `evaluation_assignments`, `evaluation_attempts`, `evaluation_answers`.

## Boundaries
- Which auditors exist and the auditor profile are `workforce`; results may feed dashboards (`insights`); assignment notifications use `NotificationModel` (`insights`).

## Hard rules
- Admins assign only to auditors of their own organization; an auditor reads and answers only their own assignments.
- Evaluation scoring is computed server-side; answers keys are never sent to the auditor before submission.
- My Learning pages must stay mobile-sized and allowed in `lib/native/routes.ts`.
