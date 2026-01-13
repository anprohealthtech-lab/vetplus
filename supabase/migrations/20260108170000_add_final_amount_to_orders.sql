-- Add final_amount column to orders table
-- This stores the amount after discount (discount details are already in invoices table)

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS final_amount DECIMAL(10,2);

-- Update existing orders to have final_amount = total_amount (no discount)
UPDATE orders 
SET final_amount = total_amount 
WHERE final_amount IS NULL;

COMMENT ON COLUMN orders.final_amount IS 'Total amount after discount (discount details stored in invoices table)';
