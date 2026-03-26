-- Migration: Add dynamic approver signature tracking
-- Purpose: Track who approved orders/results and fetch their signatures dynamically
-- Date: 2025-11-15

-- Step 1: Add approved_by column to orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'approved_by'
    ) THEN
        ALTER TABLE orders ADD COLUMN approved_by uuid REFERENCES users(id);
        CREATE INDEX idx_orders_approved_by ON orders(approved_by);
    END IF;
END $$;

-- Step 2: Add verified_by column to result_values table (not results)
-- Note: result_values already has verify_status column, just need verified_by for tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'result_values' AND column_name = 'verified_by'
    ) THEN
        -- Column already exists in schema, just ensure index exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'result_values' AND indexname = 'idx_result_values_verified_by'
        ) THEN
            CREATE INDEX idx_result_values_verified_by ON result_values(verified_by);
        END IF;
    END IF;
END $$;

-- Step 3: Create function to track approver
CREATE OR REPLACE FUNCTION track_order_approver()
RETURNS TRIGGER AS $$
BEGIN
    -- When order status changes to 'Completed', record who did it
    IF NEW.status = 'Completed' AND (OLD.status IS NULL OR OLD.status != 'Completed') THEN
        NEW.approved_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger for order approval tracking
DROP TRIGGER IF EXISTS set_order_approved_by ON orders;
CREATE TRIGGER set_order_approved_by
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION track_order_approver();

-- Step 5: Create function to track result value verifier
-- Note: Trigger on result_values table, not results table
CREATE OR REPLACE FUNCTION track_result_value_verifier()
RETURNS TRIGGER AS $$
BEGIN
    -- When result_values.verify_status changes to 'approved', record who did it
    IF NEW.verify_status = 'approved' AND (OLD.verify_status IS NULL OR OLD.verify_status != 'approved') THEN
        NEW.verified_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create trigger for result value verification tracking
DROP TRIGGER IF EXISTS set_result_value_verified_by ON result_values;
CREATE TRIGGER set_result_value_verified_by
    BEFORE UPDATE ON result_values
    FOR EACH ROW
    EXECUTE FUNCTION track_result_value_verifier();

-- Step 7: Update v_report_template_context view to include approved_by
-- Fixed: Use result_values directly instead of invalid results.analyte_id join
-- Using CREATE OR REPLACE to avoid dropping the view (production safety)
CREATE OR REPLACE VIEW public.v_report_template_context AS
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
    
    jsonb_agg(
        DISTINCT jsonb_build_object(
            'result_id', rv.result_id,
            'analyte_id', rv.analyte_id,
            'parameter', COALESCE(la.lab_specific_name, a.name),
            'value', rv.value,
            'unit', COALESCE(la.lab_specific_unit, a.unit),
            'reference_range', COALESCE(la.lab_specific_reference_range, a.reference_range),
            'flag', rv.flag,
            'verify_status', rv.verify_status
        )
    ) FILTER (WHERE rv.id IS NOT NULL) AS analytes,
    
    array_agg(DISTINCT COALESCE(la.lab_specific_name, a.name)) 
        FILTER (WHERE a.name IS NOT NULL) AS analyte_parameters,
    
    array_agg(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) AS test_group_ids

FROM orders o
LEFT JOIN patients p ON o.patient_id = p.id
LEFT JOIN locations l ON o.location_id = l.id
LEFT JOIN doctors d ON o.referring_doctor_id = d.id
-- sample_collected_by is text (email), match on email field
LEFT JOIN users u_collector ON o.sample_collected_by = u_collector.email
LEFT JOIN order_tests ot ON o.id = ot.order_id
LEFT JOIN test_groups tg ON ot.test_group_id = tg.id
LEFT JOIN test_group_analytes tga ON tg.id = tga.test_group_id
LEFT JOIN analytes a ON tga.analyte_id = a.id
LEFT JOIN lab_analytes la ON a.id = la.analyte_id AND o.lab_id = la.lab_id
-- Join directly to result_values using order + analyte (results table doesn't have analyte_id)
LEFT JOIN result_values rv ON rv.order_id = o.id AND rv.analyte_id = a.id

GROUP BY 
    o.id, o.order_number, o.order_date, o.status, o.total_amount,
    o.sample_collected_at, o.sample_id, o.color_code, o.color_name,
    o.qr_code_data, o.created_at, o.lab_id, o.patient_id,
    o.location_id, o.referring_doctor_id, o.approved_by,
    p.name, p.display_id, p.age, p.gender, p.phone,
    p.date_of_birth, p.registration_date,
    l.name, d.name, u_collector.name, u_collector.email;

-- Grant permissions
GRANT SELECT ON public.v_report_template_context TO authenticated;

-- Step 8: Update get_report_template_context function to fetch approver signature
CREATE OR REPLACE FUNCTION public.get_report_template_context(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  ctx_record RECORD;
  base_placeholders jsonb := '{}';
  lab_placeholders jsonb := '{}';
  analyte_placeholders jsonb := '{}';
  approver_placeholders jsonb := '{}';
  safe_age integer;
  approver_signature_url text := NULL;
  approver_name text := NULL;
  approver_role text := NULL;
BEGIN
  SELECT * INTO ctx_record
  FROM public.v_report_template_context
  WHERE order_id = p_order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  safe_age := CASE
    WHEN ctx_record.age IS NULL THEN NULL
    WHEN btrim(ctx_record.age::text) = '' THEN NULL
    WHEN btrim(ctx_record.age::text) ~ '^[0-9]+$' THEN btrim(ctx_record.age::text)::int
    ELSE NULL
  END;

  base_placeholders := jsonb_build_object(
    'patientName', coalesce(ctx_record.patient_name, ''),
    'patientDisplayId', coalesce(ctx_record.patient_display_id, ''),
    'patientId', ctx_record.patient_id::text,
    'patientAge', coalesce(safe_age, 0),
    'patientGender', coalesce((ctx_record.gender)::text, ''),
    'patientPhone', coalesce(ctx_record.patient_phone, ''),
    'patientDOB', to_char(ctx_record.date_of_birth, 'YYYY-MM-DD'),
    'patientRegistrationDate', to_char(ctx_record.registration_date, 'YYYY-MM-DD'),
    'orderId', ctx_record.order_id::text,
    'orderNumber', coalesce(ctx_record.order_number::text, ''),
    'orderDate', to_char(ctx_record.order_date, 'YYYY-MM-DD'),
    'sampleCollectedAt', to_char(ctx_record.sample_collected_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'sampleCollectedAtFormatted', coalesce(to_char(ctx_record.sample_collected_at, 'DD-MM-YYYY HH12:MI AM'), ''),
    'sampleCollectedBy', coalesce(ctx_record.sample_collected_by, ''),
    'sampleId', coalesce(ctx_record.sample_id, ''),
    'locationId', coalesce(ctx_record.location_id::text, ''),
    'locationName', coalesce(ctx_record.location_name, ''),
    'referringDoctorId', coalesce(ctx_record.referring_doctor_id::text, ''),
    'referringDoctorName', coalesce(ctx_record.referring_doctor_name, ''),
    'approvedAt', to_char(ctx_record.approved_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'approvedAtFormatted', coalesce(to_char(ctx_record.approved_at, 'DD-MM-YYYY HH12:MI AM'), '')
  );

  SELECT jsonb_build_object(
    'labId', lab.id::text,
    'labName', coalesce(lab.name, ''),
    'labEmail', coalesce(lab.email, ''),
    'labPhone', coalesce(lab.phone, ''),
    'labAddress', coalesce(lab.address, ''),
    'labRegistrationNumber', coalesce(lab.registration_number, '')
  ) INTO lab_placeholders
  FROM public.labs lab
  WHERE lab.id = ctx_record.lab_id;

  -- Fetch approver signature and details
  IF ctx_record.approved_by IS NOT NULL THEN
    SELECT 
      COALESCE(lus.imagekit_url, lus.processed_signature_url, lus.signature_url),
      COALESCE(u.name, u.email),
      u.role
    INTO approver_signature_url, approver_name, approver_role
    FROM users u
    LEFT JOIN lab_user_signatures lus ON lus.user_id = u.id 
      AND lus.lab_id = ctx_record.lab_id 
      AND lus.is_default = true
    WHERE u.id = ctx_record.approved_by
    LIMIT 1;
  END IF;

  -- Build approver placeholders
  approver_placeholders := jsonb_build_object(
    'approverSignature', COALESCE(approver_signature_url, ''),
    'approverSignatureUrl', COALESCE(approver_signature_url, ''),
    'approvedBySignature', COALESCE(approver_signature_url, ''),
    'approvedByName', COALESCE(approver_name, ''),
    'approverName', COALESCE(approver_name, ''),
    'approverRole', COALESCE(approver_role, '')
  );

  SELECT coalesce(jsonb_object_agg(entry.placeholder_key, entry.placeholder_value), '{}'::jsonb)
  INTO analyte_placeholders
  FROM (
    WITH normalized AS (
      SELECT
        CASE
          WHEN trimmed_parameter IS NULL OR trimmed_parameter = '' THEN NULL
          WHEN trimmed_parameter ~ '^[0-9]' THEN 'n' || trimmed_parameter
          ELSE trimmed_parameter
        END AS slug,
        CASE
          WHEN alias_raw IS NULL OR alias_raw = '' THEN NULL
          WHEN alias_raw ~ '^[0-9]' THEN 'N' || alias_raw
          ELSE alias_raw
        END AS alias_key,
        rv.value,
        rv.unit,
        rv.reference_range,
        rv.flag,
        rv.verify_status::text AS verify_status,
        rv.parameter AS original_parameter
      FROM (
        SELECT
          rv.*,
          regexp_replace(lower(coalesce(rv.parameter, '')), '[^a-z0-9]+', '', 'g') AS trimmed_parameter,
          regexp_replace(coalesce(rv.parameter, ''), '[^A-Za-z0-9]+', '', 'g') AS alias_raw
        FROM public.result_values rv
        WHERE rv.order_id = ctx_record.order_id
      ) AS rv
    )
    SELECT slug AS placeholder_key, coalesce(value, '') AS placeholder_value
    FROM normalized
    WHERE slug IS NOT NULL AND value IS NOT NULL
    UNION ALL
    SELECT slug || '_unit', coalesce(unit, '')
    FROM normalized
    WHERE slug IS NOT NULL AND unit IS NOT NULL
    UNION ALL
    SELECT slug || '_reference', coalesce(reference_range, '')
    FROM normalized
    WHERE slug IS NOT NULL AND reference_range IS NOT NULL
    UNION ALL
    SELECT slug || '_flag', coalesce(flag, '')
    FROM normalized
    WHERE slug IS NOT NULL AND flag IS NOT NULL
    UNION ALL
    SELECT slug || '_status', coalesce(verify_status, '')
    FROM normalized
    WHERE slug IS NOT NULL AND verify_status IS NOT NULL
    UNION ALL
    SELECT alias_key, coalesce(value, '')
    FROM normalized
    WHERE alias_key IS NOT NULL AND (slug IS NULL OR alias_key <> slug) AND value IS NOT NULL
    UNION ALL
    SELECT alias_key || '_unit', coalesce(unit, '')
    FROM normalized
    WHERE alias_key IS NOT NULL AND (slug IS NULL OR alias_key <> slug) AND unit IS NOT NULL
    UNION ALL
    SELECT alias_key || '_reference', coalesce(reference_range, '')
    FROM normalized
    WHERE alias_key IS NOT NULL AND (slug IS NULL OR alias_key <> slug) AND reference_range IS NOT NULL
    UNION ALL
    SELECT alias_key || '_flag', coalesce(flag, '')
    FROM normalized
    WHERE alias_key IS NOT NULL AND (slug IS NULL OR alias_key <> slug) AND flag IS NOT NULL
    UNION ALL
    SELECT alias_key || '_status', coalesce(verify_status, '')
    FROM normalized
    WHERE alias_key IS NOT NULL AND (slug IS NULL OR alias_key <> slug) AND verify_status IS NOT NULL
  ) AS entry;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'orderId', ctx_record.order_id::text,
    'patientId', ctx_record.patient_id::text,
    'labId', ctx_record.lab_id::text,
    'meta', jsonb_build_object(
      'orderNumber', coalesce(ctx_record.order_number::text, ''),
      'orderDate', to_char(ctx_record.order_date, 'YYYY-MM-DD'),
      'status', coalesce((ctx_record.status)::text, ''),
      'totalAmount', ctx_record.total_amount,
      'createdAt', to_char(ctx_record.order_created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'createdAtFormatted', coalesce(to_char(ctx_record.order_created_at, 'DD-MM-YYYY HH12:MI AM'), ''),
      'allAnalytesApproved', ctx_record.all_analytes_approved
    ),
    'patient', jsonb_build_object(
      'name', coalesce(ctx_record.patient_name, ''),
      'displayId', coalesce(ctx_record.patient_display_id, ''),
      'age', safe_age,
      'gender', coalesce((ctx_record.gender)::text, ''),
      'phone', coalesce(ctx_record.patient_phone, ''),
      'dateOfBirth', to_char(ctx_record.date_of_birth, 'YYYY-MM-DD'),
      'registrationDate', to_char(ctx_record.registration_date, 'YYYY-MM-DD')
    ),
    'order', jsonb_build_object(
      'sampleCollectedAt', to_char(ctx_record.sample_collected_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'sampleCollectedAtFormatted', coalesce(to_char(ctx_record.sample_collected_at, 'DD-MM-YYYY HH12:MI AM'), ''),
      'sampleCollectedBy', coalesce(ctx_record.sample_collected_by, ''),
      'sampleId', coalesce(ctx_record.sample_id, ''),
      'locationId', coalesce(ctx_record.location_id::text, ''),
      'locationName', coalesce(ctx_record.location_name, ''),
      'referringDoctorId', coalesce(ctx_record.referring_doctor_id::text, ''),
      'referringDoctorName', coalesce(ctx_record.referring_doctor_name, ''),
      'approvedAt', to_char(ctx_record.approved_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'approvedAtFormatted', coalesce(to_char(ctx_record.approved_at, 'DD-MM-YYYY HH12:MI AM'), ''),
      'approvedBy', coalesce(ctx_record.approved_by::text, ''),
      'approvedByName', COALESCE(approver_name, ''),
      'approverSignature', COALESCE(approver_signature_url, '')
    ),
    'analytes', coalesce(ctx_record.analytes, '[]'::jsonb),
    'analyteParameters', to_jsonb(coalesce(ctx_record.analyte_parameters, ARRAY[]::text[])),
    'testGroupIds', to_jsonb(coalesce(ctx_record.test_group_ids, ARRAY[]::uuid[])),
    'placeholderValues', coalesce(base_placeholders, '{}'::jsonb)
      || coalesce(lab_placeholders, '{}'::jsonb)
      || coalesce(analyte_placeholders, '{}'::jsonb)
      || coalesce(approver_placeholders, '{}'::jsonb)
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_template_context(uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN orders.approved_by IS 'User ID who approved/completed the order';
COMMENT ON COLUMN results.verified_by IS 'User ID who verified/approved the result';
COMMENT ON FUNCTION track_order_approver() IS 'Automatically tracks which user approved an order';
COMMENT ON FUNCTION track_result_verifier() IS 'Automatically tracks which user verified a result';
