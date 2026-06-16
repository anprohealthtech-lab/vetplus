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
-- Table structure for table `tests`
--

CREATE TABLE `tests` (
  `id` int(11) NOT NULL,
  `slug` varchar(60) NOT NULL,
  `category` enum('blood','liver','kidney','thyroid','metabolic','hormone') NOT NULL,
  `emoji` varchar(10) DEFAULT '?',
  `name` varchar(120) NOT NULL,
  `price` decimal(8,2) NOT NULL,
  `turnaround` varchar(60) NOT NULL,
  `sample` varchar(100) NOT NULL,
  `fasting` varchar(80) NOT NULL DEFAULT 'Not Required',
  `species` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Array of species keys' CHECK (json_valid(`species`)),
  `params` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Array of parameter strings' CHECK (json_valid(`params`)),
  `description` text DEFAULT NULL,
  `indicators` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Array of clinical indicators' CHECK (json_valid(`indicators`)),
  `sort_order` int(11) DEFAULT 0,
  `active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tests`
--

INSERT INTO `tests` (`id`, `slug`, `category`, `emoji`, `name`, `price`, `turnaround`, `sample`, `fasting`, `species`, `params`, `description`, `indicators`, `sort_order`, `active`, `created_at`, `updated_at`) VALUES
(1, 'cbp', 'blood', '🩸', 'Complete Blood Profile (CBP)', 400.00, '30 Min – 1 Hr', 'Whole Blood (EDTA)', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Hb\",\"RBC\",\"TLC\",\"DLC\",\"ALC\",\"PLT\",\"PCV\",\"MCV\"]', 'Comprehensive evaluation of red blood cells, white blood cells, and platelets. Provides valuable insight into overall health across all species.', '[\"Fever & infections\",\"Anaemia & blood loss\",\"Inflammatory conditions\",\"Immune system assessment\",\"Pre-surgical evaluation\",\"Lethargy & weakness\"]', 1, 1, '2026-06-06 18:09:45', '2026-06-06 20:03:38'),
(2, 'basiclft', 'liver', '🫁', 'Basic Liver Function Test (LFT)', 600.00, '1 – 3 Hrs', 'Serum', 'Recommended 8–12 hrs', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Bilirubin\",\"ALP\",\"ALT\",\"AST\",\"GGT\",\"Total Protein\",\"Albumin\",\"Globulin\"]', 'Measures key liver enzymes and proteins to detect liver damage, inflammation, and biliary disorders.', '[\"Jaundice\",\"Vomiting\",\"Loss of appetite\",\"Weight loss\",\"Medication monitoring\"]', 2, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(3, 'advlft', 'liver', '🫁', 'Advanced Liver Function Test', 800.00, '1 – 3 Hrs', 'Serum', 'Recommended 8–12 hrs', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Bilirubin\",\"ALP\",\"ALT\",\"AST\",\"TP\",\"GGT\",\"Albumin\",\"Globulin\",\"Bile Acids\"]', 'Includes Bile Acids testing for improved early liver dysfunction detection and bile reserve assessment.', '[\"Elevated liver enzymes\",\"Suspected liver disease\",\"Chronic liver disorders\",\"Bile acid metabolism\"]', 3, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(4, 'basicrft', 'kidney', '🫘', 'Basic Kidney Function Test (RFT Mini)', 500.00, '1 – 3 Hrs', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Creatinine\",\"Urea\",\"BUN\",\"Uric Acid\"]', 'Evaluates kidney filtration by measuring waste products normally cleared from the bloodstream.', '[\"Renal disease detection\",\"Dehydration\",\"Urinary signs\",\"Kidney treatment monitoring\"]', 4, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(5, 'advrft', 'kidney', '🫘', 'Advanced Kidney Function Test', 800.00, '1 – 3 Hrs', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Creatinine\",\"Urea\",\"BUN\",\"Uric Acid\",\"Na\",\"K\",\"Cl\",\"Ca\",\"Mg\"]', 'Full renal evaluation plus electrolyte assessment for critical and chronic patients across all species.', '[\"Chronic kidney disease\",\"Excessive thirst & urination\",\"Senior animals\",\"Critical care patients\"]', 5, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(6, 'basicthy', 'thyroid', '🦋', 'Basic Thyroid Profile', 450.00, '1 – 3 Hrs', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"horse\",\"lab\"]', '[\"TT3\",\"TT4\",\"TSH\"]', 'Assesses thyroid gland function and metabolism. Most commonly indicated in dogs, cats, and horses.', '[\"Weight gain\",\"Hair / wool loss\",\"Skin disorders\",\"Lethargy\"]', 6, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(7, 'advthy', 'thyroid', '🦋', 'Advanced Thyroid Profile', 850.00, '1 – 3 Hrs', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"horse\",\"lab\"]', '[\"TT3\",\"TT4\",\"FT3\",\"FT4\",\"TSH\"]', 'Detailed thyroid assessment including free hormone fractions for improved diagnostic accuracy.', '[\"Complex thyroid disorders\",\"Treatment monitoring\",\"Suspected thyroid disease\"]', 7, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(8, 'elec', 'metabolic', '⚡', 'Electrolytes Panel', 400.00, '1 – 3 Hrs', 'Serum / Plasma', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Sodium\",\"Potassium\",\"Chloride\",\"Calcium\",\"Magnesium\"]', 'Electrolyte balance assessment — critical for all species including dairy cattle and buffaloes (milk fever).', '[\"Vomiting & diarrhoea\",\"Dehydration\",\"Kidney disease\",\"Milk fever (cattle)\",\"ICU patients\"]', 8, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(9, 'lipid', 'metabolic', '🧈', 'Lipid Profile', 500.00, '1 – 3 Hrs', 'Serum', 'Mandatory 10–12 hrs', '[\"dog\",\"cat\",\"horse\",\"pig\",\"lab\"]', '[\"Triglycerides\",\"Cholesterol\",\"LDL\",\"HDL\",\"VLDL\"]', 'Evaluates blood fats and lipoproteins. Relevant for obese pets, horses, and pigs.', '[\"Obesity\",\"Diabetes\",\"Pancreatitis\",\"Thyroid disorders\",\"Senior screening\"]', 9, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(10, 'creat', 'kidney', '🫘', 'Creatinine (Serum)', 150.00, '30 Min – 1 Hr', 'Serum', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Creatinine\"]', 'Sensitive marker for kidney filtration efficiency and progression monitoring across all species.', '[\"Renal monitoring\",\"Disease follow-up\"]', 10, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(11, 'bili', 'liver', '🟡', 'Bilirubin Profile', 250.00, '30 Min – 1 Hr', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Total Bilirubin\",\"Direct Bilirubin\",\"Indirect Bilirubin\"]', 'Assesses liver and biliary tract function via bilirubin fractions. Useful across all species.', '[\"Jaundice / icterus\",\"Liver disease\",\"Biliary obstruction\",\"Haemolytic anaemia\"]', 11, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(12, 'hba1c', 'metabolic', '🍬', 'HbA1c', 400.00, '30 Min – 1 Hr', 'Whole Blood (EDTA)', 'Not Required', '[\"dog\",\"cat\",\"horse\",\"pig\",\"lab\"]', '[\"HbA1c (Glycated Haemoglobin)\"]', 'Estimates average blood glucose over several weeks — key for long-term diabetic control monitoring.', '[\"Diabetic monitoring\",\"Long-term glucose control\",\"Treatment efficacy\"]', 12, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(13, 'amylase', 'liver', '🔬', 'Amylase', 500.00, '2 – 6 Hrs', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"pig\",\"horse\",\"lab\"]', '[\"Amylase\"]', 'Pancreatic enzyme test for digestive and pancreatic disorders in dogs, cats, pigs, and horses.', '[\"Pancreatitis\",\"Digestive disorders\",\"Abdominal pain\"]', 13, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(14, 'lipase', 'liver', '💉', 'Lipase', 700.00, '2 – 6 Hrs', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"pig\",\"horse\",\"lab\"]', '[\"Lipase\"]', 'Key pancreatic enzyme for pancreatitis diagnosis and monitoring.', '[\"Pancreatitis\",\"Pancreatic disease monitoring\"]', 14, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(15, 'calcium', 'metabolic', '🦴', 'Calcium (Serum)', 180.00, '30 Min – 1 Hr', 'Serum', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Calcium\"]', 'Blood calcium — critical for bone health, muscle function, and endocrine balance. Essential for dairy cattle milk fever prevention.', '[\"Bone disorders\",\"Milk fever (cattle / buffaloes)\",\"Muscle weakness\",\"Parathyroid evaluation\"]', 15, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(16, 'vitd', 'metabolic', '☀️', 'Vitamin D', 900.00, '30 Min – 1 Hr', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"25-OH Vitamin D\"]', 'Vital for bone metabolism, immune function, and calcium homeostasis — especially important in housed or stall-fed animals.', '[\"Bone disease / rickets\",\"Immune dysfunction\",\"Housed animals\",\"Nutritional assessment\"]', 16, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(17, 'vitb12', 'metabolic', '💊', 'Vitamin B12', 800.00, '30 Min – 1 Hr', 'Serum', 'Preferred', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Vitamin B12 (Cobalamin)\"]', 'Evaluates B12 status — essential for neurological function, RBC production, and GI health including ruminants.', '[\"Neurological signs\",\"GI disease\",\"Anaemia\",\"Ruminant deficiency\"]', 17, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(18, 'rbg', 'metabolic', '🩸', 'Random Blood Glucose (RBG)', 100.00, '30 Min – 1 Hr', 'Whole Blood / Serum', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Blood Glucose\"]', 'Point-in-time glucose measurement for diabetes screening and farm animal ketosis monitoring.', '[\"Diabetes screening\",\"Hypoglycaemia\",\"Ketosis (cattle)\"]', 18, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(19, 'ua', 'kidney', '🧫', 'Urine Analysis', 250.00, '30 Min – 1 Hr', 'Fresh Urine', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Physical examination\",\"Chemical examination\",\"Microscopic examination\"]', 'Comprehensive urinary tract, kidney, and metabolic assessment across all species.', '[\"UTI\",\"Kidney disease\",\"Diabetes / ketosis\",\"Bladder disorders\"]', 19, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(20, 'ck', 'blood', '💪', 'Creatine Kinase (CK)', 500.00, '30 Min – 1 Hr', 'Serum', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\",\"lab\"]', '[\"Creatine Kinase\"]', 'Detects muscle injury, exertional myopathy, and cardiac conditions across all species.', '[\"Muscle injury\",\"Azoturia (horses)\",\"Capture myopathy\",\"Cardiac disease\"]', 20, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(21, 'crp', 'blood', '🔴', 'C-Reactive Protein (CRP)', 800.00, '30 Min – 1 Hr', 'Serum', 'Not Required', '[\"dog\",\"cat\",\"horse\",\"pig\",\"lab\"]', '[\"C-Reactive Protein\"]', 'Sensitive acute-phase protein for detecting inflammation, infection, and monitoring treatment response.', '[\"Infection\",\"Inflammation\",\"Post-surgical monitoring\",\"Treatment assessment\"]', 21, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(22, 'prog', 'hormone', '🔬', 'Progesterone', 600.00, '30 Min – 1 Hr', 'Serum', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\"]', '[\"Progesterone\"]', 'Key reproductive hormone for breeding management, ovulation timing, and pregnancy monitoring across companion and farm species.', '[\"Ovulation timing\",\"Pregnancy monitoring\",\"Calving / whelping prediction\",\"Breeding management\"]', 22, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45'),
(23, 'estro', 'hormone', '🌸', 'Estrogen', 600.00, '30 Min – 1 Hr', 'Serum', 'Not Required', '[\"dog\",\"cat\",\"cattle\",\"buf\",\"horse\",\"pig\"]', '[\"Estrogen (Estradiol)\"]', 'Evaluates estrogen levels to assess reproductive health and hormonal balance in female companion and farm animals.', '[\"Reproductive disorders\",\"Fertility evaluation\",\"Oestrus detection\",\"Hormonal imbalance\"]', 23, 1, '2026-06-06 18:09:45', '2026-06-06 18:09:45');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `tests`
--
ALTER TABLE `tests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `tests`
--
ALTER TABLE `tests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
