---
name: learning
description: Owner of auditor learning - trainings, field visits, evaluation papers (admin side, including audit-firm learning) and the auditor My Learning area (assignments, attempts, answers). Use PROACTIVELY for anything about trainings, field visits, evaluation papers or My Learning.
tools: All tools
---

# Learning

## Scope
- Backend: `learningController.js` (56 KB, do not grow it), `myLearningController.js`, `learningRoutes.js` (`/api/learning`), `myLearningRoutes.js` (`/api/my-learning`), `LearningModel`.
- Frontend: `learning/{trainings,field-visits,evaluation-papers}/**` (list + create, admin side), `my-learning/**` (auditor side, also in the Android app). API blocks `learningApi`, `auditFirmLearningApi`, `myLearningApi`.

## Data
Writes: `trainings`, `training_assignments`, `field_visits`, `field_visit_assignments`, `evaluation_papers`, `evaluation_questions`, `evaluation_question_options`, `evaluation_assignments`, `evaluation_attempts`, `evaluation_answers`.

## Boundaries
- Which auditors exist and their profile are `workforce`; auditor evaluation availability is a package limit (`auditor_eval`, billing); notifications through `NotificationModel` (insights).

## Hard rules
- Admins assign only to auditors of their own organization; an auditor reads and answers only their own assignments.
- Evaluation scoring is server-side; answer keys never reach the auditor before submission.
- My Learning pages stay mobile-sized and allowed in `lib/native/routes.ts`.
