-- Results Verification Workflow Migration (Aligned with existing schema)
-- This migration adds verification status tracking and audit capabilities to existing 'results' table

-- Add verification columns to the existing 'results' table (not test_results)
ALTER TABLE results 
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'pending_verification' 
    CHECK (verification_status IN ('pending_verification', 'needs_clarification', 'verified', 'rejected')),
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS review_comment TEXT,
ADD COLUMN IF NOT EXISTS technician_notes TEXT,
ADD COLUMN IF NOT EXISTS delta_check_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS critical_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1 CHECK (priority_level BETWEEN 1 AND 5);

-- Create verification notes table (for discussion threads)
CREATE TABLE IF NOT EXISTS result_verification_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    result_id UUID REFERENCES results(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id),
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unified verification audit table
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

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_result_verification_audit_result_id ON result_verification_audit(result_id);
CREATE INDEX IF NOT EXISTS idx_result_verification_audit_performed_at ON result_verification_audit(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_results_verification_status ON results(verification_status);
CREATE INDEX IF NOT EXISTS idx_results_priority_level ON results(priority_level DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_result_verification_notes_result_id ON result_verification_notes(result_id);

-- Create view for pending results queue (aligned with existing schema)
CREATE OR REPLACE VIEW view_results_pending AS
SELECT 
    r.id as result_id,
    r.order_id,
    r.patient_id,
    r.patient_name,
    r.test_name,
    r.status as result_status,
    r.verification_status,
    r.entered_by,
    r.entered_date as entered_at,
    r.technician_notes,
    r.delta_check_flag,
    r.critical_flag,
    r.priority_level,
    o.id as order_number,
    o.sample_id,
    o.status as order_status,
    o.priority,
    o.order_date as ordered_date,
    o.doctor as physician_name,
    p.id as patient_id_ref,
    p.name as patient_full_name,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(p.date_of_birth, p.registration_date))) as age,
    p.gender,
    COALESCE(p.external_patient_id, p.id::text) as patient_code,
    -- Calculate hours since entry
    EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 as hours_since_entry,
    -- Join with result_values to get actual test values
    COALESCE(rv.value, r.value, 'N/A') as value,
    COALESCE(rv.unit, r.unit, '') as unit,
    COALESCE(rv.reference_range, r.reference_range, '') as reference_range,
    COALESCE(rv.flag, r.flag, '') as flag,
    COALESCE(a.name, r.test_name) as analyte_name,
    COALESCE(a.category, 'General') as department,
    -- Calculate urgency score based on priority and flags
    CASE 
        WHEN COALESCE(r.critical_flag, false) THEN 'urgent'
        WHEN o.priority = 'STAT' THEN 'urgent'
        WHEN COALESCE(r.priority_level, 1) >= 4 THEN 'urgent'
        WHEN COALESCE(r.priority_level, 1) = 3 THEN 'high' 
        WHEN COALESCE(r.priority_level, 1) = 2 THEN 'medium'
        ELSE 'normal'
    END as urgency_level,
    -- Days pending
    EXTRACT(DAYS FROM NOW() - r.created_at) as days_pending
FROM results r
LEFT JOIN orders o ON r.order_id = o.id
LEFT JOIN patients p ON COALESCE(r.patient_id, o.patient_id) = p.id
LEFT JOIN result_values rv ON rv.result_id = r.id
LEFT JOIN analytes a ON rv.analyte_id = a.id
WHERE COALESCE(r.verification_status, 'pending_verification') IN ('pending_verification', 'needs_clarification')
ORDER BY 
    CASE WHEN COALESCE(o.priority, 'ROUTINE') = 'STAT' THEN 1 ELSE 2 END,
    CASE WHEN COALESCE(r.critical_flag, false) THEN 1 ELSE 2 END,
    COALESCE(r.priority_level, 1) DESC,
    r.created_at ASC;

-- Create view for verification statistics
CREATE OR REPLACE VIEW view_verification_stats AS
SELECT 
    COUNT(*) FILTER (WHERE verification_status = 'pending_verification') as pending_count,
    COUNT(*) FILTER (WHERE verification_status = 'verified') as approved_count,
    COUNT(*) FILTER (WHERE verification_status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE verification_status = 'needs_clarification') as clarification_count,
    COUNT(*) FILTER (WHERE critical_flag = true) as urgent_count,
    AVG(EXTRACT(HOURS FROM (verified_at - created_at))) FILTER (WHERE verified_at IS NOT NULL) as avg_verification_time_hours
FROM results
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- RLS Policies for verification workflow
ALTER TABLE result_verification_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_verification_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read verification notes
CREATE POLICY "Users can read verification notes" ON result_verification_notes
    FOR SELECT USING (true);

-- Policy: Authorized users can create verification notes
CREATE POLICY "Authorized users can create verification notes" ON result_verification_notes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::uuid 
            AND role IN ('Admin', 'Manager', 'Technician', 'Doctor')
        )
    );

-- Policy: Users can read verification audit
CREATE POLICY "Users can read verification audit" ON result_verification_audit
    FOR SELECT USING (true);

-- Policy: Users can create audit records for their own actions
CREATE POLICY "Users can create verification audit" ON result_verification_audit
    FOR INSERT WITH CHECK (
        auth.uid()::uuid = performed_by
    );

-- Function to verify results with audit trail
CREATE OR REPLACE FUNCTION verify_result(
    p_result_id UUID,
    p_action VARCHAR,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_current_status VARCHAR;
    v_new_status VARCHAR;
    v_user_id UUID;
    v_user_name TEXT;
BEGIN
    -- Get user info
    SELECT auth.uid()::uuid INTO v_user_id;
    SELECT COALESCE(name, email, 'System') INTO v_user_name 
    FROM users 
    WHERE id = v_user_id;
    
    -- Get current status
    SELECT COALESCE(verification_status, 'pending_verification') 
    INTO v_current_status
    FROM results
    WHERE id = p_result_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Result not found'
        );
    END IF;
    
    -- Determine new status
    CASE p_action
        WHEN 'approve' THEN v_new_status := 'verified';
        WHEN 'clarify' THEN v_new_status := 'needs_clarification';
        WHEN 'reject' THEN v_new_status := 'rejected';
        ELSE 
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid action: ' || p_action
            );
    END CASE;
    
    -- Update result
    UPDATE results
    SET 
        verification_status = v_new_status,
        verified_by = CASE WHEN v_new_status = 'verified' THEN v_user_id ELSE verified_by END,
        verified_at = CASE WHEN v_new_status = 'verified' THEN NOW() ELSE verified_at END,
        review_comment = p_comment,
        reviewed_by = CASE WHEN v_new_status = 'verified' THEN v_user_name ELSE reviewed_by END,
        reviewed_date = CASE WHEN v_new_status = 'verified' THEN CURRENT_DATE ELSE reviewed_date END,
        -- Update main status when verified
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
        'new_status', v_new_status,
        'message', 'Result ' || p_action || 'd successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for bulk verification
CREATE OR REPLACE FUNCTION bulk_verify_results(
    p_result_ids UUID[],
    p_action VARCHAR,
    p_comment TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_result_id UUID;
    v_results JSONB[] := '{}';
    v_count INTEGER := 0;
BEGIN
    FOREACH v_result_id IN ARRAY p_result_ids
    LOOP
        v_results := array_append(v_results, verify_result(v_result_id, p_action, p_comment));
        v_count := v_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'count', v_count,
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing data
-- Set verification_status based on existing status field
UPDATE results 
SET verification_status = CASE 
    WHEN status = 'Entered' THEN 'pending_verification'
    WHEN status = 'Reviewed' THEN 'verified'
    ELSE 'pending_verification'
END
WHERE verification_status IS NULL;

-- Grant permissions
GRANT SELECT ON view_results_pending TO authenticated;
GRANT SELECT ON view_verification_stats TO authenticated;
GRANT SELECT, INSERT ON result_verification_audit TO authenticated;
GRANT SELECT, INSERT ON result_verification_notes TO authenticated;
GRANT EXECUTE ON FUNCTION verify_result TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_verify_results TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE result_verification_audit IS 'Complete audit trail of all verification actions';
COMMENT ON TABLE result_verification_notes IS 'Discussion thread for result verification';
COMMENT ON VIEW view_results_pending IS 'Queue of results pending verification with full context';
COMMENT ON VIEW view_verification_stats IS 'Real-time statistics for verification workflow monitoring';
