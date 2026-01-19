-- Backfill outsourced_cost for existing invoice_items that have outsourced_lab_id but null cost
-- This joins invoice_items with outsourced_lab_prices to get the cost

-- First, let's see what needs to be updated (for logging/verification)
-- SELECT ii.id, ii.test_name, ii.outsourced_lab_id, ii.outsourced_cost, olp.cost
-- FROM invoice_items ii
-- LEFT JOIN order_tests ot ON ot.id = ii.order_test_id
-- LEFT JOIN outsourced_lab_prices olp ON olp.outsourced_lab_id = ii.outsourced_lab_id 
--   AND olp.test_group_id = ot.test_group_id
--   AND olp.is_active = true
-- WHERE ii.outsourced_lab_id IS NOT NULL 
--   AND ii.outsourced_cost IS NULL;

-- Update invoice_items with outsourced_cost from outsourced_lab_prices
-- Using order_tests to get test_group_id since invoice_items may not have it directly
UPDATE invoice_items ii
SET 
  outsourced_cost = olp.cost,
  updated_at = NOW()
FROM order_tests ot, outsourced_lab_prices olp
WHERE ii.order_test_id = ot.id
  AND olp.outsourced_lab_id = ii.outsourced_lab_id
  AND olp.test_group_id = ot.test_group_id
  AND olp.is_active = true
  AND ii.outsourced_lab_id IS NOT NULL
  AND (ii.outsourced_cost IS NULL OR ii.outsourced_cost = 0);

-- Alternative: If order_test_id is not always set, try matching by test_name
-- This is a fallback for invoice_items created without order_test_id link
UPDATE invoice_items ii
SET 
  outsourced_cost = olp.cost,
  updated_at = NOW()
FROM test_groups tg, outsourced_lab_prices olp
WHERE ii.test_name = tg.name
  AND olp.outsourced_lab_id = ii.outsourced_lab_id
  AND olp.test_group_id = tg.id
  AND olp.is_active = true
  AND ii.outsourced_lab_id IS NOT NULL
  AND (ii.outsourced_cost IS NULL OR ii.outsourced_cost = 0)
  AND ii.order_test_id IS NULL;
