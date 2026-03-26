-- Backfill location_receivable for existing invoice items
-- Uses location's receivable_type and collection_percentage to calculate

-- Update invoice items where location_receivable is NULL but order has a location
UPDATE invoice_items ii
SET location_receivable = CASE
  -- Own center: lab gets 100% of revenue
  WHEN l.receivable_type = 'own_center' THEN ii.price
  -- Percentage based: calculate from collection_percentage
  WHEN l.receivable_type = 'percentage' AND l.collection_percentage IS NOT NULL 
    THEN ii.price * (l.collection_percentage / 100.0)
  -- Test-wise: try to get from location_test_prices
  WHEN l.receivable_type = 'test_wise' THEN (
    SELECT ltp.lab_receivable
    FROM location_test_prices ltp
    JOIN order_tests ot ON ot.order_id = ii.order_id AND ot.test_group_id = ltp.test_group_id
    WHERE ltp.location_id = l.id
    AND ltp.is_active = true
    LIMIT 1
  )
  ELSE NULL
END
FROM orders o
JOIN locations l ON l.id = o.location_id
WHERE ii.order_id = o.id
AND ii.location_receivable IS NULL
AND o.location_id IS NOT NULL;
