-- Add unique constraints to prevent duplicate entries

BEGIN;

-- 1. First, add order_id column to reports table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reports' 
                   AND column_name = 'order_id') THEN
        ALTER TABLE reports ADD COLUMN order_id UUID;
        
        -- Update order_id based on result_id relationships
        UPDATE reports 
        SET order_id = r.order_id 
        FROM results r 
        WHERE reports.result_id = r.id 
        AND reports.order_id IS NULL;
        
        -- Add foreign key constraint
        ALTER TABLE reports 
        ADD CONSTRAINT reports_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES orders(id);
    END IF;
    
    -- Add PDF-related columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reports' 
                   AND column_name = 'pdf_url') THEN
        ALTER TABLE reports ADD COLUMN pdf_url TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reports' 
                   AND column_name = 'pdf_generated_at') THEN
        ALTER TABLE reports ADD COLUMN pdf_generated_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Update status column to be more descriptive if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'reports' 
               AND column_name = 'status') THEN
        -- Update existing records to have consistent status
        UPDATE reports SET status = 'pending' WHERE status IS NULL OR status = '';
    END IF;
END $$;

-- 2. Remove duplicate entries from results table
-- Keep only the most recent entry for each (order_id, test_name) combination
-- Handle foreign key constraints by cleaning up related records first

-- Identify duplicate result IDs that will be deleted
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY order_id, test_name 
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) as rn
    FROM results
),
duplicate_ids AS (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
)
-- Delete related audit records first
DELETE FROM result_verification_audit 
WHERE result_id IN (SELECT id FROM duplicate_ids);

-- Delete related result_values records
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY order_id, test_name 
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) as rn
    FROM results
),
duplicate_ids AS (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
)
DELETE FROM result_values 
WHERE result_id IN (SELECT id FROM duplicate_ids);

-- Now delete the duplicate results
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY order_id, test_name 
               ORDER BY updated_at DESC, created_at DESC, id DESC
           ) as rn
    FROM results
)
DELETE FROM results 
WHERE id IN (
    SELECT id 
    FROM duplicates 
    WHERE rn > 1
);

-- 3. Remove duplicate entries from reports table
-- Keep only the most recent entry for each order_id
WITH report_duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY order_id 
               ORDER BY generated_date DESC, created_at DESC, id DESC
           ) as rn
    FROM reports
    WHERE order_id IS NOT NULL
)
DELETE FROM reports 
WHERE id IN (
    SELECT id 
    FROM report_duplicates 
    WHERE rn > 1
);

-- 4. Add unique constraint for results to prevent duplicate entries
-- Each order should have only one result entry per test
ALTER TABLE results 
ADD CONSTRAINT unique_order_test_result 
UNIQUE (order_id, test_name);

-- 5. Add unique constraint for reports table
-- Each order should have only one report
ALTER TABLE reports 
ADD CONSTRAINT unique_order_report 
UNIQUE (order_id);

-- 6. Create function to handle result entry with conflict resolution
CREATE OR REPLACE FUNCTION insert_or_update_result(
    p_order_id UUID,
    p_test_name VARCHAR(255),
    p_patient_id UUID,
    p_patient_name VARCHAR(255),
    p_entered_by VARCHAR(255),
    p_value VARCHAR(255) DEFAULT NULL,
    p_unit VARCHAR(255) DEFAULT NULL,
    p_reference_range VARCHAR(255) DEFAULT NULL,
    p_flag VARCHAR(255) DEFAULT NULL,
    p_attachment_id UUID DEFAULT NULL,
    p_technician_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_result_id UUID;
BEGIN
    -- Try to insert, on conflict update
    INSERT INTO results (
        order_id, test_name, patient_id, patient_name, 
        entered_by, entered_date, value, unit, 
        reference_range, flag, attachment_id, technician_notes,
        status, verification_status
    ) VALUES (
        p_order_id, p_test_name, p_patient_id, p_patient_name,
        p_entered_by, CURRENT_DATE, p_value, p_unit,
        p_reference_range, p_flag, p_attachment_id, p_technician_notes,
        'Entered', 'pending_verification'
    )
    ON CONFLICT (order_id, test_name) 
    DO UPDATE SET
        value = EXCLUDED.value,
        unit = EXCLUDED.unit,
        reference_range = EXCLUDED.reference_range,
        flag = EXCLUDED.flag,
        attachment_id = COALESCE(EXCLUDED.attachment_id, results.attachment_id),
        technician_notes = COALESCE(EXCLUDED.technician_notes, results.technician_notes),
        entered_date = CURRENT_DATE,
        entered_by = EXCLUDED.entered_by,
        updated_at = NOW(),
        -- Reset verification if result is updated
        verification_status = 'pending_verification',
        verified_by = NULL,
        verified_at = NULL
    RETURNING id INTO v_result_id;
    
    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT EXECUTE ON FUNCTION insert_or_update_result TO authenticated;

-- 8. Create reports storage bucket if it doesn't exist
DO $$
BEGIN
    -- Insert bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('reports', 'reports', true)
    ON CONFLICT (id) DO NOTHING;
    
    -- Set up storage policies for reports bucket
    -- Allow authenticated users to upload reports
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Allow authenticated users to upload reports'
    ) THEN
        CREATE POLICY "Allow authenticated users to upload reports"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'reports');
    END IF;
    
    -- Allow public access to view reports
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Allow public access to view reports'
    ) THEN
        CREATE POLICY "Allow public access to view reports"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'reports');
    END IF;
    
    -- Allow authenticated users to update reports
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Allow authenticated users to update reports'
    ) THEN
        CREATE POLICY "Allow authenticated users to update reports"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'reports');
    END IF;
END $$;

COMMIT;
