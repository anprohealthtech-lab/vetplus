-- Auto-update invoice status when payments are recorded
-- Date: 2025-11-13
-- Purpose: Automatically update invoice status based on total payments

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_invoice_status_on_payment ON payments;
DROP FUNCTION IF EXISTS update_invoice_status_from_payment();

-- Create function to update invoice status
CREATE OR REPLACE FUNCTION update_invoice_status_from_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
  v_invoice_total NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Get the invoice total
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;

  -- Calculate total paid for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE invoice_id = NEW.invoice_id;

  -- Determine new status
  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'Paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'Partial';
  ELSE
    v_new_status := 'Unpaid';
  END IF;

  -- Update invoice status
  UPDATE invoices
  SET 
    status = v_new_status,
    payment_method = NEW.payment_method,
    payment_date = NEW.payment_date,
    updated_at = NOW()
  WHERE id = NEW.invoice_id;

  RAISE NOTICE 'Invoice % status updated to % (paid: %, total: %)', 
    NEW.invoice_id, v_new_status, v_total_paid, v_invoice_total;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_invoice_status_on_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status_from_payment();

COMMENT ON FUNCTION update_invoice_status_from_payment() IS 
'Automatically updates invoice status when a payment is recorded';

COMMENT ON TRIGGER update_invoice_status_on_payment ON payments IS 
'Trigger to update invoice status when payments are added';

-- Verify
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'update_invoice_status_on_payment';

SELECT 'Invoice status trigger created successfully! ✅' AS status;
