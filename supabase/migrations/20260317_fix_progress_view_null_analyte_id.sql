-- Fix: ALB-U (Urine Albumin, analyte ec047148) was incorrectly added to all
-- "Liver Function Test" groups across all labs. It belongs only in urine test groups.
-- This removes it from all LFT variants while preserving it in "Urine (Albumin)".

DELETE FROM test_group_analytes
WHERE analyte_id = 'ec047148-707c-4540-8d99-42f9651a9e02'
  AND test_group_id IN (
    SELECT id FROM test_groups WHERE name = 'Liver Function Test'
  );

-- Defensive: backfill results.order_test_id where NULL but result_values has it set.
UPDATE results res
SET order_test_id = rv.order_test_id
FROM result_values rv
WHERE rv.result_id      = res.id
  AND res.order_test_id IS NULL
  AND rv.order_test_id  IS NOT NULL;
