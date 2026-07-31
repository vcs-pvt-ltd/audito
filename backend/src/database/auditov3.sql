-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jul 27, 2026 at 04:53 AM
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
  `id` int NOT NULL,
  `admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `nic` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `org_level` tinyint NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `email_verified` tinyint(1) DEFAULT '0',
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_verified` tinyint(1) DEFAULT '0',
  `verification_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `onboarding_completed` tinyint(1) DEFAULT '0',
  `onboarding_skipped` tinyint(1) DEFAULT '0',
  `onboarding_completed_at` timestamp NULL DEFAULT NULL,
  `profile_image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'admin'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `admin_id`, `first_name`, `last_name`, `nic`, `email`, `country`, `phone_number`, `password`, `account_type`, `entity_type`, `entity_code`, `org_level`, `is_active`, `email_verified`, `last_login`, `created_at`, `updated_at`, `is_verified`, `verification_token`, `onboarding_completed`, `onboarding_skipped`, `onboarding_completed_at`, `profile_image`, `role`) VALUES
(1, 'USR-00000001', 'Dilan', 'Ranasinghe', NULL, 'dilan96ranasinghe@gmail.com', 'Sri Lanka', '+94 771501357', '$2b$12$o9pMEokkvtwcBewIzJe5eeiGmFYuSHoeqi1GYpfztbadM0YjZHClq', 'audito_admin', 'audito_admin', 'AUDITO', 0, 1, 0, NULL, '2026-07-10 07:03:15', '2026-07-14 05:29:58', 1, NULL, 0, 0, NULL, '/uploads/profile-images/avatar_audito_admin_USR-00000001_1783670765314.jpg', 'audito_admin'),
(2, 'USR-00000002', 'Dilan', 'Ranasinghe', NULL, 'dilan1128db@gmail.com', NULL, NULL, '$2b$12$o9pMEokkvtwcBewIzJe5eeiGmFYuSHoeqi1GYpfztbadM0YjZHClq', NULL, NULL, NULL, 0, 1, 0, NULL, '2026-07-10 08:16:48', '2026-07-10 08:17:49', 1, NULL, 0, 0, NULL, NULL, 'audito_admin');

-- --------------------------------------------------------

--
-- Table structure for table `ai_checklist_generation_jobs`
--

CREATE TABLE `ai_checklist_generation_jobs` (
  `id` int NOT NULL,
  `ai_checklist_job_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `entity_code` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `requested_by` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `scope_entity_code` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `source_file_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `source_mime` varchar(120) COLLATE utf8mb4_general_ci NOT NULL,
  `focus` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `checklist_type` varchar(100) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `model_name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `requested_question_count` int UNSIGNED NOT NULL,
  `generated_question_count` int UNSIGNED NOT NULL DEFAULT '0',
  `status` enum('processing','completed','failed') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'processing',
  `issues_json` json DEFAULT NULL,
  `error_message` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ai_checklist_question_suggestions`
--

CREATE TABLE `ai_checklist_question_suggestions` (
  `id` int NOT NULL,
  `ai_checklist_suggestion_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `ai_checklist_job_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `entity_code` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_type` varchar(80) COLLATE utf8mb4_general_ci NOT NULL,
  `entity_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `question_text` text COLLATE utf8mb4_general_ci NOT NULL,
  `answer_type` varchar(30) COLLATE utf8mb4_general_ci NOT NULL,
  `options_json` json DEFAULT NULL,
  `source_reference` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `rationale` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` enum('draft','accepted','discarded') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditors`
--

CREATE TABLE `auditors` (
  `id` int NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `nic` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'auditor',
  `user_type` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'Auditor',
  `auditor_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_by_entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email_verified` tinyint(1) DEFAULT '0',
  `email_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email_token_expires` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `profile_image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `onboarding_completed` tinyint(1) DEFAULT '0',
  `onboarding_skipped` tinyint(1) DEFAULT '0',
  `onboarding_completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_experiences`
--

CREATE TABLE `auditor_experiences` (
  `id` int NOT NULL,
  `auditor_experience_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `industry_sector` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `experience_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `company_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `years` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_notifications`
--

CREATE TABLE `auditor_notifications` (
  `id` int NOT NULL,
  `auditor_notification_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_by_entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `type` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `notify_date` date DEFAULT NULL,
  `notification_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_profiles`
--

CREATE TABLE `auditor_profiles` (
  `id` int NOT NULL,
  `auditor_profile_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name_with_initials` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `designation` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `profile_picture` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gender` enum('Male','Female','Other') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `civil_status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `district` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `city` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `mobile_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `whatsapp_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `home_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `specialized_network` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `working_status` enum('Employed','Retired') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `current_sector` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `current_organization` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `join_as` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `signature_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cv_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_qualifications`
--

CREATE TABLE `auditor_qualifications` (
  `id` int NOT NULL,
  `auditor_qualification_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `qualification_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `university_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `degree` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `certificate_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auditor_trainings`
--

CREATE TABLE `auditor_trainings` (
  `id` int NOT NULL,
  `auditor_training_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `training_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `course_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `duration` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `year` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `certificate_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_assignments`
--

CREATE TABLE `audit_assignments` (
  `id` int NOT NULL,
  `audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `checklist_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_type` enum('internal','external') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'internal',
  `assigned_auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_firm_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT NULL,
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '$',
  `num_workers` int DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `status` enum('plan','in_progress','completed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'plan',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `parent_audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `audit_mode` enum('standard','cap_verification') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'standard',
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_by` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_assignment_entities`
--

CREATE TABLE `audit_assignment_entities` (
  `id` int NOT NULL,
  `audit_assignment_entity_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_entity_progress`
--

CREATE TABLE `audit_entity_progress` (
  `id` int NOT NULL,
  `audit_entity_progress_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `total_questions` int DEFAULT '0',
  `answered_questions` int DEFAULT '0',
  `total_marks` decimal(10,2) DEFAULT '0.00',
  `obtained_marks` decimal(10,2) DEFAULT '0.00',
  `status` enum('not_started','in_progress','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'not_started',
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_evidence`
--

CREATE TABLE `audit_evidence` (
  `id` int NOT NULL,
  `audit_evidence_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_response_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `file_type` enum('image','video','audio') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `file_path` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_size` int DEFAULT '0',
  `uploaded_by` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_firm_companies`
--

CREATE TABLE `audit_firm_companies` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Audit Firm',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Company',
  `org_level` tinyint NOT NULL DEFAULT '6',
  `afc_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_firm_company_branches`
--

CREATE TABLE `audit_firm_company_branches` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Audit Firm Company',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Branch',
  `org_level` tinyint NOT NULL DEFAULT '3',
  `afc_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `afc_branch_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_firm_company_departments`
--

CREATE TABLE `audit_firm_company_departments` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Audit Firm Company',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Audit Firm Department',
  `org_level` tinyint NOT NULL DEFAULT '1',
  `afc_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `afc_branch_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `afc_dept_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_responses`
--

CREATE TABLE `audit_responses` (
  `id` int NOT NULL,
  `audit_response_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `checklist_question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `answer_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `selected_option_ids` json DEFAULT NULL,
  `marks_obtained` decimal(6,2) DEFAULT '0.00',
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `cap_required` tinyint(1) DEFAULT '0',
  `status` enum('pending','answered','skipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `answered_by` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `answered_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `caps`
--

CREATE TABLE `caps` (
  `id` int NOT NULL,
  `cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `status` enum('plan','in_progress','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'plan',
  `created_by` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_assignment_entities`
--

CREATE TABLE `cap_assignment_entities` (
  `id` int NOT NULL,
  `cap_assignment_entity_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_entity_progress`
--

CREATE TABLE `cap_entity_progress` (
  `id` int NOT NULL,
  `cap_entity_progress_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `total_questions` int DEFAULT '0',
  `total_marks` int DEFAULT '0',
  `obtained_marks` int DEFAULT '0',
  `answered_questions` int DEFAULT '0',
  `status` enum('not_started','in_progress','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'not_started',
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_questions`
--

CREATE TABLE `cap_questions` (
  `id` int NOT NULL,
  `cap_question_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `corrective_action_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `checklist_question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('not_started','in_progress','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'not_started',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_responses`
--

CREATE TABLE `cap_responses` (
  `id` int NOT NULL,
  `cap_response_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `cap_question_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `response_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `status` enum('plan','in_progress','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'plan',
  `responded_by` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `responded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `selected_option_ids` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `marks_obtained` int DEFAULT '0',
  `remarks` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `cap_required` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cap_response_evidence`
--

CREATE TABLE `cap_response_evidence` (
  `id` int NOT NULL,
  `cap_response_evidence_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `cap_response_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_cap_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_type` enum('image','video','audio') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `file_path` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `file_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `file_size` int DEFAULT '0',
  `uploaded_by` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklists`
--

CREATE TABLE `checklists` (
  `id` int NOT NULL,
  `checklist_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `media_path` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `checklist_type_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `time_period_value` int DEFAULT NULL,
  `time_period_unit` enum('days','weeks','months','years') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `repeat_duration_value` int DEFAULT NULL,
  `repeat_duration_unit` enum('days','weeks','months','years') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT NULL,
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT '$',
  `num_workers` int DEFAULT NULL,
  `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklist_questions`
--

CREATE TABLE `checklist_questions` (
  `id` int NOT NULL,
  `checklist_question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `checklist_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `question_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `answer_type` enum('free_text','single_option','multiple_options','dropdown') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'free_text',
  `total_marks` decimal(6,2) DEFAULT '10.00',
  `order_index` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklist_question_options`
--

CREATE TABLE `checklist_question_options` (
  `id` int NOT NULL,
  `checklist_question_option_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `checklist_question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `option_text` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `marks` decimal(6,2) DEFAULT '0.00',
  `order_index` int DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `checklist_types`
--

CREATE TABLE `checklist_types` (
  `id` int NOT NULL,
  `checklist_type_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_by` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Company',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Company',
  `org_level` tinyint NOT NULL DEFAULT '5',
  `comp_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_clusters`
--

CREATE TABLE `company_clusters` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Company',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Cluster',
  `org_level` tinyint NOT NULL DEFAULT '4',
  `comp_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_clus_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_departments`
--

CREATE TABLE `company_departments` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Company',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Department',
  `org_level` tinyint NOT NULL DEFAULT '1',
  `comp_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_clus_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_fact_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_unit_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_dept_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_factories`
--

CREATE TABLE `company_factories` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Company',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Factory',
  `org_level` tinyint NOT NULL DEFAULT '3',
  `comp_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_clus_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_fact_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_sections`
--

CREATE TABLE `company_sections` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_dept_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_section_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_units`
--

CREATE TABLE `company_units` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Company',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Unit',
  `org_level` tinyint NOT NULL DEFAULT '2',
  `comp_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_clus_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_fact_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `comp_unit_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contact_messages`
--

CREATE TABLE `contact_messages` (
  `id` int NOT NULL,
  `contact_message_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `company` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `status` enum('unread','read','replied') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'unread',
  `reply_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `replied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `corrective_actions`
--

CREATE TABLE `corrective_actions` (
  `id` int NOT NULL,
  `corrective_action_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `audit_response_id` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cap_response_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `checklist_question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `severity` enum('low','medium','high','critical') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'medium',
  `responsible_organization_user_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `responsible_person_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('open','in_progress','resolved','verified','closed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'open',
  `resolution_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `verified_by` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `created_by` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Customer',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Customer',
  `org_level` tinyint NOT NULL DEFAULT '8',
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_buying_offices`
--

CREATE TABLE `customer_buying_offices` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Customer',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Buying Office',
  `org_level` tinyint NOT NULL DEFAULT '7',
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cbo_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_suppliers`
--

CREATE TABLE `customer_suppliers` (
  `id` int NOT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `registration_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address_line_3` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `account_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Customer',
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Supplier',
  `org_level` tinyint NOT NULL DEFAULT '6',
  `cust_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `cbo_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `csup_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `timezone` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `organization_logo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `custom_solution_requests`
--

CREATE TABLE `custom_solution_requests` (
  `id` int NOT NULL,
  `request_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `root_entity_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `admin_id` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `org_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `max_company_levels` int NOT NULL DEFAULT '1',
  `max_departments` int NOT NULL DEFAULT '4',
  `max_audits` int NOT NULL DEFAULT '2',
  `max_checklists` int NOT NULL DEFAULT '3',
  `max_auditors` int NOT NULL DEFAULT '1',
  `allow_auditor_eval` tinyint(1) NOT NULL DEFAULT '0',
  `allow_company_to_company` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('pending','priced','accepted','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `assigned_price` decimal(10,2) DEFAULT NULL,
  `assigned_billing_cycle` enum('Monthly','Yearly') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `admin_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `payment_code` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_token` varchar(128) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `verification_expires_at` datetime DEFAULT NULL,
  `admin_setup_completed` tinyint(1) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization_users`
--

CREATE TABLE `organization_users` (
  `id` int NOT NULL,
  `organization_user_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `phone_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `nic` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `country` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `role` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'organization_user',
  `user_type` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_by_entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email_verified` tinyint(1) DEFAULT '0',
  `email_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `email_token_expires` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `profile_image` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `onboarding_completed` tinyint(1) DEFAULT '0',
  `onboarding_skipped` tinyint(1) DEFAULT '0',
  `onboarding_completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization_user_scopes`
--

CREATE TABLE `organization_user_scopes` (
  `scope_id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `organization_user_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `entity_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `scope_mode` enum('EXACT','SUBTREE') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'EXACT',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`scope_id`),
  UNIQUE KEY `uq_organization_user_scope` (`organization_user_id`,`org_tree_id`),
  KEY `idx_organization_user_scopes_user` (`organization_user_id`,`is_active`),
  KEY `idx_organization_user_scopes_tree` (`org_tree_id`,`is_active`),
  KEY `idx_organization_user_scopes_entity` (`entity_code`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_answers`
--

CREATE TABLE `evaluation_answers` (
  `id` int NOT NULL,
  `evaluation_answer_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `attempt_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `selected_option_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `answer_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `selected_option_ids` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `is_correct` tinyint(1) DEFAULT NULL,
  `marks_awarded` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_assignments`
--

CREATE TABLE `evaluation_assignments` (
  `id` int NOT NULL,
  `evaluation_assignment_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `paper_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `due_date` datetime DEFAULT NULL,
  `status` enum('assigned','in_progress','submitted','expired') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'assigned'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_attempts`
--

CREATE TABLE `evaluation_attempts` (
  `id` int NOT NULL,
  `evaluation_attempt_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `paper_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `started_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `score` decimal(10,2) DEFAULT NULL,
  `max_score` decimal(10,2) DEFAULT NULL,
  `passed` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_papers`
--

CREATE TABLE `evaluation_papers` (
  `id` int NOT NULL,
  `evaluation_paper_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `time_limit_minutes` int DEFAULT NULL,
  `pass_marks` decimal(8,2) DEFAULT NULL,
  `available_from` datetime DEFAULT NULL,
  `available_to` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_questions`
--

CREATE TABLE `evaluation_questions` (
  `id` int NOT NULL,
  `evaluation_question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `paper_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `question_text` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `answer_type` enum('free_text','single_option','multiple_options','dropdown') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'single_option',
  `marks` decimal(8,2) DEFAULT '1.00',
  `question_type` enum('mcq_single') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'mcq_single',
  `sort_order` int DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `evaluation_question_options`
--

CREATE TABLE `evaluation_question_options` (
  `id` int NOT NULL,
  `evaluation_question_option_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `question_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `option_text` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `marks` decimal(10,2) DEFAULT '0.00',
  `order_index` int DEFAULT '0',
  `is_correct` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `field_visits`
--

CREATE TABLE `field_visits` (
  `id` int NOT NULL,
  `field_visit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `location_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `address` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `field_visit_assignments`
--

CREATE TABLE `field_visit_assignments` (
  `id` int NOT NULL,
  `field_visit_assignment_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `field_visit_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('assigned','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'assigned',
  `check_in_time` datetime DEFAULT NULL,
  `check_out_time` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `link_billing_credits`
--

CREATE TABLE `link_billing_credits` (
  `id` int NOT NULL,
  `link_billing_credit_id` varchar(20) NOT NULL,
  `organization_link_id` varchar(20) NOT NULL,
  `credit_for_entity_code` varchar(30) NOT NULL COMMENT 'entity that gains the credit (link target)',
  `credit_from_entity_code` varchar(30) NOT NULL COMMENT 'entity whose plan generates the credit (requester)',
  `source_plan_name` varchar(20) NOT NULL,
  `source_billing_cycle` varchar(10) NOT NULL,
  `source_yearly_billed` decimal(10,2) NOT NULL COMMENT 'total amount billed for source yearly plan',
  `remaining_months` int NOT NULL COMMENT 'months until source subscription end_date at generation time',
  `credit_amount` decimal(10,2) NOT NULL COMMENT 'monthly_rate × remaining_months',
  `applied_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'sum of all applications',
  `status` enum('active','fully_applied','reversed') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reversed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `link_credit_applications`
--

CREATE TABLE `link_credit_applications` (
  `id` int NOT NULL,
  `link_credit_application_id` varchar(20) NOT NULL,
  `link_billing_credit_id` varchar(20) NOT NULL,
  `payment_transaction_id` varchar(20) NOT NULL,
  `applied_amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notices`
--

CREATE TABLE `notices` (
  `id` int NOT NULL,
  `notice_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `notice_date` date NOT NULL,
  `assign_to_all` tinyint(1) DEFAULT '1',
  `created_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_by_entity_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notice_auditor_assignments`
--

CREATE TABLE `notice_auditor_assignments` (
  `id` int NOT NULL,
  `notice_auditor_assignment_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `notice_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization_links`
--

CREATE TABLE `organization_links` (
  `id` int NOT NULL,
  `organization_link_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `link_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `requester_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `requester_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `requester_level` tinyint NOT NULL,
  `target_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `target_level` tinyint NOT NULL,
  `verification_key_hash` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `verification_key_verified_at` timestamp NULL DEFAULT NULL,
  `status` enum('pending','accepted','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'pending',
  `requested_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organization_tree`
--

CREATE TABLE `organization_tree` (
  `id` int NOT NULL,
  `org_tree_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `parent_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `child_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `child_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `created_by` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `root_entity_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `parent_edge_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_otps`
--

CREATE TABLE `password_reset_otps` (
  `id` int NOT NULL,
  `password_reset_otp_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `otp` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_gateway_events`
--

CREATE TABLE `payment_gateway_events` (
  `id` bigint NOT NULL,
  `payment_gateway_event_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `payment_transaction_id` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `provider` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `event_type` varchar(64) COLLATE utf8mb4_general_ci NOT NULL,
  `provider_reference` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `provider_status` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `signature_valid` tinyint(1) NOT NULL DEFAULT '0',
  `payload_sha256` char(64) COLLATE utf8mb4_general_ci NOT NULL,
  `received_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `id` bigint NOT NULL,
  `payment_method_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `root_entity_code` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `gateway` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `token_ciphertext` text COLLATE utf8mb4_general_ci NOT NULL,
  `token_iv` varchar(32) COLLATE utf8mb4_general_ci NOT NULL,
  `token_auth_tag` varchar(32) COLLATE utf8mb4_general_ci NOT NULL,
  `token_fingerprint` char(64) COLLATE utf8mb4_general_ci NOT NULL,
  `provider_customer_reference` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `card_brand` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `card_last4` char(4) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `expiry_month` tinyint UNSIGNED DEFAULT NULL,
  `expiry_year` smallint UNSIGNED DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `consented_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_transactions`
--

CREATE TABLE `payment_transactions` (
  `id` int NOT NULL,
  `payment_transaction_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `payment_code` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `root_entity_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `purpose` enum('registration','upgrade','renewal') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `plan_name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Basic',
  `billing_cycle` enum('Monthly','Yearly') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Monthly',
  `amount` decimal(10,2) DEFAULT '0.00',
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'USD',
  `status` enum('pending','processing','paid','failed','cancelled') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'pending',
  `payer_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `payer_email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `org_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `promotion_campaign_id` varchar(20) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `list_amount` decimal(12,2) DEFAULT NULL,
  `promotion_discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `invoice_number` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gateway` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gateway_reference` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gateway_status` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `gateway_attempt_id` varchar(64) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `initiated_at` datetime DEFAULT NULL,
  `failed_at` datetime DEFAULT NULL,
  `failure_reason` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `save_payment_method_requested` tinyint(1) NOT NULL DEFAULT '0',
  `period_start` datetime DEFAULT NULL,
  `period_end` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `paid_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `plan_entry_prices`
--

CREATE TABLE `plan_entry_prices` (
  `id` int NOT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `monthly_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `plan_entry_prices`
--

INSERT INTO `plan_entry_prices` (`id`, `entity_type`, `monthly_price`, `updated_at`) VALUES
(1, 'Audit Firm Company', 999.00, '2026-07-23 03:15:50'),
(2, 'Audit Firm Department', 299.00, '2026-07-23 03:15:50'),
(3, 'Branch', 599.00, '2026-07-23 03:15:50'),
(4, 'Buying Office', 599.00, '2026-07-23 03:15:50'),
(5, 'Customer', 999.00, '2026-07-23 03:15:50'),
(6, 'Supplier', 299.00, '2026-07-23 03:15:50');

-- --------------------------------------------------------

--
-- Table structure for table `plan_settings`
--

CREATE TABLE `plan_settings` (
  `id` int NOT NULL,
  `plan_name` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `display_name` varchar(50) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `description` varchar(180) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '100',
  `monthly_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `yearly_discount_percent` decimal(5,2) NOT NULL DEFAULT '20.00',
  `max_company_levels` int NOT NULL,
  `max_departments` int NOT NULL,
  `max_audits` int NOT NULL,
  `max_checklists` int NOT NULL,
  `max_auditors` int NOT NULL,
  `allow_auditor_eval` tinyint(1) NOT NULL DEFAULT '0',
  `allow_company_to_company` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `plan_settings`
--

INSERT INTO `plan_settings` (`id`, `plan_name`, `display_name`, `description`, `sort_order`, `monthly_price`, `yearly_discount_percent`, `max_company_levels`, `max_departments`, `max_audits`, `max_checklists`, `max_auditors`, `allow_auditor_eval`, `allow_company_to_company`, `is_active`, `updated_at`) VALUES
(1, 'Basic', 'Basic', 'Perfect for trying out Audito', 10, 99.00, 20.00, 1, 4, 2, 3, 1, 0, 0, 1, '2026-07-23 03:15:50'),
(2, 'Elite', 'Elite', 'For large organizations', 30, 299.00, 20.00, 5, 16, 14, 25, 15, 1, 1, 1, '2026-07-23 03:15:50'),
(3, 'Pro', 'Pro', 'For growing teams', 20, 199.00, 20.00, 2, 8, 6, 6, 3, 0, 0, 1, '2026-07-23 03:15:50');

-- --------------------------------------------------------

--
-- Table structure for table `privacy_policies`
--

CREATE TABLE `privacy_policies` (
  `id` bigint UNSIGNED NOT NULL,
  `privacy_policy_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `intro` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `sections_json` json NOT NULL,
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `is_current` tinyint(1) NOT NULL DEFAULT '0',
  `effective_date` date DEFAULT NULL,
  `published_at` datetime DEFAULT NULL,
  `created_by` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `privacy_policies`
--

INSERT INTO `privacy_policies` (`id`, `privacy_policy_id`, `title`, `version`, `intro`, `sections_json`, `status`, `is_current`, `effective_date`, `published_at`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'PPOL00001', 'Privacy Policy', 'v1.0', 'This Privacy Policy explains how Audito collects, uses, protects, and shares information when you use our platform.', '[{\"title\": \"1. Information We Collect\", \"content\": \"We collect the account, organization, audit, checklist, report, corrective action, communication, and usage information needed to provide Audito.\"}, {\"title\": \"2. How We Use Information\", \"content\": \"We use this information to operate and secure the platform, deliver requested services, provide support, improve Audito, and meet legal obligations.\"}, {\"title\": \"3. Information Sharing\", \"content\": \"We do not sell personal information. We share information only with authorized users, service providers that support Audito, or where required by law.\"}, {\"title\": \"4. Data Security\", \"content\": \"We use appropriate technical and organizational measures to protect information. No online service can guarantee absolute security.\"}, {\"title\": \"5. Your Rights and Choices\", \"content\": \"You may request access, correction, or deletion of personal information where applicable, subject to legal and operational requirements.\"}, {\"title\": \"6. Contact Us\", \"content\": \"For privacy questions or requests, contact Audito through the support details published in the platform.\"}]', 'published', 1, '2026-07-23', '2026-07-23 17:08:07', NULL, '2026-07-23 11:38:07', '2026-07-23 11:38:07');

-- --------------------------------------------------------

--
-- Table structure for table `privacy_policy_agreements`
--

CREATE TABLE `privacy_policy_agreements` (
  `id` bigint UNSIGNED NOT NULL,
  `privacy_policy_agreement_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `privacy_policy_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `root_entity_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accepted_by_email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agreed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotion_campaigns`
--

CREATE TABLE `promotion_campaigns` (
  `id` int NOT NULL,
  `campaign_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(300) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `discount_type` enum('percentage','fixed') COLLATE utf8mb4_general_ci NOT NULL,
  `discount_value` decimal(10,2) NOT NULL,
  `priority` smallint UNSIGNED NOT NULL DEFAULT '0',
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  `applies_to_registration` tinyint(1) NOT NULL DEFAULT '1',
  `applies_to_upgrade` tinyint(1) NOT NULL DEFAULT '0',
  `applies_to_renewal` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotion_campaign_plans`
--

CREATE TABLE `promotion_campaign_plans` (
  `id` int NOT NULL,
  `campaign_id` varchar(20) COLLATE utf8mb4_general_ci NOT NULL,
  `plan_name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `billing_cycle` enum('Monthly','Yearly','Any') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'Any'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promo_codes`
--

CREATE TABLE `promo_codes` (
  `id` int NOT NULL,
  `promo_code_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `discount_percentage` decimal(5,2) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL,
  `refresh_token_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `user_role` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'admin',
  `token` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `refresh_tokens`
--

INSERT INTO `refresh_tokens` (`id`, `refresh_token_id`, `admin_id`, `user_role`, `token`, `expires_at`, `created_at`) VALUES
(1, 'RT000001', 'USR-00000002', 'audito_admin', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJVU1ItMDAwMDAwMDIiLCJ1c2VyQ29kZSI6IlVTUi0wMDAwMDAwMiIsInJvbGUiOiJhdWRpdG9fYWRtaW4iLCJpYXQiOjE3ODUxMjA2NTIsImV4cCI6MTc4NTcyNTQ1Mn0.TTSkvDNmjD8y9bkFmE3TBVCTs2v-vCtw9_xJYnOZwoU', '2026-08-03 02:50:52', '2026-07-27 02:50:52');

-- --------------------------------------------------------

--
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` int NOT NULL,
  `subscription_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `root_entity_code` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `plan_name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `billing_cycle` enum('Monthly','Yearly','None') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'None',
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `max_company_levels` int DEFAULT '1',
  `max_departments` int DEFAULT '4',
  `max_audits` int DEFAULT '2',
  `max_checklists` int DEFAULT '3',
  `max_auditors` int DEFAULT '1',
  `allow_auditor_eval` tinyint(1) DEFAULT '0',
  `allow_company_to_company` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trainings`
--

CREATE TABLE `trainings` (
  `id` int NOT NULL,
  `training_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `entity_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `platform` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `video_url` varchar(800) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `duration_minutes` int DEFAULT NULL,
  `created_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `training_assignments`
--

CREATE TABLE `training_assignments` (
  `id` int NOT NULL,
  `training_assignment_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `training_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `auditor_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `assigned_by_admin_id` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('assigned','completed') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'assigned',
  `completed_at` timestamp NULL DEFAULT NULL,
  `watched_seconds` int UNSIGNED NOT NULL DEFAULT '0',
  `last_position_seconds` int UNSIGNED NOT NULL DEFAULT '0',
  `is_watching` tinyint(1) NOT NULL DEFAULT '0',
  `watch_started_at` datetime DEFAULT NULL,
  `last_watched_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_notifications`
--

CREATE TABLE `user_notifications` (
  `id` bigint UNSIGNED NOT NULL,
  `notification_id` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_user_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_role` enum('admin','auditor','organization_user','audito_admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_by_entity_code` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `audit_id` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notify_date` datetime DEFAULT NULL,
  `notification_key` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `admin_id` (`admin_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_account_type` (`account_type`);

--
-- Indexes for table `ai_checklist_generation_jobs`
--
ALTER TABLE `ai_checklist_generation_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ai_checklist_job_id` (`ai_checklist_job_id`),
  ADD KEY `idx_ai_checklist_jobs_entity_created` (`entity_code`,`created_at`),
  ADD KEY `idx_ai_checklist_jobs_requested_by` (`requested_by`);

--
-- Indexes for table `ai_checklist_question_suggestions`
--
ALTER TABLE `ai_checklist_question_suggestions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ai_checklist_suggestion_id` (`ai_checklist_suggestion_id`),
  ADD KEY `idx_ai_checklist_suggestions_job` (`ai_checklist_job_id`);

--
-- Indexes for table `auditors`
--
ALTER TABLE `auditors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auditor_id` (`auditor_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_created_by` (`created_by_entity_code`),
  ADD KEY `idx_assigned` (`assigned_entity_code`),
  ADD KEY `idx_auditor_type` (`auditor_type`);

--
-- Indexes for table `auditor_experiences`
--
ALTER TABLE `auditor_experiences`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auditor_experience_id` (`auditor_experience_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

--
-- Indexes for table `auditor_notifications`
--
ALTER TABLE `auditor_notifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auditor_notification_id` (`auditor_notification_id`),
  ADD UNIQUE KEY `notification_key` (`notification_key`),
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_created_by_entity` (`created_by_entity_code`),
  ADD KEY `idx_notify_date` (`notify_date`),
  ADD KEY `fk_auditor_notifications_audit` (`audit_id`);

--
-- Indexes for table `auditor_profiles`
--
ALTER TABLE `auditor_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auditor_profile_id` (`auditor_profile_id`),
  ADD UNIQUE KEY `auditor_id` (`auditor_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

--
-- Indexes for table `auditor_qualifications`
--
ALTER TABLE `auditor_qualifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auditor_qualification_id` (`auditor_qualification_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

--
-- Indexes for table `auditor_trainings`
--
ALTER TABLE `auditor_trainings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `auditor_training_id` (`auditor_training_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

--
-- Indexes for table `audit_assignments`
--
ALTER TABLE `audit_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `audit_id` (`audit_id`),
  ADD KEY `idx_checklist_id` (`checklist_id`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_audit_type` (`audit_type`),
  ADD KEY `fk_audit_assignments_auditor` (`assigned_auditor_id`),
  ADD KEY `fk_audit_assignments_firm` (`assigned_firm_code`),
  ADD KEY `fk_audit_assignments_parent` (`parent_audit_id`);

--
-- Indexes for table `audit_assignment_entities`
--
ALTER TABLE `audit_assignment_entities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `audit_assignment_entity_id` (`audit_assignment_entity_id`),
  ADD UNIQUE KEY `uq_audit_entity` (`audit_id`,`entity_code`,`org_tree_id`),
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_entity_code` (`entity_code`);

--
-- Indexes for table `audit_entity_progress`
--
ALTER TABLE `audit_entity_progress`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `audit_entity_progress_id` (`audit_entity_progress_id`),
  ADD UNIQUE KEY `uq_audit_org_entity` (`audit_id`,`org_tree_id`,`entity_code`),
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

--
-- Indexes for table `audit_evidence`
--
ALTER TABLE `audit_evidence`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `audit_evidence_id` (`audit_evidence_id`),
  ADD KEY `idx_audit_response_id` (`audit_response_id`);

--
-- Indexes for table `audit_firm_companies`
--
ALTER TABLE `audit_firm_companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `afc_code` (`afc_code`),
  ADD KEY `idx_afc_code` (`afc_code`);

--
-- Indexes for table `audit_firm_company_branches`
--
ALTER TABLE `audit_firm_company_branches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `afc_branch_code` (`afc_branch_code`),
  ADD KEY `idx_afc_code` (`afc_code`),
  ADD KEY `idx_afc_branch_code` (`afc_branch_code`);

--
-- Indexes for table `audit_firm_company_departments`
--
ALTER TABLE `audit_firm_company_departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `afc_dept_code` (`afc_dept_code`),
  ADD KEY `idx_afc_code` (`afc_code`),
  ADD KEY `idx_afc_branch_code` (`afc_branch_code`);

--
-- Indexes for table `audit_responses`
--
ALTER TABLE `audit_responses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `audit_response_id` (`audit_response_id`),
  ADD UNIQUE KEY `uq_response` (`audit_id`,`entity_code`,`checklist_question_id`,`org_tree_id`),
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_checklist_question_id` (`checklist_question_id`);

--
-- Indexes for table `caps`
--
ALTER TABLE `caps`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cap_id` (`cap_id`),
  ADD KEY `idx_caps_audit_id` (`audit_id`),
  ADD KEY `idx_caps_status` (`status`),
  ADD KEY `fk_caps_parent` (`parent_cap_id`);

--
-- Indexes for table `cap_assignment_entities`
--
ALTER TABLE `cap_assignment_entities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cap_assignment_entity_id` (`cap_assignment_entity_id`),
  ADD UNIQUE KEY `uq_cap_entity` (`cap_id`,`entity_code`,`org_tree_id`),
  ADD KEY `idx_cap_id` (`cap_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

--
-- Indexes for table `cap_entity_progress`
--
ALTER TABLE `cap_entity_progress`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cap_entity_progress_id` (`cap_entity_progress_id`),
  ADD UNIQUE KEY `uq_cap_entity_progress` (`cap_id`,`entity_code`,`org_tree_id`),
  ADD KEY `idx_cap_id` (`cap_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

--
-- Indexes for table `cap_questions`
--
ALTER TABLE `cap_questions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cap_question_id` (`cap_question_id`),
  ADD UNIQUE KEY `uq_cap_question` (`cap_id`,`corrective_action_id`),
  ADD KEY `idx_cap_id` (`cap_id`),
  ADD KEY `idx_corrective_action_id` (`corrective_action_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

--
-- Indexes for table `cap_responses`
--
ALTER TABLE `cap_responses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cap_response_id` (`cap_response_id`),
  ADD UNIQUE KEY `uq_cap_question_response` (`cap_question_id`),
  ADD KEY `idx_cap_question_id` (`cap_question_id`),
  ADD KEY `idx_cap_responses_status` (`status`);

--
-- Indexes for table `cap_response_evidence`
--
ALTER TABLE `cap_response_evidence`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cap_response_evidence_id` (`cap_response_evidence_id`),
  ADD KEY `idx_cap_response_id` (`cap_response_id`);

--
-- Indexes for table `checklists`
--
ALTER TABLE `checklists`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `checklist_id` (`checklist_id`),
  ADD KEY `idx_checklist_type_id` (`checklist_type_id`);

--
-- Indexes for table `checklist_questions`
--
ALTER TABLE `checklist_questions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `checklist_question_id` (`checklist_question_id`),
  ADD KEY `idx_checklist_id` (`checklist_id`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`);

--
-- Indexes for table `checklist_question_options`
--
ALTER TABLE `checklist_question_options`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `checklist_question_option_id` (`checklist_question_option_id`),
  ADD KEY `idx_checklist_question_id` (`checklist_question_id`);

--
-- Indexes for table `checklist_types`
--
ALTER TABLE `checklist_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `checklist_type_id` (`checklist_type_id`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_companies` (`cust_code`);

--
-- Indexes for table `company_clusters`
--
ALTER TABLE `company_clusters`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `comp_clus_code` (`comp_clus_code`),
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_clusters` (`cust_code`);

--
-- Indexes for table `company_departments`
--
ALTER TABLE `company_departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `comp_dept_code` (`comp_dept_code`),
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_depts` (`cust_code`),
  ADD KEY `idx_comp_unit_code` (`comp_unit_code`);

--
-- Indexes for table `company_factories`
--
ALTER TABLE `company_factories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `comp_fact_code` (`comp_fact_code`),
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_factories` (`cust_code`),
  ADD KEY `idx_comp_clus_code` (`comp_clus_code`);

--
-- Indexes for table `company_sections`
--
ALTER TABLE `company_sections`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `comp_section_code` (`comp_section_code`),
  ADD KEY `idx_section_cust_code` (`cust_code`),
  ADD KEY `idx_section_comp_code` (`comp_code`),
  ADD KEY `idx_section_dept_code` (`comp_dept_code`);

--
-- Indexes for table `company_units`
--
ALTER TABLE `company_units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `comp_unit_code` (`comp_unit_code`),
  ADD KEY `idx_comp_code` (`comp_code`),
  ADD KEY `idx_cust_code_units` (`cust_code`),
  ADD KEY `idx_comp_fact_code` (`comp_fact_code`);

--
-- Indexes for table `contact_messages`
--
ALTER TABLE `contact_messages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `contact_message_id` (`contact_message_id`);

--
-- Indexes for table `corrective_actions`
--
ALTER TABLE `corrective_actions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `corrective_action_id` (`corrective_action_id`),
  ADD KEY `idx_audit_id` (`audit_id`),
  ADD KEY `idx_entity_code` (`entity_code`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_responsible_organization_user` (`responsible_organization_user_id`),
  ADD KEY `idx_audit_response_id` (`audit_response_id`),
  ADD KEY `idx_org_tree_id` (`org_tree_id`),
  ADD KEY `fk_corrective_actions_cap_response` (`cap_response_id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cust_code` (`cust_code`),
  ADD KEY `idx_cust_code` (`cust_code`);

--
-- Indexes for table `customer_buying_offices`
--
ALTER TABLE `customer_buying_offices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cbo_code` (`cbo_code`),
  ADD KEY `idx_cust_code` (`cust_code`);

--
-- Indexes for table `customer_suppliers`
--
ALTER TABLE `customer_suppliers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `csup_code` (`csup_code`),
  ADD KEY `idx_cust_code` (`cust_code`),
  ADD KEY `idx_cbo_code` (`cbo_code`);

--
-- Indexes for table `custom_solution_requests`
--
ALTER TABLE `custom_solution_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `request_id` (`request_id`),
  ADD UNIQUE KEY `root_entity_code` (`root_entity_code`),
  ADD KEY `admin_id` (`admin_id`),
  ADD KEY `status` (`status`),
  ADD KEY `idx_custom_solution_verification_token` (`verification_token`);

--
-- Indexes for table `organization_users`
--
ALTER TABLE `organization_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `organization_user_id` (`organization_user_id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_user_type` (`user_type`),
  ADD KEY `idx_created_by` (`created_by_entity_code`),
  ADD KEY `idx_assigned` (`assigned_entity_code`),
  ADD KEY `idx_assigned_org_tree_id` (`assigned_org_tree_id`),
  ADD KEY `fk_organization_users_admin` (`created_by_admin_id`);

--
-- Indexes for table `evaluation_answers`
--
ALTER TABLE `evaluation_answers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `evaluation_answer_id` (`evaluation_answer_id`),
  ADD UNIQUE KEY `uq_attempt_question` (`attempt_id`,`question_id`),
  ADD KEY `idx_attempt_id` (`attempt_id`),
  ADD KEY `idx_question_id` (`question_id`);

--
-- Indexes for table `evaluation_assignments`
--
ALTER TABLE `evaluation_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `evaluation_assignment_id` (`evaluation_assignment_id`),
  ADD UNIQUE KEY `uq_paper_auditor` (`paper_id`,`auditor_id`),
  ADD KEY `idx_paper_id` (`paper_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_assigned_by_admin_id` (`assigned_by_admin_id`),
  ADD KEY `idx_evaluation_assignment_expiry` (`status`,`expires_at`);

--
-- Indexes for table `evaluation_attempts`
--
ALTER TABLE `evaluation_attempts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `evaluation_attempt_id` (`evaluation_attempt_id`),
  ADD KEY `idx_paper_id` (`paper_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

--
-- Indexes for table `evaluation_papers`
--
ALTER TABLE `evaluation_papers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `evaluation_paper_id` (`evaluation_paper_id`),
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`),
  ADD KEY `idx_entity_code` (`entity_code`);

--
-- Indexes for table `evaluation_questions`
--
ALTER TABLE `evaluation_questions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `evaluation_question_id` (`evaluation_question_id`),
  ADD KEY `idx_paper_id` (`paper_id`);

--
-- Indexes for table `evaluation_question_options`
--
ALTER TABLE `evaluation_question_options`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `evaluation_question_option_id` (`evaluation_question_option_id`),
  ADD KEY `idx_question_id` (`question_id`);

--
-- Indexes for table `field_visits`
--
ALTER TABLE `field_visits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `field_visit_id` (`field_visit_id`),
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`),
  ADD KEY `idx_entity_code` (`entity_code`);

--
-- Indexes for table `field_visit_assignments`
--
ALTER TABLE `field_visit_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `field_visit_assignment_id` (`field_visit_assignment_id`),
  ADD UNIQUE KEY `uq_field_visit_auditor` (`field_visit_id`,`auditor_id`),
  ADD KEY `idx_field_visit_id` (`field_visit_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_assigned_by_admin_id` (`assigned_by_admin_id`);

--
-- Indexes for table `link_billing_credits`
--
ALTER TABLE `link_billing_credits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_link_billing_credit_id` (`link_billing_credit_id`),
  ADD KEY `idx_lbc_for` (`credit_for_entity_code`),
  ADD KEY `idx_lbc_from` (`credit_from_entity_code`),
  ADD KEY `idx_lbc_link` (`organization_link_id`);

--
-- Indexes for table `link_credit_applications`
--
ALTER TABLE `link_credit_applications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_link_credit_application_id` (`link_credit_application_id`),
  ADD KEY `idx_lca_credit` (`link_billing_credit_id`),
  ADD KEY `idx_lca_payment` (`payment_transaction_id`);

--
-- Indexes for table `notices`
--
ALTER TABLE `notices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `notice_id` (`notice_id`),
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`),
  ADD KEY `idx_notice_entity` (`created_by_entity_code`);

--
-- Indexes for table `notice_auditor_assignments`
--
ALTER TABLE `notice_auditor_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `notice_auditor_assignment_id` (`notice_auditor_assignment_id`),
  ADD KEY `idx_notice_id` (`notice_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`);

--
-- Indexes for table `organization_links`
--
ALTER TABLE `organization_links`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `organization_link_id` (`organization_link_id`),
  ADD UNIQUE KEY `link_code` (`link_code`),
  ADD UNIQUE KEY `uq_link` (`requester_type`,`requester_code`,`target_type`,`target_code`),
  ADD KEY `idx_requester` (`requester_type`,`requester_code`),
  ADD KEY `idx_target` (`target_type`,`target_code`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `organization_tree`
--
ALTER TABLE `organization_tree`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `org_tree_id` (`org_tree_id`),
  ADD UNIQUE KEY `uq_edge` (`parent_code`,`child_code`,`root_entity_code`,`parent_edge_id`),
  ADD KEY `idx_parent` (`parent_type`,`parent_code`),
  ADD KEY `idx_child` (`child_type`,`child_code`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_root_entity` (`root_entity_code`),
  ADD KEY `idx_parent_edge` (`parent_edge_id`);

--
-- Indexes for table `password_reset_otps`
--
ALTER TABLE `password_reset_otps`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `password_reset_otp_id` (`password_reset_otp_id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_otp` (`otp`);

--
-- Indexes for table `payment_gateway_events`
--
ALTER TABLE `payment_gateway_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payment_gateway_event_id` (`payment_gateway_event_id`),
  ADD UNIQUE KEY `uq_gateway_event` (`provider`,`event_type`,`provider_reference`,`payload_sha256`),
  ADD KEY `idx_gateway_event_payment` (`payment_transaction_id`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payment_method_id` (`payment_method_id`),
  ADD UNIQUE KEY `uq_gateway_token` (`root_entity_code`,`gateway`,`token_fingerprint`),
  ADD KEY `idx_payment_method_org` (`root_entity_code`,`revoked_at`,`is_default`);

--
-- Indexes for table `payment_transactions`
--
ALTER TABLE `payment_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payment_transaction_id` (`payment_transaction_id`),
  ADD UNIQUE KEY `payment_code` (`payment_code`),
  ADD UNIQUE KEY `invoice_number` (`invoice_number`),
  ADD UNIQUE KEY `uq_payment_gateway_attempt` (`gateway_attempt_id`),
  ADD KEY `idx_root_entity` (`root_entity_code`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_payment_gateway_reference` (`gateway`,`gateway_reference`),
  ADD KEY `idx_payment_status_created` (`status`,`created_at`),
  ADD KEY `idx_payment_transactions_promotion_campaign` (`promotion_campaign_id`);

--
-- Indexes for table `plan_entry_prices`
--
ALTER TABLE `plan_entry_prices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_plan_entry_prices_entity_type` (`entity_type`);

--
-- Indexes for table `plan_settings`
--
ALTER TABLE `plan_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_plan_settings_plan_name` (`plan_name`);

--
-- Indexes for table `privacy_policies`
--
ALTER TABLE `privacy_policies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_privacy_policies_policy_id` (`privacy_policy_id`),
  ADD UNIQUE KEY `uq_privacy_policies_version` (`version`),
  ADD KEY `idx_privacy_policies_current` (`status`,`is_current`);

--
-- Indexes for table `privacy_policy_agreements`
--
ALTER TABLE `privacy_policy_agreements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_privacy_policy_agreement_id` (`privacy_policy_agreement_id`),
  ADD KEY `idx_privacy_policy_agreements_policy` (`privacy_policy_id`),
  ADD KEY `idx_privacy_policy_agreements_entity` (`root_entity_code`);

--
-- Indexes for table `promotion_campaigns`
--
ALTER TABLE `promotion_campaigns`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_promotion_campaign_id` (`campaign_id`),
  ADD KEY `idx_promotion_campaigns_active_window` (`is_active`,`starts_at`,`ends_at`);

--
-- Indexes for table `promotion_campaign_plans`
--
ALTER TABLE `promotion_campaign_plans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_promotion_campaign_plan` (`campaign_id`,`plan_name`,`billing_cycle`),
  ADD KEY `idx_promotion_campaign_plans_lookup` (`plan_name`,`billing_cycle`);

--
-- Indexes for table `promo_codes`
--
ALTER TABLE `promo_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `promo_code_id` (`promo_code_id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `refresh_token_id` (`refresh_token_id`),
  ADD KEY `idx_token` (`token`(255)),
  ADD KEY `idx_admin_id` (`admin_id`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `subscription_id` (`subscription_id`),
  ADD UNIQUE KEY `root_entity_code` (`root_entity_code`);

--
-- Indexes for table `trainings`
--
ALTER TABLE `trainings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `training_id` (`training_id`),
  ADD KEY `idx_created_by_admin_id` (`created_by_admin_id`),
  ADD KEY `idx_entity_code` (`entity_code`);

--
-- Indexes for table `training_assignments`
--
ALTER TABLE `training_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `training_assignment_id` (`training_assignment_id`),
  ADD UNIQUE KEY `uq_training_auditor` (`training_id`,`auditor_id`),
  ADD KEY `idx_training_id` (`training_id`),
  ADD KEY `idx_auditor_id` (`auditor_id`),
  ADD KEY `idx_assigned_by_admin_id` (`assigned_by_admin_id`);

--
-- Indexes for table `user_notifications`
--
ALTER TABLE `user_notifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_user_notifications_id` (`notification_id`),
  ADD UNIQUE KEY `uq_user_notifications_key` (`notification_key`),
  ADD KEY `idx_user_notifications_recipient` (`recipient_user_code`,`recipient_role`,`is_active`,`created_at`),
  ADD KEY `idx_user_notifications_audit` (`audit_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `ai_checklist_generation_jobs`
--
ALTER TABLE `ai_checklist_generation_jobs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ai_checklist_question_suggestions`
--
ALTER TABLE `ai_checklist_question_suggestions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditors`
--
ALTER TABLE `auditors`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditor_experiences`
--
ALTER TABLE `auditor_experiences`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditor_notifications`
--
ALTER TABLE `auditor_notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditor_profiles`
--
ALTER TABLE `auditor_profiles`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditor_qualifications`
--
ALTER TABLE `auditor_qualifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auditor_trainings`
--
ALTER TABLE `auditor_trainings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_assignments`
--
ALTER TABLE `audit_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_assignment_entities`
--
ALTER TABLE `audit_assignment_entities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_entity_progress`
--
ALTER TABLE `audit_entity_progress`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_evidence`
--
ALTER TABLE `audit_evidence`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_firm_companies`
--
ALTER TABLE `audit_firm_companies`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_firm_company_branches`
--
ALTER TABLE `audit_firm_company_branches`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_firm_company_departments`
--
ALTER TABLE `audit_firm_company_departments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `audit_responses`
--
ALTER TABLE `audit_responses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `caps`
--
ALTER TABLE `caps`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cap_assignment_entities`
--
ALTER TABLE `cap_assignment_entities`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cap_entity_progress`
--
ALTER TABLE `cap_entity_progress`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cap_questions`
--
ALTER TABLE `cap_questions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cap_responses`
--
ALTER TABLE `cap_responses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cap_response_evidence`
--
ALTER TABLE `cap_response_evidence`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `checklists`
--
ALTER TABLE `checklists`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `checklist_questions`
--
ALTER TABLE `checklist_questions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `checklist_question_options`
--
ALTER TABLE `checklist_question_options`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `checklist_types`
--
ALTER TABLE `checklist_types`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `company_clusters`
--
ALTER TABLE `company_clusters`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `company_departments`
--
ALTER TABLE `company_departments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `company_factories`
--
ALTER TABLE `company_factories`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `company_sections`
--
ALTER TABLE `company_sections`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `company_units`
--
ALTER TABLE `company_units`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `contact_messages`
--
ALTER TABLE `contact_messages`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `corrective_actions`
--
ALTER TABLE `corrective_actions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_buying_offices`
--
ALTER TABLE `customer_buying_offices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_suppliers`
--
ALTER TABLE `customer_suppliers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `custom_solution_requests`
--
ALTER TABLE `custom_solution_requests`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organization_users`
--
ALTER TABLE `organization_users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evaluation_answers`
--
ALTER TABLE `evaluation_answers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evaluation_assignments`
--
ALTER TABLE `evaluation_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evaluation_attempts`
--
ALTER TABLE `evaluation_attempts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evaluation_papers`
--
ALTER TABLE `evaluation_papers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evaluation_questions`
--
ALTER TABLE `evaluation_questions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `evaluation_question_options`
--
ALTER TABLE `evaluation_question_options`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `field_visits`
--
ALTER TABLE `field_visits`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `field_visit_assignments`
--
ALTER TABLE `field_visit_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `link_billing_credits`
--
ALTER TABLE `link_billing_credits`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `link_credit_applications`
--
ALTER TABLE `link_credit_applications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notices`
--
ALTER TABLE `notices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notice_auditor_assignments`
--
ALTER TABLE `notice_auditor_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organization_links`
--
ALTER TABLE `organization_links`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organization_tree`
--
ALTER TABLE `organization_tree`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `password_reset_otps`
--
ALTER TABLE `password_reset_otps`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_gateway_events`
--
ALTER TABLE `payment_gateway_events`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `id` bigint NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_transactions`
--
ALTER TABLE `payment_transactions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `plan_entry_prices`
--
ALTER TABLE `plan_entry_prices`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `plan_settings`
--
ALTER TABLE `plan_settings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `privacy_policies`
--
ALTER TABLE `privacy_policies`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `privacy_policy_agreements`
--
ALTER TABLE `privacy_policy_agreements`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `promotion_campaigns`
--
ALTER TABLE `promotion_campaigns`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `promotion_campaign_plans`
--
ALTER TABLE `promotion_campaign_plans`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `promo_codes`
--
ALTER TABLE `promo_codes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `subscriptions`
--
ALTER TABLE `subscriptions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `trainings`
--
ALTER TABLE `trainings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `training_assignments`
--
ALTER TABLE `training_assignments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_notifications`
--
ALTER TABLE `user_notifications`
  MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `ai_checklist_question_suggestions`
--
ALTER TABLE `ai_checklist_question_suggestions`
  ADD CONSTRAINT `fk_ai_checklist_suggestions_job` FOREIGN KEY (`ai_checklist_job_id`) REFERENCES `ai_checklist_generation_jobs` (`ai_checklist_job_id`) ON DELETE CASCADE;

--
-- Constraints for table `auditor_experiences`
--
ALTER TABLE `auditor_experiences`
  ADD CONSTRAINT `fk_auditor_experiences_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

--
-- Constraints for table `auditor_notifications`
--
ALTER TABLE `auditor_notifications`
  ADD CONSTRAINT `fk_auditor_notifications_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_auditor_notifications_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

--
-- Constraints for table `auditor_profiles`
--
ALTER TABLE `auditor_profiles`
  ADD CONSTRAINT `fk_auditor_profiles_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

--
-- Constraints for table `auditor_qualifications`
--
ALTER TABLE `auditor_qualifications`
  ADD CONSTRAINT `fk_auditor_qualifications_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

--
-- Constraints for table `auditor_trainings`
--
ALTER TABLE `auditor_trainings`
  ADD CONSTRAINT `fk_auditor_trainings_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE;

--
-- Constraints for table `audit_assignments`
--
ALTER TABLE `audit_assignments`
  ADD CONSTRAINT `fk_audit_assignments_auditor` FOREIGN KEY (`assigned_auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_audit_assignments_checklist` FOREIGN KEY (`checklist_id`) REFERENCES `checklists` (`checklist_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_audit_assignments_firm` FOREIGN KEY (`assigned_firm_code`) REFERENCES `audit_firm_companies` (`afc_code`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_audit_assignments_parent` FOREIGN KEY (`parent_audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE SET NULL;

--
-- Constraints for table `audit_assignment_entities`
--
ALTER TABLE `audit_assignment_entities`
  ADD CONSTRAINT `fk_audit_assignment_entities_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE;

--
-- Constraints for table `audit_entity_progress`
--
ALTER TABLE `audit_entity_progress`
  ADD CONSTRAINT `fk_audit_entity_progress_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE;

--
-- Constraints for table `audit_evidence`
--
ALTER TABLE `audit_evidence`
  ADD CONSTRAINT `fk_audit_evidence_response` FOREIGN KEY (`audit_response_id`) REFERENCES `audit_responses` (`audit_response_id`) ON DELETE CASCADE;

--
-- Constraints for table `audit_responses`
--
ALTER TABLE `audit_responses`
  ADD CONSTRAINT `fk_audit_responses_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_audit_responses_question` FOREIGN KEY (`checklist_question_id`) REFERENCES `checklist_questions` (`checklist_question_id`) ON DELETE CASCADE;

--
-- Constraints for table `caps`
--
ALTER TABLE `caps`
  ADD CONSTRAINT `fk_caps_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_caps_parent` FOREIGN KEY (`parent_cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE SET NULL;

--
-- Constraints for table `cap_assignment_entities`
--
ALTER TABLE `cap_assignment_entities`
  ADD CONSTRAINT `fk_cap_assignment_entities_cap` FOREIGN KEY (`cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE CASCADE;

--
-- Constraints for table `cap_entity_progress`
--
ALTER TABLE `cap_entity_progress`
  ADD CONSTRAINT `fk_cap_entity_progress_cap` FOREIGN KEY (`cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE CASCADE;

--
-- Constraints for table `cap_questions`
--
ALTER TABLE `cap_questions`
  ADD CONSTRAINT `fk_cap_questions_cap` FOREIGN KEY (`cap_id`) REFERENCES `caps` (`cap_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cap_questions_corrective_action` FOREIGN KEY (`corrective_action_id`) REFERENCES `corrective_actions` (`corrective_action_id`) ON DELETE CASCADE;

--
-- Constraints for table `cap_responses`
--
ALTER TABLE `cap_responses`
  ADD CONSTRAINT `fk_cap_responses_cap_question` FOREIGN KEY (`cap_question_id`) REFERENCES `cap_questions` (`cap_question_id`) ON DELETE CASCADE;

--
-- Constraints for table `cap_response_evidence`
--
ALTER TABLE `cap_response_evidence`
  ADD CONSTRAINT `fk_cap_response_evidence_cap_response` FOREIGN KEY (`cap_response_id`) REFERENCES `cap_responses` (`cap_response_id`) ON DELETE CASCADE;

--
-- Constraints for table `checklists`
--
ALTER TABLE `checklists`
  ADD CONSTRAINT `fk_checklists_checklist_type` FOREIGN KEY (`checklist_type_id`) REFERENCES `checklist_types` (`checklist_type_id`) ON DELETE SET NULL;

--
-- Constraints for table `checklist_questions`
--
ALTER TABLE `checklist_questions`
  ADD CONSTRAINT `fk_checklist_questions_checklist` FOREIGN KEY (`checklist_id`) REFERENCES `checklists` (`checklist_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_checklist_questions_org_tree` FOREIGN KEY (`org_tree_id`) REFERENCES `organization_tree` (`org_tree_id`) ON DELETE SET NULL;

--
-- Constraints for table `checklist_question_options`
--
ALTER TABLE `checklist_question_options`
  ADD CONSTRAINT `fk_checklist_question_options_question` FOREIGN KEY (`checklist_question_id`) REFERENCES `checklist_questions` (`checklist_question_id`) ON DELETE CASCADE;

--
-- Constraints for table `corrective_actions`
--
ALTER TABLE `corrective_actions`
  ADD CONSTRAINT `fk_corrective_actions_audit` FOREIGN KEY (`audit_id`) REFERENCES `audit_assignments` (`audit_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_corrective_actions_cap_response` FOREIGN KEY (`cap_response_id`) REFERENCES `cap_responses` (`cap_response_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_corrective_actions_organization_user` FOREIGN KEY (`responsible_organization_user_id`) REFERENCES `organization_users` (`organization_user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_corrective_actions_response` FOREIGN KEY (`audit_response_id`) REFERENCES `audit_responses` (`audit_response_id`) ON DELETE CASCADE;

--
-- Constraints for table `custom_solution_requests`
--
ALTER TABLE `custom_solution_requests`
  ADD CONSTRAINT `fk_custom_solution_requests_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE;

--
-- Constraints for table `organization_users`
--
ALTER TABLE `organization_users`
  ADD CONSTRAINT `fk_organization_users_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE;

--
-- Constraints for table `organization_user_scopes`
--
ALTER TABLE `organization_user_scopes`
  ADD CONSTRAINT `fk_organization_user_scopes_user` FOREIGN KEY (`organization_user_id`) REFERENCES `organization_users` (`organization_user_id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_answers`
--
ALTER TABLE `evaluation_answers`
  ADD CONSTRAINT `fk_evaluation_answers_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `evaluation_attempts` (`evaluation_attempt_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_evaluation_answers_question` FOREIGN KEY (`question_id`) REFERENCES `evaluation_questions` (`evaluation_question_id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_assignments`
--
ALTER TABLE `evaluation_assignments`
  ADD CONSTRAINT `fk_evaluation_assignments_admin` FOREIGN KEY (`assigned_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_evaluation_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_evaluation_assignments_paper` FOREIGN KEY (`paper_id`) REFERENCES `evaluation_papers` (`evaluation_paper_id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_attempts`
--
ALTER TABLE `evaluation_attempts`
  ADD CONSTRAINT `fk_evaluation_attempts_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_evaluation_attempts_paper` FOREIGN KEY (`paper_id`) REFERENCES `evaluation_papers` (`evaluation_paper_id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_papers`
--
ALTER TABLE `evaluation_papers`
  ADD CONSTRAINT `fk_evaluation_papers_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

--
-- Constraints for table `evaluation_questions`
--
ALTER TABLE `evaluation_questions`
  ADD CONSTRAINT `fk_evaluation_questions_paper` FOREIGN KEY (`paper_id`) REFERENCES `evaluation_papers` (`evaluation_paper_id`) ON DELETE CASCADE;

--
-- Constraints for table `evaluation_question_options`
--
ALTER TABLE `evaluation_question_options`
  ADD CONSTRAINT `fk_evaluation_question_options_question` FOREIGN KEY (`question_id`) REFERENCES `evaluation_questions` (`evaluation_question_id`) ON DELETE CASCADE;

--
-- Constraints for table `field_visits`
--
ALTER TABLE `field_visits`
  ADD CONSTRAINT `fk_field_visits_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

--
-- Constraints for table `field_visit_assignments`
--
ALTER TABLE `field_visit_assignments`
  ADD CONSTRAINT `fk_field_visit_assignments_admin` FOREIGN KEY (`assigned_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_field_visit_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_field_visit_assignments_visit` FOREIGN KEY (`field_visit_id`) REFERENCES `field_visits` (`field_visit_id`) ON DELETE CASCADE;

--
-- Constraints for table `notices`
--
ALTER TABLE `notices`
  ADD CONSTRAINT `fk_notices_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE;

--
-- Constraints for table `notice_auditor_assignments`
--
ALTER TABLE `notice_auditor_assignments`
  ADD CONSTRAINT `fk_notice_auditor_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_notice_auditor_assignments_notice` FOREIGN KEY (`notice_id`) REFERENCES `notices` (`notice_id`) ON DELETE CASCADE;

--
-- Constraints for table `payment_gateway_events`
--
ALTER TABLE `payment_gateway_events`
  ADD CONSTRAINT `fk_gateway_event_payment` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`payment_transaction_id`);

--
-- Constraints for table `payment_transactions`
--
ALTER TABLE `payment_transactions`
  ADD CONSTRAINT `fk_payment_transactions_promotion_campaign` FOREIGN KEY (`promotion_campaign_id`) REFERENCES `promotion_campaigns` (`campaign_id`) ON DELETE SET NULL;

--
-- Constraints for table `privacy_policy_agreements`
--
ALTER TABLE `privacy_policy_agreements`
  ADD CONSTRAINT `fk_privacy_policy_agreements_policy` FOREIGN KEY (`privacy_policy_id`) REFERENCES `privacy_policies` (`privacy_policy_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `promotion_campaign_plans`
--
ALTER TABLE `promotion_campaign_plans`
  ADD CONSTRAINT `fk_promotion_campaign_plans_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `promotion_campaigns` (`campaign_id`) ON DELETE CASCADE;

--
-- Constraints for table `trainings`
--
ALTER TABLE `trainings`
  ADD CONSTRAINT `fk_trainings_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL;

--
-- Constraints for table `training_assignments`
--
ALTER TABLE `training_assignments`
  ADD CONSTRAINT `fk_training_assignments_admin` FOREIGN KEY (`assigned_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_training_assignments_auditor` FOREIGN KEY (`auditor_id`) REFERENCES `auditors` (`auditor_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_training_assignments_training` FOREIGN KEY (`training_id`) REFERENCES `trainings` (`training_id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
