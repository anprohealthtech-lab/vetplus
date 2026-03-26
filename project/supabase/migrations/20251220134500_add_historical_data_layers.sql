-- Create table for storing external report metadata
CREATE TABLE public.external_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  lab_name text,
  report_date date,
  file_url text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'review_required'::text, 'completed'::text, 'failed'::text])),
  uploaded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  ai_metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT external_reports_pkey PRIMARY KEY (id),
  CONSTRAINT fk_external_reports_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT fk_external_reports_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES public.users(id)
);

-- Enable RLS for external_reports
ALTER TABLE public.external_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.external_reports
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.external_reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.external_reports
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create table for storing parsed result values from external reports
CREATE TABLE public.external_result_values (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_report_id uuid NOT NULL,
  
  -- The Core Mapping
  mapped_analyte_id uuid,
  mapped_test_group_id uuid,
  
  -- Extracted Data
  original_analyte_name text,
  value character varying,
  unit character varying,
  reference_range text,
  
  -- AI Processing Metadata
  ai_confidence numeric,
  is_verified boolean DEFAULT false,
  varified_by uuid,
  verified_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT external_result_values_pkey PRIMARY KEY (id),
  CONSTRAINT fk_erv_report FOREIGN KEY (external_report_id) REFERENCES public.external_reports(id),
  CONSTRAINT fk_erv_analyte FOREIGN KEY (mapped_analyte_id) REFERENCES public.analytes(id),
  CONSTRAINT fk_erv_test_group FOREIGN KEY (mapped_test_group_id) REFERENCES public.test_groups(id)
);

-- Enable RLS for external_result_values
ALTER TABLE public.external_result_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.external_result_values
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.external_result_values
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.external_result_values
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create unified view for patient history (Internal + External)
CREATE OR REPLACE VIEW public.view_patient_history AS
SELECT 
  o.patient_id,
  rv.analyte_id,
  rv.value,
  rv.unit,
  rv.created_at as result_date,
  'internal' as source,
  rv.reference_range,
  rv.id as source_id
FROM public.result_values rv
JOIN public.orders o ON rv.order_id = o.id
WHERE rv.verified = true

UNION ALL

SELECT 
  r.patient_id,
  v.mapped_analyte_id as analyte_id,
  v.value,
  v.unit,
  r.report_date as result_date,
  'external' as source,
  v.reference_range,
  v.id as source_id
FROM public.external_result_values v
JOIN public.external_reports r ON v.external_report_id = r.id
WHERE v.is_verified = true;

-- Grant permissions (if needed, though default usually covers it for authenticated)
GRANT SELECT ON public.view_patient_history TO authenticated;
GRANT SELECT ON public.view_patient_history TO anon;
