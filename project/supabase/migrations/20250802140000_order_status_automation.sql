-- Migration: Order Status Automation
-- Date: 2025-08-02
-- Purpose: Add fields to track automated status changes and delivery

-- Add status tracking columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_by VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by VARCHAR(255);

-- Add comments for clarity
COMMENT ON COLUMN orders.status_updated_at IS 'When status was last automatically updated';
COMMENT ON COLUMN orders.status_updated_by IS 'Who/what updated the status (user or system)';
COMMENT ON COLUMN orders.delivered_at IS 'When order was marked as delivered';
COMMENT ON COLUMN orders.delivered_by IS 'Who marked the order as delivered';

-- Create function to automatically update order status based on results
CREATE OR REPLACE FUNCTION check_and_update_order_status(p_order_id UUID)
RETURNS JSON AS $$
DECLARE
  order_record RECORD;
  total_tests INTEGER;
  results_with_values INTEGER;
  approved_results INTEGER;
  new_status VARCHAR(50);
  status_changed BOOLEAN := FALSE;
  result_json JSON;
BEGIN
  -- Get order with related data
  SELECT 
    o.*,
    COUNT(DISTINCT ot.id) as test_count
  INTO order_record
  FROM orders o
  LEFT JOIN order_tests ot ON o.id = ot.order_id
  WHERE o.id = p_order_id
  GROUP BY o.id, o.patient_id, o.patient_name, o.status, o.priority, o.order_date, o.expected_date, o.doctor, o.total_amount, o.created_by, o.created_at, o.updated_at;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Order not found');
  END IF;

  total_tests := order_record.test_count;
  
  -- Count results by status
  SELECT 
    COUNT(CASE WHEN rv.id IS NOT NULL THEN 1 END) as with_values,
    COUNT(CASE WHEN r.status = 'Approved' THEN 1 END) as approved
  INTO results_with_values, approved_results
  FROM results r
  LEFT JOIN result_values rv ON r.id = rv.result_id
  WHERE r.order_id = p_order_id;
  
  new_status := order_record.status;
  
  -- Determine new status based on completion
  IF order_record.status = 'In Progress' THEN
    -- If all tests have results submitted, move to Pending Approval
    IF results_with_values >= total_tests AND total_tests > 0 THEN
      new_status := 'Pending Approval';
    END IF;
  ELSIF order_record.status = 'Pending Approval' THEN
    -- If all results are approved, move to Completed
    IF approved_results >= total_tests AND total_tests > 0 THEN
      new_status := 'Completed';
    END IF;
  END IF;
  
  -- Update status if it changed
  IF new_status != order_record.status THEN
    UPDATE orders 
    SET 
      status = new_status,
      status_updated_at = NOW(),
      status_updated_by = 'System (Auto)'
    WHERE id = p_order_id;
    
    status_changed := TRUE;
    
    -- Log the status change
    INSERT INTO patient_activity_log (
      patient_id,
      order_id,
      activity_type,
      description,
      metadata,
      performed_at
    ) VALUES (
      order_record.patient_id,
      p_order_id,
      'status_auto_updated',
      'Order status automatically updated from ' || order_record.status || ' to ' || new_status,
      json_build_object(
        'previous_status', order_record.status,
        'new_status', new_status,
        'total_tests', total_tests,
        'results_with_values', results_with_values,
        'approved_results', approved_results
      ),
      NOW()
    );
  END IF;
  
  -- Return result
  result_json := json_build_object(
    'order_id', p_order_id,
    'previous_status', order_record.status,
    'new_status', new_status,
    'status_changed', status_changed,
    'total_tests', total_tests,
    'results_with_values', results_with_values,
    'approved_results', approved_results
  );
  
  RETURN result_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to automatically check status when results are inserted/updated
CREATE OR REPLACE FUNCTION trigger_check_order_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Check and update order status when result is inserted or updated
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM check_and_update_order_status(NEW.order_id);
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic status checking
DROP TRIGGER IF EXISTS trigger_results_status_check ON results;
CREATE TRIGGER trigger_results_status_check
  AFTER INSERT OR UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_order_status();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_status_updated ON orders(status_updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_delivered ON orders(delivered_at) WHERE delivered_at IS NOT NULL;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_and_update_order_status(UUID) TO authenticated;
