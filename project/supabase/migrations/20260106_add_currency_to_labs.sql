-- Add currency_code column to labs table
-- Currency is automatically determined from country_code

ALTER TABLE labs 
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) DEFAULT 'INR';

-- Add comment
COMMENT ON COLUMN labs.currency_code IS 'ISO 4217 currency code - automatically set based on country_code';

-- Update existing labs to have currency based on country_code
UPDATE labs 
SET currency_code = CASE 
  WHEN country_code = '+92' THEN 'PKR'  -- Pakistan
  WHEN country_code = '+94' THEN 'LKR'  -- Sri Lanka
  WHEN country_code = '+971' THEN 'AED' -- UAE
  WHEN country_code = '+880' THEN 'BDT' -- Bangladesh
  WHEN country_code = '+977' THEN 'NPR' -- Nepal
  ELSE 'INR'                             -- India (default)
END
WHERE country_code IS NOT NULL;

-- Create function to automatically set currency_code based on country_code
CREATE OR REPLACE FUNCTION set_currency_from_country_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically set currency_code based on country_code
  NEW.currency_code := CASE 
    WHEN NEW.country_code = '+92' THEN 'PKR'  -- Pakistan
    WHEN NEW.country_code = '+94' THEN 'LKR'  -- Sri Lanka
    WHEN NEW.country_code = '+971' THEN 'AED' -- UAE (Dubai)
    WHEN NEW.country_code = '+880' THEN 'BDT' -- Bangladesh
    WHEN NEW.country_code = '+977' THEN 'NPR' -- Nepal
    ELSE 'INR'                                 -- India (default)
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set currency on INSERT or UPDATE
DROP TRIGGER IF EXISTS trigger_set_currency_from_country ON labs;
CREATE TRIGGER trigger_set_currency_from_country
  BEFORE INSERT OR UPDATE OF country_code ON labs
  FOR EACH ROW
  EXECUTE FUNCTION set_currency_from_country_code();

-- Add comment on trigger
COMMENT ON TRIGGER trigger_set_currency_from_country ON labs IS 
  'Automatically sets currency_code based on country_code when lab is created or country is changed';
