-- Fix view_patient_history to include analyte name for PostgREST compatibility
-- This allows trend graph queries to work without needing foreign key relationships

-- Drop the existing view first to avoid column order conflicts
DROP VIEW IF EXISTS public.view_patient_history;

-- Recreate the view with analyte_name included
CREATE VIEW public.view_patient_history AS
SELECT 
  o.patient_id,
  rv.analyte_id,
  COALESCE(a.name, rv.parameter) as analyte_name,
  rv.value,
  rv.unit,
  rv.created_at as result_date,
  'internal' as source,
  rv.reference_range,
  rv.id as source_id
FROM public.result_values rv
JOIN public.orders o ON rv.order_id = o.id
LEFT JOIN public.analytes a ON rv.analyte_id = a.id
WHERE (rv.verified = true OR rv.verify_status = 'approved')

UNION ALL

SELECT 
  r.patient_id,
  v.mapped_analyte_id as analyte_id,
  COALESCE(a.name, v.original_analyte_name) as analyte_name,
  v.value,
  v.unit,
  r.report_date as result_date,
  'external' as source,
  v.reference_range,
  v.id as source_id
FROM public.external_result_values v
JOIN public.external_reports r ON v.external_report_id = r.id
LEFT JOIN public.analytes a ON v.mapped_analyte_id = a.id
WHERE v.is_verified = true;

-- Grant permissions
GRANT SELECT ON public.view_patient_history TO authenticated;
GRANT SELECT ON public.view_patient_history TO anon;
