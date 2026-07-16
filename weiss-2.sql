-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jul 16, 2026 at 02:31 PM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.2.4

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `weiss`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounting_transaction_scheduled_payment`
--

CREATE TABLE `accounting_transaction_scheduled_payment` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `project_accounting_transaction_id` bigint(20) UNSIGNED NOT NULL,
  `scheduled_payment_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `acc_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `accounts`
--

INSERT INTO `accounts` (`acc_id`, `username`, `password`, `role`) VALUES
(2, 'admin@weiss.com', '$2y$12$ikfTNkB.4yA5Vs96BtwkJeAjFbH68l3S2VfRuXpENb9W8uUq7H/Se', 'admin');

-- --------------------------------------------------------

--
-- Table structure for table `agents`
--

CREATE TABLE `agents` (
  `agent_id` int(10) UNSIGNED NOT NULL,
  `agent_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `agents`
--

INSERT INTO `agents` (`agent_id`, `agent_name`) VALUES
(1, 'Aaron Q.'),
(2, 'Archie P.'),
(3, 'Carla U.'),
(4, 'Cedrick D.'),
(5, 'Charles V.'),
(6, 'Christian S.'),
(7, 'Christian T.'),
(8, 'Daiselyn F.'),
(9, 'Dee F.'),
(10, 'Enrique S.'),
(11, 'Fernando F.'),
(12, 'Florielyn R.'),
(13, 'Frances T.'),
(14, 'Francis T.'),
(15, 'Gabriel P.'),
(16, 'Ian B.'),
(17, 'Jay J. R.'),
(18, 'Jean R'),
(19, 'Jemuel D.'),
(20, 'John P. R.'),
(21, 'Joseph C.'),
(22, 'Judy D.'),
(23, 'Kim A. P.'),
(24, 'Lea D.'),
(25, 'Lexie B.'),
(26, 'Mark C. T.'),
(27, 'Mark T.'),
(28, 'Mary R. P.'),
(29, 'Paul R.'),
(30, 'Ron W.'),
(31, 'Rose U.'),
(32, 'Sigrid D.'),
(33, 'Warren G.'),
(34, 'Wenny G.'),
(35, 'Wes A.'),
(36, 'Zara C.');

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `cache`
--

INSERT INTO `cache` (`key`, `value`, `expiration`) VALUES
('laravel-cache-dcd2a72096ccfd1fd345cc3d9d346535', 'i:1;', 1784130792),
('laravel-cache-dcd2a72096ccfd1fd345cc3d9d346535:timer', 'i:1784130792;', 1784130792);

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `com_id` int(10) UNSIGNED NOT NULL,
  `company` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `prefix` text NOT NULL,
  `project_code` varchar(255) NOT NULL,
  `archived_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `companies`
--

INSERT INTO `companies` (`com_id`, `company`, `address`, `prefix`, `project_code`, `archived_at`) VALUES
(1, 'Bright Horizon', '', 'BH', 'BH#003', NULL),
(2, 'Foundation Repair Experts', '', 'FRE', 'FRE#7016', NULL),
(3, 'SBH Construction', '', 'SBH', 'SBH#5255', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `contractors`
--

CREATE TABLE `contractors` (
  `con_id` int(11) NOT NULL,
  `contractor` varchar(255) NOT NULL,
  `address` varchar(255) NOT NULL,
  `zip` int(255) NOT NULL,
  `city` text NOT NULL,
  `state` text NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` int(255) NOT NULL,
  `license` int(11) DEFAULT NULL,
  `lic_expire` date DEFAULT NULL,
  `worker_comp` date DEFAULT NULL,
  `insurance_expire` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `contractors`
--

INSERT INTO `contractors` (`con_id`, `contractor`, `address`, `zip`, `city`, `state`, `email`, `phone`, `license`, `lic_expire`, `worker_comp`, `insurance_expire`) VALUES
(1, '18 Remodel - Ron', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(2, '18 Remodel Inc. - Alvaro', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(3, '18 Remodel Inc.-Martin', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(4, 'A&L Green Home Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(5, 'Airtest Guru', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(6, 'All About Shower Glass And More Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(7, 'All In 1 Remodeling', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(8, 'All Star Construction Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(9, 'ALR Remodeling', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(10, 'AM PM Restoration & Construction Inc.', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(11, 'Amazon A', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(12, 'Ameriflex Mortgage', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(13, 'APD Smart Home & Wiring', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(14, 'Arevalos Appraisal Solutions', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(15, 'Avila\'s Cabinets', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(16, 'Best Buy', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(17, 'Build Force', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(18, 'Cali First Remodel Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(19, 'Contractors Warehouse', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(20, 'Designs By Origami', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(21, 'DG Lumber Group INC', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(22, 'DHY Enterprises', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(23, 'E And E', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(24, 'FedEx Office', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(25, 'Francisco 18 Remodel', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(26, 'Frederico Countertop', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(27, 'Future Vision Remodeling', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(28, 'G-Tech Smart Remodeling', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(29, 'Geissler Engineering', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(30, 'Gibertos Flooring Services', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(31, 'Green Empire Builder Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(32, 'Gringo - Rafael Builders', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(33, 'Gringo DHY', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(34, 'Haim Azulay (David)', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(35, 'Home Depot', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(36, 'John Mold Testing', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(37, 'KWW Kitchen Cabinets & Bath', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(38, 'KZ Kitchen Cabinets & Stone Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(39, 'Lowes Home Improvement', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(40, 'Marciano Zion', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(41, 'McCurley\'s Floor Center Inc.', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(42, 'McLaughlin Concrete', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(43, 'Mike Engineer', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(44, 'Miscellaneous / Other', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(45, 'Muller Construction Supply', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(46, 'Ohad - 18 Remodel', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(47, 'Pacific Stone Tile & Marble', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(48, 'Permit City Fee', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(49, 'Permits By Daniel', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(50, 'Power Electrical Service Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(51, 'Prime Dumpster Incorporated Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(52, 'Rafael Builders', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(53, 'Rafael Builders - Hodaya', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(54, 'Rafael Builders - Hodaya Nn', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(55, 'Rafael Builders - Oded', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(56, 'Rafael Builders - Ron', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(57, 'Ramon Renderos', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(58, 'Registered Agent Solutions Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(59, 'Rodriguez Custom Construction', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(60, 'San Jose Heating & Cooling', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(61, 'SBH Construction Inc.', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(62, 'Silicon Valley Granite', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(63, 'Sivan Windows And Doors', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(64, 'SM Electric Services Corp', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(65, 'Specialty Builders', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(66, 'Square CC Transfer', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(67, 'The Right Choice Home Remodeling', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(68, 'Top Pros Construction', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(69, 'US Marketing & Funds Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(70, 'Vision Builders', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(71, 'Werner Lopez', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(72, 'Zion Marciano', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(73, '18 Remodel - Jose', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(74, '18 Remodel Inc.', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(75, '888 ENVIRONMENTAL', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(76, 'A1 Elite Air Condition Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(77, 'All Things Interior', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(78, 'ATTIC KINGS INC', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(79, 'Best Roofing LA', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(80, 'CAL-BREEZE HEATING & AIR CONDITIONING LLC', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(81, 'California Roofline', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(82, 'De Angelo Inc.', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(83, 'EA Construction Inc.', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(84, 'Emergency Rooter & Plumbing', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(85, 'FHQ Electric Inc.', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(86, 'Floor And Decor', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(87, 'ISLD Business & Marketing Services', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(88, 'Jade Electric - Tim', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(89, 'JMA General Construction', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(90, 'MD Builders', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(91, 'Melikson Garage Door', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(92, 'NEMA Roofing Solutions', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(93, 'NK HOME CONSTRUCTION INC', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(94, 'One & Only Electrical', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(95, 'Paragon Roofing And Remodeling Inc', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(96, 'Professional Plumbing Services', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(97, 'REACTIC RESTORATION', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(98, 'SILVERLINE HOME REMODELING INC', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL),
(99, 'SOLIR ELECTRIC', '', 0, '', '', '', 0, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `emp_info`
--

CREATE TABLE `emp_info` (
  `emp_id` int(11) NOT NULL,
  `acc_id` int(11) NOT NULL,
  `first_name` text NOT NULL,
  `last_name` text NOT NULL,
  `mobile` int(11) NOT NULL,
  `email` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` varchar(255) NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` smallint(5) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leads`
--

CREATE TABLE `leads` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_name` varchar(255) NOT NULL,
  `marital_status` varchar(50) NOT NULL,
  `primary_number` varchar(30) NOT NULL,
  `secondary_number` varchar(30) DEFAULT NULL,
  `mobile_number` varchar(30) DEFAULT NULL,
  `address` varchar(255) NOT NULL,
  `zip_code` varchar(15) NOT NULL,
  `city` varchar(100) NOT NULL,
  `county` varchar(100) NOT NULL,
  `state` varchar(50) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `years_in_house` smallint(5) UNSIGNED NOT NULL,
  `product_id` int(10) UNSIGNED NOT NULL,
  `appointment_at` datetime NOT NULL,
  `appointment_result` varchar(255) DEFAULT NULL,
  `telemarketer_notes` text NOT NULL,
  `company_id` int(10) UNSIGNED NOT NULL,
  `source` varchar(100) NOT NULL,
  `agent_id` int(10) UNSIGNED NOT NULL,
  `agent_2_id` int(10) UNSIGNED DEFAULT NULL,
  `salesman_1_id` bigint(20) UNSIGNED DEFAULT NULL,
  `salesman_2_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` int(10) UNSIGNED NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'fresh',
  `confirmation_notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leads`
--

INSERT INTO `leads` (`id`, `customer_name`, `marital_status`, `primary_number`, `secondary_number`, `mobile_number`, `address`, `zip_code`, `city`, `county`, `state`, `email`, `years_in_house`, `product_id`, `appointment_at`, `appointment_result`, `telemarketer_notes`, `company_id`, `source`, `agent_id`, `agent_2_id`, `salesman_1_id`, `salesman_2_id`, `created_by`, `status`, `confirmation_notes`, `created_at`, `updated_at`) VALUES
(1, 'Karl Carpena', 'Single', '5550000000', NULL, NULL, '0987 st', '87654', 'Los Angeles', 'Orange', 'CA', NULL, 4, 2, '2026-07-15 03:55:00', 'Sold', 'test lead', 1, 'CallTools', 1, NULL, 1, NULL, 2, 'project', NULL, '2026-07-14 11:55:36', '2026-07-15 10:28:03'),
(2, 'Danna Calingasan', 'Single', '5550000000', NULL, NULL, '400 N Frankwood', '93657', 'Sanger', 'Sanger County', 'CA', NULL, 5, 1, '2026-07-16 03:37:00', NULL, 'test lead', 1, 'CallTools', 6, NULL, NULL, NULL, 2, 'fresh', NULL, '2026-07-15 11:37:50', '2026-07-15 11:46:44');

-- --------------------------------------------------------

--
-- Table structure for table `lead_notes`
--

CREATE TABLE `lead_notes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `note_type` varchar(100) NOT NULL,
  `body` text NOT NULL,
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `lead_notes`
--

INSERT INTO `lead_notes` (`id`, `lead_id`, `note_type`, `body`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'telemarketer', 'test lead', 2, '2026-07-14 11:55:36', '2026-07-14 11:55:36'),
(2, 2, 'telemarketer', 'test lead', 2, '2026-07-15 11:37:50', '2026-07-15 11:37:50');

-- --------------------------------------------------------

--
-- Table structure for table `managers`
--

CREATE TABLE `managers` (
  `manager_id` bigint(20) UNSIGNED NOT NULL,
  `account_id` int(11) NOT NULL,
  `manager_name` varchar(255) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `company_id` int(10) UNSIGNED DEFAULT NULL,
  `manager_types` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`manager_types`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `manager_permissions`
--

CREATE TABLE `manager_permissions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `manager_id` bigint(20) UNSIGNED NOT NULL,
  `module` varchar(60) NOT NULL,
  `access_level` varchar(10) NOT NULL DEFAULT 'none',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2024_01_01_000000_create_passkeys_table', 1),
(5, '2025_08_14_170933_add_two_factor_columns_to_users_table', 1),
(6, '2026_07_15_000000_create_accounts_table', 2),
(7, '2026_07_15_010000_create_companies_table', 3),
(8, '2026_07_15_020000_create_products_table', 4),
(9, '2026_07_15_030000_create_contractors_table', 5),
(10, '2026_07_15_040000_make_contractor_credentials_nullable', 5),
(11, '2026_07_15_050000_create_or_fix_agents_table', 6),
(12, '2026_07_15_060000_create_leads_table', 7),
(13, '2026_07_15_070000_add_lead_foreign_keys', 8),
(14, '2026_07_15_080000_add_shop_fields_to_leads_table', 9),
(15, '2026_07_15_090000_create_lead_notes_table', 10),
(16, '2026_07_15_100000_create_salesmen_and_add_lead_assignments', 11),
(17, '2026_07_15_110000_add_appointment_result_to_leads_table', 12),
(18, '2026_07_15_120000_add_phone_to_salesmen_table', 13),
(19, '2026_07_15_130000_create_managers_and_manager_permissions_tables', 14),
(20, '2026_07_15_140000_add_second_agent_to_leads_table', 15),
(21, '2026_07_16_000000_add_archived_at_to_companies_table', 16),
(22, '2026_07_16_010000_create_projects_table', 17),
(23, '2026_07_16_020000_add_status_to_projects_table', 18),
(24, '2026_07_16_030000_create_project_sales_table', 19),
(25, '2026_07_16_040000_create_scheduled_payments_table', 20),
(26, '2026_07_16_050000_create_project_invoices_table', 21),
(27, '2026_07_16_060000_create_project_accounting_transactions_table', 22),
(28, '2026_07_16_070000_add_payable_and_file_fields_to_project_accounting_transactions', 23);

-- --------------------------------------------------------

--
-- Table structure for table `passkeys`
--

CREATE TABLE `passkeys` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `credential_id` varchar(255) NOT NULL,
  `credential` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`credential`)),
  `last_used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `prod_id` int(10) UNSIGNED NOT NULL,
  `product_name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`prod_id`, `product_name`) VALUES
(1, 'AC / HVAC System'),
(2, 'ADU / Addition'),
(3, 'Bathroom Remodel'),
(4, 'Electrical / Plumbing'),
(5, 'Flooring / Refinishing /Restain'),
(6, 'Foundation'),
(7, 'Foundation Inspection'),
(8, 'Hardscaping / Landscaping'),
(9, 'Home Renovation'),
(10, 'Interior / Exterior Painting'),
(11, 'Kitchen Remodel'),
(12, 'Mold /Remediation Test'),
(13, 'Patio / Deck / Sunroom'),
(14, 'Permits & City Fee'),
(15, 'Retaining Wall/ Fence /Gate\'s'),
(16, 'Roof / Rain Gutters'),
(17, 'Trim / Fascia Boards'),
(18, 'Windows / Termites');

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `lead_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'new',
  `created_by` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `projects`
--

INSERT INTO `projects` (`id`, `lead_id`, `amount`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 500.00, 'new', 2, '2026-07-15 10:28:03', '2026-07-15 10:28:03');

-- --------------------------------------------------------

--
-- Table structure for table `project_accounting_transactions`
--

CREATE TABLE `project_accounting_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `project_invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `contractor_id` int(11) DEFAULT NULL,
  `type` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `transaction_date` date NOT NULL,
  `payment_method` varchar(255) NOT NULL,
  `reference_number` varchar(255) NOT NULL,
  `counterparty` varchar(255) DEFAULT NULL,
  `representative` varchar(255) DEFAULT NULL,
  `requested_by` varchar(255) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `file_path` varchar(255) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_mime` varchar(255) DEFAULT NULL,
  `file_size` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `project_invoices`
--

CREATE TABLE `project_invoices` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `contractor_id` int(11) NOT NULL,
  `invoice_number` varchar(255) NOT NULL,
  `invoice_date` date NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `file_path` varchar(255) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_mime` varchar(255) DEFAULT NULL,
  `file_size` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `project_sales`
--

CREATE TABLE `project_sales` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `type` varchar(255) NOT NULL DEFAULT 'referral',
  `amount` decimal(12,2) NOT NULL,
  `sale_date` date NOT NULL,
  `product_id` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `project_sales`
--

INSERT INTO `project_sales` (`id`, `project_id`, `type`, `amount`, `sale_date`, `product_id`, `created_at`, `updated_at`) VALUES
(1, 1, 'original', 500.00, '2026-07-15', 2, '2026-07-15 10:36:50', '2026-07-15 10:36:50');

-- --------------------------------------------------------

--
-- Table structure for table `salesmen`
--

CREATE TABLE `salesmen` (
  `salesman_id` bigint(20) UNSIGNED NOT NULL,
  `salesman_name` varchar(255) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salesmen`
--

INSERT INTO `salesmen` (`salesman_id`, `salesman_name`, `phone`, `created_at`, `updated_at`) VALUES
(1, 'Elad T.', NULL, '2026-07-14 15:30:52', '2026-07-14 15:30:52'),
(2, 'Hami A. (David)', NULL, '2026-07-14 15:30:52', '2026-07-14 15:30:52'),
(3, 'Isaac Z.', NULL, '2026-07-14 15:30:52', '2026-07-14 15:30:52'),
(4, 'Ori P.', NULL, '2026-07-14 15:30:52', '2026-07-14 15:30:52'),
(5, 'Yakov Weiss', NULL, '2026-07-14 15:30:52', '2026-07-14 15:30:52');

-- --------------------------------------------------------

--
-- Table structure for table `scheduled_payments`
--

CREATE TABLE `scheduled_payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `expected_date` date NOT NULL,
  `payment_stage` varchar(255) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `qb` tinyint(1) NOT NULL DEFAULT 0,
  `printed_sent` tinyint(1) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`) VALUES
('3HfvSeZRMNEYMBf7TrME9bYNHgOU5vkuXAWMplBr', 2, '127.0.0.1', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15', 'eyJfdG9rZW4iOiJhV3RkUjJQNjd4d2plSExrM1gyOU5BV1FHWVZlMEJGRVdJZ3NUUE9PIiwiX3ByZXZpb3VzIjp7InVybCI6Imh0dHA6XC9cL3dlaXNzLnRlc3RcL2xlYWQtd29ya2Zsb3dcL2xlYWRzLXNob3AiLCJyb3V0ZSI6ImxlYWQtd29ya2Zsb3cubGVhZHMtc2hvcCJ9LCJfZmxhc2giOnsib2xkIjpbXSwibmV3IjpbXX0sImxvZ2luX3dlYl81OWJhMzZhZGRjMmIyZjk0MDE1ODBmMDE0YzdmNThlYTRlMzA5ODlkIjoyLCJpbmVydGlhIjpbXSwidXJsIjpbXSwiYXV0aCI6eyJwYXNzd29yZF9jb25maXJtZWRfYXQiOjE3ODQxNTgxOTR9fQ==', 1784164043);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `two_factor_secret` text DEFAULT NULL,
  `two_factor_recovery_codes` text DEFAULT NULL,
  `two_factor_confirmed_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounting_transaction_scheduled_payment`
--
ALTER TABLE `accounting_transaction_scheduled_payment`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accounting_transaction_schedule_unique` (`project_accounting_transaction_id`,`scheduled_payment_id`),
  ADD KEY `accounting_schedule_payment_fk` (`scheduled_payment_id`);

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`acc_id`);

--
-- Indexes for table `agents`
--
ALTER TABLE `agents`
  ADD PRIMARY KEY (`agent_id`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_expiration_index` (`expiration`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_locks_expiration_index` (`expiration`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`com_id`),
  ADD KEY `companies_archived_at_index` (`archived_at`);

--
-- Indexes for table `contractors`
--
ALTER TABLE `contractors`
  ADD PRIMARY KEY (`con_id`);

--
-- Indexes for table `emp_info`
--
ALTER TABLE `emp_info`
  ADD KEY `acc_id` (`acc_id`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`),
  ADD KEY `failed_jobs_connection_queue_failed_at_index` (`connection`,`queue`,`failed_at`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`id`),
  ADD KEY `leads_appointment_at_company_id_agent_id_index` (`appointment_at`,`company_id`,`agent_id`),
  ADD KEY `leads_company_fk` (`company_id`),
  ADD KEY `leads_product_fk` (`product_id`),
  ADD KEY `leads_agent_fk` (`agent_id`),
  ADD KEY `leads_salesman_1_id_foreign` (`salesman_1_id`),
  ADD KEY `leads_salesman_2_id_foreign` (`salesman_2_id`),
  ADD KEY `leads_agent_2_id_foreign` (`agent_2_id`);

--
-- Indexes for table `lead_notes`
--
ALTER TABLE `lead_notes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `lead_notes_lead_id_note_type_created_at_index` (`lead_id`,`note_type`,`created_at`),
  ADD KEY `lead_notes_note_type_index` (`note_type`);

--
-- Indexes for table `managers`
--
ALTER TABLE `managers`
  ADD PRIMARY KEY (`manager_id`),
  ADD UNIQUE KEY `managers_account_id_unique` (`account_id`),
  ADD KEY `managers_company_id_foreign` (`company_id`);

--
-- Indexes for table `manager_permissions`
--
ALTER TABLE `manager_permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `manager_permissions_manager_id_module_unique` (`manager_id`,`module`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `passkeys`
--
ALTER TABLE `passkeys`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `passkeys_credential_id_unique` (`credential_id`),
  ADD KEY `passkeys_user_id_index` (`user_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`prod_id`);

--
-- Indexes for table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `projects_lead_id_unique` (`lead_id`);

--
-- Indexes for table `project_accounting_transactions`
--
ALTER TABLE `project_accounting_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_accounting_transactions_project_invoice_id_foreign` (`project_invoice_id`),
  ADD KEY `project_accounting_lookup_index` (`project_id`,`type`,`transaction_date`),
  ADD KEY `accounting_transaction_contractor_fk` (`contractor_id`);

--
-- Indexes for table `project_invoices`
--
ALTER TABLE `project_invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `project_invoices_project_id_invoice_number_unique` (`project_id`,`invoice_number`),
  ADD KEY `project_invoices_contractor_id_foreign` (`contractor_id`),
  ADD KEY `project_invoices_project_id_invoice_date_index` (`project_id`,`invoice_date`);

--
-- Indexes for table `project_sales`
--
ALTER TABLE `project_sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_sales_project_id_foreign` (`project_id`),
  ADD KEY `project_sales_product_id_foreign` (`product_id`);

--
-- Indexes for table `salesmen`
--
ALTER TABLE `salesmen`
  ADD PRIMARY KEY (`salesman_id`);

--
-- Indexes for table `scheduled_payments`
--
ALTER TABLE `scheduled_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `scheduled_payments_project_id_expected_date_index` (`project_id`,`expected_date`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounting_transaction_scheduled_payment`
--
ALTER TABLE `accounting_transaction_scheduled_payment`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `acc_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `agents`
--
ALTER TABLE `agents`
  MODIFY `agent_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `contractors`
--
ALTER TABLE `contractors`
  MODIFY `con_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leads`
--
ALTER TABLE `leads`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `lead_notes`
--
ALTER TABLE `lead_notes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `managers`
--
ALTER TABLE `managers`
  MODIFY `manager_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `manager_permissions`
--
ALTER TABLE `manager_permissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `passkeys`
--
ALTER TABLE `passkeys`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `prod_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `project_accounting_transactions`
--
ALTER TABLE `project_accounting_transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `project_invoices`
--
ALTER TABLE `project_invoices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `project_sales`
--
ALTER TABLE `project_sales`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `salesmen`
--
ALTER TABLE `salesmen`
  MODIFY `salesman_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `scheduled_payments`
--
ALTER TABLE `scheduled_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `accounting_transaction_scheduled_payment`
--
ALTER TABLE `accounting_transaction_scheduled_payment`
  ADD CONSTRAINT `accounting_schedule_payment_fk` FOREIGN KEY (`scheduled_payment_id`) REFERENCES `scheduled_payments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `accounting_schedule_transaction_fk` FOREIGN KEY (`project_accounting_transaction_id`) REFERENCES `project_accounting_transactions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `emp_info`
--
ALTER TABLE `emp_info`
  ADD CONSTRAINT `acc_id` FOREIGN KEY (`acc_id`) REFERENCES `accounts` (`acc_id`);

--
-- Constraints for table `leads`
--
ALTER TABLE `leads`
  ADD CONSTRAINT `leads_agent_2_id_foreign` FOREIGN KEY (`agent_2_id`) REFERENCES `agents` (`agent_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `leads_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `agents` (`agent_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `leads_company_fk` FOREIGN KEY (`company_id`) REFERENCES `companies` (`com_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `leads_product_fk` FOREIGN KEY (`product_id`) REFERENCES `products` (`prod_id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `leads_salesman_1_id_foreign` FOREIGN KEY (`salesman_1_id`) REFERENCES `salesmen` (`salesman_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `leads_salesman_2_id_foreign` FOREIGN KEY (`salesman_2_id`) REFERENCES `salesmen` (`salesman_id`) ON DELETE SET NULL;

--
-- Constraints for table `lead_notes`
--
ALTER TABLE `lead_notes`
  ADD CONSTRAINT `lead_notes_lead_id_foreign` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `managers`
--
ALTER TABLE `managers`
  ADD CONSTRAINT `managers_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`acc_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `managers_company_id_foreign` FOREIGN KEY (`company_id`) REFERENCES `companies` (`com_id`) ON DELETE SET NULL;

--
-- Constraints for table `manager_permissions`
--
ALTER TABLE `manager_permissions`
  ADD CONSTRAINT `manager_permissions_manager_id_foreign` FOREIGN KEY (`manager_id`) REFERENCES `managers` (`manager_id`) ON DELETE CASCADE;

--
-- Constraints for table `passkeys`
--
ALTER TABLE `passkeys`
  ADD CONSTRAINT `passkeys_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `projects`
--
ALTER TABLE `projects`
  ADD CONSTRAINT `projects_lead_id_foreign` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `project_accounting_transactions`
--
ALTER TABLE `project_accounting_transactions`
  ADD CONSTRAINT `accounting_transaction_contractor_fk` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`con_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `project_accounting_transactions_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_accounting_transactions_project_invoice_id_foreign` FOREIGN KEY (`project_invoice_id`) REFERENCES `project_invoices` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `project_invoices`
--
ALTER TABLE `project_invoices`
  ADD CONSTRAINT `project_invoices_contractor_id_foreign` FOREIGN KEY (`contractor_id`) REFERENCES `contractors` (`con_id`),
  ADD CONSTRAINT `project_invoices_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `project_sales`
--
ALTER TABLE `project_sales`
  ADD CONSTRAINT `project_sales_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`prod_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `project_sales_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `scheduled_payments`
--
ALTER TABLE `scheduled_payments`
  ADD CONSTRAINT `scheduled_payments_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
