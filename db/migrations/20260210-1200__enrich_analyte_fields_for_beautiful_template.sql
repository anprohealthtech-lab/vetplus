-- Enrich the v_report_template_context view analytes JSON with additional fields
-- needed for the beautiful 3-band color matrix generic template:
--   normal_range_min, normal_range_max, low_critical, high_critical,
--   reference_range_male, reference_range_female, expected_normal_values,
--   value_type, code, interpretation_low, interpretation_normal, interpretation_high,
--   ai_interpretation (from result_values)

-- 0) Add snapshot columns to result_values (must exist before the view references them)
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS normal_range_min numeric;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS normal_range_max numeric;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS low_critical text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS high_critical text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS reference_range_male text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS reference_range_female text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE result_values ADD COLUMN IF NOT EXISTS value_type text;

-- 1) Recreate the view with enriched analytes JSON
DROP VIEW IF EXISTS public.v_report_template_context;
CREATE VIEW public.v_report_template_context AS
SELECT 
    o.id AS order_id,
    o.order_number,
    o.order_date,
    o.status,
    o.total_amount,
    o.sample_collected_at,
    o.sample_id,
    o.color_code,
    o.color_name,
    o.qr_code_data,
    o.created_at AS order_created_at,
    o.lab_id,
    o.patient_id,
    o.location_id,
    o.referring_doctor_id,
    o.approved_by,
    
    p.name AS patient_name,
    p.display_id AS patient_display_id,
    p.age,
    p.gender,
    p.phone AS patient_phone,
    p.date_of_birth,
    p.registration_date,
    
    l.name AS location_name,
    
    d.name AS referring_doctor_name,
    
    COALESCE(u_collector.name, u_collector.email) AS sample_collected_by,
    
    -- Use result_values.verified_at as approved_at
    MAX(rv.verified_at) AS approved_at,
    
    -- All analytes approved if all result_values.verify_status = 'approved'
    BOOL_AND(
        CASE 
            WHEN rv.verify_status IS NULL THEN false
            WHEN rv.verify_status = 'approved' THEN true
            ELSE false
        END
    ) AS all_analytes_approved,
    
    -- Enriched analytes JSON with all fields needed for beautiful template
    -- Priority: result_values snapshot (from AI flag analysis) > lab_analytes > analytes
    jsonb_agg(
        DISTINCT jsonb_build_object(
            'result_id', rv.result_id,
            'analyte_id', rv.analyte_id,
            'parameter', COALESCE(la.lab_specific_name, a.name),
            'value', rv.value,
            'unit', COALESCE(la.lab_specific_unit, a.unit),
            'method', COALESCE(rv.method, la.lab_specific_method, la.method),
            'reference_range', COALESCE(la.lab_specific_reference_range, a.reference_range),
            'flag', rv.flag,
            'verify_status', rv.verify_status,
            'test_group_id', tg.id,
            'test_name', tg.name,
            -- Structured range: prefer result_values snapshot, then lab_analytes
            'normal_range_min', COALESCE(rv.normal_range_min, la.normal_range_min),
            'normal_range_max', COALESCE(rv.normal_range_max, la.normal_range_max),
            'low_critical', COALESCE(rv.low_critical, la.low_critical, la.critical_low, a.low_critical),
            'high_critical', COALESCE(rv.high_critical, la.high_critical, la.critical_high, a.high_critical),
            'reference_range_male', COALESCE(rv.reference_range_male, la.reference_range_male, a.reference_range_male),
            'reference_range_female', COALESCE(rv.reference_range_female, la.reference_range_female, a.reference_range_female),
            -- Value type: prefer snapshot
            'value_type', COALESCE(rv.value_type, la.value_type, a.value_type),
            'expected_normal_values', COALESCE(la.expected_normal_values, a.expected_normal_values),
            -- Analyte code for placeholders
            'code', a.code,
            -- Interpretation texts for clinical context
            'interpretation_low', COALESCE(la.lab_specific_interpretation_low, la.interpretation_low, a.interpretation_low),
            'interpretation_normal', COALESCE(la.lab_specific_interpretation_normal, la.interpretation_normal, a.interpretation_normal),
            'interpretation_high', COALESCE(la.lab_specific_interpretation_high, la.interpretation_high, a.interpretation_high),
            -- AI interpretation from result_values (after AI flag analysis)
            'ai_interpretation', rv.ai_interpretation,
            'ai_suggested_flag', rv.ai_suggested_flag,
            'ai_suggested_interpretation', rv.ai_suggested_interpretation
        )
    ) FILTER (WHERE rv.id IS NOT NULL) AS analytes,
    
    array_agg(DISTINCT COALESCE(la.lab_specific_name, a.name)) 
        FILTER (WHERE a.name IS NOT NULL) AS analyte_parameters,
    
    array_agg(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) AS test_group_ids

FROM orders o
LEFT JOIN patients p ON o.patient_id = p.id
LEFT JOIN locations l ON o.location_id = l.id
LEFT JOIN doctors d ON o.referring_doctor_id = d.id
LEFT JOIN users u_collector ON o.sample_collected_by = u_collector.email
LEFT JOIN order_tests ot ON o.id = ot.order_id
LEFT JOIN test_groups tg ON ot.test_group_id = tg.id
LEFT JOIN test_group_analytes tga ON tg.id = tga.test_group_id
LEFT JOIN analytes a ON tga.analyte_id = a.id
LEFT JOIN lab_analytes la ON a.id = la.analyte_id AND o.lab_id = la.lab_id
LEFT JOIN result_values rv ON rv.order_id = o.id AND rv.analyte_id = a.id

GROUP BY 
    o.id, o.order_number, o.order_date, o.status, o.total_amount,
    o.sample_collected_at, o.sample_id, o.color_code, o.color_name,
    o.qr_code_data, o.created_at, o.lab_id, o.patient_id,
    o.location_id, o.referring_doctor_id, o.approved_by,
    p.name, p.display_id, p.age, p.gender, p.phone,
    p.date_of_birth, p.registration_date,
    l.name, d.name, u_collector.name, u_collector.email;

GRANT SELECT ON public.v_report_template_context TO authenticated;

COMMENT ON VIEW public.v_report_template_context IS 'Report template context view - enriched with normal_range_min/max, critical values, value_type, interpretations, and AI fields for beautiful generic template';
