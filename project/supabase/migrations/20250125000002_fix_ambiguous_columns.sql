-- MIGRATION: Use patients.age directly (no DOB math) + keep simple changes
-- Safe to run multiple times

BEGIN;

-- Drop existing views first (handles dependencies)
DROP VIEW IF EXISTS verification_queue CASCADE;
DROP VIEW IF EXISTS view_results_pending CASCADE;

-- Recreate: view_results_pending (uses p.age)
CREATE OR REPLACE VIEW view_results_pending AS
SELECT 
    r.id                                 AS result_id,
    r.order_id,
    r.patient_id,
    r.patient_name,
    r.test_name,
    r.status                             AS result_status,
    r.verification_status,
    r.entered_by,
    r.entered_date                       AS entered_at,
    r.technician_notes,
    r.delta_check_flag,
    r.critical_flag,
    r.priority_level,

    o.id                                 AS order_number,
    o.sample_id,
    o.status                             AS order_status,
    o.priority,
    o.order_date                         AS ordered_date,
    o.doctor                             AS physician_name,

    p.id                                 AS patient_id_ref,
    p.name                               AS patient_full_name,
    p.age                                AS age,          -- << use stored age
    p.gender,
    p.external_patient_id                AS patient_code,

    -- Hours since entry
    EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0   AS hours_since_entry,

    -- Result values (flattened)
    rv.value,
    rv.unit,
    rv.reference_range,
    rv.flag,
    a.name                               AS analyte_name,
    a.category                           AS department,

    -- Urgency bucket
    CASE 
        WHEN r.critical_flag         THEN 'urgent'
        WHEN o.priority = 'STAT'     THEN 'urgent'
        WHEN r.priority_level >= 4   THEN 'urgent'
        WHEN r.priority_level = 3    THEN 'high' 
        WHEN r.priority_level = 2    THEN 'medium'
        ELSE 'normal'
    END AS urgency_level,

    -- Total days pending
    EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0  AS days_pending
FROM results r
JOIN orders   o ON r.order_id = o.id
JOIN patients p ON r.patient_id = p.id
LEFT JOIN result_values rv ON rv.result_id = r.id
LEFT JOIN analytes a       ON rv.analyte_id = a.id
WHERE (r.verification_status IN ('pending_verification', 'needs_clarification')
       OR r.verification_status IS NULL)
ORDER BY 
    CASE WHEN o.priority = 'STAT' THEN 1 ELSE 2 END,
    CASE WHEN r.critical_flag     THEN 1 ELSE 2 END,
    r.priority_level DESC,
    r.created_at ASC;

-- Recreate: verification_queue (uses p.age)
CREATE OR REPLACE VIEW verification_queue AS
SELECT DISTINCT
    r.id            AS result_id,
    r.order_id,
    r.patient_id,
    r.patient_name,
    r.test_name,
    r.verification_status,
    r.entered_by,
    r.entered_date,
    r.technician_notes,
    r.delta_check_flag,
    r.critical_flag,
    r.priority_level,

    o.sample_id,
    o.priority      AS order_priority,
    o.order_date,
    o.doctor        AS physician_name,

    p.name          AS full_patient_name,
    p.gender,
    p.external_patient_id AS patient_code,
    p.age           AS age,  -- << use stored age

    EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600.0 AS hours_since_entry
FROM results r
JOIN orders   o ON o.id = r.order_id
JOIN patients p ON p.id = r.patient_id
WHERE r.verification_status IN ('pending_verification', 'needs_clarification')
   OR r.verification_status IS NULL;

-- Permissions for app role
GRANT SELECT ON verification_queue   TO authenticated;
GRANT SELECT ON view_results_pending TO authenticated;

-- Helpful index for queue performance
CREATE INDEX IF NOT EXISTS idx_results_verification_composite 
ON results(verification_status, created_at) 
WHERE verification_status IN ('pending_verification', 'needs_clarification');

-- (Unchanged) Helper: fetch analyte values for a result (kept for UI simplicity)
CREATE OR REPLACE FUNCTION get_result_values(p_result_id UUID)
RETURNS TABLE (
    value TEXT,
    unit TEXT,
    reference_range TEXT,
    flag TEXT,
    analyte_name TEXT,
    department TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rv.value,
        rv.unit,
        rv.reference_range,
        rv.flag,
        a.name,
        a.category
    FROM result_values rv
    LEFT JOIN analytes a ON a.id = rv.analyte_id
    WHERE rv.result_id = p_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_result_values(UUID) TO authenticated;

COMMIT;
