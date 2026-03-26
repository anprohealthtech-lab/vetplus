-- Migration: Add phlebotomist flag to users and sample collector tracking
-- Date: 2025-11-16
-- Purpose: Track which users can collect samples (phlebotomists)
-- Note: No separate role needed - receptionist can also be phlebotomist

-- Step 1: Add is_phlebotomist flag to users table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_phlebotomist'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN is_phlebotomist boolean DEFAULT false;
        
        CREATE INDEX idx_users_is_phlebotomist ON users(is_phlebotomist) WHERE is_phlebotomist = true;
    END IF;
END $$;

-- Step 2: Drop view temporarily to avoid deadlock when altering orders table
DROP VIEW IF EXISTS public.v_report_template_context;

-- Step 3: Add sample_collector_id column to orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'sample_collector_id'
    ) THEN
        ALTER TABLE orders 
        ADD COLUMN sample_collector_id uuid REFERENCES users(id);
        
        CREATE INDEX idx_orders_sample_collector_id ON orders(sample_collector_id);
    END IF;
END $$;

-- Step 4: Create trigger to auto-populate sample_collector_id when sample is collected
CREATE OR REPLACE FUNCTION track_sample_collector()
RETURNS TRIGGER AS $$
BEGIN
    -- When sample_collected_at is set and sample_collector_id is not yet set
    IF NEW.sample_collected_at IS NOT NULL 
       AND (OLD.sample_collected_at IS NULL OR OLD.sample_collected_at IS DISTINCT FROM NEW.sample_collected_at)
       AND NEW.sample_collector_id IS NULL THEN
        NEW.sample_collector_id = auth.uid();
        
        -- Also update the sample_collected_by text field with user's name/email
        IF auth.uid() IS NOT NULL THEN
            SELECT COALESCE(name, email) INTO NEW.sample_collected_by
            FROM users WHERE id = auth.uid();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger
DROP TRIGGER IF EXISTS set_sample_collector ON orders;
CREATE TRIGGER set_sample_collector
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION track_sample_collector();

-- Step 6: Recreate v_report_template_context view with all existing columns plus new sample_collector_id
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
    
    -- Keep original calculation to avoid type conflicts
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
    
    array_agg(DISTINCT tg.id) FILTER (WHERE tg.id IS NOT NULL) AS test_group_ids,
    
    -- NEW COLUMN ADDED AT THE END
    o.sample_collector_id

FROM orders o
LEFT JOIN patients p ON o.patient_id = p.id
LEFT JOIN locations l ON o.location_id = l.id
LEFT JOIN doctors d ON o.referring_doctor_id = d.id
-- Join using sample_collector_id (UUID) first, fallback to email match
LEFT JOIN users u_collector ON o.sample_collector_id = u_collector.id 
    OR (o.sample_collector_id IS NULL AND o.sample_collected_by = u_collector.email)
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
    l.name, d.name, u_collector.name, u_collector.email, o.sample_collected_by, o.sample_collector_id;
