-- Patient Merge/Unmerge System Migration
-- Created: 2025-11-18
-- Purpose: Implement a non-destructive patient merge system that links duplicate records
--          without actually merging data. All patient records remain separate in the database.

-- ============================================================================
-- STEP 1: Add merge tracking columns to patients table
-- ============================================================================

DO $$
BEGIN
    -- Add master_patient_id column (self-referencing foreign key)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'master_patient_id'
    ) THEN
        ALTER TABLE patients ADD COLUMN master_patient_id UUID;
        COMMENT ON COLUMN patients.master_patient_id IS 
            'References the master patient ID when this patient is marked as a duplicate. NULL means this is a unique/master patient.';
    END IF;

    -- Add is_duplicate flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'is_duplicate'
    ) THEN
        ALTER TABLE patients ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN patients.is_duplicate IS 
            'TRUE when this patient record is marked as a duplicate of another patient.';
    END IF;

    -- Add merge_date timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'merge_date'
    ) THEN
        ALTER TABLE patients ADD COLUMN merge_date TIMESTAMPTZ;
        COMMENT ON COLUMN patients.merge_date IS 
            'Timestamp when this patient was merged as a duplicate.';
    END IF;

    -- Add merged_by user tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'merged_by'
    ) THEN
        ALTER TABLE patients ADD COLUMN merged_by UUID;
        COMMENT ON COLUMN patients.merged_by IS 
            'User ID who performed the merge operation.';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add foreign key constraints
-- ============================================================================

DO $$
BEGIN
    -- Foreign key to patients table (self-referencing)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_patients_master_patient'
    ) THEN
        ALTER TABLE patients 
        ADD CONSTRAINT fk_patients_master_patient 
        FOREIGN KEY (master_patient_id) REFERENCES patients(id) ON DELETE SET NULL;
    END IF;

    -- Foreign key to users table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_patients_merged_by'
    ) THEN
        ALTER TABLE patients 
        ADD CONSTRAINT fk_patients_merged_by 
        FOREIGN KEY (merged_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_patients_master_patient_id 
ON patients(master_patient_id) 
WHERE master_patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_is_duplicate 
ON patients(is_duplicate) 
WHERE is_duplicate = TRUE;

-- ============================================================================
-- STEP 4: Create view for patients with duplicates
-- ============================================================================

CREATE OR REPLACE VIEW v_patients_with_duplicates AS
SELECT 
    p.id,
    p.lab_id,
    p.name,
    p.age,
    p.gender,
    p.phone,
    p.email,
    p.address,
    p.city,
    p.state,
    p.pincode,
    p.display_id,
    p.registration_date,
    p.is_active,
    p.is_duplicate,
    p.master_patient_id,
    p.merge_date,
    p.merged_by,
    p.created_at,
    p.updated_at,
    -- Count of duplicate patients linked to this master
    (
        SELECT COUNT(*) 
        FROM patients dup 
        WHERE dup.master_patient_id = p.id 
        AND dup.is_duplicate = TRUE
    ) as duplicate_count,
    -- Array of duplicate patient IDs
    (
        SELECT ARRAY_AGG(dup.id) 
        FROM patients dup 
        WHERE dup.master_patient_id = p.id 
        AND dup.is_duplicate = TRUE
    ) as duplicate_patient_ids,
    -- Array of duplicate patient names for quick reference
    (
        SELECT ARRAY_AGG(dup.name) 
        FROM patients dup 
        WHERE dup.master_patient_id = p.id 
        AND dup.is_duplicate = TRUE
    ) as duplicate_patient_names
FROM patients p
WHERE (p.is_duplicate = FALSE OR p.is_duplicate IS NULL) AND p.is_active = TRUE;

COMMENT ON VIEW v_patients_with_duplicates IS 
    'Shows all unique/master patients with their linked duplicate count and IDs. Use this view for displaying the consolidated patient list.';

-- ============================================================================
-- STEP 5: Create RPC function to merge patients
-- ============================================================================

CREATE OR REPLACE FUNCTION merge_patients(
    p_master_id UUID,
    p_duplicate_id UUID,
    p_merged_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_master_patient RECORD;
    v_duplicate_patient RECORD;
    v_result JSON;
BEGIN
    -- Validate that both patients exist
    SELECT * INTO v_master_patient FROM patients WHERE id = p_master_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Master patient not found'
        );
    END IF;

    SELECT * INTO v_duplicate_patient FROM patients WHERE id = p_duplicate_id;
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Duplicate patient not found'
        );
    END IF;

    -- Prevent merging a patient with itself
    IF p_master_id = p_duplicate_id THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Cannot merge a patient with itself'
        );
    END IF;

    -- Prevent merging if duplicate is already marked as duplicate
    IF v_duplicate_patient.is_duplicate = TRUE THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Patient is already marked as a duplicate'
        );
    END IF;

    -- Prevent merging if master is marked as duplicate
    IF v_master_patient.is_duplicate = TRUE THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Cannot use a duplicate patient as master'
        );
    END IF;

    -- Validate same lab
    IF v_master_patient.lab_id != v_duplicate_patient.lab_id THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Patients must belong to the same lab'
        );
    END IF;

    -- Mark duplicate patient
    UPDATE patients 
    SET 
        master_patient_id = p_master_id,
        is_duplicate = TRUE,
        merge_date = NOW(),
        merged_by = p_merged_by
    WHERE id = p_duplicate_id;

    -- Return success with details
    RETURN json_build_object(
        'success', TRUE,
        'master_patient_id', p_master_id,
        'duplicate_patient_id', p_duplicate_id,
        'merge_date', NOW(),
        'message', 'Patients merged successfully. All records remain in database.'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION merge_patients IS 
    'Marks a patient as a duplicate of another master patient. Does NOT delete or modify patient data - only links records.';

-- ============================================================================
-- STEP 6: Create RPC function to unmerge patients
-- ============================================================================

CREATE OR REPLACE FUNCTION unmerge_patient(
    p_duplicate_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_patient RECORD;
BEGIN
    -- Get patient record
    SELECT * INTO v_patient FROM patients WHERE id = p_duplicate_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Patient not found'
        );
    END IF;

    -- Check if patient is actually marked as duplicate
    IF v_patient.is_duplicate = FALSE OR v_patient.is_duplicate IS NULL THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Patient is not marked as a duplicate'
        );
    END IF;

    -- Remove merge link
    UPDATE patients 
    SET 
        master_patient_id = NULL,
        is_duplicate = FALSE,
        merge_date = NULL,
        merged_by = NULL
    WHERE id = p_duplicate_id;

    RETURN json_build_object(
        'success', TRUE,
        'patient_id', p_duplicate_id,
        'message', 'Patient unmerged successfully and restored as unique patient.'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION unmerge_patient IS 
    'Removes merge link and restores a duplicate patient as a unique/independent patient.';

-- ============================================================================
-- STEP 7: Create RPC function to get patient with all duplicates
-- ============================================================================

CREATE OR REPLACE FUNCTION get_patient_with_duplicates(
    p_patient_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_master_id UUID;
    v_result JSON;
BEGIN
    -- Determine the master patient ID
    -- If the provided patient is a duplicate, get its master
    -- Otherwise, use the provided patient as master
    SELECT 
        CASE 
            WHEN is_duplicate = TRUE THEN master_patient_id
            ELSE id
        END INTO v_master_id
    FROM patients 
    WHERE id = p_patient_id;

    IF v_master_id IS NULL THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Patient not found'
        );
    END IF;

    -- Build result with master patient and all duplicates
    SELECT json_build_object(
        'success', TRUE,
        'master_patient', (
            SELECT row_to_json(p) 
            FROM patients p 
            WHERE p.id = v_master_id
        ),
        'duplicates', (
            SELECT COALESCE(json_agg(row_to_json(d)), '[]'::json)
            FROM patients d
            WHERE d.master_patient_id = v_master_id
            AND d.is_duplicate = TRUE
        ),
        'total_count', (
            SELECT 1 + COUNT(*)
            FROM patients d
            WHERE d.master_patient_id = v_master_id
            AND d.is_duplicate = TRUE
        )
    ) INTO v_result;

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', SQLERRM
        );
END;
$$;

COMMENT ON FUNCTION get_patient_with_duplicates IS 
    'Returns a master patient record along with all linked duplicate patients. Works with both master and duplicate patient IDs.';

-- ============================================================================
-- STEP 8: Grant permissions
-- ============================================================================

-- Grant view access
GRANT SELECT ON v_patients_with_duplicates TO authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION merge_patients TO authenticated;
GRANT EXECUTE ON FUNCTION unmerge_patient TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_with_duplicates TO authenticated;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✓ Added merge tracking columns to patients table
-- ✓ Created foreign key constraints
-- ✓ Created performance indexes
-- ✓ Created v_patients_with_duplicates view
-- ✓ Created merge_patients() RPC function
-- ✓ Created unmerge_patient() RPC function
-- ✓ Created get_patient_with_duplicates() RPC function
-- ✓ Added comprehensive comments
-- ✓ Granted appropriate permissions

-- Usage Examples:
-- 
-- 1. Merge patients:
--    SELECT merge_patients(
--        'master-patient-uuid'::uuid, 
--        'duplicate-patient-uuid'::uuid, 
--        'user-uuid'::uuid
--    );
--
-- 2. Unmerge a patient:
--    SELECT unmerge_patient('duplicate-patient-uuid'::uuid);
--
-- 3. Get patient with all duplicates:
--    SELECT get_patient_with_duplicates('any-patient-uuid'::uuid);
--
-- 4. View unique patients with duplicate counts:
--    SELECT * FROM v_patients_with_duplicates WHERE duplicate_count > 0;
