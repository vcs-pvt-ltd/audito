-- Workspace-scoped organization link targets.
-- Apply this migration manually before deploying the matching backend/frontend.

ALTER TABLE organization_links
  ADD COLUMN target_workspace_type VARCHAR(50) NULL AFTER target_level,
  ADD COLUMN target_workspace_code VARCHAR(20) NULL AFTER target_workspace_type,
  ADD COLUMN target_org_tree_id VARCHAR(20) NULL AFTER target_workspace_code;

-- Existing links targeted a registered root entity directly, so that entity is
-- also the approving workspace. Existing tree links have no selected child edge.
UPDATE organization_links
SET target_workspace_type = target_type,
    target_workspace_code = target_code
WHERE target_workspace_type IS NULL
   OR target_workspace_code IS NULL;

ALTER TABLE organization_links
  MODIFY COLUMN target_workspace_type VARCHAR(50) NOT NULL,
  MODIFY COLUMN target_workspace_code VARCHAR(20) NOT NULL,
  ADD INDEX idx_org_links_target_workspace
    (target_workspace_type, target_workspace_code, status, is_active),
  ADD INDEX idx_org_links_target_tree (target_org_tree_id);
