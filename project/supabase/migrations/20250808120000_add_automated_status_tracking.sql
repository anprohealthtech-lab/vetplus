-- Add automated status tracking fields to orders table
-- This enables automatic status progression based on result completion

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS status_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS status_updated_by text,
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivered_by text;

-- Add index for better query performance on status updates
CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at ON public.orders(status_updated_at);

-- Update existing orders to have status tracking info
UPDATE public.orders 
SET 
  status_updated_at = updated_at,
  status_updated_by = 'System Migration'
WHERE status_updated_at IS NULL;

-- Add comment explaining the automation
COMMENT ON COLUMN public.orders.status_updated_at IS 'Timestamp when order status was last automatically or manually updated';
COMMENT ON COLUMN public.orders.status_updated_by IS 'User or system that updated the order status (e.g., "System (Auto)", user email, etc.)';
COMMENT ON COLUMN public.orders.delivered_at IS 'Timestamp when order was marked as delivered';
COMMENT ON COLUMN public.orders.delivered_by IS 'User who marked the order as delivered';

-- Create or replace function to automatically update order status based on results
CREATE OR REPLACE FUNCTION public.auto_update_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- This function will be called after result inserts/updates
  -- It checks if all tests in an order have results and updates status accordingly
  
  -- Get order information
  DECLARE
    order_id UUID;
    total_tests INTEGER;
    completed_results INTEGER;
    approved_results INTEGER;
    current_status TEXT;
  BEGIN
    -- Get the order_id from the result
    order_id := COALESCE(NEW.order_id, OLD.order_id);
    
    IF order_id IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Get current order status and test counts
    SELECT o.status INTO current_status
    FROM orders o WHERE o.id = order_id;
    
    -- Count total tests for this order
    SELECT COUNT(*) INTO total_tests
    FROM order_tests ot WHERE ot.order_id = order_id;
    
    -- Count results with values (completed results)
    SELECT COUNT(DISTINCT r.id) INTO completed_results
    FROM results r 
    INNER JOIN result_values rv ON r.id = rv.result_id
    WHERE r.order_id = order_id;
    
    -- Count approved results
    SELECT COUNT(*) INTO approved_results
    FROM results r 
    WHERE r.order_id = order_id AND r.status = 'Approved';
    
    -- Auto-update status based on completion
    IF current_status = 'In Progress' AND completed_results >= total_tests AND total_tests > 0 THEN
      UPDATE orders 
      SET status = 'Pending Approval',
          status_updated_at = NOW(),
          status_updated_by = 'System (Auto)'
      WHERE id = order_id;
      
    ELSIF current_status = 'Pending Approval' AND approved_results >= total_tests AND total_tests > 0 THEN
      UPDATE orders 
      SET status = 'Completed',
          status_updated_at = NOW(),
          status_updated_by = 'System (Auto)'
      WHERE id = order_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
  END;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic status updates
-- Trigger on result insert/update
DROP TRIGGER IF EXISTS trigger_auto_update_order_status_on_result ON public.results;
CREATE TRIGGER trigger_auto_update_order_status_on_result
  AFTER INSERT OR UPDATE ON public.results
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

-- Trigger on result_values insert/update (when actual values are added)
DROP TRIGGER IF EXISTS trigger_auto_update_order_status_on_result_values ON public.result_values;
CREATE TRIGGER trigger_auto_update_order_status_on_result_values
  AFTER INSERT OR UPDATE ON public.result_values
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_order_status();

-- Add comments explaining the automation system
COMMENT ON FUNCTION public.auto_update_order_status() IS 'Automatically updates order status when results are submitted or approved. Moves from "In Progress" to "Pending Approval" when all results are submitted, and from "Pending Approval" to "Completed" when all results are approved.';
