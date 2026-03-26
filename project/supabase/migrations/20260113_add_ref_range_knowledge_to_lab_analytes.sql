-- Add ref_range_knowledge to lab_analytes to allow lab-specific overrides
ALTER TABLE lab_analytes ADD COLUMN IF NOT EXISTS ref_range_knowledge JSONB DEFAULT '{}'::jsonb;
