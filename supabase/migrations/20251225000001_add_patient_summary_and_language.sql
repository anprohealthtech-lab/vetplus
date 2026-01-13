-- Migration: Add Patient Summary and Lab Language Settings
-- Date: 2025-12-25
-- Purpose: Enable patient-friendly summaries in regional languages

BEGIN;

-- ============================================
-- 1. Add preferred_language to labs table
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'labs' AND column_name = 'preferred_language'
    ) THEN
        ALTER TABLE labs ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'english';
        
        -- Add check constraint for supported Indian languages
        ALTER TABLE labs ADD CONSTRAINT labs_preferred_language_check 
            CHECK (preferred_language IN (
                'english', 
                'hindi', 
                'marathi', 
                'gujarati', 
                'tamil', 
                'telugu', 
                'kannada', 
                'bengali', 
                'punjabi', 
                'malayalam',
                'odia',
                'assamese'
            ));
        
        RAISE NOTICE 'Added preferred_language column to labs table';
    ELSE
        RAISE NOTICE 'preferred_language column already exists in labs table';
    END IF;
END $$;

-- ============================================
-- 2. Add patient summary columns to orders table
-- ============================================
DO $$
BEGIN
    -- Add ai_patient_summary column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'ai_patient_summary'
    ) THEN
        ALTER TABLE orders ADD COLUMN ai_patient_summary TEXT;
        RAISE NOTICE 'Added ai_patient_summary column to orders table';
    END IF;

    -- Add ai_patient_summary_generated_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'ai_patient_summary_generated_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN ai_patient_summary_generated_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added ai_patient_summary_generated_at column to orders table';
    END IF;

    -- Add include_patient_summary_in_report column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'include_patient_summary_in_report'
    ) THEN
        ALTER TABLE orders ADD COLUMN include_patient_summary_in_report BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added include_patient_summary_in_report column to orders table';
    END IF;

    -- Add patient_summary_language column (language used for this specific summary)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'patient_summary_language'
    ) THEN
        ALTER TABLE orders ADD COLUMN patient_summary_language TEXT DEFAULT 'english';
        RAISE NOTICE 'Added patient_summary_language column to orders table';
    END IF;
END $$;

-- ============================================
-- 3. Create index for faster queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_patient_summary 
    ON orders(id) 
    WHERE ai_patient_summary IS NOT NULL;

-- ============================================
-- 4. Add comment for documentation
-- ============================================
COMMENT ON COLUMN labs.preferred_language IS 
    'Default language for patient-facing summaries. Medical terms remain in English.';

COMMENT ON COLUMN orders.ai_patient_summary IS 
    'AI-generated patient-friendly summary of test results in the selected language.';

COMMENT ON COLUMN orders.ai_patient_summary_generated_at IS 
    'Timestamp when the patient summary was generated.';

COMMENT ON COLUMN orders.include_patient_summary_in_report IS 
    'Whether to include the patient summary in the PDF report.';

COMMENT ON COLUMN orders.patient_summary_language IS 
    'The language in which this specific patient summary was generated.';

COMMIT;
