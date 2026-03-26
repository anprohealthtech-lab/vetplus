/*
  # Add Global Analyte Functionality and Lab-Specific Customizations

  1. Schema Changes
     - Add `is_global` column to `analytes` table to mark analytes that should be auto-added to new labs
     - Add lab-specific columns to `lab_analytes` table:
       - `lab_specific_reference_range` for lab-customized reference ranges
       - `lab_specific_interpretation_low` for lab-customized low value interpretation
       - `lab_specific_interpretation_normal` for lab-customized normal value interpretation
       - `lab_specific_interpretation_high` for lab-customized high value interpretation

  2. Trigger Function Update
     - Update `create_lab_analytes_for_new_lab` function to only add global analytes to new labs
     - Pre-populate lab-specific columns with global values as defaults

  3. Data Migration
     - Set existing analytes as global by default
     - Populate existing lab_analytes with global values
*/

-- Step 1: Add is_global column to analytes table
ALTER TABLE public.analytes 
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT TRUE;

-- Step 2: Add lab-specific columns to lab_analytes table
ALTER TABLE public.lab_analytes
ADD COLUMN IF NOT EXISTS lab_specific_reference_range TEXT,
ADD COLUMN IF NOT EXISTS lab_specific_interpretation_low TEXT,
ADD COLUMN IF NOT EXISTS lab_specific_interpretation_normal TEXT,
ADD COLUMN IF NOT EXISTS lab_specific_interpretation_high TEXT;

-- Step 3: Update existing analytes to be global by default
UPDATE public.analytes 
SET is_global = TRUE 
WHERE is_global IS NULL;

-- Step 4: Populate existing lab_analytes with global values as defaults
UPDATE public.lab_analytes 
SET 
  lab_specific_reference_range = a.reference_range,
  lab_specific_interpretation_low = a.interpretation_low,
  lab_specific_interpretation_normal = a.interpretation_normal,
  lab_specific_interpretation_high = a.interpretation_high
FROM public.analytes a
WHERE lab_analytes.analyte_id = a.id
  AND lab_analytes.lab_specific_reference_range IS NULL;

-- Step 5: Update the trigger function to handle global analytes
CREATE OR REPLACE FUNCTION public.create_lab_analytes_for_new_lab()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Insert lab_analytes entries for all global analytes when a new lab is created
    INSERT INTO public.lab_analytes (
        lab_id,
        analyte_id,
        is_active,
        visible,
        lab_specific_reference_range,
        lab_specific_interpretation_low,
        lab_specific_interpretation_normal,
        lab_specific_interpretation_high
    )
    SELECT
        NEW.id,                           -- New lab's ID
        a.id,                            -- Analyte ID
        TRUE,                            -- Default is_active to TRUE
        TRUE,                            -- Default visible to TRUE
        a.reference_range,               -- Copy global reference range as default
        a.interpretation_low,            -- Copy global interpretation_low as default
        a.interpretation_normal,         -- Copy global interpretation_normal as default
        a.interpretation_high            -- Copy global interpretation_high as default
    FROM
        public.analytes a
    WHERE
        a.is_global = TRUE               -- Only insert global analytes
        AND a.is_active = TRUE;          -- Only insert active analytes
    
    RETURN NEW;
END;
$function$;

-- Step 6: Create helper function to add global analytes to existing labs
CREATE OR REPLACE FUNCTION public.add_global_analytes_to_existing_labs()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Add any new global analytes to existing labs that don't have them yet
    INSERT INTO public.lab_analytes (
        lab_id,
        analyte_id,
        is_active,
        visible,
        lab_specific_reference_range,
        lab_specific_interpretation_low,
        lab_specific_interpretation_normal,
        lab_specific_interpretation_high
    )
    SELECT
        l.id,                            -- Lab ID
        a.id,                            -- Analyte ID
        TRUE,                            -- Default is_active to TRUE
        TRUE,                            -- Default visible to TRUE
        a.reference_range,               -- Copy global reference range as default
        a.interpretation_low,            -- Copy global interpretation_low as default
        a.interpretation_normal,         -- Copy global interpretation_normal as default
        a.interpretation_high            -- Copy global interpretation_high as default
    FROM
        public.labs l
        CROSS JOIN public.analytes a
    WHERE
        a.is_global = TRUE
        AND a.is_active = TRUE
        AND NOT EXISTS (
            SELECT 1 
            FROM public.lab_analytes la 
            WHERE la.lab_id = l.id 
            AND la.analyte_id = a.id
        );
END;
$function$;

-- Step 7: Execute the helper function to populate existing labs with global analytes
SELECT public.add_global_analytes_to_existing_labs();

-- Step 8: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytes_is_global 
ON public.analytes (is_global) 
WHERE is_global = TRUE;

CREATE INDEX IF NOT EXISTS idx_lab_analytes_lab_specific_fields 
ON public.lab_analytes (lab_id, analyte_id) 
WHERE lab_specific_reference_range IS NOT NULL;