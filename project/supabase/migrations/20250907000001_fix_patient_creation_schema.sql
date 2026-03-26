-- Fix patient creation by ensuring all referenced columns exist
-- Migration: Fix database schema for patient creation
-- Date: September 7, 2025

-- The error showed these columns were expected but missing
-- Since color_code and color_name belong to orders (not patients), 
-- we're removing them from patient references

-- Ensure display_id column exists in patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS display_id TEXT UNIQUE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_patients_display_id ON patients(display_id);

-- Update any existing patients that don't have display_id
UPDATE patients 
SET display_id = 'MIGRATED-' || id::text
WHERE display_id IS NULL;

-- Add comment to document the schema
COMMENT ON COLUMN patients.display_id IS 'Human-readable patient identifier in format DD-Mon-YYYY-SeqNum';
