-- Fix order status calculation to only count result_values with actual values
-- This prevents counting placeholder/empty result rows as "completed"

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
  -- FIXED: Only count result_values that have actual non-empty values
  SELECT 
    COUNT(CASE WHEN rv.id IS NOT NULL AND rv.value IS NOT NULL AND rv.value != '' THEN 1 END) as with_values,
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_and_update_order_status(UUID) TO authenticated;
