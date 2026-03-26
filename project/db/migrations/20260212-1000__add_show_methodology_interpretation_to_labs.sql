-- Add show_methodology and show_interpretation toggle columns to labs table
-- These control whether the default report templates (beautiful/classic) include
-- methodology and interpretation columns for each analyte.

ALTER TABLE labs ADD COLUMN IF NOT EXISTS show_methodology boolean DEFAULT true;
ALTER TABLE labs ADD COLUMN IF NOT EXISTS show_interpretation boolean DEFAULT false;

COMMENT ON COLUMN labs.show_methodology IS 'When true, default report templates display the methodology/method for each analyte';
COMMENT ON COLUMN labs.show_interpretation IS 'When true, default report templates display interpretation (low/normal/high) text below each analyte based on flag';
