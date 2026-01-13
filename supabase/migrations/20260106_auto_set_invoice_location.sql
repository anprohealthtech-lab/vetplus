-- Automatically set invoice location_id from order location_id
-- When an invoice is created from an order, inherit the order's location

CREATE OR REPLACE FUNCTION set_invoice_location_from_order()
RETURNS TRIGGER AS $$
BEGIN
  -- If invoice has an order_id and location_id is not already set
  IF NEW.order_id IS NOT NULL AND NEW.location_id IS NULL THEN
    -- Get location_id from the order
    SELECT location_id INTO NEW.location_id
    FROM orders
    WHERE id = NEW.order_id;
    
    -- Log for debugging
    IF NEW.location_id IS NOT NULL THEN
      RAISE NOTICE 'Auto-set invoice location_id to % from order %', NEW.location_id, NEW.order_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-set location on invoice INSERT
DROP TRIGGER IF EXISTS trigger_set_invoice_location_from_order ON invoices;
CREATE TRIGGER trigger_set_invoice_location_from_order
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_location_from_order();

-- Add comment
COMMENT ON TRIGGER trigger_set_invoice_location_from_order ON invoices IS 
  'Automatically sets invoice location_id from the associated order location_id';

-- Also update existing invoices that have order_id but no location_id
UPDATE invoices i
SET location_id = o.location_id
FROM orders o
WHERE i.order_id = o.id
  AND i.location_id IS NULL
  AND o.location_id IS NOT NULL;
