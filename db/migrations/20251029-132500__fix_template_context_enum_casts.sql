-- Migration: Adjust get_report_template_context to avoid enum cast errors
-- Purpose: Cast enum fields to text before applying COALESCE to prevent invalid input errors

CREATE OR REPLACE FUNCTION public.get_report_template_context(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  ctx_record RECORD;
  base_placeholders jsonb := '{}';
  lab_placeholders jsonb := '{}';
  analyte_placeholders jsonb := '{}';
  safe_age integer;
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
        rv.value,
        rv.unit,
        rv.reference_range,
        rv.flag,
        rv.verify_status::text AS verify_status
      FROM (
        SELECT
          rv.*,
          regexp_replace(lower(coalesce(rv.parameter, '')), '[^a-z0-9]+', '', 'g') AS trimmed_parameter
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
      'approvedAtFormatted', coalesce(to_char(ctx_record.approved_at, 'DD-MM-YYYY HH12:MI AM'), '')
    ),
    'analytes', coalesce(ctx_record.analytes, '[]'::jsonb),
    'analyteParameters', to_jsonb(coalesce(ctx_record.analyte_parameters, ARRAY[]::text[])),
    'testGroupIds', to_jsonb(coalesce(ctx_record.test_group_ids, ARRAY[]::uuid[])),
    'placeholderValues', coalesce(base_placeholders, '{}'::jsonb)
      || coalesce(lab_placeholders, '{}'::jsonb)
      || coalesce(analyte_placeholders, '{}'::jsonb)
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_template_context(uuid) TO authenticated;
