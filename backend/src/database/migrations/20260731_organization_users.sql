-- Organization Users
-- Apply this migration manually before deploying the matching application code.
-- The existing entity_heads table is retained so authentication and historical
-- references continue to work without a disruptive table/role rename.

CREATE TABLE IF NOT EXISTS organization_user_scopes (
  scope_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_head_id VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  org_tree_id VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  entity_code VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  entity_type VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  scope_mode ENUM('EXACT', 'SUBTREE') NOT NULL DEFAULT 'EXACT',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_admin_id VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (scope_id),
  UNIQUE KEY uq_organization_user_scope (entity_head_id, org_tree_id),
  KEY idx_organization_user_scopes_user (entity_head_id, is_active),
  KEY idx_organization_user_scopes_tree (org_tree_id, is_active),
  KEY idx_organization_user_scopes_entity (entity_code, is_active),
  CONSTRAINT fk_organization_user_scopes_user
    FOREIGN KEY (entity_head_id) REFERENCES entity_heads (entity_head_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

START TRANSACTION;

-- Preserve every existing Organization User's current behavior: its assigned node and
-- all descendants become one SUBTREE scope.
INSERT INTO organization_user_scopes (
  entity_head_id,
  org_tree_id,
  entity_code,
  entity_type,
  scope_mode,
  is_active,
  created_by_admin_id
)
SELECT
  eh.entity_head_id,
  eh.assigned_org_tree_id,
  eh.assigned_entity_code,
  eh.assigned_entity_type,
  'SUBTREE',
  1,
  eh.created_by_admin_id
FROM entity_heads eh
WHERE eh.is_active = TRUE
  AND eh.assigned_entity_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM organization_user_scopes ous
    WHERE ous.entity_head_id = eh.entity_head_id
      AND (
        ous.org_tree_id = eh.assigned_org_tree_id
        OR (ous.org_tree_id IS NULL AND eh.assigned_org_tree_id IS NULL)
      )
  );

-- Consolidate the user-facing type. The internal role remains entity_head until
-- route guards and historical references can be renamed independently.
UPDATE entity_heads
SET user_type = 'Organization User'
WHERE role = 'entity_head'
  AND user_type <> 'Organization User';

COMMIT;
