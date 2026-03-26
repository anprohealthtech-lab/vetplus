-- Add code column to analytes table for short identifiers
-- Non-unique since same analyte can be used by multiple labs

ALTER TABLE public.analytes
ADD COLUMN IF NOT EXISTS code VARCHAR(50);

-- Create index for faster lookups (but not unique)
CREATE INDEX IF NOT EXISTS idx_analytes_code ON public.analytes(code);

-- Backfill codes for existing analytes (generate from name)
-- Convert to uppercase, remove spaces and special chars
UPDATE public.analytes
SET code = UPPER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(name, '[^a-zA-Z0-9 ]', '', 'g'),
    '\s+',
    '_',
    'g'
  )
)
WHERE code IS NULL;

COMMENT ON COLUMN public.analytes.code IS 'Short identifier for analyte (e.g., HB, GLU, WBC). Non-unique as same analyte can exist across labs.';
