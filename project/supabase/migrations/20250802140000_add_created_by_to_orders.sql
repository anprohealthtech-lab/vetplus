-- Migration: Add created_by column to orders table
-- Date: 2025-08-02
-- Purpose: Add missing created_by column that triggers expect

-- Add created_by column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add comment for clarity
COMMENT ON COLUMN orders.created_by IS 'User who created this order';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);

-- Update existing orders to have a created_by value (set to first admin user or null)
-- This prevents issues with existing orders
UPDATE orders 
SET created_by = (
  SELECT id 
  FROM auth.users 
  WHERE email LIKE '%admin%' OR email LIKE '%test%'
  LIMIT 1
)
WHERE created_by IS NULL;
