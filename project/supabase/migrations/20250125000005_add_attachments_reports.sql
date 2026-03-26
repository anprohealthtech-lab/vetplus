-- Optimized Results Verification Workflow - Only add missing pieces

BEGIN;

-- 1. Check and add only missing columns to results table
DO $$ 
BEGIN
    -- verification_status already exists from previous migration
    -- verified_by already exists from previous migration  
    -- verified_at already exists from previous migration
    -- review_comment already exists from previous migration
    
    -- Only add columns that don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'results' 
                   AND column_name = 'technician_notes') THEN
        ALTER TABLE results ADD COLUMN technician_notes TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'results' 
                   AND column_name = 'delta_check_flag') THEN
        ALTER TABLE results ADD COLUMN delta_check_flag BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'results' 
                   AND column_name = 'critical_flag') THEN
        ALTER TABLE results ADD COLUMN critical_flag BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'results' 
                   AND column_name = 'priority_level') THEN
        ALTER TABLE results ADD COLUMN priority_level INTEGER DEFAULT 1 
            CHECK (priority_level BETWEEN 1 AND 5);
    END IF;
END $$;

-- 2. Create verification notes table only if it doesn't exist
CREATE TABLE IF NOT EXISTS result_verification_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    result_id UUID REFERENCES results(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create verification audit table only if it doesn't exist
CREATE TABLE IF NOT EXISTS result_verification_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    result_id UUID REFERENCES results(id),
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    comment TEXT,
    metadata JSONB
);

-- 4. Create indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_results_verification_status 
    ON results(verification_status);
CREATE INDEX IF NOT EXISTS idx_results_critical_flag 
    ON results(critical_flag) WHERE critical_flag = true;
CREATE INDEX IF NOT EXISTS idx_result_verification_audit_result_id 
    ON result_verification_audit(result_id);

-- 5. Create simplified view for approved results (for Reports module)
CREATE OR REPLACE VIEW view_approved_results AS
SELECT 
    r.id as result_id,
    r.order_id,
    r.patient_id,
    r.patient_name,
    r.test_name,
    r.status,
    r.verification_status,
    r.verified_by,
    r.verified_at,
    r.review_comment,
    r.entered_by,
    r.entered_date,
    r.reviewed_by,
    r.reviewed_date,
    o.sample_id,
    o.order_date,
    o.doctor,
    p.name as patient_full_name,
    p.age,
    p.gender,
    p.phone,
    -- Include attachment info for viewing uploaded documents
    r.attachment_id,
    a.file_url as attachment_url,
    a.file_type as attachment_type,
    a.original_filename as attachment_name
FROM results r
LEFT JOIN orders o ON r.order_id = o.id
LEFT JOIN patients p ON r.patient_id = p.id
LEFT JOIN attachments a ON r.attachment_id = a.id
WHERE r.verification_status = 'verified'
ORDER BY r.verified_at DESC;

-- 6. Create or replace the verify_result function (simplified version)
CREATE OR REPLACE FUNCTION verify_result(
    p_result_id UUID,
    p_action VARCHAR,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_status VARCHAR;
    v_new_status VARCHAR;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid()::uuid;
    
    -- Get current status
    SELECT verification_status INTO v_current_status
    FROM results WHERE id = p_result_id;
    
    -- Determine new status
    CASE p_action
        WHEN 'approve' THEN v_new_status := 'verified';
        WHEN 'clarify' THEN v_new_status := 'needs_clarification';
        WHEN 'reject' THEN v_new_status := 'rejected';
        ELSE RAISE EXCEPTION 'Invalid action: %', p_action;
    END CASE;
    
    -- Update result
    UPDATE results
    SET 
        verification_status = v_new_status,
        verified_by = CASE WHEN v_new_status = 'verified' THEN v_user_id ELSE verified_by END,
        verified_at = CASE WHEN v_new_status = 'verified' THEN NOW() ELSE verified_at END,
        review_comment = p_comment,
        status = CASE WHEN v_new_status = 'verified' THEN 'Reviewed' ELSE status END
    WHERE id = p_result_id;
    
    -- Create audit entry
    INSERT INTO result_verification_audit (
        result_id, action, performed_by,
        previous_status, new_status, comment
    ) VALUES (
        p_result_id, p_action, v_user_id,
        v_current_status, v_new_status, p_comment
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'new_status', v_new_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6a. Create bulk verify function for efficiency
CREATE OR REPLACE FUNCTION bulk_verify_results(
    p_result_ids UUID[],
    p_action VARCHAR,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_new_status VARCHAR;
    v_user_id UUID;
    v_updated_count INTEGER := 0;
BEGIN
    v_user_id := auth.uid()::uuid;
    
    -- Determine new status
    CASE p_action
        WHEN 'approve' THEN v_new_status := 'verified';
        WHEN 'clarify' THEN v_new_status := 'needs_clarification';
        WHEN 'reject' THEN v_new_status := 'rejected';
        ELSE RAISE EXCEPTION 'Invalid action: %', p_action;
    END CASE;
    
    -- Update all results
    UPDATE results
    SET 
        verification_status = v_new_status,
        verified_by = CASE WHEN v_new_status = 'verified' THEN v_user_id ELSE verified_by END,
        verified_at = CASE WHEN v_new_status = 'verified' THEN NOW() ELSE verified_at END,
        review_comment = p_comment,
        status = CASE WHEN v_new_status = 'verified' THEN 'Reviewed' ELSE status END
    WHERE id = ANY(p_result_ids);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Create audit entries for all results
    INSERT INTO result_verification_audit (
        result_id, action, performed_by,
        previous_status, new_status, comment
    )
    SELECT 
        id, p_action, v_user_id,
        'pending_verification', v_new_status, p_comment
    FROM unnest(p_result_ids) as id;
    
    RETURN jsonb_build_object(
        'success', true,
        'new_status', v_new_status,
        'updated_count', v_updated_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Grant permissions
GRANT SELECT ON view_approved_results TO authenticated;
GRANT EXECUTE ON FUNCTION verify_result TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_verify_results TO authenticated;

-- 8. Enable RLS on new tables
ALTER TABLE result_verification_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_verification_audit ENABLE ROW LEVEL SECURITY;

-- 9. Create simple RLS policies
CREATE POLICY "Users can read verification notes" 
    ON result_verification_notes FOR SELECT 
    USING (true);

CREATE POLICY "Users can create verification notes" 
    ON result_verification_notes FOR INSERT 
    WITH CHECK (auth.uid()::uuid = author_id);

CREATE POLICY "Users can read verification audit" 
    ON result_verification_audit FOR SELECT 
    USING (true);

COMMIT;