-- Audito AI public knowledge base
-- Review and run this file manually. It is not executed automatically by the application.

CREATE TABLE `ai_knowledge_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ai_knowledge_setting_id` VARCHAR(20) NOT NULL,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ai_knowledge_setting_id` (`ai_knowledge_setting_id`),
  UNIQUE KEY `uq_ai_knowledge_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ai_knowledge_sources` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ai_knowledge_source_id` VARCHAR(20) NOT NULL,
  `source_type` ENUM('article', 'document') NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `category` VARCHAR(80) DEFAULT NULL,
  `tags_json` JSON DEFAULT NULL,
  `body_content` MEDIUMTEXT DEFAULT NULL,
  `source_file_name` VARCHAR(255) DEFAULT NULL,
  `source_mime` VARCHAR(120) DEFAULT NULL,
  `storage_path` VARCHAR(500) DEFAULT NULL,
  `openai_file_id` VARCHAR(100) DEFAULT NULL,
  `vector_store_file_id` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('draft', 'processing', 'published', 'failed', 'archived') NOT NULL DEFAULT 'draft',
  `error_message` VARCHAR(500) DEFAULT NULL,
  `published_at` TIMESTAMP NULL DEFAULT NULL,
  `created_by` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ai_knowledge_source_id` (`ai_knowledge_source_id`),
  KEY `idx_ai_knowledge_status` (`status`),
  KEY `idx_ai_knowledge_openai_file` (`openai_file_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
