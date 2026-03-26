-- Create a consolidated view for report generation
-- This view aggregates all necessary data (Patient, Doctor, Lab, Branding, Results) into a single JSON object per order
-- This allows the PDF generation function to make a single DB call instead of multiple queries.
-- Updated to include Lab Templates (GrapesJS HTML/CSS) for each test group.

CREATE OR REPLACE VIEW public.view_report_final_context AS
SELECT
  o.id AS order_id,
  o.lab_id,
  
  -- Patient Object
  jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'age', p.age,
    'gender', p.gender,
    'phone', p.phone,
    'display_id', p.display_id,
    'sex_age', CONCAT(p.age, ' / ', p.gender),
    'collected_at', o.sample_collected_at,
    'reported_at', o.report_auto_generated_at,
    'ref_doctor', doc.name
  ) AS patient,
  
  -- Doctor Object
  jsonb_build_object(
    'id', doc.id,
    'name', doc.name,
    'specialization', doc.specialization,
    'registration_number', doc.registration_number,
    'phone', doc.phone,
    'email', doc.email
  ) AS doctor,
  
  -- Lab Object with Context-Aware Branding
  jsonb_build_object(
    'id', l.id,
    'name', l.name,
    'address', l.address,
    'email', l.email,
    'phone', l.phone,
    'city', l.city,
    'state', l.state,
    'pincode', l.pincode,
    
    -- Context-Aware Header Selection
    'header_url', (
        SELECT file_url FROM lab_branding_assets lba 
        WHERE lba.lab_id = l.id 
        AND lba.asset_type = 'header' 
        AND lba.is_active = true 
        AND (
            (o.account_id IS NOT NULL AND lba.usage_context @> ARRAY['b2b']) OR 
            (lba.usage_context @> ARRAY[o.location_id::text]) OR 
            lba.is_default = true
        )
        ORDER BY 
            CASE WHEN o.account_id IS NOT NULL AND lba.usage_context @> ARRAY['b2b'] THEN 1 ELSE 2 END,
            CASE WHEN lba.usage_context @> ARRAY[o.location_id::text] THEN 1 ELSE 2 END,
            CASE WHEN lba.is_default THEN 1 ELSE 2 END,
            lba.created_at DESC
        LIMIT 1
    ),
    
    -- Context-Aware Footer Selection
    'footer_url', (
        SELECT file_url FROM lab_branding_assets lba 
        WHERE lba.lab_id = l.id 
        AND lba.asset_type = 'footer' 
        AND lba.is_active = true 
        AND (
            (o.account_id IS NOT NULL AND lba.usage_context @> ARRAY['b2b']) OR 
            (lba.usage_context @> ARRAY[o.location_id::text]) OR 
            lba.is_default = true
        )
        ORDER BY 
            CASE WHEN o.account_id IS NOT NULL AND lba.usage_context @> ARRAY['b2b'] THEN 1 ELSE 2 END,
            CASE WHEN lba.usage_context @> ARRAY[o.location_id::text] THEN 1 ELSE 2 END,
            CASE WHEN lba.is_default THEN 1 ELSE 2 END,
            lba.created_at DESC
        LIMIT 1
    ),
    
    'logo_url', (SELECT lba.file_url FROM lab_branding_assets lba WHERE lba.lab_id = l.id AND lba.asset_type = 'logo' AND lba.is_active = true ORDER BY lba.is_default DESC, lba.created_at DESC LIMIT 1),
    'watermark_url', (SELECT lba.file_url FROM lab_branding_assets lba WHERE lba.lab_id = l.id AND lba.asset_type = 'watermark' AND lba.is_active = true ORDER BY lba.is_default DESC, lba.created_at DESC LIMIT 1),
    
    -- Signatory
    'signature_url', (
        COALESCE(
            (SELECT lus.file_url FROM lab_user_signatures lus WHERE lus.user_id = o.approved_by AND lus.is_active = true LIMIT 1),
            (SELECT lus.file_url FROM lab_user_signatures lus JOIN users u ON u.id = lus.user_id WHERE u.name = l.default_signatory_name AND lus.lab_id = l.id AND lus.is_active = true LIMIT 1)
        )
    ),
    'signatory_name', (
        COALESCE(
            (SELECT u.name FROM users u WHERE u.id = o.approved_by),
            l.default_signatory_name
        )
    ),
    'signatory_designation', (
        COALESCE(
             (SELECT u.role::text FROM users u WHERE u.id = o.approved_by),
             l.default_signatory_designation
        )
    )
  ) AS lab,
  
  -- Results (Nested Structure: Test Group -> Results)
  -- NOW INCLUDES TEMPLATE HTML/CSS
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'group_id', tg.id,
        'group_name', tg.name,
        'department', tg.department,
         -- Fetch the HTML/CSS template for this specific Test Group
        'template', (
             SELECT jsonb_build_object(
                 'html', lt.gjs_html,
                 'css', lt.gjs_css
             )
             FROM lab_templates lt
             WHERE lt.test_group_id = tg.id 
             AND lt.lab_id = l.id
             AND lt.is_active = true
             ORDER BY lt.is_default DESC, lt.created_at DESC
             LIMIT 1
        ),
        'test_results', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'parameter', rv.parameter,
                    'value', rv.value,
                    'unit', rv.unit,
                    'range', rv.reference_range,
                    'flag', rv.flag,
                    'notes', rv.verify_note,
                    'method', (SELECT method FROM lab_analytes la WHERE la.analyte_id = rv.analyte_id AND la.lab_id = o.lab_id LIMIT 1),
                    'extras', r.report_extras 
                ) ORDER BY rv.id 
            )
            FROM result_values rv
            WHERE rv.result_id = r.id
        )
      )
    )
    FROM results r
    JOIN test_groups tg ON r.test_group_id = tg.id
    WHERE r.order_id = o.id
  ) AS test_results,

  -- Flat list
  (
    SELECT jsonb_agg(
        jsonb_build_object(
            'parameter', rv.parameter,
            'value', rv.value,
            'unit', rv.unit,
            'range', rv.reference_range,
            'flag', rv.flag,
            'group_name', tg.name,
            'extras', r2.report_extras
        ) ORDER BY rv.id
    )
    FROM result_values rv
    JOIN results r2 ON rv.result_id = r2.id
    JOIN test_groups tg ON r2.test_group_id = tg.id
    WHERE r2.order_id = o.id
  ) AS all_results_flat
  
FROM orders o
JOIN patients p ON o.patient_id = p.id
LEFT JOIN doctors doc ON o.referring_doctor_id = doc.id
JOIN labs l ON o.lab_id = l.id;
