-- ============================================================================
-- Migration: Add template-critical snapshot fields to result_values
-- ============================================================================
-- NOTE: The columns are also added in 20260210-1200 (before the view).
-- This migration is kept as a safety net (IF NOT EXISTS) and for comments.
-- ============================================================================

-- Idempotent — safe to re-run even if 1200 already added them
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS normal_range_min numeric;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS normal_range_max numeric;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS low_critical text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS high_critical text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS reference_range_male text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS reference_range_female text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS value_type text;

-- Column documentation
COMMENT ON COLUMN result_values.normal_range_min IS 'Snapshot: lower bound of normal range at analysis time (from lab_analytes or analytes)';
COMMENT ON COLUMN result_values.normal_range_max IS 'Snapshot: upper bound of normal range at analysis time (from lab_analytes or analytes)';
COMMENT ON COLUMN result_values.low_critical IS 'Snapshot: critical low threshold at analysis time';
COMMENT ON COLUMN result_values.high_critical IS 'Snapshot: critical high threshold at analysis time';
COMMENT ON COLUMN result_values.reference_range_male IS 'Snapshot: male-specific reference range at analysis time';
COMMENT ON COLUMN result_values.reference_range_female IS 'Snapshot: female-specific reference range at analysis time';
COMMENT ON COLUMN result_values.method IS 'Snapshot: analytical method at analysis time';
COMMENT ON COLUMN result_values.value_type IS 'Snapshot: value type (numeric/qualitative/semi-quantitative) at analysis time';
