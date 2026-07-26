-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Nov 03, 2023 at 11:51 AM
-- Server version: 10.3.39-MariaDB
-- PHP Version: 8.1.16

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `merchan1_info`
--

-- --------------------------------------------------------

--
-- Table structure for table `BitcoinDomains`
--

CREATE TABLE `BitcoinDomains` (
  `id` int(11) NOT NULL,
  `DomainName` varchar(50) NOT NULL,
  `BitcoinAddr` varchar(50) NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bwapiusers`
--

CREATE TABLE `bwapiusers` (
  `id` int(11) NOT NULL,
  `title` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `xpub` varchar(200) NOT NULL,
  `fee` float NOT NULL DEFAULT 0.01,
  `apiUserId` varchar(200) NOT NULL,
  `apiUserKey` varchar(200) NOT NULL,
  `create_date` datetime DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gc`
--

CREATE TABLE `gc` (
  `id` int(11) NOT NULL,
  `type` varchar(100) DEFAULT NULL,
  `price` varchar(200) DEFAULT NULL,
  `num` varchar(200) DEFAULT NULL,
  `pin` varchar(200) DEFAULT NULL,
  `exp` varchar(200) DEFAULT NULL,
  `state` varchar(200) NOT NULL DEFAULT 'selling',
  `email` varchar(200) DEFAULT NULL,
  `emailSent` int(11) NOT NULL DEFAULT 0,
  `create_lock` datetime DEFAULT NULL,
  `expire_lock` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gct`
--

CREATE TABLE `gct` (
  `id` int(11) NOT NULL,
  `gcNum` varchar(200) DEFAULT NULL,
  `transactionKey` varchar(100) NOT NULL,
  `address` varchar(200) DEFAULT NULL,
  `currency` varchar(50) DEFAULT NULL,
  `amount` float DEFAULT NULL,
  `rate` float DEFAULT NULL,
  `btc_expected` float DEFAULT NULL,
  `btc_received` float DEFAULT NULL,
  `btc_total_received` float DEFAULT NULL,
  `out` mediumtext DEFAULT NULL,
  `time` datetime DEFAULT NULL,
  `domains` varchar(200) NOT NULL,
  `create_date` datetime NOT NULL,
  `expire_date` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `output`
--

CREATE TABLE `output` (
  `output_id` int(10) UNSIGNED NOT NULL,
  `transaction_id` int(10) UNSIGNED NOT NULL,
  `output_txid` varchar(64) NOT NULL,
  `output_value` bigint(20) UNSIGNED NOT NULL,
  `output_timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `transaction`
--

CREATE TABLE `transaction` (
  `transaction_id` int(10) UNSIGNED NOT NULL,
  `transaction_mpk` varchar(255) NOT NULL,
  `transaction_index` int(10) UNSIGNED NOT NULL,
  `transaction_currency` varchar(255) NOT NULL,
  `transaction_fiat` varchar(255) NOT NULL,
  `transaction_rate` varchar(255) NOT NULL,
  `transaction_btc_expected` bigint(20) UNSIGNED NOT NULL,
  `transaction_btc_received` bigint(20) UNSIGNED NOT NULL,
  `transaction_timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `BitcoinDomains`
--
ALTER TABLE `BitcoinDomains`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `bwapiusers`
--
ALTER TABLE `bwapiusers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `xpub` (`xpub`),
  ADD UNIQUE KEY `apiUserId` (`apiUserId`),
  ADD UNIQUE KEY `apiUserKey` (`apiUserKey`);

--
-- Indexes for table `gc`
--
ALTER TABLE `gc`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `gct`
--
ALTER TABLE `gct`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `output`
--
ALTER TABLE `output`
  ADD PRIMARY KEY (`output_id`),
  ADD UNIQUE KEY `output_txid` (`output_txid`);

--
-- Indexes for table `transaction`
--
ALTER TABLE `transaction`
  ADD PRIMARY KEY (`transaction_id`),
  ADD UNIQUE KEY `unique_index` (`transaction_mpk`,`transaction_index`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `BitcoinDomains`
--
ALTER TABLE `BitcoinDomains`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bwapiusers`
--
ALTER TABLE `bwapiusers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gc`
--
ALTER TABLE `gc`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `gct`
--
ALTER TABLE `gct`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `output`
--
ALTER TABLE `output`
  MODIFY `output_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `transaction`
--
ALTER TABLE `transaction`
  MODIFY `transaction_id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
