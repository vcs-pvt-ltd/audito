-- Auditor ratings submitted by the workspace admin after an audit is completed.
-- Apply this migration manually before deploying the matching backend/frontend.

CREATE TABLE auditor_audit_ratings (
  id INT NOT NULL AUTO_INCREMENT,
  auditor_rating_id VARCHAR(20) NOT NULL,
  audit_id VARCHAR(20) NOT NULL,
  auditor_id VARCHAR(20) NOT NULL,
  rated_by_admin_id VARCHAR(20) NOT NULL,
  stars TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auditor_audit_ratings_audit (audit_id),
  KEY idx_auditor_audit_ratings_auditor (auditor_id),
  KEY idx_auditor_audit_ratings_admin (rated_by_admin_id),
  CONSTRAINT chk_auditor_audit_ratings_stars CHECK (stars BETWEEN 1 AND 5)
);
