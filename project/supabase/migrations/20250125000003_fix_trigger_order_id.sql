-- Fix the auto_update_order_status trigger function to work with both results and result_values tables
-- Now that result_values table has order_id column, we can use it directly

BEGIN;

-- Create or replace function to automatically update order status based on results
-- This simplified version works since both tables now have order_id column
CREATE OR REPLACE FUNCTION public.auto_update_order_status()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_total_tests INTEGER;
    v_completed_results INTEGER;
    v_approved_results INTEGER;
    v_current_status TEXT;
BEGIN
    -- Get the order_id from either table (both now have order_id)
    v_order_id := COALESCE(NEW.order_id, OLD.order_id);
    
    IF v_order_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get current order status
    SELECT o.status INTO v_current_status
    FROM orders o WHERE o.id = v_order_id;
    
    -- Count total tests for this order
    SELECT COUNT(*) INTO v_total_tests
    FROM order_tests ot WHERE ot.order_id = v_order_id;
    
    -- Count results with values (completed results)
    SELECT COUNT(DISTINCT r.id) INTO v_completed_results
    FROM results r 
    INNER JOIN result_values rv ON r.id = rv.result_id
    WHERE r.order_id = v_order_id;
    
    -- Count approved results
    SELECT COUNT(*) INTO v_approved_results
    FROM results r 
    WHERE r.order_id = v_order_id AND r.status = 'Approved';
    
    -- Auto-update status based on completion
    IF v_current_status = 'In Progress' AND v_completed_results >= v_total_tests AND v_total_tests > 0 THEN
      UPDATE orders 
      SET status = 'Pending Approval',
          status_updated_at = NOW(),
          status_updated_by = 'System (Auto)'
      WHERE id = v_order_id;
      
    ELSIF v_current_status = 'Pending Approval' AND v_approved_results >= v_total_tests AND v_total_tests > 0 THEN
      UPDATE orders 
      SET status = 'Completed',
          status_updated_at = NOW(),
          status_updated_by = 'System (Auto)'
      WHERE id = v_order_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the triggers with the fixed function
DROP TRIGGER IF EXISTS trigger_auto_update_order_status_on_result ON public.results;
CREATE TRIGGER trigger_auto_update_order_status_on_result
  AFTER INSERT OR UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

DROP TRIGGER IF EXISTS trigger_auto_update_order_status_on_result_values ON public.result_values;
CREATE TRIGGER trigger_auto_update_order_status_on_result_values
  AFTER INSERT OR UPDATE ON public.result_values
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

-- Add comments explaining the fix
COMMENT ON FUNCTION public.auto_update_order_status() IS 'Automatically updates order status when results are submitted or approved. Fixed to handle both results table (has order_id) and result_values table (uses result_id to get order_id).';

COMMIT;
