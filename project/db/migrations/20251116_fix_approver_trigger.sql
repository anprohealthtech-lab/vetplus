-- Migration: Fix approver trigger to handle 'Report Ready' status
-- Date: 2025-11-16
-- Issue: Trigger only fires on 'Completed' status, but orders can also be 'Report Ready'
-- Fix: Update trigger to handle both 'Completed' and 'Report Ready' statuses

-- Update function to track approver on both statuses
CREATE OR REPLACE FUNCTION track_order_approver()
RETURNS TRIGGER AS $$
BEGIN
    -- When order status changes to 'Completed' or 'Report Ready', record who did it
    IF (NEW.status = 'Completed' OR NEW.status = 'Report Ready') 
       AND (OLD.status IS NULL OR (OLD.status != 'Completed' AND OLD.status != 'Report Ready')) 
       AND NEW.approved_by IS NULL THEN
        NEW.approved_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists, just needed function update
