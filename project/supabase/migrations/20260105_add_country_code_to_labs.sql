-- Add country code field to labs table
-- This allows each lab to configure their country code for phone number formatting

-- Add country_code column
ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+91';

-- Add comment
COMMENT ON COLUMN labs.country_code IS 'Country calling code (e.g., +91 for India, +92 for Pakistan, +94 for Sri Lanka, +971 for UAE, +880 for Bangladesh, +977 for Nepal)';

-- Update existing labs to have +91 as default (India)
UPDATE labs 
SET country_code = '+91' 
WHERE country_code IS NULL;
