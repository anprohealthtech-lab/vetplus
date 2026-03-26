-- 1. Patient Schema - Age Units Support
-- To accurately support pediatric ranges when DOB is unknown
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS age_unit text DEFAULT 'years' CHECK (age_unit IN ('years', 'months', 'days'));

-- 2. Test Groups - AI Config & Required Inputs
ALTER TABLE public.test_groups
ADD COLUMN IF NOT EXISTS ref_range_ai_config jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.test_groups
ADD COLUMN IF NOT EXISTS required_patient_inputs jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.test_groups.ref_range_ai_config IS 
'AI configuration for dynamic reference range determination. Example: {"enabled": true, "consider_age": true}';

COMMENT ON COLUMN public.test_groups.required_patient_inputs IS 
'Array of required patient fields for this test. Example: ["pregnancy_status", "lmp", "weight"]';

-- 3. Orders - Patient Context
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS patient_context jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.orders.patient_context IS 
'Patient context at time of order for reference range determination.';

CREATE INDEX IF NOT EXISTS idx_orders_patient_context ON public.orders USING gin(patient_context);

-- 4. Analytes - Knowledge Base
ALTER TABLE public.analytes
ADD COLUMN IF NOT EXISTS ref_range_knowledge jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.analytes.ref_range_knowledge IS 
'Medical knowledge about reference ranges for different populations.';
