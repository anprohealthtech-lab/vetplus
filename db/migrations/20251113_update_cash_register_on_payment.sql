-- Migration: Auto-update cash_register.system_amount when cash payments are recorded
-- Date: 2025-11-13
-- Purpose: Automatically track cash payments in the cash register for accurate reconciliation

-- Drop trigger if exists (for rerunability)
DROP TRIGGER IF EXISTS update_cash_register_on_payment ON payments;
DROP FUNCTION IF EXISTS update_cash_register_system_amount();

-- Create function to update cash register system_amount
CREATE OR REPLACE FUNCTION update_cash_register_system_amount()
RETURNS TRIGGER AS $$
DECLARE
  v_register_id uuid;
BEGIN
  -- Only process cash payments
  IF NEW.payment_method = 'cash' THEN
    -- Find the active cash register for this location and date
    SELECT id INTO v_register_id
    FROM cash_register
    WHERE register_date = DATE(NEW.payment_date)
      AND location_id = NEW.location_id
      AND lab_id = NEW.lab_id
      AND reconciled = false
    LIMIT 1;

    -- If found, update system_amount
    IF v_register_id IS NOT NULL THEN
      UPDATE cash_register
      SET system_amount = system_amount + NEW.amount
      WHERE id = v_register_id;
      
      -- Log the update
      RAISE NOTICE 'Updated cash_register % with amount %', v_register_id, NEW.amount;
    ELSE
      -- Log warning if no active register found
      RAISE WARNING 'No active cash register found for location % on date %', NEW.location_id, DATE(NEW.payment_date);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_cash_register_on_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_cash_register_system_amount();

COMMENT ON FUNCTION update_cash_register_system_amount() IS 
'Automatically updates cash_register.system_amount when a cash payment is recorded';

COMMENT ON TRIGGER update_cash_register_on_payment ON payments IS 
'Trigger to update cash register system amount when cash payments are added';

-- Test the trigger (optional - can be run manually)
-- INSERT INTO payments (invoice_id, amount, payment_method, payment_date, received_by, lab_id, location_id)
-- VALUES ('test-invoice-id', 100, 'cash', CURRENT_DATE, 'test-user-id', 'test-lab-id', 'test-location-id');
