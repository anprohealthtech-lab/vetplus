-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jun 09, 2026 at 10:04 AM
-- Server version: 11.8.6-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u304414148_vetplus`
--

-- --------------------------------------------------------

--
-- Table structure for table `packages`
--

CREATE TABLE `packages` (
  `id` int(11) NOT NULL,
  `slug` varchar(60) NOT NULL,
  `type` enum('genpkg','specpkg','infectpkg','rtpcr','rapid') NOT NULL,
  `grade` varchar(60) DEFAULT NULL,
  `emoji` varchar(10) DEFAULT '?',
  `name` varchar(120) NOT NULL,
  `includes` text DEFAULT NULL,
  `price` decimal(8,2) NOT NULL,
  `turnaround` varchar(60) NOT NULL,
  `color` varchar(80) DEFAULT 'linear-gradient(135deg,#0a6370,#1dcade)',
  `species` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`species`)),
  `params` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`params`)),
  `indicators` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`indicators`)),
  `description` text DEFAULT NULL,
  `sub_note` varchar(200) DEFAULT NULL,
  `featured` tinyint(1) DEFAULT 0,
  `sort_order` int(11) DEFAULT 0,
  `active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `packages`
--

INSERT INTO `packages` (`id`, `slug`, `type`, `grade`, `emoji`, `name`, `includes`, `price`, `turnaround`, `color`, `species`, `params`, `indicators`, `description`, `sub_note`, `featured`, `sort_order`, `active`, `created_at`, `updated_at`) VALUES
(1, 'vbasic', 'genpkg', 'Basic', '📋', 'V Basic Health Panel', 'CBP + LFT + RFT', 1300.00, '2–6 Hrs', 'linear-gradient(135deg,#101f4a,#0a6370)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"Basic LFT\",\"Basic RFT\"]', '[\"Annual wellness\",\"Newly adopted pets\",\"Pre-vaccination\",\"Pre-surgical evaluation\"]', 'Entry-level comprehensive health screen covering blood, liver, and kidney parameters.', NULL, 0, 1, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(2, 'vessential', 'genpkg', 'Essential', '✅', 'V Essential Health Panel', 'CBP + LFT + RFT + Electrolytes + RBG', 1600.00, '2–6 Hrs', 'linear-gradient(135deg,#0a6370,#0e8f9e)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"Basic LFT\",\"Basic RFT\",\"Electrolytes\",\"Random Blood Glucose\"]', '[\"Adult pets\",\"Post-illness recovery\",\"Chronic medication\",\"Preventive care\"]', 'Essential wellness panel with electrolytes and glucose screening for comprehensive monitoring.', NULL, 0, 2, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(3, 'vcomplete', 'genpkg', 'Most Popular', '⭐', 'V Complete Health Panel', 'CBP + LFT + RFT + Electrolytes + Thyroid + Lipid + RBG + UA', 2500.00, '2–6 Hrs', 'linear-gradient(135deg,#0a6370,#1dcade)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"Basic LFT\",\"Basic RFT\",\"Electrolytes\",\"Thyroid Profile\",\"Lipid Profile\",\"RBG\",\"Urinalysis\"]', '[\"Middle-aged pets\",\"Unexplained weight changes\",\"Excessive thirst\",\"Annual preventive screening\"]', 'Our most popular panel — complete organ and metabolic assessment for thorough preventive care.', NULL, 1, 3, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(4, 'vcomprehensive', 'genpkg', 'Comprehensive', '💎', 'V Comprehensive Health Panel', 'CBP + LFT + RFT + Electrolytes + Adv Thyroid + Lipid + HbA1c + Vit D + Vit B12 + UA', 3500.00, '2–6 Hrs', 'linear-gradient(135deg,#101f4a,#1a3270)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"LFT\",\"RFT\",\"Electrolytes\",\"Advanced Thyroid (FT3,FT4,TSH)\",\"Lipid Profile\",\"HbA1c\",\"Vitamin D\",\"Vitamin B12\",\"Urinalysis\"]', '[\"Senior pets\",\"Chronic health concerns\",\"Breed-specific screening\",\"Preventive programmes\"]', 'Comprehensive panel including vitamins and advanced thyroid for senior and complex cases.', NULL, 0, 4, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(5, 'vadvanced', 'genpkg', 'Advanced', '🏆', 'V Advanced Health Panel', 'CBP + Adv LFT + Adv RFT + Adv Thyroid + Lipid + RBG + HbA1c + Vit D + Vit B12 + CRP + CK + Amylase + Lipase + UA', 5500.00, '2–6 Hrs', 'linear-gradient(135deg,#062030,#0a6370)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"Advanced LFT\",\"Advanced RFT\",\"Advanced Thyroid\",\"Lipid Profile\",\"RBG\",\"HbA1c\",\"Vitamin D\",\"Vitamin B12\",\"CRP\",\"CK\",\"Amylase\",\"Lipase\",\"Urinalysis\"]', '[\"Senior pets\",\"Critically ill patients\",\"Multiple clinical symptoms\",\"Pre-anaesthetic (high risk)\"]', 'Our most advanced panel — full organ function, inflammation, muscle, and metabolic assessment.', NULL, 0, 5, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(6, 'geriatric', 'specpkg', 'Age 7+', '👴', 'V Geriatric Panel', 'CBP + LFT + Adv RFT + Thyroid + Lipid + RBG + HbA1c + CK + UA', 3000.00, '2–6 Hrs', 'linear-gradient(135deg,#4a3000,#8a5c00)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"LFT\",\"Advanced RFT\",\"Thyroid Profile\",\"Lipid Profile\",\"RBG\",\"HbA1c\",\"CK\",\"Urinalysis\"]', '[\"Chronic kidney disease\",\"Hypothyroidism\",\"Diabetes mellitus\",\"Age-related organ dysfunction\"]', 'Tailored for animals aged 7+ — comprehensive screen of all age-sensitive organ systems.', NULL, 0, 1, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(7, 'hepatic', 'specpkg', 'Liver Focus', '🌿', 'V Hepatic Panel', 'CBP + Adv LFT + Lipid + Vit B12 + Vit D + HbA1c + RBG + Amylase + Lipase', 4000.00, '2–6 Hrs', 'linear-gradient(135deg,#1a4a20,#2a7a30)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"Advanced LFT\",\"Lipid Profile\",\"Vitamin B12\",\"Vitamin D\",\"HbA1c\",\"RBG\",\"Amylase\",\"Lipase\"]', '[\"Hepatitis\",\"Fatty liver disease\",\"Liver toxicity\",\"Biliary disorders\"]', 'Comprehensive liver-focused panel including pancreatic enzymes and nutritional markers.', NULL, 0, 2, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(8, 'renal', 'specpkg', 'Kidney Focus', '💧', 'V Renal Panel', 'CBP + Adv RFT + Adv LFT + UA + HbA1c + RBG + Vit B12 + Vit D', 4000.00, '2–6 Hrs', 'linear-gradient(135deg,#0a3a5c,#1266a0)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"Advanced RFT\",\"Advanced LFT\",\"Urinalysis\",\"HbA1c\",\"RBG\",\"Vitamin B12\",\"Vitamin D\"]', '[\"Acute kidney injury\",\"Chronic kidney disease\",\"Renal insufficiency\",\"Urinary disorders\"]', 'Complete renal assessment with urinalysis, nutritional status, and glucose monitoring.', NULL, 0, 3, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(9, 'cardiac', 'specpkg', 'Heart Focus', '❤️', 'V Cardiac Panel', 'CBP + LFT + Adv RFT + Lipid + HbA1c + RBG + Vit B12 + Vit D + CK + CRP', 5000.00, '2–6 Hrs', 'linear-gradient(135deg,#4a0a1a,#9a1a3a)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"LFT\",\"Advanced RFT\",\"Lipid Profile\",\"HbA1c\",\"RBG\",\"Vitamin B12\",\"Vitamin D\",\"CK\",\"CRP\"]', '[\"Cardiomyopathy\",\"Heart failure\",\"Exercise intolerance\",\"Cardiac breed screening\"]', 'Cardiac-focused panel with lipid, inflammation, and muscle markers supporting heart health assessment.', NULL, 0, 4, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(10, 'diabetic', 'specpkg', 'Metabolic', '🩺', 'V Diabetic Panel', 'CBP + LFT + Adv RFT + Lipid + RBG + HbA1c + Vit B12 + Vit D + UA', 4000.00, '2–6 Hrs', 'linear-gradient(135deg,#2a1a4a,#6a3a9a)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"CBP\",\"LFT\",\"Advanced RFT\",\"Lipid Profile\",\"RBG\",\"HbA1c\",\"Vitamin B12\",\"Vitamin D\",\"Urinalysis\"]', '[\"Diabetes mellitus\",\"Diabetic nephropathy\",\"Metabolic syndrome\",\"Secondary infections\"]', 'Complete metabolic panel for diabetic management, monitoring, and complication screening.', NULL, 0, 5, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(11, 'gynaec', 'specpkg', 'Reproductive', '🌸', 'V Gynaec Panel', 'CBP + LFT + RFT + Lipid + Adv Thyroid + Progesterone + Estrogen + Vit B12 + Vit D + RBG + HbA1c', 4500.00, '2–6 Hrs', 'linear-gradient(135deg,#3a0a30,#8a2a7a)', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\"]', '[\"CBP\",\"LFT\",\"RFT\",\"Lipid Profile\",\"Advanced Thyroid\",\"Progesterone\",\"Estrogen\",\"Vitamin B12\",\"Vitamin D\",\"RBG\",\"HbA1c\"]', '[\"Infertility\",\"Irregular cycles\",\"Hormonal disorders\",\"Breeding management\"]', 'Reproductive hormone panel combined with full metabolic assessment for breeding females.', NULL, 0, 6, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(12, 'r1', 'rapid', 'HER-ANA-BC-BG-LP Ab', '🐕', 'Asian Tick 5 Rapid (Canine)', '5-pathogen antibody rapid test', 1900.00, '30 Min – 1 Hr', 'linear-gradient(135deg,#1060a0,#1a8acc)', '[\"dog\"]', '[\"Ehrlichia (HER) Ab\",\"Anaplasmosis (ANA) Ab\",\"Babesia canis (BC) Ab\",\"Babesia gibsoni (BG) Ab\",\"Leptospira (LP) Ab\"]', '[\"Tick exposure\",\"Fever\",\"Lethargy\",\"Loss of appetite\"]', 'Five-pathogen antibody detection for the most common canine tick-borne diseases plus Leptospira.', NULL, 0, 1, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(13, 'r2', 'rapid', 'HER-ANA-BC-BG Ab', '🐕', 'Asian Tick 4 Rapid (Canine)', '4-pathogen antibody rapid test', 1600.00, '30 Min – 1 Hr', 'linear-gradient(135deg,#1060a0,#1a8acc)', '[\"dog\"]', '[\"Ehrlichia (HER) Ab\",\"Anaplasmosis (ANA) Ab\",\"Babesia canis (BC) Ab\",\"Babesia gibsoni (BG) Ab\"]', '[\"Tick exposure\",\"Fever\",\"Lethargy\"]', 'Four-pathogen antibody detection for the most common canine tick-borne diseases.', NULL, 0, 2, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(14, 'r3', 'rapid', 'Antigen Test', '🦠', 'Canine Parvovirus Ag Rapid', 'Parvo antigen rapid test', 600.00, '30 Min – 1 Hr', 'linear-gradient(135deg,#1060a0,#1a8acc)', '[\"dog\"]', '[\"Canine Parvovirus Antigen\"]', '[\"Haemorrhagic gastroenteritis\",\"Puppies / unvaccinated dogs\",\"Vomiting & diarrhoea\"]', 'Antigen-based rapid detection of Canine Parvovirus — quick first-line confirmation.', NULL, 0, 3, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(15, 'r4', 'rapid', 'Antibody Test', '🌀', 'Canine Leptospira Ab Rapid', 'Leptospira antibody rapid test', 750.00, '30 Min – 1 Hr', 'linear-gradient(135deg,#1060a0,#1a8acc)', '[\"dog\"]', '[\"Leptospira Antibody\"]', '[\"Fever\",\"Renal signs\",\"Water / wildlife exposure\"]', 'Antibody-based rapid detection of Leptospira infection in dogs.', NULL, 0, 4, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(16, 'r5', 'rapid', 'Antigen Test', '🦠', 'Canine Distemper Ag Rapid', 'Distemper antigen rapid test', 600.00, '30 Min – 1 Hr', 'linear-gradient(135deg,#1060a0,#1a8acc)', '[\"dog\"]', '[\"Distemper Virus Antigen\"]', '[\"Respiratory signs\",\"Neurological signs\",\"Unvaccinated dogs\"]', 'Rapid antigen detection of Canine Distemper Virus.', NULL, 0, 5, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(17, 'r6', 'rapid', 'Antigen Test', '🐈', 'Feline Panleukopenia Ag Rapid', 'FPV antigen rapid test', 600.00, '30 Min – 1 Hr', 'linear-gradient(135deg,#3a0a30,#8a2a7a)', '[\"cat\"]', '[\"FPV Antigen\"]', '[\"Vomiting & diarrhoea\",\"Lethargy\",\"Kittens / unvaccinated cats\"]', 'Rapid antigen test for Feline Panleukopenia Virus (Feline Parvovirus).', NULL, 0, 6, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(18, 'r7', 'rapid', 'Triple Combo', '🐈', 'Feline PV + Corona + Giardia Combo', 'Triple combo rapid test', 1750.00, '30 Min – 1 Hr', 'linear-gradient(135deg,#3a0a30,#8a2a7a)', '[\"cat\"]', '[\"Panleukopenia (PV) Ag\",\"Coronavirus Ag\",\"Giardia Ag\"]', '[\"Gastrointestinal illness\",\"Multi-cat households\",\"Diarrhoea & vomiting\"]', 'Triple rapid combo test detecting three pathogens simultaneously in cats.', NULL, 0, 7, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(19, 'ci', 'infectpkg', 'Rapid Tests + Blood Work', '🐕', 'V Canine Infectious Panel', 'HER-ANA-BC-BG Rapid + Parvo Rapid + CBP + LFT + RFT', 3000.00, '2–6 Hrs', 'linear-gradient(135deg,#101f4a,#0a6370)', '[\"dog\"]', '[\"Rapid: Ehrlichiosis, Anaplasmosis, Babesiosis, Parvovirus\",\"CBP\",\"Basic LFT\",\"Basic RFT\"]', '[\"Fever\",\"Tick exposure\",\"GI symptoms\",\"Lethargy\"]', 'Combined rapid test and blood work panel for infectious disease screening in dogs.', NULL, 0, 1, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(20, 'aci', 'infectpkg', 'RT-PCR + Blood Work', '🐕', 'V Advanced Canine Infectious Panel', 'ER-2, ANA-2, BB-4, TE, HC RT-PCR + CBP + LFT + RFT', 5000.00, '8–12 Hrs', 'linear-gradient(135deg,#0a3a5c,#1266a0)', '[\"dog\"]', '[\"RT-PCR: Ehrlichia, Anaplasmosis, Babesia (4 types), Theileria, Hepatozoon\",\"CBP\",\"LFT\",\"RFT\"]', '[\"Persistent fever\",\"Negative rapid with strong suspicion\",\"Critical care patients\"]', 'Advanced molecular RT-PCR panel for comprehensive tick-borne and infectious disease detection.', NULL, 0, 2, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(21, 'fi', 'infectpkg', 'RT-PCR + Blood Work', '🐈', 'V Feline Infectious Panel', 'FIV+FLV+FIP+FC+FBF+FMH RT-PCR + CBP + LFT + RFT', 5000.00, '8–12 Hrs', 'linear-gradient(135deg,#3a0a30,#8a2a7a)', '[\"cat\"]', '[\"RT-PCR: FIV, FeLV, FIP, Calicivirus, Herpesvirus, Mycoplasma haemofelis\",\"CBP\",\"LFT\",\"RFT\"]', '[\"Sick cats with fever\",\"Respiratory disease\",\"Multi-cat outbreaks\"]', 'Six-pathogen feline molecular panel combined with blood work for comprehensive infectious disease diagnosis.', NULL, 0, 3, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(22, 'tp1', 'rtpcr', 'RT-PCR Molecular', '🕷️', 'Canine Tick Fever Panel', '10-pathogen molecular panel', 4000.00, '8–12 Hrs', 'linear-gradient(135deg,#101f4a,#1a3270)', '[\"dog\"]', '[\"Babesia gibsoni\",\"Babesia canis\",\"Babesia rossi\",\"Babesia vogeli\",\"Hepatozoon canis\",\"Ehrlichia canis\",\"Ehrlichia ewingii\",\"Anaplasma platys\",\"Anaplasma phagocytophilum\",\"Theileria equi\"]', '[\"Acute fever\",\"Tick exposure history\",\"Chronic unexplained illness\",\"Treatment-resistant infections\"]', 'Ten-pathogen molecular tick fever panel — detects pathogen DNA before antibodies form.', 'BG, BC, BR, BV, HC, EC, EE, AP, APH, TE', 0, 1, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(23, 'tp2', 'rtpcr', 'RT-PCR Molecular', '🦠', 'Canine Parvovirus RT-PCR', 'CPV-2 DNA molecular test', 2500.00, '8–12 Hrs', 'linear-gradient(135deg,#101f4a,#1a3270)', '[\"dog\"]', '[\"Canine Parvovirus 2 (CPV-2) DNA\"]', '[\"Haemorrhagic gastroenteritis\",\"Doubtful rapid test results\",\"Early detection\"]', 'Gold-standard molecular detection of Parvovirus before antibodies develop.', NULL, 0, 2, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(24, 'tp3', 'rtpcr', 'RT-PCR Molecular', '🧫', 'Canine Distemper Virus RT-PCR', 'CDV RNA molecular test', 2500.00, '8–12 Hrs', 'linear-gradient(135deg,#101f4a,#1a3270)', '[\"dog\"]', '[\"Canine Distemper Virus (CDV) RNA\"]', '[\"Neurological signs\",\"Respiratory disease\",\"Early treatment decisions\"]', 'Advanced molecular detection of CDV — one of the most serious canine viral diseases.', NULL, 0, 3, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(25, 'tp4', 'rtpcr', 'RT-PCR Molecular', '🌀', 'Canine Leptospira RT-PCR', 'Leptospira DNA molecular test', 2000.00, '8–12 Hrs', 'linear-gradient(135deg,#101f4a,#1a3270)', '[\"dog\"]', '[\"Leptospira spp. DNA\"]', '[\"Acute fever\",\"Renal failure signs\",\"Wildlife / water exposure\"]', 'Detects active Leptospira infection before antibodies are detectable.', NULL, 0, 4, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(26, 'tp5', 'rtpcr', 'RT-PCR Molecular', '🐈', 'Feline Infectious Panel RT-PCR', '6-pathogen feline molecular panel', 3000.00, '8–12 Hrs', 'linear-gradient(135deg,#3a0a30,#8a2a7a)', '[\"cat\"]', '[\"FIV (Feline Immunodeficiency Virus)\",\"FeLV (Feline Leukemia Virus)\",\"FIP (Feline Infectious Peritonitis)\",\"Feline Calicivirus\",\"Feline Herpesvirus\",\"Mycoplasma haemofelis\"]', '[\"Sick cats\",\"Respiratory illness\",\"Complex feline cases\",\"Multi-cat outbreaks\"]', 'Six-pathogen feline molecular panel for accurate, early disease detection.', 'FIV, FLV, FIP, FC, FBF, FMH', 0, 5, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `packages`
--
ALTER TABLE `packages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `packages`
--
ALTER TABLE `packages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
