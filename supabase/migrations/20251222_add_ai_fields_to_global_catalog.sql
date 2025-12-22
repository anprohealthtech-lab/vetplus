-- Migration: Add AI Processing Fields to Global Test Catalog
-- Description: Adds specimen type, department, AI processing type, and group-level prompt fields
--              for global test groups to enable automated AI-assisted data capture configuration.

-- Add new columns to global_test_catalog
ALTER TABLE public.global_test_catalog
ADD COLUMN IF NOT EXISTS specimen_type_default text,
ADD COLUMN IF NOT EXISTS department_default text,
ADD COLUMN IF NOT EXISTS default_ai_processing_type text,
ADD COLUMN IF NOT EXISTS group_level_prompt text,
ADD COLUMN IF NOT EXISTS ai_config jsonb DEFAULT '{}'::jsonb;

-- Add constraints for specimen type (must match sample_type enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'global_test_catalog_specimen_type_check'
  ) THEN
    ALTER TABLE public.global_test_catalog
    ADD CONSTRAINT global_test_catalog_specimen_type_check 
    CHECK (specimen_type_default IS NULL OR specimen_type_default = ANY(ARRAY[
      'EDTA Blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'CSF', 
      'Sputum', 'Swab', 'Tissue', 'Other', 'Fluoride Plasma', 'Citrated Plasma'
    ]));
  END IF;
END $$;

-- Add constraints for department
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'global_test_catalog_department_check'
  ) THEN
    ALTER TABLE public.global_test_catalog
    ADD CONSTRAINT global_test_catalog_department_check 
    CHECK (department_default IS NULL OR department_default = ANY(ARRAY[
      'Biochemistry', 'Hematology', 'Immunology', 'Microbiology', 
      'Clinical Pathology', 'Serology', 'Histopathology', 'Cytology',
      'Molecular Biology', 'Toxicology', 'Endocrinology', 'Other'
    ]));
  END IF;
END $$;

-- Add constraints for AI processing type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'global_test_catalog_ai_processing_type_check'
  ) THEN
    ALTER TABLE public.global_test_catalog
    ADD CONSTRAINT global_test_catalog_ai_processing_type_check 
    CHECK (default_ai_processing_type IS NULL OR default_ai_processing_type = ANY(ARRAY[
      'INSTRUMENT_SCREEN_OCR',
      'THERMAL_SLIP_OCR',
      'RAPID_CARD_LFA',
      'COLOR_STRIP_MULTIPARAM',
      'SINGLE_WELL_COLORIMETRIC',
      'AGGLUTINATION_CARD',
      'MICROSCOPY_MORPHOLOGY',
      'ZONE_OF_INHIBITION',
      'MENISCUS_SCALE_READING',
      'SAMPLE_QUALITY_TUBE_CHECK',
      'MANUAL_ENTRY_NO_VISION',
      'UNKNOWN_NEEDS_REVIEW'
    ]));
  END IF;
END $$;

-- Create index for quick lookups by processing type
CREATE INDEX IF NOT EXISTS idx_global_test_catalog_ai_processing_type 
ON public.global_test_catalog(default_ai_processing_type) 
WHERE default_ai_processing_type IS NOT NULL;

-- Create index for department
CREATE INDEX IF NOT EXISTS idx_global_test_catalog_department 
ON public.global_test_catalog(department_default) 
WHERE department_default IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.global_test_catalog.specimen_type_default IS 'Default specimen type for this test group (Serum, Plasma, Whole Blood, Urine, etc.)';
COMMENT ON COLUMN public.global_test_catalog.department_default IS 'Lab department that typically handles this test (Biochemistry, Hematology, etc.)';
COMMENT ON COLUMN public.global_test_catalog.default_ai_processing_type IS 'Default AI data capture method (THERMAL_SLIP_OCR, RAPID_CARD_LFA, etc.)';
COMMENT ON COLUMN public.global_test_catalog.group_level_prompt IS 'AI Vision prompt template for processing this test result';
COMMENT ON COLUMN public.global_test_catalog.ai_config IS 'Full AI configuration including confidence score, warnings, method-specific config, etc.';
