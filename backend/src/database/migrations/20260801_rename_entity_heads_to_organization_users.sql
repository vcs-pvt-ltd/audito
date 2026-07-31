-- Full Organization User terminology migration.
-- Apply after 20260731_organization_users.sql and before deploying the renamed
-- backend/frontend. Existing identifier VALUES (for example EH-000001) are
-- intentionally preserved.

ALTER TABLE organization_user_scopes
  DROP FOREIGN KEY fk_organization_user_scopes_user;

ALTER TABLE corrective_actions
  DROP FOREIGN KEY fk_corrective_actions_entity_head;

ALTER TABLE entity_heads
  DROP FOREIGN KEY fk_entity_heads_admin;

RENAME TABLE entity_heads TO organization_users;

ALTER TABLE organization_users
  CHANGE COLUMN entity_head_id organization_user_id
    VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  MODIFY COLUMN role
    VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
    DEFAULT 'organization_user',
  DROP INDEX entity_head_id,
  ADD UNIQUE KEY organization_user_id (organization_user_id);

UPDATE organization_users
SET role = 'organization_user'
WHERE role = 'entity_head';

UPDATE refresh_tokens
SET user_role = 'organization_user'
WHERE user_role = 'entity_head';

-- Expand the enum before rewriting existing notification rows, then remove the
-- legacy role once no rows depend on it.
ALTER TABLE user_notifications
  MODIFY COLUMN recipient_role
    ENUM('admin', 'auditor', 'entity_head', 'organization_user', 'audito_admin')
    COLLATE utf8mb4_unicode_ci NOT NULL;

UPDATE user_notifications
SET recipient_role = 'organization_user'
WHERE recipient_role = 'entity_head';

ALTER TABLE user_notifications
  MODIFY COLUMN recipient_role
    ENUM('admin', 'auditor', 'organization_user', 'audito_admin')
    COLLATE utf8mb4_unicode_ci NOT NULL;

ALTER TABLE organization_user_scopes
  CHANGE COLUMN entity_head_id organization_user_id
    VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;

ALTER TABLE corrective_actions
  CHANGE COLUMN responsible_entity_head_id responsible_organization_user_id
    VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  DROP INDEX idx_responsible,
  ADD KEY idx_responsible_organization_user (responsible_organization_user_id);

ALTER TABLE organization_users
  ADD CONSTRAINT fk_organization_users_admin
    FOREIGN KEY (created_by_admin_id) REFERENCES admins (admin_id)
    ON DELETE CASCADE;

ALTER TABLE organization_user_scopes
  ADD CONSTRAINT fk_organization_user_scopes_user
    FOREIGN KEY (organization_user_id)
    REFERENCES organization_users (organization_user_id)
    ON DELETE CASCADE;

ALTER TABLE corrective_actions
  ADD CONSTRAINT fk_corrective_actions_organization_user
    FOREIGN KEY (responsible_organization_user_id)
    REFERENCES organization_users (organization_user_id)
    ON DELETE SET NULL;
