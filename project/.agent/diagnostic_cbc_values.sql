-- Diagnostic query to understand CBC analyte completion
-- Run this to see exactly what's happening with the CBC test

-- Check the actual result_values for this order's CBC test
SELECT 
    tga.analyte_id,
    a.name as analyte_name,
    r.id as result_id,
    rv.id as result_value_id,
    rv.value,
    rv.value IS NULL as value_is_null,
    rv.value = '' as value_is_empty,
    CASE 
        WHEN rv.value IS NOT NULL AND rv.value != '' THEN 'HAS_VALUE'
        WHEN rv.value = '' THEN 'EMPTY_STRING'
        WHEN rv.value IS NULL THEN 'NULL'
        ELSE 'UNKNOWN'
    END as value_status
FROM test_group_analytes tga
LEFT JOIN analytes a ON tga.analyte_id = a.id
LEFT JOIN test_groups tg ON tga.test_group_id = tg.id
LEFT JOIN order_tests ot ON ot.test_group_id = tg.id
LEFT JOIN results r ON r.order_test_id = ot.id AND r.order_id = '28e227c4-b3b4-4059-a204-7877aae811ad'
LEFT JOIN result_values rv ON rv.result_id = r.id AND rv.analyte_id = tga.analyte_id
WHERE tg.id = 'aa14b3b4-8363-4bd8-8bcc-77ddce240a73' -- CBC test group
  AND ot.order_id = '28e227c4-b3b4-4059-a204-7877aae811ad'
ORDER BY tga.analyte_id;

-- This will show us:
-- 1. All 11 CBC analytes
-- 2. Which ones have result_values rows
-- 3. Which ones have actual non-empty values
-- 4. The exact status of each
