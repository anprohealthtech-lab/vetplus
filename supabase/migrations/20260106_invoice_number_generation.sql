-- Auto-generate invoice numbers for invoices
-- Format: INV-YYMM-0001

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_lab_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_sequence INT;
  v_invoice_number TEXT;
BEGIN
  -- Get current year and month
  v_year := TO_CHAR(NOW(), 'YY');
  v_month := TO_CHAR(NOW(), 'MM');
  
  -- Get next sequence number for this lab
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '\d+$') AS INT)), 0) + 1
  INTO v_sequence
  FROM invoices
  WHERE lab_id = p_lab_id
    AND invoice_number LIKE 'INV-' || v_year || v_month || '%';
  
  -- Format: INV-YYMM-0001
  v_invoice_number := 'INV-' || v_year || v_month || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-set invoice number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if invoice_number is NULL
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := generate_invoice_number(NEW.lab_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trigger_set_invoice_number ON invoices;
CREATE TRIGGER trigger_set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_number();

-- Update existing invoices without invoice_number
UPDATE invoices
SET invoice_number = generate_invoice_number(lab_id)
WHERE invoice_number IS NULL;

-- Add comment
COMMENT ON FUNCTION generate_invoice_number IS 'Generates unique invoice number in format INV-YYMM-0001';
COMMENT ON TRIGGER trigger_set_invoice_number ON invoices IS 'Auto-generates invoice number on insert';
