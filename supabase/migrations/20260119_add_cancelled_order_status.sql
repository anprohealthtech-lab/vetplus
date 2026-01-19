-- Add "Cancelled" status to order_status enum for operational order cancellation
-- This allows admins to cancel orders before invoicing

-- Add the new enum value
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Cancelled';

-- Note: Orders can only be cancelled if:
-- 1. No invoice has been created for the order
-- 2. Admin role is required for cancellation
