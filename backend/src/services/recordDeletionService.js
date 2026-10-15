const { db } = require('../config/db');
const TokenWalletModel = require('../models/TokenWalletModel');

function placeholders(values) {
  return values.map(() => '?').join(',');
}

async function collectCapTree(connection, rootCapId) {
  const orderedIds = [];
  const seen = new Set();
  let pending = [rootCapId];

  while (pending.length) {
    const current = pending.filter((id) => id && !seen.has(String(id)));
    if (!current.length) break;

    current.forEach((id) => {
      seen.add(String(id));
      orderedIds.push(String(id));
    });

    const [children] = await connection.query(
      `SELECT cap_id FROM caps WHERE parent_cap_id IN (${placeholders(current)})`,
      current
    );
    pending = children.map((row) => row.cap_id);
  }

  return orderedIds;
}

async function getCapEvidencePaths(connection, capIds) {
  if (!capIds.length) return [];
  const [rows] = await connection.query(
    `SELECT DISTINCT evidence.file_path
       FROM cap_response_evidence evidence
       INNER JOIN cap_responses response ON response.cap_response_id = evidence.cap_response_id
       INNER JOIN cap_questions question ON question.cap_question_id = response.cap_question_id
      WHERE question.cap_id IN (${placeholders(capIds)})`,
    capIds
  );
  return rows.map((row) => row.file_path).filter(Boolean);
}

async function getGeneratedCorrectiveActionIds(connection, capIds) {
  if (!capIds.length) return [];
  const [rows] = await connection.query(
    `SELECT DISTINCT action_item.corrective_action_id
       FROM corrective_actions action_item
       INNER JOIN cap_questions question
         ON question.corrective_action_id = action_item.corrective_action_id
      WHERE question.cap_id IN (${placeholders(capIds)})
        AND action_item.cap_response_id IS NOT NULL`,
    capIds
  );
  return rows.map((row) => row.corrective_action_id).filter(Boolean);
}

async function deleteCapNotifications(connection, auditId, capIds) {
  if (!capIds.length) return;
  const clauses = [];
  const values = [auditId];

  for (const capId of capIds) {
    clauses.push('(notification_key LIKE ? OR notification_key LIKE ?)');
    values.push(`cap_created:${capId}:%`, `sub_cap_created:${capId}:%`);
  }

  await connection.query(
    `DELETE FROM user_notifications
      WHERE audit_id = ? AND (${clauses.join(' OR ')})`,
    values
  );
}

async function deleteCapsInTransaction(connection, capIds, auditId) {
  const evidencePaths = await getCapEvidencePaths(connection, capIds);
  const generatedActionIds = await getGeneratedCorrectiveActionIds(connection, capIds);

  await deleteCapNotifications(connection, auditId, capIds);

  // Delete deepest descendants first. This keeps the operation predictable even
  // on databases where the self-reference uses ON DELETE SET NULL.
  for (const capId of [...capIds].reverse()) {
    await connection.query('DELETE FROM caps WHERE cap_id = ?', [capId]);
  }

  if (generatedActionIds.length) {
    await connection.query(
      `DELETE FROM corrective_actions action_item
        WHERE action_item.corrective_action_id IN (${placeholders(generatedActionIds)})
          AND action_item.audit_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM cap_questions question
            WHERE question.corrective_action_id = action_item.corrective_action_id
          )`,
      [...generatedActionIds, auditId]
    );
  }

  return evidencePaths;
}

async function deleteCap({ capId, ownerEntityCode }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT cap.cap_id, cap.audit_id, audit.created_by
         FROM caps cap
         INNER JOIN audit_assignments audit ON audit.audit_id = cap.audit_id
        WHERE cap.cap_id = ?
        FOR UPDATE`,
      [capId]
    );
    const cap = rows[0];
    if (!cap || String(cap.created_by) !== String(ownerEntityCode)) {
      const error = new Error('CAP not found.');
      error.status = 404;
      throw error;
    }

    const capIds = await collectCapTree(connection, capId);
    const evidencePaths = await deleteCapsInTransaction(connection, capIds, cap.audit_id);

    await connection.commit();
    return { evidencePaths, deletedCaps: capIds.length };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteAudit({ auditId, ownerEntityCode }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT audit_id, created_by
         FROM audit_assignments
        WHERE audit_id = ?
        FOR UPDATE`,
      [auditId]
    );
    const audit = rows[0];
    if (!audit || String(audit.created_by) !== String(ownerEntityCode)) {
      const error = new Error('Audit not found.');
      error.status = 404;
      throw error;
    }

    // Planned audits return held tokens. Burned and legacy-exempt audits do not
    // receive an automatic refund. The immutable token ledger survives the
    // operational audit deletion because it stores the audit reference as text.
    await TokenWalletModel.releaseReservation(connection, auditId, 'audit_deleted');

    const [auditEvidence] = await connection.query(
      `SELECT DISTINCT evidence.file_path
         FROM audit_evidence evidence
         INNER JOIN audit_responses response
           ON response.audit_response_id = evidence.audit_response_id
        WHERE response.audit_id = ?`,
      [auditId]
    );
    const [capRows] = await connection.query(
      'SELECT cap_id FROM caps WHERE audit_id = ?',
      [auditId]
    );
    const capIds = capRows.map((row) => row.cap_id);
    const capEvidencePaths = await getCapEvidencePaths(connection, capIds);

    // These tables intentionally use SET NULL (or may not have a cascade), so
    // remove their audit-specific records before deleting the audit itself.
    await connection.query('DELETE FROM user_notifications WHERE audit_id = ?', [auditId]);
    await connection.query('DELETE FROM auditor_notifications WHERE audit_id = ?', [auditId]);
    await connection.query('DELETE FROM auditor_audit_ratings WHERE audit_id = ?', [auditId]);
    await connection.query('DELETE FROM audit_assignments WHERE audit_id = ?', [auditId]);

    await connection.commit();
    return {
      evidencePaths: [
        ...auditEvidence.map((row) => row.file_path).filter(Boolean),
        ...capEvidencePaths,
      ],
      deletedCaps: capIds.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  deleteAudit,
  deleteCap,
};
