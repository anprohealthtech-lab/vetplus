/*
  # Add doctor column to reports table

  1. Changes
    - Add `doctor` column to `reports` table with varchar(255) type
    - Set default value to empty string for existing records
    - Add index for performance on doctor column

  2. Notes
    - This column stores the referring doctor's name for each report
    - Non-nullable to ensure data consistency
*/

-- Add doctor column to reports table
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS doctor varchar(255) NOT NULL DEFAULT '';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_reports_doctor ON public.reports(doctor);