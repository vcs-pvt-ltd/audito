-- A corrective action created from a sub-CAP is linked through cap_response_id
-- and has no source audit response. Keep audit_response_id for audit-originated
-- actions, but allow it to be NULL for CAP-originated actions.
ALTER TABLE corrective_actions
  MODIFY audit_response_id VARCHAR(20) NULL;
