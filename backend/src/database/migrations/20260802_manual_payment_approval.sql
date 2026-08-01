-- Temporary manual-payment approval workflow.
-- Apply this migration manually before deploying the matching backend/frontend.

ALTER TABLE payment_transactions
  ADD COLUMN manual_approval_status ENUM('not_requested','requested','approved')
    NOT NULL DEFAULT 'not_requested' AFTER gateway_status,
  ADD COLUMN manual_approval_requested_at DATETIME NULL AFTER manual_approval_status,
  ADD COLUMN manual_approval_reviewed_at DATETIME NULL AFTER manual_approval_requested_at,
  ADD COLUMN manual_approval_reviewed_by VARCHAR(20) NULL AFTER manual_approval_reviewed_at,
  ADD INDEX idx_payment_manual_approval_queue
    (manual_approval_status, status, manual_approval_requested_at),
  ADD INDEX idx_payment_manual_approval_reviewer (manual_approval_reviewed_by);

