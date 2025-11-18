-- Quick Verification Query: Run AFTER migration to verify all columns exist
-- This query shows all test_groups columns with their types and defaults

SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'test_groups'
    AND column_name IN (
        'test_type', 'gender', 'sample_color', 'barcode_suffix',
        'lmp_required', 'id_required', 'consent_form', 
        'pre_collection_guidelines', 'flabs_id',
        'only_female', 'only_male', 'only_billing', 'start_from_next_page'
    )
ORDER BY 
    column_name;

-- Expected Result: 13 rows showing all new columns
-- If you see fewer than 13 rows, the migration didn't complete successfully

-- Sample test: Insert a test group with new fields to verify everything works
-- (Optional - only run if you want to test immediately)
/*
INSERT INTO test_groups (
    name, code, category, clinical_purpose, price, 
    turnaround_time, sample_type, is_active,
    test_type, gender, sample_color, barcode_suffix,
    lmp_required, id_required, consent_form,
    pre_collection_guidelines, flabs_id,
    only_female, only_male, only_billing, start_from_next_page
) VALUES (
    'Test Configuration Sample',
    'TEST_CONFIG_001',
    'Laboratory',
    'Sample test to verify new configuration fields',
    500.00,
    '24 hours',
    'Blood',
    true,
    'Special',
    'Female',
    'Blue',
    'WH01',
    true,
    true,
    true,
    'Patient should fast for 12 hours before sample collection. Avoid alcohol and fatty foods.',
    'FLT9999',
    true,
    false,
    false,
    true
);

-- After inserting, query to verify:
SELECT 
    name, test_type, gender, sample_color, lmp_required, 
    pre_collection_guidelines, flabs_id
FROM 
    test_groups
WHERE 
    code = 'TEST_CONFIG_001';
*/
