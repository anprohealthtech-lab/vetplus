/*
  # Add display_id to patients table

  1. Changes
    - Add display_id column to patients table
    - This column will store a user-friendly ID in the format DD-Mon-YYYY-SeqNum
    - For example: 14-Jul-2025-1 for the first patient registered on July 14, 2025
*/

-- Add display_id column to patients table
ALTER TABLE public.patients
ADD COLUMN display_id VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_display_id ON public.patients USING btree (display_id);