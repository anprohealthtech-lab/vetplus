-- Migration: Add "Order Created" status to order_status enum
-- Date: 2025-08-02
-- Purpose: Add the "Order Created" status for proper LIMS workflow

-- First, let's check if we have an enum type or if status is VARCHAR
-- Based on error message, we have an enum type order_status

-- Handle dependent views by storing their definitions and recreating them
-- Step 1: Store the view definitions
CREATE TEMP TABLE temp_view_definitions AS
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN ('patient_visit_summary', 'order_chain_view');

-- Step 2: Drop dependent views
DROP VIEW IF EXISTS public.patient_visit_summary CASCADE;
DROP VIEW IF EXISTS public.order_chain_view CASCADE;

-- Step 3: Create new enum with all values including "Order Created"
CREATE TYPE order_status_new AS ENUM (
  'Order Created',
  'Sample Collection', 
  'In Progress', 
  'Pending Approval', 
  'Completed', 
  'Delivered'
);

-- Step 4: Add a temporary column with the new enum type
ALTER TABLE orders ADD COLUMN status_new order_status_new;

-- Step 5: Copy existing data, mapping old values to new enum
UPDATE orders SET status_new = 
  CASE status::text
    WHEN 'Sample Collection' THEN 'Sample Collection'::order_status_new
    WHEN 'In Progress' THEN 'In Progress'::order_status_new
    WHEN 'Pending Approval' THEN 'Pending Approval'::order_status_new
    WHEN 'Completed' THEN 'Completed'::order_status_new
    WHEN 'Delivered' THEN 'Delivered'::order_status_new
    ELSE 'Order Created'::order_status_new  -- Default for any unrecognized values
  END;

-- Step 6: Drop the old column and rename the new one
ALTER TABLE orders DROP COLUMN status;
ALTER TABLE orders RENAME COLUMN status_new TO status;

-- Step 7: Set default value for new orders
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'Order Created'::order_status_new;

-- Step 8: Drop the old enum type and rename the new one
DROP TYPE IF EXISTS order_status;
ALTER TYPE order_status_new RENAME TO order_status;

-- Step 9: Add NOT NULL constraint if it doesn't exist
ALTER TABLE orders ALTER COLUMN status SET NOT NULL;

-- Step 10: Recreate the dependent views
-- Note: We'll recreate them with updated logic that handles the new status

-- Recreate patient_visit_summary view
CREATE OR REPLACE VIEW public.patient_visit_summary AS
SELECT 
  p.id as patient_id,
  p.name as patient_name,
  p.age,
  p.gender,
  p.created_at as patient_created_at,
  o.id as order_id,
  o.status as order_status,
  o.order_date,
  o.expected_date,
  o.total_amount,
  ARRAY_AGG(DISTINCT ot.test_name) as tests,
  COUNT(DISTINCT r.id) as result_count,
  COUNT(DISTINCT CASE WHEN r.status = 'Approved' THEN r.id END) as approved_results,
  CASE 
    WHEN o.status IN ('Completed', 'Delivered') THEN 'Complete'
    WHEN o.status = 'Pending Approval' THEN 'Awaiting Approval'
    WHEN o.status = 'In Progress' THEN 'In Progress'
    WHEN o.status = 'Sample Collection' THEN 'Sample Collection'
    WHEN o.status = 'Order Created' THEN 'Order Created'
    ELSE 'Unknown'
  END as visit_status
FROM patients p
LEFT JOIN orders o ON p.id = o.patient_id
LEFT JOIN order_tests ot ON o.id = ot.order_id
LEFT JOIN results r ON o.id = r.order_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.age, p.gender, p.created_at, o.id, o.status, o.order_date, o.expected_date, o.total_amount;

-- Recreate order_chain_view
CREATE OR REPLACE VIEW public.order_chain_view AS
SELECT 
  o.id as order_id,
  o.patient_id,
  o.status as order_status,
  o.order_date,
  o.expected_date,
  o.priority,
  o.total_amount,
  p.name as patient_name,
  p.age as patient_age,
  p.gender as patient_gender,
  ARRAY_AGG(DISTINCT ot.test_name) as tests,
  COUNT(DISTINCT ot.id) as test_count,
  COUNT(DISTINCT r.id) as result_count,
  COUNT(DISTINCT CASE WHEN r.status = 'Approved' THEN r.id END) as approved_results,
  MAX(r.entered_date) as last_result_date,
  CASE 
    WHEN o.status = 'Order Created' THEN 1
    WHEN o.status = 'Sample Collection' THEN 2
    WHEN o.status = 'In Progress' THEN 3
    WHEN o.status = 'Pending Approval' THEN 4
    WHEN o.status = 'Completed' THEN 5
    WHEN o.status = 'Delivered' THEN 6
    ELSE 0
  END as status_order
FROM orders o
JOIN patients p ON o.patient_id = p.id
LEFT JOIN order_tests ot ON o.id = ot.order_id
LEFT JOIN results r ON o.id = r.order_id
GROUP BY o.id, o.patient_id, o.status, o.order_date, o.expected_date, o.priority, o.total_amount, 
         p.name, p.age, p.gender;

-- Add comment for documentation
COMMENT ON COLUMN orders.status IS 'Order workflow status: Order Created (initial) → Sample Collection → In Progress → Pending Approval → Completed → Delivered';

-- Create index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Clean up temp table
DROP TABLE IF EXISTS temp_view_definitions;
