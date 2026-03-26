-- Ensure refund trigger is properly configured and update any orphaned refunds
-- This migration ensures the invoice refund totals are properly updated

-- Recreate the trigger function to ensure it's up to date
CREATE OR REPLACE FUNCTION update_invoice_refund_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_refunded NUMERIC(10,2);
  paid_amt NUMERIC(10,2);
  inv_id UUID;
BEGIN
  -- Determine which invoice to update
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  IF inv_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate total refunded amount for this invoice (only 'paid' refunds count)
  SELECT COALESCE(SUM(refund_amount), 0) INTO total_refunded
  FROM refund_requests
  WHERE invoice_id = inv_id AND status = 'paid';
  
  -- Get paid amount from invoice
  SELECT amount_paid INTO paid_amt FROM invoices WHERE id = inv_id;
  
  -- Update invoice with new totals
  UPDATE invoices
  SET 
    total_refunded_amount = total_refunded,
    refund_status = CASE
      WHEN total_refunded = 0 THEN 'not_requested'
      WHEN total_refunded >= COALESCE(paid_amt, 0) THEN 'fully_refunded'
      ELSE 'partially_refunded'
    END,
    updated_at = now()
  WHERE id = inv_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_invoice_refund_totals ON refund_requests;
CREATE TRIGGER trigger_update_invoice_refund_totals
  AFTER INSERT OR UPDATE OR DELETE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_refund_totals();

-- Fix any existing invoices that have paid refunds but weren't updated
UPDATE invoices i
SET 
  total_refunded_amount = COALESCE(refund_totals.total_refunded, 0),
  refund_status = CASE
    WHEN COALESCE(refund_totals.total_refunded, 0) = 0 THEN 'not_requested'
    WHEN COALESCE(refund_totals.total_refunded, 0) >= COALESCE(i.amount_paid, 0) THEN 'fully_refunded'
    ELSE 'partially_refunded'
  END,
  updated_at = now()
FROM (
  SELECT 
    invoice_id, 
    SUM(refund_amount) as total_refunded
  FROM refund_requests 
  WHERE status = 'paid'
  GROUP BY invoice_id
) refund_totals
WHERE i.id = refund_totals.invoice_id
  AND (i.total_refunded_amount IS NULL 
       OR i.total_refunded_amount != refund_totals.total_refunded);

-- Add comment
COMMENT ON FUNCTION update_invoice_refund_totals() IS 
'Updates invoice total_refunded_amount and refund_status when refund_requests change';
