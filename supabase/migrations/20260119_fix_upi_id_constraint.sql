-- Fix UPI ID format constraint to be more lenient
-- Allow empty strings as well as NULL, and support broader UPI formats

-- Drop the existing constraint
ALTER TABLE locations
DROP CONSTRAINT IF EXISTS locations_upi_id_format_check;

-- Add a more lenient constraint that:
-- 1. Allows NULL
-- 2. Allows empty string ''
-- 3. If populated, must contain @ symbol (basic UPI format)
ALTER TABLE locations
ADD CONSTRAINT locations_upi_id_format_check 
CHECK (
  upi_id IS NULL 
  OR upi_id = '' 
  OR upi_id ~ '^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$'
);

-- Also fix any existing empty string to NULL for consistency
UPDATE locations 
SET upi_id = NULL 
WHERE upi_id = '';
