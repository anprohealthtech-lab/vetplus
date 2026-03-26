-- Function to ensure order status consistency
CREATE OR REPLACE FUNCTION ensure_order_status_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- If sample is collected, ensure status reflects it
  IF NEW.sample_collected_at IS NOT NULL AND 
     (NEW.status = 'Order Created' OR NEW.status = 'Pending Collection') THEN
    NEW.status = 'In Progress';
  END IF;
  
  -- If sample is not collected, ensure status doesn't say it is
  IF NEW.sample_collected_at IS NULL AND NEW.status = 'In Progress' THEN
    NEW.status = 'Pending Collection';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_order_status_consistency_trigger ON orders;
CREATE TRIGGER ensure_order_status_consistency_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION ensure_order_status_consistency();

-- Fix existing inconsistent data
UPDATE orders 
SET status = 'In Progress' 
WHERE sample_collected_at IS NOT NULL 
  AND status IN ('Order Created', 'Pending Collection');

UPDATE orders 
SET status = 'Pending Collection' 
WHERE sample_collected_at IS NULL 
  AND status = 'In Progress';

COMMENT ON FUNCTION ensure_order_status_consistency() IS 'Ensures order status stays synchronized with sample collection state';
