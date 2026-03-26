-- ============================================================================
-- Migration: Add comprehensive test group configuration fields
-- Date: 2025-11-18
-- Description: Adds 13 new columns to test_groups table for enhanced test configuration
--              including test type, gender requirements, sample identification,
--              required fields tracking, and additional options.
--
-- CURRENT SCHEMA (existing columns in test_groups):
--   - id, name, code, category, clinical_purpose, price, turnaround_time
--   - sample_type, requires_fasting, is_active, created_at, updated_at
--   - default_ai_processing_type, group_level_prompt, lab_id, to_be_copied
--   - description, department, tat_hours
--
-- NEW COLUMNS BEING ADDED (13 columns):
--   - test_type, gender, sample_color, barcode_suffix
--   - lmp_required, id_required, consent_form, pre_collection_guidelines
--   - flabs_id, only_female, only_male, only_billing, start_from_next_page
-- ============================================================================

-- Add test_type column (Default, Special, Urgent, Routine)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'test_type'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN test_type VARCHAR(50) DEFAULT 'Default';
        COMMENT ON COLUMN test_groups.test_type IS 'Type of test: Default, Special, Urgent, or Routine';
        RAISE NOTICE '✓ Added column: test_type';
    ELSE
        RAISE NOTICE '⊘ Column already exists: test_type';
    END IF;
END $$;

-- Add gender column (Male, Female, Both)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'gender'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN gender VARCHAR(20) DEFAULT 'Both';
        COMMENT ON COLUMN test_groups.gender IS 'Gender applicability: Male, Female, or Both';
        RAISE NOTICE '✓ Added column: gender';
    ELSE
        RAISE NOTICE '⊘ Column already exists: gender';
    END IF;
END $$;

-- Add sample_color column for sample identification
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'sample_color'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN sample_color VARCHAR(50) DEFAULT 'Red';
        COMMENT ON COLUMN test_groups.sample_color IS 'Color coding for sample identification (Red, Blue, Green, Yellow, Purple, Gray, Pink, Orange)';
        RAISE NOTICE '✓ Added column: sample_color';
    ELSE
        RAISE NOTICE '⊘ Column already exists: sample_color';
    END IF;
END $$;

-- Add barcode_suffix column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'barcode_suffix'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN barcode_suffix VARCHAR(50);
        COMMENT ON COLUMN test_groups.barcode_suffix IS 'Custom suffix for barcode generation';
        RAISE NOTICE '✓ Added column: barcode_suffix';
    ELSE
        RAISE NOTICE '⊘ Column already exists: barcode_suffix';
    END IF;
END $$;

-- Add lmp_required column (Last Menstrual Period)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'lmp_required'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN lmp_required BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN test_groups.lmp_required IS 'Whether Last Menstrual Period date is required for this test';
        RAISE NOTICE '✓ Added column: lmp_required';
    ELSE
        RAISE NOTICE '⊘ Column already exists: lmp_required';
    END IF;
END $$;

-- Add id_required column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'id_required'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN id_required BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN test_groups.id_required IS 'Whether patient ID verification is required for this test';
        RAISE NOTICE '✓ Added column: id_required';
    ELSE
        RAISE NOTICE '⊘ Column already exists: id_required';
    END IF;
END $$;

-- Add consent_form column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'consent_form'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN consent_form BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN test_groups.consent_form IS 'Whether patient consent form is required for this test';
        RAISE NOTICE '✓ Added column: consent_form';
    ELSE
        RAISE NOTICE '⊘ Column already exists: consent_form';
    END IF;
END $$;

-- Add pre_collection_guidelines column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'pre_collection_guidelines'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN pre_collection_guidelines TEXT;
        COMMENT ON COLUMN test_groups.pre_collection_guidelines IS 'Instructions for patient preparation before sample collection';
        RAISE NOTICE '✓ Added column: pre_collection_guidelines';
    ELSE
        RAISE NOTICE '⊘ Column already exists: pre_collection_guidelines';
    END IF;
END $$;

-- Add flabs_id column (External lab ID)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'flabs_id'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN flabs_id VARCHAR(100);
        COMMENT ON COLUMN test_groups.flabs_id IS 'External lab or Flabs system identifier (e.g., FLT0625)';
        RAISE NOTICE '✓ Added column: flabs_id';
    ELSE
        RAISE NOTICE '⊘ Column already exists: flabs_id';
    END IF;
END $$;

-- Add only_female column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'only_female'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN only_female BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN test_groups.only_female IS 'Whether test is applicable only to female patients';
        RAISE NOTICE '✓ Added column: only_female';
    ELSE
        RAISE NOTICE '⊘ Column already exists: only_female';
    END IF;
END $$;

-- Add only_male column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'only_male'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN only_male BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN test_groups.only_male IS 'Whether test is applicable only to male patients';
        RAISE NOTICE '✓ Added column: only_male';
    ELSE
        RAISE NOTICE '⊘ Column already exists: only_male';
    END IF;
END $$;

-- Add only_billing column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'only_billing'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN only_billing BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN test_groups.only_billing IS 'Whether test is for billing purposes only';
        RAISE NOTICE '✓ Added column: only_billing';
    ELSE
        RAISE NOTICE '⊘ Column already exists: only_billing';
    END IF;
END $$;

-- Add start_from_next_page column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'test_groups' AND column_name = 'start_from_next_page'
    ) THEN
        ALTER TABLE test_groups ADD COLUMN start_from_next_page BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN test_groups.start_from_next_page IS 'Whether test results should start on a new page in reports';
        RAISE NOTICE '✓ Added column: start_from_next_page';
    ELSE
        RAISE NOTICE '⊘ Column already exists: start_from_next_page';
    END IF;
END $$;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_test_groups_test_type ON test_groups(test_type);
CREATE INDEX IF NOT EXISTS idx_test_groups_gender ON test_groups(gender);
CREATE INDEX IF NOT EXISTS idx_test_groups_only_female ON test_groups(only_female) WHERE only_female = TRUE;
CREATE INDEX IF NOT EXISTS idx_test_groups_only_male ON test_groups(only_male) WHERE only_male = TRUE;

-- ============================================================================
-- MIGRATION COMPLETION SUMMARY
-- ============================================================================
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    -- Count how many of the new columns actually exist
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'test_groups'
    AND column_name IN (
        'test_type', 'gender', 'sample_color', 'barcode_suffix',
        'lmp_required', 'id_required', 'consent_form', 'pre_collection_guidelines',
        'flabs_id', 'only_female', 'only_male', 'only_billing', 'start_from_next_page'
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Table: test_groups';
    RAISE NOTICE 'Columns verified: % of 13 new configuration columns exist', column_count;
    RAISE NOTICE '';
    RAISE NOTICE 'New columns:';
    RAISE NOTICE '  1. test_type (VARCHAR) - Test classification';
    RAISE NOTICE '  2. gender (VARCHAR) - Gender applicability';
    RAISE NOTICE '  3. sample_color (VARCHAR) - Sample identification';
    RAISE NOTICE '  4. barcode_suffix (VARCHAR) - Custom barcode suffix';
    RAISE NOTICE '  5. lmp_required (BOOLEAN) - LMP date required';
    RAISE NOTICE '  6. id_required (BOOLEAN) - ID verification required';
    RAISE NOTICE '  7. consent_form (BOOLEAN) - Consent form required';
    RAISE NOTICE '  8. pre_collection_guidelines (TEXT) - Patient prep instructions';
    RAISE NOTICE '  9. flabs_id (VARCHAR) - External lab identifier';
    RAISE NOTICE '  10. only_female (BOOLEAN) - Female patients only';
    RAISE NOTICE '  11. only_male (BOOLEAN) - Male patients only';
    RAISE NOTICE '  12. only_billing (BOOLEAN) - Billing only flag';
    RAISE NOTICE '  13. start_from_next_page (BOOLEAN) - Report page break';
    RAISE NOTICE '';
    RAISE NOTICE 'Indexes created: 4 performance indexes';
    RAISE NOTICE '============================================================================';
    
    IF column_count = 13 THEN
        RAISE NOTICE '✓ ALL 13 COLUMNS ADDED SUCCESSFULLY';
    ELSE
        RAISE WARNING '⚠ Only % of 13 columns were added. Some may have already existed.', column_count;
    END IF;
    RAISE NOTICE '============================================================================';
END $$;
