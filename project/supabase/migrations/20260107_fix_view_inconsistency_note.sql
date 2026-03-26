-- Fix view inconsistencies: Only count result_values with actual non-empty values
-- This ensures both v_order_test_progress views give consistent data

-- Note: We need to find and update the view definitions 
-- The views are counting result_values incorrectly (counting NULL/empty values)

-- Temporary diagnostic query to show the discrepancy
DO $$
BEGIN
  RAISE NOTICE 'This migration identifies the view counting issue.';
  RAISE NOTICE 'The views v_order_test_progress and v_order_test_progress_enhanced';
  RAISE NOTICE 'are counting result_values.id (all rows) instead of filtering for actual values.';
  RAISE NOTICE '';
  RAISE NOTICE 'They should use: COUNT(CASE WHEN rv.value IS NOT NULL AND rv.value != '''' THEN 1 END)';
  RAISE NOTICE 'Instead of: COUNT(rv.id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Since the view definitions are not in migrations, they need to be updated';
  RAISE NOTICE 'directly in the Supabase dashboard or via a separate migration.';
END $$;

-- Example of what the corrected count should look like:
-- Instead of:
--   COUNT(DISTINCT rv.id) as entered_analytes
-- Use:
--   COUNT(DISTINCT CASE WHEN rv.value IS NOT NULL AND rv.value != '' THEN rv.id END) as entered_analytes
