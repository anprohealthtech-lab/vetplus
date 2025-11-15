-- Fix existing invoices with null location_id
-- Date: 2025-11-13
-- Purpose: Update existing invoices to populate location_id from orders or users

DO $$
DECLARE
  updated_count INTEGER := 0;
  invoice_record RECORD;
BEGIN
  -- Find all invoices with null location_id
  FOR invoice_record IN 
    SELECT i.id, i.order_id, i.lab_id
    FROM invoices i
    WHERE i.location_id IS NULL
  LOOP
    -- Try to get location from order
    UPDATE invoices
    SET location_id = (
      SELECT o.location_id 
      FROM orders o 
      WHERE o.id = invoice_record.order_id 
        AND o.location_id IS NOT NULL
      LIMIT 1
    )
    WHERE id = invoice_record.id
      AND location_id IS NULL;
    
    -- If still null, try to get from the first location in the lab
    UPDATE invoices
    SET location_id = (
      SELECT l.id
      FROM locations l
      WHERE l.lab_id = invoice_record.lab_id
        AND l.is_active = true
      ORDER BY l.created_at ASC
      LIMIT 1
    )
    WHERE id = invoice_record.id
      AND location_id IS NULL;
    
    IF FOUND THEN
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Updated % invoices with location_id', updated_count;
END $$;

-- Verify the fix
SELECT 
  COUNT(*) as total_invoices,
  COUNT(location_id) as with_location,
  COUNT(*) - COUNT(location_id) as still_null
FROM invoices;

SELECT 'Invoice location_id fix completed!' AS status;
