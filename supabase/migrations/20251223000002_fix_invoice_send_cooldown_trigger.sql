-- =============================================
-- Fix Invoice Send Cooldown Trigger
-- =============================================
-- Problem: The trigger was firing on ANY invoice update when whatsapp_sent_at 
-- has a value, even if the whatsapp_sent_at field wasn't being changed.
-- This caused errors when creating refund requests.
--
-- Solution: Only check cooldown when the timestamp is actually being UPDATED
-- (i.e., NEW value is different from OLD value)
-- =============================================

-- Drop the old trigger first
DROP TRIGGER IF EXISTS trigger_invoice_send_cooldown ON invoices;

-- Create improved cooldown check function
CREATE OR REPLACE FUNCTION check_invoice_send_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check WhatsApp cooldown if whatsapp_sent_at is actually being changed
  IF NEW.whatsapp_sent_at IS DISTINCT FROM OLD.whatsapp_sent_at THEN
    -- If trying to update the timestamp on the same day as the previous send
    IF OLD.whatsapp_sent_at IS NOT NULL 
       AND NEW.whatsapp_sent_at IS NOT NULL 
       AND DATE(NEW.whatsapp_sent_at) = DATE(OLD.whatsapp_sent_at) THEN
      RAISE EXCEPTION 'Invoice was already sent via WhatsApp today. Please wait until tomorrow.';
    END IF;
  END IF;
  
  -- Only check Email cooldown if email_sent_at is actually being changed
  IF NEW.email_sent_at IS DISTINCT FROM OLD.email_sent_at THEN
    -- If trying to update the timestamp on the same day as the previous send
    IF OLD.email_sent_at IS NOT NULL 
       AND NEW.email_sent_at IS NOT NULL 
       AND DATE(NEW.email_sent_at) = DATE(OLD.email_sent_at) THEN
      RAISE EXCEPTION 'Invoice was already sent via email today. Please wait until tomorrow.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger without WHEN clause - let the function handle the logic
-- This ensures the trigger runs but the function only raises exception when appropriate
CREATE TRIGGER trigger_invoice_send_cooldown
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_invoice_send_cooldown();

-- Add comment documenting the fix
COMMENT ON FUNCTION check_invoice_send_cooldown() IS 
  'Prevents sending invoice via same channel twice on the same day. Fixed to only check when timestamp actually changes.';
