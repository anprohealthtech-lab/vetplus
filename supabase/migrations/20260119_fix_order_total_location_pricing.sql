-- Migration: Fix orders where total_amount doesn't match invoice subtotal
-- This fixes orders that were created before the location pricing fix
-- 
-- Problem: create-order-with-payment was using base price instead of location price
-- Result: order.total_amount = 200 but invoice.subtotal = 150 (location price)
-- Effect: Dashboard showed "Due: ₹50" even after full payment

-- Update orders where the total_amount differs from the invoice subtotal
-- Only update if the invoice subtotal is LESS than order total (location discount scenario)
-- and the difference is significant (> ₹1 to handle float precision)

UPDATE orders o
SET 
  total_amount = i.subtotal,
  final_amount = i.total_after_discount,
  updated_at = NOW()
FROM invoices i
WHERE 
  o.id = i.order_id
  AND o.total_amount > i.subtotal
  AND (o.total_amount - i.subtotal) > 1
  -- Only fix orders that have location_id set (indicating location-specific pricing was intended)
  AND o.location_id IS NOT NULL;
