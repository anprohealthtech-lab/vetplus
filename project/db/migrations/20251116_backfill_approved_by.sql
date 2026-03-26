-- Migration: Backfill approved_by for existing completed orders
-- Date: 2025-11-16
-- Issue: Trigger only fires on status change, existing orders already in final status have null approved_by
-- Fix: Set approved_by to created_by for all completed orders that don't have it

-- Backfill approved_by for existing orders
UPDATE orders 
SET approved_by = created_by 
WHERE (status = 'Report Ready' OR status = 'Completed') 
  AND approved_by IS NULL
  AND created_by IS NOT NULL;

-- For orders where created_by is also null, try to use status_updated_by
-- (Need to look up user by email)
UPDATE orders o
SET approved_by = u.id
FROM users u
WHERE o.status_updated_by = u.email
  AND (o.status = 'Report Ready' OR o.status = 'Completed')
  AND o.approved_by IS NULL
  AND o.created_by IS NULL;
