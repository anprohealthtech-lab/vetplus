/*
  # Add AI Configuration to Analytes Table

  1. New Columns
    - `ai_processing_type` (text, nullable)
      - Defines how AI should process data for this analyte
      - Values: 'ocr_report', 'vision_card', 'vision_color', 'none'
    - `ai_prompt_override` (text, nullable)
      - Custom prompt for Gemini NLP function
      - Overrides default prompt generation when provided

  2. Security
    - No changes to RLS policies needed
    - Existing policies cover new columns

  3. Data Migration
    - Set default ai_processing_type to 'ocr_report' for existing analytes
    - Leave ai_prompt_override as null for existing records
*/

-- Add AI configuration columns to analytes table
DO $$
BEGIN
  -- Add ai_processing_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analytes' AND column_name = 'ai_processing_type'
  ) THEN
    ALTER TABLE analytes ADD COLUMN ai_processing_type TEXT DEFAULT 'ocr_report';
  END IF;

  -- Add ai_prompt_override column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analytes' AND column_name = 'ai_prompt_override'
  ) THEN
    ALTER TABLE analytes ADD COLUMN ai_prompt_override TEXT;
  END IF;
END $$;

-- Add check constraint for ai_processing_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'analytes_ai_processing_type_check'
  ) THEN
    ALTER TABLE analytes ADD CONSTRAINT analytes_ai_processing_type_check 
    CHECK (ai_processing_type IN ('ocr_report', 'vision_card', 'vision_color', 'none') OR ai_processing_type IS NULL);
  END IF;
END $$;

-- Create index for ai_processing_type for better query performance
CREATE INDEX IF NOT EXISTS idx_analytes_ai_processing_type 
ON analytes(ai_processing_type) 
WHERE ai_processing_type IS NOT NULL;

-- Update existing analytes to have default AI processing type
UPDATE analytes 
SET ai_processing_type = 'ocr_report' 
WHERE ai_processing_type IS NULL;