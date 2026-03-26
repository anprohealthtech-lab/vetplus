-- Add sample collection tracking fields to orders table
-- Migration: Add sample collection tracking
-- Date: September 7, 2025

-- Add columns for sample collection tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS sample_collected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sample_collected_by TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_sample_collected_at ON orders(sample_collected_at);

-- Update existing orders that have 'Sample Collection' or later status 
-- but no collection timestamp (data cleanup)
UPDATE orders 
SET sample_collected_at = created_at,
    sample_collected_by = 'Migration - Auto-filled'
WHERE status IN ('Sample Collection', 'In Progress', 'Pending Approval', 'Completed', 'Delivered')
  AND sample_collected_at IS NULL;

-- Add comment to document the schema change
COMMENT ON COLUMN orders.sample_collected_at IS 'Timestamp when the sample was physically collected from the patient';
COMMENT ON COLUMN orders.sample_collected_by IS 'User who collected the sample (email or name)';
