-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jul 07, 2026
-- Server version: 8.0.36-28
-- PHP Version: 8.1.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `auditov3`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `admin_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `nic` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE KEY,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `account_type` VARCHAR(50) DEFAULT NULL,
  `entity_type` VARCHAR(50) DEFAULT NULL,
  `entity_code` VARCHAR(20) DEFAULT NULL,
  `org_level` TINYINT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT '1',
  `email_verified` TINYINT(1) DEFAULT '0',
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_verified` TINYINT(1) DEFAULT '0',
  `verification_token` VARCHAR(255) DEFAULT NULL,
  `onboarding_completed` TINYINT(1) DEFAULT '0',
  `onboarding_skipped` TINYINT(1) DEFAULT '0',
  `onboarding_completed_at` TIMESTAMP NULL DEFAULT NULL,
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `role` VARCHAR(50) DEFAULT 'admin'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditors`
--

CREATE TABLE `auditors` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `auditor_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE KEY,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `nic` VARCHAR(50) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `role` VARCHAR(50) DEFAULT 'auditor',
  `user_type` VARCHAR(80) DEFAULT 'Auditor',
  `auditor_type` VARCHAR(50) DEFAULT NULL,
  `assigned_entity_type` VARCHAR(50) DEFAULT NULL,
  `assigned_entity_code` VARCHAR(30) DEFAULT NULL,
  `assigned_org_tree_id` VARCHAR(20) DEFAULT NULL,
  `created_by_admin_id` VARCHAR(20) NOT NULL,
  `created_by_entity_code` VARCHAR(30) NOT NULL,
  `email_verified` TINYINT(1) DEFAULT '0',
  `email_token` VARCHAR(255) DEFAULT NULL,
  `email_token_expires` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `onboarding_completed` TINYINT(1) DEFAULT '0',
  `onboarding_skipped` TINYINT(1) DEFAULT '0',
  `onboarding_completed_at` TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_experiences`
--

CREATE TABLE `auditor_experiences` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `auditor_experience_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `auditor_id` VARCHAR(20) NOT NULL,
  `industry_sector` VARCHAR(100) DEFAULT NULL,
  `experience_type` VARCHAR(100) DEFAULT NULL,
  `company_name` VARCHAR(255) DEFAULT NULL,
  `years` INT DEFAULT '0',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_notifications`
--

CREATE TABLE `auditor_notifications` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `auditor_notification_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `auditor_id` VARCHAR(20) NOT NULL,
  `created_by_entity_code` VARCHAR(30) NOT NULL,
  `type` VARCHAR(40) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `audit_id` VARCHAR(20) DEFAULT NULL,
  `notify_date` DATE DEFAULT NULL,
  `notification_key` VARCHAR(255) DEFAULT NULL UNIQUE KEY,
  `is_read` TINYINT(1) DEFAULT '0',
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_profiles`
--

CREATE TABLE `auditor_profiles` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `auditor_profile_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `auditor_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `name_with_initials` VARCHAR(255) DEFAULT NULL,
  `designation` VARCHAR(255) DEFAULT NULL,
  `profile_picture` VARCHAR(500) DEFAULT NULL,
  `gender` ENUM('Male','Female','Other') DEFAULT NULL,
  `date_of_birth` DATE DEFAULT NULL,
  `civil_status` VARCHAR(50) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `district` VARCHAR(100) DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `latitude` DECIMAL(10,8) DEFAULT NULL,
  `longitude` DECIMAL(11,8) DEFAULT NULL,
  `mobile_number` VARCHAR(50) DEFAULT NULL,
  `whatsapp_number` VARCHAR(50) DEFAULT NULL,
  `home_number` VARCHAR(50) DEFAULT NULL,
  `specialized_network` VARCHAR(255) DEFAULT NULL,
  `working_status` ENUM('Employed','Retired') DEFAULT NULL,
  `current_sector` VARCHAR(100) DEFAULT NULL,
  `current_organization` VARCHAR(255) DEFAULT NULL,
  `join_as` VARCHAR(100) DEFAULT NULL,
  `signature_path` VARCHAR(500) DEFAULT NULL,
  `cv_path` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_qualifications`
--

CREATE TABLE `auditor_qualifications` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `auditor_qualification_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `auditor_id` VARCHAR(20) NOT NULL,
  `qualification_name` VARCHAR(255) DEFAULT NULL,
  `university_name` VARCHAR(255) DEFAULT NULL,
  `degree` VARCHAR(100) DEFAULT NULL,
  `year` VARCHAR(4) DEFAULT NULL,
  `certificate_path` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_trainings`
--

CREATE TABLE `auditor_trainings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `auditor_training_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `auditor_id` VARCHAR(20) NOT NULL,
  `training_type` VARCHAR(100) DEFAULT NULL,
  `course_name` VARCHAR(255) DEFAULT NULL,
  `organization` VARCHAR(255) DEFAULT NULL,
  `duration` VARCHAR(100) DEFAULT NULL,
  `year` VARCHAR(4) DEFAULT NULL,
  `certificate_path` VARCHAR(500) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_assignments`
--

CREATE TABLE `audit_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `audit_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `checklist_id` VARCHAR(20) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `audit_type` ENUM('internal','external') DEFAULT 'internal',
  `assigned_auditor_id` VARCHAR(20) DEFAULT NULL,
  `assigned_firm_code` VARCHAR(30) DEFAULT NULL,
  `assigned_org_tree_id` VARCHAR(20) DEFAULT NULL,
  `budget` DECIMAL(15,2) DEFAULT NULL,
  `currency` VARCHAR(10) DEFAULT '$',
  `num_workers` INT DEFAULT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM('plan','in_progress','completed','cancelled') DEFAULT 'plan',
  `notes` TEXT,
  `parent_audit_id` VARCHAR(20) DEFAULT NULL,
  `audit_mode` ENUM('standard','cap_verification') DEFAULT 'standard',
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_by` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_assignment_entities`
--

CREATE TABLE `audit_assignment_entities` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `audit_assignment_entity_id` VARCHAR(20) DEFAULT NULL UNIQUE KEY,
  `audit_id` VARCHAR(20) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `entity_code` VARCHAR(30) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_audit_entity` (`audit_id`,`entity_code`,`org_tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_entity_progress`
--

CREATE TABLE `audit_entity_progress` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `audit_entity_progress_id` VARCHAR(20) DEFAULT NULL UNIQUE KEY,
  `audit_id` VARCHAR(20) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `entity_code` VARCHAR(30) NOT NULL,
  `total_questions` INT DEFAULT '0',
  `answered_questions` INT DEFAULT '0',
  `total_marks` DECIMAL(10,2) DEFAULT '0.00',
  `obtained_marks` DECIMAL(10,2) DEFAULT '0.00',
  `status` ENUM('not_started','in_progress','completed') DEFAULT 'not_started',
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_audit_org_entity` (`audit_id`,`org_tree_id`,`entity_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_evidence`
--

CREATE TABLE `audit_evidence` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `audit_evidence_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `audit_response_id` VARCHAR(20) NOT NULL,
  `file_type` ENUM('image','video','audio') NOT NULL,
  `file_path` VARCHAR(1000) NOT NULL,
  `file_name` VARCHAR(255) DEFAULT NULL,
  `file_size` INT DEFAULT '0',
  `uploaded_by` VARCHAR(30) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_firm_companies`
--

CREATE TABLE `audit_firm_companies` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Audit Firm',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Company',
  `org_level` TINYINT NOT NULL DEFAULT '6',
  `afc_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_firm_company_branches`
--

CREATE TABLE `audit_firm_company_branches` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Audit Firm Company',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Branch',
  `org_level` TINYINT NOT NULL DEFAULT '3',
  `afc_code` VARCHAR(20) DEFAULT NULL,
  `afc_branch_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_firm_company_departments`
--

CREATE TABLE `audit_firm_company_departments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Audit Firm Company',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Audit Firm Department',
  `org_level` TINYINT NOT NULL DEFAULT '1',
  `afc_code` VARCHAR(20) DEFAULT NULL,
  `afc_branch_code` VARCHAR(20) DEFAULT NULL,
  `afc_dept_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_responses`
--

CREATE TABLE `audit_responses` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `audit_response_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `audit_id` VARCHAR(20) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `entity_code` VARCHAR(30) NOT NULL,
  `checklist_question_id` VARCHAR(20) NOT NULL,
  `answer_text` TEXT,
  `selected_option_ids` JSON DEFAULT NULL,
  `marks_obtained` DECIMAL(6,2) DEFAULT '0.00',
  `remarks` TEXT,
  `cap_required` TINYINT(1) DEFAULT '0',
  `status` ENUM('pending','answered','skipped') DEFAULT 'pending',
  `answered_by` VARCHAR(30) NOT NULL,
  `answered_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_response` (`audit_id`,`entity_code`,`checklist_question_id`,`org_tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `caps`
--

CREATE TABLE `caps` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cap_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `audit_id` VARCHAR(20) NOT NULL,
  `parent_cap_id` VARCHAR(20) DEFAULT NULL,
  `title` VARCHAR(255) DEFAULT NULL,
  `description` TEXT,
  `status` ENUM('plan','in_progress','completed') DEFAULT 'plan',
  `created_by` VARCHAR(30) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_assignment_entities`
--

CREATE TABLE `cap_assignment_entities` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cap_assignment_entity_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `cap_id` VARCHAR(20) NOT NULL,
  `parent_cap_id` VARCHAR(20) DEFAULT NULL,
  `entity_code` VARCHAR(30) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `entity_type` VARCHAR(50) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cap_entity` (`cap_id`,`entity_code`,`org_tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_entity_progress`
--

CREATE TABLE `cap_entity_progress` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cap_entity_progress_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `cap_id` VARCHAR(20) NOT NULL,
  `parent_cap_id` VARCHAR(20) DEFAULT NULL,
  `entity_code` VARCHAR(30) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `total_questions` INT DEFAULT '0',
  `total_marks` INT DEFAULT '0',
  `obtained_marks` INT DEFAULT '0',
  `answered_questions` INT DEFAULT '0',
  `status` ENUM('not_started','in_progress','completed') DEFAULT 'not_started',
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cap_entity_progress` (`cap_id`,`entity_code`,`org_tree_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_questions`
--

CREATE TABLE `cap_questions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cap_question_id` VARCHAR(50) NOT NULL UNIQUE KEY,
  `cap_id` VARCHAR(20) NOT NULL,
  `parent_cap_id` VARCHAR(20) DEFAULT NULL,
  `corrective_action_id` VARCHAR(20) NOT NULL,
  `entity_code` VARCHAR(30) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `checklist_question_id` VARCHAR(20) NOT NULL,
  `status` ENUM('not_started','in_progress','completed') DEFAULT 'not_started',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cap_question` (`cap_id`,`corrective_action_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_responses`
--

CREATE TABLE `cap_responses` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cap_response_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `cap_question_id` VARCHAR(50) NOT NULL,
  `parent_cap_id` VARCHAR(20) DEFAULT NULL,
  `response_text` TEXT,
  `status` ENUM('plan','in_progress','completed') DEFAULT 'plan',
  `responded_by` VARCHAR(30) DEFAULT NULL,
  `responded_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `selected_option_ids` TEXT,
  `marks_obtained` INT DEFAULT '0',
  `remarks` TEXT,
  `cap_required` TINYINT(1) DEFAULT '0',
  UNIQUE KEY `uq_cap_question_response` (`cap_question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_response_evidence`
--

CREATE TABLE `cap_response_evidence` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cap_response_evidence_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `cap_response_id` VARCHAR(20) NOT NULL,
  `parent_cap_id` VARCHAR(20) DEFAULT NULL,
  `file_type` ENUM('image','video','audio') NOT NULL,
  `file_path` VARCHAR(1000) NOT NULL,
  `file_name` VARCHAR(255) DEFAULT NULL,
  `file_size` INT DEFAULT '0',
  `uploaded_by` VARCHAR(30) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklists`
--

CREATE TABLE `checklists` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `checklist_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `media_path` VARCHAR(1000) DEFAULT NULL,
  `checklist_type_id` VARCHAR(20) DEFAULT NULL,
  `time_period_value` INT DEFAULT NULL,
  `time_period_unit` ENUM('days','weeks','months','years') DEFAULT NULL,
  `repeat_duration_value` INT DEFAULT NULL,
  `repeat_duration_unit` ENUM('days','weeks','months','years') DEFAULT NULL,
  `budget` DECIMAL(15,2) DEFAULT NULL,
  `currency` VARCHAR(10) DEFAULT '$',
  `num_workers` INT DEFAULT NULL,
  `created_by` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklist_questions`
--

CREATE TABLE `checklist_questions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `checklist_question_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `checklist_id` VARCHAR(20) NOT NULL,
  `entity_code` VARCHAR(50) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `entity_type` VARCHAR(100) NOT NULL,
  `entity_name` VARCHAR(255) DEFAULT NULL,
  `question_text` TEXT NOT NULL,
  `answer_type` ENUM('free_text','single_option','multiple_options','dropdown') DEFAULT 'free_text',
  `total_marks` DECIMAL(6,2) DEFAULT '10.00',
  `order_index` INT DEFAULT '0',
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklist_question_options`
--

CREATE TABLE `checklist_question_options` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `checklist_question_option_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `checklist_question_id` VARCHAR(20) NOT NULL,
  `option_text` VARCHAR(1000) NOT NULL,
  `marks` DECIMAL(6,2) DEFAULT '0.00',
  `order_index` INT DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklist_types`
--

CREATE TABLE `checklist_types` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `checklist_type_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `created_by` VARCHAR(50) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Company',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Company',
  `org_level` TINYINT NOT NULL DEFAULT '5',
  `comp_code` VARCHAR(20) NOT NULL,
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_type` VARCHAR(255) DEFAULT NULL,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_clusters`
--

CREATE TABLE `company_clusters` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Company',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Cluster',
  `org_level` TINYINT NOT NULL DEFAULT '4',
  `comp_code` VARCHAR(20) DEFAULT NULL,
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `comp_clus_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_departments`
--

CREATE TABLE `company_departments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Company',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Department',
  `org_level` TINYINT NOT NULL DEFAULT '1',
  `comp_code` VARCHAR(20) DEFAULT NULL,
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `comp_clus_code` VARCHAR(20) DEFAULT NULL,
  `comp_fact_code` VARCHAR(20) DEFAULT NULL,
  `comp_unit_code` VARCHAR(20) DEFAULT NULL,
  `comp_dept_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_factories`
--

CREATE TABLE `company_factories` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Company',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Factory',
  `org_level` TINYINT NOT NULL DEFAULT '3',
  `comp_code` VARCHAR(20) DEFAULT NULL,
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `comp_clus_code` VARCHAR(20) DEFAULT NULL,
  `comp_fact_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_sections`
--

CREATE TABLE `company_sections` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `comp_code` VARCHAR(20) DEFAULT NULL,
  `comp_dept_code` VARCHAR(20) DEFAULT NULL,
  `comp_section_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_units`
--

CREATE TABLE `company_units` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Company',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Unit',
  `org_level` TINYINT NOT NULL DEFAULT '2',
  `comp_code` VARCHAR(20) DEFAULT NULL,
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `comp_clus_code` VARCHAR(20) DEFAULT NULL,
  `comp_fact_code` VARCHAR(20) DEFAULT NULL,
  `comp_unit_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contact_messages`
--

CREATE TABLE `contact_messages` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `contact_message_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `company` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('unread','read','replied') DEFAULT 'unread',
  `reply_content` TEXT,
  `replied_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `corrective_actions`
--

CREATE TABLE `corrective_actions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `corrective_action_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `audit_id` VARCHAR(20) NOT NULL,
  `audit_response_id` VARCHAR(20) DEFAULT NULL,
  `cap_response_id` VARCHAR(20) DEFAULT NULL,
  `entity_code` VARCHAR(30) NOT NULL,
  `checklist_question_id` VARCHAR(20) NOT NULL,
  `org_tree_id` VARCHAR(20) DEFAULT NULL,
  `description` TEXT,
  `severity` ENUM('low','medium','high','critical') DEFAULT 'medium',
  `responsible_entity_head_id` VARCHAR(20) DEFAULT NULL,
  `responsible_person_name` VARCHAR(255) DEFAULT NULL,
  `due_date` DATE DEFAULT NULL,
  `status` ENUM('open','in_progress','resolved','verified','closed') DEFAULT 'open',
  `resolution_notes` TEXT,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `verified_by` VARCHAR(30) DEFAULT NULL,
  `verified_at` TIMESTAMP NULL DEFAULT NULL,
  `created_by` VARCHAR(30) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Customer',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Customer',
  `org_level` TINYINT NOT NULL DEFAULT '8',
  `cust_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_buying_offices`
--

CREATE TABLE `customer_buying_offices` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Customer',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Buying Office',
  `org_level` TINYINT NOT NULL DEFAULT '7',
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `cbo_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_suppliers`
--

CREATE TABLE `customer_suppliers` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `address_line_1` VARCHAR(255) DEFAULT NULL,
  `address_line_2` VARCHAR(255) DEFAULT NULL,
  `address_line_3` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `account_type` VARCHAR(50) NOT NULL DEFAULT 'Customer',
  `entity_type` VARCHAR(50) NOT NULL DEFAULT 'Supplier',
  `org_level` TINYINT NOT NULL DEFAULT '6',
  `cust_code` VARCHAR(20) DEFAULT NULL,
  `cbo_code` VARCHAR(20) DEFAULT NULL,
  `csup_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `entity_heads`
--

CREATE TABLE `entity_heads` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `entity_head_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE KEY,
  `phone_number` VARCHAR(50) DEFAULT NULL,
  `nic` VARCHAR(50) DEFAULT NULL,
  `country` VARCHAR(100) DEFAULT NULL,
  `password` VARCHAR(255) DEFAULT NULL,
  `role` VARCHAR(50) DEFAULT 'entity_head',
  `user_type` VARCHAR(80) NOT NULL,
  `assigned_entity_type` VARCHAR(50) DEFAULT NULL,
  `assigned_entity_code` VARCHAR(30) DEFAULT NULL,
  `assigned_org_tree_id` VARCHAR(20) DEFAULT NULL,
  `created_by_admin_id` VARCHAR(20) NOT NULL,
  `created_by_entity_code` VARCHAR(30) NOT NULL,
  `email_verified` TINYINT(1) DEFAULT '0',
  `email_token` VARCHAR(255) DEFAULT NULL,
  `email_token_expires` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `profile_image` VARCHAR(255) DEFAULT NULL,
  `onboarding_completed` TINYINT(1) DEFAULT '0',
  `onboarding_skipped` TINYINT(1) DEFAULT '0',
  `onboarding_completed_at` TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_answers`
--

CREATE TABLE `evaluation_answers` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evaluation_answer_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `attempt_id` VARCHAR(20) NOT NULL,
  `question_id` VARCHAR(20) NOT NULL,
  `selected_option_id` VARCHAR(20) DEFAULT NULL,
  `answer_text` TEXT,
  `selected_option_ids` TEXT,
  `is_correct` TINYINT(1) DEFAULT NULL,
  `marks_awarded` DECIMAL(10,2) DEFAULT NULL,
  UNIQUE KEY `uq_attempt_question` (`attempt_id`,`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_assignments`
--

CREATE TABLE `evaluation_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evaluation_assignment_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `paper_id` VARCHAR(20) NOT NULL,
  `auditor_id` VARCHAR(20) NOT NULL,
  `assigned_by_admin_id` VARCHAR(20) DEFAULT NULL,
  `assigned_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `due_date` DATETIME DEFAULT NULL,
  `status` ENUM('assigned','submitted') DEFAULT 'assigned',
  UNIQUE KEY `uq_paper_auditor` (`paper_id`,`auditor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_attempts`
--

CREATE TABLE `evaluation_attempts` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evaluation_attempt_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `paper_id` VARCHAR(20) NOT NULL,
  `auditor_id` VARCHAR(20) NOT NULL,
  `started_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` TIMESTAMP NULL DEFAULT NULL,
  `score` DECIMAL(10,2) DEFAULT NULL,
  `max_score` DECIMAL(10,2) DEFAULT NULL,
  `passed` TINYINT(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_papers`
--

CREATE TABLE `evaluation_papers` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evaluation_paper_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `entity_code` VARCHAR(20) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `time_limit_minutes` INT DEFAULT NULL,
  `pass_marks` DECIMAL(8,2) DEFAULT NULL,
  `available_from` DATETIME DEFAULT NULL,
  `available_to` DATETIME DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_by_admin_id` VARCHAR(20) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_questions`
--

CREATE TABLE `evaluation_questions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evaluation_question_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `paper_id` VARCHAR(20) NOT NULL,
  `question_text` TEXT NOT NULL,
  `answer_type` ENUM('free_text','single_option','multiple_options','dropdown') DEFAULT 'single_option',
  `marks` DECIMAL(8,2) DEFAULT '1.00',
  `question_type` ENUM('mcq_single') DEFAULT 'mcq_single',
  `sort_order` INT DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_question_options`
--

CREATE TABLE `evaluation_question_options` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `evaluation_question_option_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `question_id` VARCHAR(20) NOT NULL,
  `option_text` VARCHAR(1000) NOT NULL,
  `marks` DECIMAL(10,2) DEFAULT '0.00',
  `order_index` INT DEFAULT '0',
  `is_correct` TINYINT(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `field_visits`
--

CREATE TABLE `field_visits` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `field_visit_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `entity_code` VARCHAR(20) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `location_name` VARCHAR(255) DEFAULT NULL,
  `address` VARCHAR(500) DEFAULT NULL,
  `latitude` DECIMAL(10,8) DEFAULT NULL,
  `longitude` DECIMAL(11,8) DEFAULT NULL,
  `start_date` DATETIME DEFAULT NULL,
  `end_date` DATETIME DEFAULT NULL,
  `notes` TEXT,
  `created_by_admin_id` VARCHAR(20) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `field_visit_assignments`
--

CREATE TABLE `field_visit_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `field_visit_assignment_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `field_visit_id` VARCHAR(20) NOT NULL,
  `auditor_id` VARCHAR(20) NOT NULL,
  `assigned_by_admin_id` VARCHAR(20) DEFAULT NULL,
  `assigned_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('assigned','completed') DEFAULT 'assigned',
  `check_in_time` DATETIME DEFAULT NULL,
  `check_out_time` DATETIME DEFAULT NULL,
  UNIQUE KEY `uq_field_visit_auditor` (`field_visit_id`,`auditor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notices`
--

CREATE TABLE `notices` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `notice_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `notice_date` DATE NOT NULL,
  `assign_to_all` TINYINT(1) DEFAULT '1',
  `created_by_admin_id` VARCHAR(20) NOT NULL,
  `created_by_entity_code` VARCHAR(20) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notice_auditor_assignments`
--

CREATE TABLE `notice_auditor_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `notice_auditor_assignment_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `notice_id` VARCHAR(20) NOT NULL,
  `auditor_id` VARCHAR(20) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization_links`
--

CREATE TABLE `organization_links` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `organization_link_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `link_code` VARCHAR(30) NOT NULL UNIQUE KEY,
  `requester_type` VARCHAR(50) NOT NULL,
  `requester_code` VARCHAR(20) NOT NULL,
  `requester_level` TINYINT NOT NULL,
  `target_type` VARCHAR(50) NOT NULL,
  `target_code` VARCHAR(20) NOT NULL,
  `target_level` TINYINT NOT NULL,
  `verification_key_hash` VARCHAR(64) DEFAULT NULL,
  `verification_key_verified_at` TIMESTAMP NULL DEFAULT NULL,
  `status` ENUM('pending','accepted','rejected') DEFAULT 'pending',
  `requested_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` TIMESTAMP NULL DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_link` (`requester_type`,`requester_code`,`target_type`,`target_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization_tree`
--

CREATE TABLE `organization_tree` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `org_tree_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `parent_type` VARCHAR(50) NOT NULL,
  `parent_code` VARCHAR(20) NOT NULL,
  `child_type` VARCHAR(50) NOT NULL,
  `child_code` VARCHAR(20) NOT NULL,
  `created_by` VARCHAR(20) NOT NULL,
  `root_entity_code` VARCHAR(20) DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `parent_edge_id` VARCHAR(20) DEFAULT NULL,
  UNIQUE KEY `uq_edge` (`parent_code`,`child_code`,`root_entity_code`,`parent_edge_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_otps`
--

CREATE TABLE `password_reset_otps` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `password_reset_otp_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `email` VARCHAR(255) NOT NULL,
  `otp` VARCHAR(100) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used` TINYINT(1) DEFAULT '0',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_transactions`
--

CREATE TABLE `payment_transactions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `payment_transaction_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `payment_code` VARCHAR(40) NOT NULL UNIQUE KEY,
  `root_entity_code` VARCHAR(255) NOT NULL,
  `purpose` ENUM('registration','upgrade','renewal') NOT NULL,
  `plan_name` ENUM('Basic','Pro','Elite') NOT NULL,
  `billing_cycle` ENUM('Monthly','Yearly') NOT NULL DEFAULT 'Monthly',
  `amount` DECIMAL(10,2) DEFAULT '0.00',
  `currency` VARCHAR(3) DEFAULT 'USD',
  `status` ENUM('pending','paid','failed','cancelled') DEFAULT 'pending',
  `payer_name` VARCHAR(255) DEFAULT NULL,
  `payer_email` VARCHAR(255) DEFAULT NULL,
  `org_name` VARCHAR(255) DEFAULT NULL,
  `invoice_number` VARCHAR(40) DEFAULT NULL UNIQUE KEY,
  `gateway` VARCHAR(50) DEFAULT NULL,
  `gateway_reference` VARCHAR(255) DEFAULT NULL,
  `period_start` DATETIME DEFAULT NULL,
  `period_end` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `paid_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promo_codes`
--

CREATE TABLE `promo_codes` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `promo_code_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `code` VARCHAR(50) NOT NULL UNIQUE KEY,
  `discount_percentage` DECIMAL(5,2) NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `expires_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `refresh_token_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `admin_id` VARCHAR(20) NOT NULL,
  `user_role` VARCHAR(20) DEFAULT 'admin',
  `token` VARCHAR(500) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_token` (`token`(255)),
  INDEX `idx_admin_id` (`admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `subscription_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `root_entity_code` VARCHAR(255) NOT NULL UNIQUE KEY,
  `plan_name` ENUM('Basic','Pro','Elite') DEFAULT 'Basic',
  `billing_cycle` ENUM('Monthly','Yearly','None') DEFAULT 'None',
  `start_date` DATETIME NOT NULL,
  `end_date` DATETIME NOT NULL,
  `is_active` TINYINT(1) DEFAULT '1',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `max_company_levels` INT DEFAULT '1',
  `max_departments` INT DEFAULT '4',
  `max_audits` INT DEFAULT '2',
  `max_checklists` INT DEFAULT '3',
  `max_auditors` INT DEFAULT '1',
  `allow_auditor_eval` TINYINT(1) DEFAULT '0',
  `allow_company_to_company` TINYINT(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trainings`
--

CREATE TABLE `trainings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `training_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `entity_code` VARCHAR(20) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `platform` VARCHAR(50) DEFAULT NULL,
  `video_url` VARCHAR(800) NOT NULL,
  `description` TEXT,
  `duration_minutes` INT DEFAULT NULL,
  `created_by_admin_id` VARCHAR(20) DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `training_assignments`
--

CREATE TABLE `training_assignments` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `training_assignment_id` VARCHAR(20) NOT NULL UNIQUE KEY,
  `training_id` VARCHAR(20) NOT NULL,
  `auditor_id` VARCHAR(20) NOT NULL,
  `assigned_by_admin_id` VARCHAR(20) DEFAULT NULL,
  `assigned_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('assigned','completed') DEFAULT 'assigned',
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  UNIQUE KEY `uq_training_auditor` (`training_id`,`auditor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Indexes for entity tables (PK and UNIQUE KEYs)
--

--
-- Indexes for table `audit_firm_companies`
--
ALTER TABLE `audit_firm_companies`
  ADD UNIQUE KEY `afc_code` (`afc_code`);

--
-- Indexes for table `audit_firm_company_branches`
--
ALTER TABLE `audit_firm_company_branches`
  ADD UNIQUE KEY `afc_branch_code` (`afc_branch_code`);

--
-- Indexes for table `audit_firm_company_departments`
--
ALTER TABLE `audit_firm_company_departments`
  ADD UNIQUE KEY `afc_dept_code` (`afc_dept_code`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD UNIQUE KEY `comp_code` (`comp_code`);

--
-- Indexes for table `company_clusters`
--
ALTER TABLE `company_clusters`
  ADD UNIQUE KEY `comp_clus_code` (`comp_clus_code`);

--
-- Indexes for table `company_departments`
--
ALTER TABLE `company_departments`
  ADD UNIQUE KEY `comp_dept_code` (`comp_dept_code`);

--
-- Indexes for table `company_factories`
--
ALTER TABLE `company_factories`
  ADD UNIQUE KEY `comp_fact_code` (`comp_fact_code`);

--
-- Indexes for table `company_sections`
--
ALTER TABLE `company_sections`
  ADD UNIQUE KEY `comp_section_code` (`comp_section_code`);

--
-- Indexes for table `company_units`
--
ALTER TABLE `company_units`
  ADD UNIQUE KEY `comp_unit_code` (`comp_unit_code`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD UNIQUE KEY `cust_code` (`cust_code`);

--
-- Indexes for table `customer_buying_offices`
--
ALTER TABLE `customer_buying_offices`
  ADD UNIQUE KEY `cbo_code` (`cbo_code`);

--
-- Indexes for table `customer_suppliers`
--
ALTER TABLE `customer_suppliers`
  ADD UNIQUE KEY `csup_code` (`csup_code`);

--
-- Additional indexes for FK columns on all tables
--

ALTER TABLE `admins`
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_account_type` (`account_type`);

ALTER TABLE `auditors`
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_created_by` (`created_by_entity_code`),
  ADD KEY `idx_assigned` (`assigned_entity_code`),
  ADD KEY `idx_auditor_type` (`auditor_type`);

ALTER TABLE `auditor_experiences`
  ADD KEY `idx_auditor_id` (`auditor_id`);

ALTER TABLE `auditor_notifications`
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_created_by_entity` (`created_by_entity_code`),
  ADD KEY `idx_notify_date` (`notify_date`);

ALTER TABLE `auditor_profiles`
  ADD KEY `idx_auditor_id` (`auditor_id`);

ALTER TABLE `auditor_qualifications`
  ADD KEY `idx_auditor_id` (`auditor_id`);

ALTER TABLE `auditor_trainings`
  ADD KEY `idx_auditor_id` (`auditor_id`);

ALTER TABLE `audit_assignments`
  ADD KEY `idx_checklist_id` (`checklist_id`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_audit_type` (`audit_type`);

ALTER TABLE `audit_assignment_entities`
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_entity_code` (`entity_code`);

ALTER TABLE `audit_entity_progress`
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

ALTER TABLE `audit_evidence`
  ADD KEY `idx_audit_response_id` (`audit_response_id`);

ALTER TABLE `audit_firm_companies`
  ADD KEY `idx_afc_code` (`afc_code`);

ALTER TABLE `audit_firm_company_branches`
  ADD KEY `idx_afc_code` (`afc_code`),
  ADD KEY `idx_afc_branch_code` (`afc_branch_code`);

ALTER TABLE `audit_firm_company_departments`
  ADD KEY `idx_afc_code` (`afc_code`),
  ADD KEY `idx_afc_branch_code` (`afc_branch_code`);

ALTER TABLE `audit_responses`
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_checklist_question_id` (`checklist_question_id`);

ALTER TABLE `caps`
  ADD KEY `idx_caps_audit_id` (`audit_id`),
  ADD KEY `idx_caps_status` (`status`);

ALTER TABLE `cap_assignment_entities`
  ADD KEY `idx_cap_id` (`cap_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

ALTER TABLE `cap_entity_progress`
  ADD KEY `idx_cap_id` (`cap_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

ALTER TABLE `cap_questions`
  ADD KEY `idx_cap_id` (`cap_id`),
  ADD KEY `idx_corrective_action_id` (`corrective_action_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

ALTER TABLE `cap_responses`
  ADD KEY `idx_cap_question_id` (`cap_question_id`),
  ADD KEY `idx_cap_responses_status` (`status`);

ALTER TABLE `cap_response_evidence`
  ADD KEY `idx_cap_response_id` (`cap_response_id`);

ALTER TABLE `checklists`
  ADD KEY `idx_checklist_type_id` (`checklist_type_id`);

ALTER TABLE `checklist_questions`
  ADD KEY `idx_checklist_id` (`checklist_id`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

ALTER TABLE `checklist_question_options`
  ADD KEY `idx_checklist_question_id` (`checklist_question_id`);

ALTER TABLE `companies`
  ADD KEY `idx_cust_code_companies` (`cust_code`);

ALTER TABLE `company_clusters`
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_clusters` (`cust_code`);

ALTER TABLE `company_departments`
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_depts` (`cust_code`),
  ADD KEY `idx_comp_unit_code` (`comp_unit_code`);

ALTER TABLE `company_factories`
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_factories` (`cust_code`),
  ADD KEY `idx_comp_clus_code` (`comp_clus_code`);

ALTER TABLE `company_sections`
  ADD KEY `idx_section_cust_code` (`cust_code`),
  ADD KEY `idx_section_comp_code` (`comp_code`),
  ADD KEY `idx_section_dept_code` (`comp_dept_code`);

ALTER TABLE `company_units`
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_units` (`cust_code`),
  ADD KEY `idx_comp_fact_code` (`comp_fact_code`);

ALTER TABLE `corrective_actions`
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_responsible` (`responsible_entity_head_id`),
  ADD KEY `idx_audit_response_id` (`audit_response_id`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

ALTER TABLE `customers`
  ADD KEY `idx_cust_code` (`cust_code`);

ALTER TABLE `customer_buying_offices`
  ADD KEY `idx_cust_code` (`cust_code`);

ALTER TABLE `customer_suppliers`
  ADD KEY `idx_cust_code` (`cust_code`),
  ADD KEY `idx_cbo_code` (`cbo_code`);

ALTER TABLE `entity_heads`
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_user_type` (`user_type`),
  ADD KEY `idx_created_by` (`created_by_entity_code`),
  ADD KEY `idx_assigned` (`assigned_entity_code`),
  ADD KEY `idx_assigned_org_tree_id` (`assigned_org_tree_id`);

ALTER TABLE `evaluation_answers`
  ADD KEY `idx_attempt_id` (`attempt_id`),
  ADD KEY `idx_question_id` (`question_id`);

ALTER TABLE `evaluation_assignments`
  ADD KEY `idx_paper_id` (`paper_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_assigned_by_admin_id` (`assigned_by_admin_id`);

ALTER TABLE `evaluation_attempts`
  ADD KEY `idx_paper_id` (`paper_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

ALTER TABLE `evaluation_papers`
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`);

ALTER TABLE `evaluation_questions`
  ADD KEY `idx_paper_id` (`paper_id`);

ALTER TABLE `evaluation_question_options`
  ADD KEY `idx_question_id` (`question_id`);

ALTER TABLE `field_visits`
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`);

ALTER TABLE `field_visit_assignments`
  ADD KEY `idx_field_visit_id` (`field_visit_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_assigned_by_admin_id` (`assigned_by_admin_id`);

ALTER TABLE `notices`
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`),
  ADD KEY `idx_notice_entity` (`created_by_entity_code`);

ALTER TABLE `notice_auditor_assignments`
  ADD KEY `idx_notice_id` (`notice_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

ALTER TABLE `organization_links`
  ADD KEY `idx_requester` (`requester_type`,`requester_code`),
  ADD KEY `idx_target` (`target_type`,`target_code`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `organization_tree`
  ADD KEY `idx_parent` (`parent_type`,`parent_code`),
  ADD KEY `idx_child` (`child_type`,`child_code`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_root_entity` (`root_entity_code`),
  ADD KEY `idx_parent_edge` (`parent_edge_id`);

ALTER TABLE `password_reset_otps`
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_otp` (`otp`);

ALTER TABLE `payment_transactions`
  ADD KEY `idx_root_entity` (`root_entity_code`),
  ADD KEY `idx_status` (`status`);

ALTER TABLE `trainings`
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`);

ALTER TABLE `training_assignments`
  ADD KEY `idx_training_id` (`training_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_assigned_by_admin_id` (`assigned_by_admin_id`);



-- --------------------------------------------------------

--
-- FOREIGN KEY Constraints
--

ALTER TABLE `auditor_experiences`
  ADD CONSTRAINT `fk_auditor_experiences_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

ALTER TABLE `auditor_notifications`
  ADD CONSTRAINT `fk_auditor_notifications_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_auditor_notifications_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE SET NULL;

ALTER TABLE `auditor_profiles`
  ADD CONSTRAINT `fk_auditor_profiles_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

ALTER TABLE `auditor_qualifications`
  ADD CONSTRAINT `fk_auditor_qualifications_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

ALTER TABLE `auditor_trainings`
  ADD CONSTRAINT `fk_auditor_trainings_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

ALTER TABLE `audit_assignments`
  ADD CONSTRAINT `fk_audit_assignments_checklist` FOREIGN KEY (`checklist_id`) REFERENCES `checklists` (`checklist_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_audit_assignments_auditor` FOREIGN KEY (`assigned_auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_audit_assignments_firm` FOREIGN KEY (`assigned_firm_code`) REFERENCES `audit_firm_companies` (`afc_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_audit_assignments_parent` FOREIGN KEY (`parent_audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE SET NULL;

ALTER TABLE `audit_assignment_entities`
  ADD CONSTRAINT `fk_audit_assignment_entities_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE;

ALTER TABLE `audit_entity_progress`
  ADD CONSTRAINT `fk_audit_entity_progress_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE;

ALTER TABLE `audit_evidence`
  ADD CONSTRAINT `fk_audit_evidence_response` FOREIGN KEY (`audit_response_id`) REFERENCES `audit_responses` (`audit_response_id`) ON DELETE CASCADE;

ALTER TABLE `audit_responses`
  ADD CONSTRAINT `fk_audit_responses_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_audit_responses_question` FOREIGN KEY (`checklist_question_id`) REFERENCES `checklist_questions` (`checklist_question_id`) ON DELETE CASCADE;

ALTER TABLE `caps`
  ADD CONSTRAINT `fk_caps_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_caps_parent` FOREIGN KEY (`parent_cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE SET NULL;

ALTER TABLE `cap_assignment_entities`
  ADD CONSTRAINT `fk_cap_assignment_entities_cap` FOREIGN KEY (`cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE CASCADE;

ALTER TABLE `cap_entity_progress`
  ADD CONSTRAINT `fk_cap_entity_progress_cap` FOREIGN KEY (`cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE CASCADE;

ALTER TABLE `cap_questions`
  ADD CONSTRAINT `fk_cap_questions_cap` FOREIGN KEY (`cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cap_questions_corrective_action` FOREIGN KEY (`corrective_action_id`) REFERENCES `corrective_actions` (`corrective_action_id`) ON DELETE CASCADE;

ALTER TABLE `cap_responses`
  ADD CONSTRAINT `fk_cap_responses_cap_question` FOREIGN KEY (`cap_question_id`) REFERENCES `cap_questions` (`cap_question_id`) ON DELETE CASCADE;

ALTER TABLE `cap_response_evidence`
  ADD CONSTRAINT `fk_cap_response_evidence_cap_response` FOREIGN KEY (`cap_response_id`) REFERENCES `cap_responses` (`cap_response_id`) ON DELETE CASCADE;

ALTER TABLE `checklists`
  ADD CONSTRAINT `fk_checklists_checklist_type` FOREIGN KEY (`checklist_type_id`) REFERENCES `checklist_types` (`checklist_type_id`) ON DELETE SET NULL;

ALTER TABLE `checklist_questions`
  ADD CONSTRAINT `fk_checklist_questions_checklist` FOREIGN KEY (`checklist_id`) REFERENCES `checklists` (`checklist_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_checklist_questions_org_tree` FOREIGN KEY (`org_tree_id`) REFERENCES `organization_tree` (`org_tree_id`) ON DELETE SET NULL;

ALTER TABLE `checklist_question_options`
  ADD CONSTRAINT `fk_checklist_question_options_question` FOREIGN KEY (`checklist_question_id`) REFERENCES `checklist_questions` (`checklist_question_id`) ON DELETE CASCADE;

ALTER TABLE `corrective_actions`
  ADD CONSTRAINT `fk_corrective_actions_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_corrective_actions_response` FOREIGN KEY (`audit_response_id`) REFERENCES `audit_responses` (`audit_response_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_corrective_actions_cap_response` FOREIGN KEY (`cap_response_id`) REFERENCES `cap_responses` (`cap_response_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_corrective_actions_entity_head` FOREIGN KEY (`responsible_entity_head_id`) REFERENCES `entity_heads` (`entity_head_id`) ON DELETE SET NULL;

ALTER TABLE `entity_heads`
  ADD CONSTRAINT `fk_entity_heads_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE;

ALTER TABLE `evaluation_answers`
  ADD CONSTRAINT `fk_evaluation_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `evaluation_attempts` (`evaluation_attempt_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_evaluation_answers_question` FOREIGN KEY (`question_id`) REFERENCES `evaluation_questions` (`evaluation_question_id`) ON DELETE CASCADE;

ALTER TABLE `evaluation_assignments`
  ADD CONSTRAINT `fk_evaluation_assignments_paper` FOREIGN KEY (`paper_id`) REFERENCES `evaluation_papers` (`evaluation_paper_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_evaluation_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_evaluation_assignments_admin` FOREIGN KEY (`assigned_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

ALTER TABLE `evaluation_attempts`
  ADD CONSTRAINT `fk_evaluation_attempts_paper` FOREIGN KEY (`paper_id`) REFERENCES `evaluation_papers` (`evaluation_paper_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_evaluation_attempts_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

ALTER TABLE `evaluation_papers`
  ADD CONSTRAINT `fk_evaluation_papers_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

ALTER TABLE `evaluation_questions`
  ADD CONSTRAINT `fk_evaluation_questions_paper` FOREIGN KEY (`paper_id`) REFERENCES `evaluation_papers` (`evaluation_paper_id`) ON DELETE CASCADE;

ALTER TABLE `evaluation_question_options`
  ADD CONSTRAINT `fk_evaluation_question_options_question` FOREIGN KEY (`question_id`) REFERENCES `evaluation_questions` (`evaluation_question_id`) ON DELETE CASCADE;

ALTER TABLE `field_visits`
  ADD CONSTRAINT `fk_field_visits_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

ALTER TABLE `field_visit_assignments`
  ADD CONSTRAINT `fk_field_visit_assignments_visit` FOREIGN KEY (`field_visit_id`) REFERENCES `field_visits` (`field_visit_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_field_visit_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_field_visit_assignments_admin` FOREIGN KEY (`assigned_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

ALTER TABLE `notices`
  ADD CONSTRAINT `fk_notices_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE;

ALTER TABLE `notice_auditor_assignments`
  ADD CONSTRAINT `fk_notice_auditor_assignments_notice` FOREIGN KEY (`notice_id`) REFERENCES `notices` (`notice_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_notice_auditor_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

ALTER TABLE `trainings`
  ADD CONSTRAINT `fk_trainings_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

ALTER TABLE `training_assignments`
  ADD CONSTRAINT `fk_training_assignments_training` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`training_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_training_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_training_assignments_admin` FOREIGN KEY (`assigned_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

-- ============================================================
-- LINK BILLING CREDITS
-- ============================================================

CREATE TABLE `link_billing_credits` (
  `link_billing_credit_id`                      VARCHAR(20)  NOT NULL PRIMARY KEY,
  `organization_link_id`           VARCHAR(20)  NOT NULL,
  `credit_for_entity_code`         VARCHAR(30)  NOT NULL COMMENT 'entity that gains the credit (link target)',
  `credit_from_entity_code`        VARCHAR(30)  NOT NULL COMMENT 'entity whose plan generates the credit (requester)',
  `source_plan_name`               VARCHAR(20)  NOT NULL,
  `source_billing_cycle`           VARCHAR(10)  NOT NULL,
  `source_yearly_billed`           DECIMAL(10,2) NOT NULL COMMENT 'total amount billed for source yearly plan',
  `remaining_months`               INT          NOT NULL COMMENT 'months until source subscription end_date at generation time',
  `credit_amount`                  DECIMAL(10,2) NOT NULL COMMENT 'monthly_rate × remaining_months',
  `applied_amount`                 DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'sum of all applications',
  `status`                         ENUM('active','fully_applied','reversed') NOT NULL DEFAULT 'active',
  `created_at`                     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversed_at`                    TIMESTAMP    NULL     DEFAULT NULL,
  INDEX `idx_lbc_for` (`credit_for_entity_code`),
  INDEX `idx_lbc_from` (`credit_from_entity_code`),
  INDEX `idx_lbc_link` (`organization_link_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `link_credit_applications` (
  `link_credit_application_id`         VARCHAR(20)  NOT NULL PRIMARY KEY,
  `link_billing_credit_id`              VARCHAR(20)  NOT NULL,
  `payment_transaction_id` VARCHAR(20)  NOT NULL,
  `applied_amount`         DECIMAL(10,2) NOT NULL,
  `created_at`             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_lca_credit` (`link_billing_credit_id`),
  INDEX `idx_lca_payment` (`payment_transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;

-- ============================================================
-- PENDING ALTER STATEMENTS (run on production server)
-- ============================================================

-- 1. Widen cap_question_id to support longer composite keys
ALTER TABLE `cap_questions` MODIFY COLUMN `cap_question_id` VARCHAR(50) NOT NULL;
ALTER TABLE `cap_responses` MODIFY COLUMN `cap_question_id` VARCHAR(50) NOT NULL;

-- 2. Add total_marks / obtained_marks to cap_entity_progress
ALTER TABLE `cap_entity_progress`
  ADD COLUMN `total_marks` INT DEFAULT '0' AFTER `status`,
  ADD COLUMN `obtained_marks` INT DEFAULT '0' AFTER `total_marks`;

-- 3. Drop redundant cap_code from corrective_actions
ALTER TABLE `corrective_actions` DROP COLUMN `cap_code`;

-- 4. Ensure timezone columns exist on Customer-family entity tables
--    (may be missing if live DB was created from an older schema)
--    Run each individually; skip if column already exists.
ALTER TABLE `customers` ADD COLUMN `timezone` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `customer_buying_offices` ADD COLUMN `timezone` VARCHAR(255) DEFAULT NULL;
ALTER TABLE `customer_suppliers` ADD COLUMN `timezone` VARCHAR(255) DEFAULT NULL;

-- 5. Create link billing credit tables (run on production if not already created)
-- Run the CREATE TABLE statements above; these will fail harmlessly if tables exist.

-- ============================================================

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
