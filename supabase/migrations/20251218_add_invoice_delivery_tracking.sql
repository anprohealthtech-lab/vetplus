-- Migration: Add delivery tracking fields to invoices table
-- Purpose: Track WhatsApp sends, email sends, and payment reminders with timestamps
-- Date: 2025-12-18
-- Similar to reports delivery tracking but for invoices

-- Add delivery tracking columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_sent_to TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_sent_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS whatsapp_sent_via TEXT CHECK (whatsapp_sent_via IN ('api', 'manual_link')),
ADD COLUMN IF NOT EXISTS whatsapp_caption TEXT,
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_sent_to TEXT,
ADD COLUMN IF NOT EXISTS email_sent_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS email_sent_via TEXT CHECK (email_sent_via IN ('api', 'manual_link')),
ADD COLUMN IF NOT EXISTS payment_reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_sent_by UUID REFERENCES users(id);

-- Add comments for documentation
COMMENT ON COLUMN invoices.whatsapp_sent_at IS 'Timestamp when invoice was sent via WhatsApp (either API or manual link)';
COMMENT ON COLUMN invoices.whatsapp_sent_to IS 'Recipient phone number for WhatsApp send';
COMMENT ON COLUMN invoices.whatsapp_sent_by IS 'User ID who sent the WhatsApp message';
COMMENT ON COLUMN invoices.whatsapp_sent_via IS 'Method used to send: api (backend WhatsApp API) or manual_link (user created manual link)';
COMMENT ON COLUMN invoices.whatsapp_caption IS 'Message/caption sent with the invoice via WhatsApp';
COMMENT ON COLUMN invoices.email_sent_at IS 'Timestamp when invoice was sent via email';
COMMENT ON COLUMN invoices.email_sent_to IS 'Recipient email address';
COMMENT ON COLUMN invoices.email_sent_by IS 'User ID who sent the email';
COMMENT ON COLUMN invoices.email_sent_via IS 'Method used to send: api (backend email service) or manual_link (user created manual link)';
COMMENT ON COLUMN invoices.payment_reminder_count IS 'Number of payment reminders sent for this invoice';
COMMENT ON COLUMN invoices.last_reminder_at IS 'Timestamp of last payment reminder sent';
COMMENT ON COLUMN invoices.reminder_sent_by IS 'User ID who sent the last payment reminder';

-- Create indexes for faster queries on sent status
CREATE INDEX IF NOT EXISTS idx_invoices_whatsapp_sent_at ON invoices(whatsapp_sent_at) WHERE whatsapp_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_email_sent_at ON invoices(email_sent_at) WHERE email_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_last_reminder_at ON invoices(last_reminder_at) WHERE last_reminder_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_sent_status ON invoices(lab_id, status, whatsapp_sent_at, email_sent_at) WHERE status != 'paid';

-- Function to prevent duplicate sends on same day
CREATE OR REPLACE FUNCTION check_invoice_send_cooldown()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if invoice was already sent via same channel today
  IF NEW.whatsapp_sent_at IS NOT NULL 
     AND OLD.whatsapp_sent_at IS NOT NULL 
     AND DATE(NEW.whatsapp_sent_at) = DATE(OLD.whatsapp_sent_at) THEN
    RAISE EXCEPTION 'Invoice was already sent via WhatsApp today. Please wait until tomorrow.';
  END IF;
  
  IF NEW.email_sent_at IS NOT NULL 
     AND OLD.email_sent_at IS NOT NULL 
     AND DATE(NEW.email_sent_at) = DATE(OLD.email_sent_at) THEN
    RAISE EXCEPTION 'Invoice was already sent via email today. Please wait until tomorrow.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check cooldown
CREATE TRIGGER trigger_invoice_send_cooldown
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  WHEN (
    (NEW.whatsapp_sent_at IS NOT NULL AND OLD.whatsapp_sent_at IS NOT NULL) OR
    (NEW.email_sent_at IS NOT NULL AND OLD.email_sent_at IS NOT NULL)
  )
  EXECUTE FUNCTION check_invoice_send_cooldown();

-- Function to increment reminder count when reminder is sent
CREATE OR REPLACE FUNCTION increment_invoice_reminder_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_reminder_at IS NOT NULL AND 
     (OLD.last_reminder_at IS NULL OR NEW.last_reminder_at != OLD.last_reminder_at) THEN
    NEW.payment_reminder_count = COALESCE(OLD.payment_reminder_count, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to increment reminder count
CREATE TRIGGER trigger_increment_reminder_count
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.last_reminder_at IS NOT NULL)
  EXECUTE FUNCTION increment_invoice_reminder_count();

-- RLS Policies for accessing delivery status (already inherited from invoices table)
-- No additional policies needed as we're just adding columns to existing table
