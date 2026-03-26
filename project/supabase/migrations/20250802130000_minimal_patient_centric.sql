-- Migration: Minimal Patient-Centric Workflow Enhancement
-- Date: 2025-08-02
-- Purpose: Add patient journey tracking with minimal database changes

-- Add minimal columns to existing orders table for order chaining
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'initial';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS visit_group_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS addition_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS can_add_tests BOOLEAN DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Add comments for clarity
COMMENT ON COLUMN orders.parent_order_id IS 'Links to parent order for order chaining (follow-ups, additions)';
COMMENT ON COLUMN orders.order_type IS 'Type: initial, additional, urgent, follow_up, stat';
COMMENT ON COLUMN orders.visit_group_id IS 'Groups all orders from same patient visit';
COMMENT ON COLUMN orders.addition_reason IS 'Reason for creating additional order';
COMMENT ON COLUMN orders.can_add_tests IS 'Whether more tests can be added to this order';
COMMENT ON COLUMN orders.locked_at IS 'When order was locked from further modifications';

-- Create simple activity log table for comprehensive tracking
CREATE TABLE IF NOT EXISTS patient_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  lab_id UUID REFERENCES labs(id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_visit_group ON orders(visit_group_id);
CREATE INDEX IF NOT EXISTS idx_orders_patient_date ON orders(patient_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_can_add_tests ON orders(can_add_tests) WHERE can_add_tests = true;

CREATE INDEX IF NOT EXISTS idx_activity_patient_date ON patient_activity_log(patient_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_activity_order ON patient_activity_log(order_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON patient_activity_log(activity_type);

-- Function to auto-generate visit group ID
CREATE OR REPLACE FUNCTION generate_visit_group_id(p_patient_id UUID, p_order_date DATE)
RETURNS VARCHAR(100) AS $$
DECLARE
  patient_display VARCHAR(20);
  date_str VARCHAR(20);
  sequence_num INTEGER;
  visit_id VARCHAR(100);
BEGIN
  -- Get patient display ID or create abbreviated one
  SELECT COALESCE(
    NULLIF(display_id, ''), 
    'PAT' || LPAD(extract(day from p_order_date)::text, 2, '0')
  ) 
  INTO patient_display 
  FROM patients 
  WHERE id = p_patient_id;
  
  -- Format date as DDMONYY
  date_str := TO_CHAR(p_order_date, 'DDMONYY');
  
  -- Get sequence number for multiple visits on same day
  SELECT COUNT(DISTINCT visit_group_id) + 1
  INTO sequence_num
  FROM orders 
  WHERE patient_id = p_patient_id 
    AND order_date::date = p_order_date
    AND visit_group_id IS NOT NULL;
  
  -- Format: PAT02-02AUG25-001
  visit_id := patient_display || '-' || date_str;
  
  -- Add sequence if multiple visits same day
  IF sequence_num > 1 THEN
    visit_id := visit_id || '-' || LPAD(sequence_num::text, 3, '0');
  END IF;
  
  RETURN visit_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-populate visit_group_id for new orders
CREATE OR REPLACE FUNCTION auto_set_visit_group_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.visit_group_id IS NULL THEN
    NEW.visit_group_id := generate_visit_group_id(NEW.patient_id, NEW.order_date::date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set visit group ID
DROP TRIGGER IF EXISTS trigger_auto_set_visit_group_id ON orders;
CREATE TRIGGER trigger_auto_set_visit_group_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_visit_group_id();

-- Function to log activities automatically
CREATE OR REPLACE FUNCTION log_order_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO patient_activity_log (
      patient_id, order_id, activity_type, description, metadata, performed_by
    ) VALUES (
      NEW.patient_id, 
      NEW.id, 
      'order_created',
      CASE 
        WHEN NEW.order_type = 'initial' THEN 'Initial order created'
        WHEN NEW.order_type = 'additional' THEN 'Additional tests ordered'
        WHEN NEW.order_type = 'follow_up' THEN 'Follow-up order created'
        WHEN NEW.order_type = 'urgent' THEN 'Urgent order created'
        ELSE 'Order created'
      END,
      jsonb_build_object(
        'order_type', NEW.order_type,
        'priority', NEW.priority,
        'total_amount', NEW.total_amount,
        'visit_group_id', NEW.visit_group_id,
        'parent_order_id', NEW.parent_order_id
      ),
      NEW.created_by
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO patient_activity_log (
        patient_id, order_id, activity_type, description, metadata
      ) VALUES (
        NEW.patient_id,
        NEW.id,
        'status_changed',
        'Order status changed from ' || OLD.status || ' to ' || NEW.status,
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status,
          'changed_at', NOW()
        )
      );
    END IF;

    IF OLD.can_add_tests = true AND NEW.can_add_tests = false THEN
      INSERT INTO patient_activity_log (
        patient_id, order_id, activity_type, description, metadata
      ) VALUES (
        NEW.patient_id,
        NEW.id,
        'order_locked',
        'Order locked from further modifications',
        jsonb_build_object(
          'locked_at', NEW.locked_at,
          'reason', 'Sample collected or processing started'
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic activity logging
DROP TRIGGER IF EXISTS trigger_log_order_activity ON orders;
CREATE TRIGGER trigger_log_order_activity
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_activity();

-- Patient Visit Summary View
CREATE OR REPLACE VIEW patient_visit_summary AS
SELECT 
  o.visit_group_id,
  o.patient_id,
  p.name as patient_name,
  p.phone as patient_phone,
  p.email as patient_email,
  MIN(o.order_date) as visit_date,
  COUNT(o.id) as total_orders,
  COUNT(CASE WHEN o.order_type = 'initial' THEN 1 END) as initial_orders,
  COUNT(CASE WHEN o.order_type = 'additional' THEN 1 END) as additional_orders,
  COUNT(CASE WHEN o.order_type = 'follow_up' THEN 1 END) as followup_orders,
  SUM(o.total_amount) as total_visit_amount,
  STRING_AGG(DISTINCT o.status::text, ', ') as order_statuses,
  MAX(o.updated_at) as last_updated,
  CASE 
    WHEN COUNT(CASE WHEN o.status IN ('Completed', 'Delivered') THEN 1 END) = COUNT(o.id) 
    THEN 'All Complete'
    WHEN COUNT(CASE WHEN o.status = 'Sample Collection' THEN 1 END) > 0 
    THEN 'Sample Collection'
    WHEN COUNT(CASE WHEN o.status = 'In Progress' THEN 1 END) > 0 
    THEN 'In Progress'
    ELSE 'Pending'
  END as visit_status
FROM orders o
JOIN patients p ON o.patient_id = p.id
WHERE o.visit_group_id IS NOT NULL
GROUP BY o.visit_group_id, o.patient_id, p.name, p.phone, p.email;

-- Order Chain View
CREATE OR REPLACE VIEW order_chain_view AS
WITH RECURSIVE order_hierarchy AS (
  SELECT 
    id, patient_id, visit_group_id, order_type, parent_order_id,
    status, total_amount, order_date, created_at,
    0 as level,
    ARRAY[id] as path,
    id::text as chain_id
  FROM orders 
  WHERE parent_order_id IS NULL

  UNION ALL

  SELECT 
    o.id, o.patient_id, o.visit_group_id, o.order_type, o.parent_order_id,
    o.status, o.total_amount, o.order_date, o.created_at,
    oh.level + 1,
    oh.path || o.id,
    oh.chain_id
  FROM orders o
  JOIN order_hierarchy oh ON o.parent_order_id = oh.id
)
SELECT 
  oc.*,
  p.name as patient_name,
  CASE 
    WHEN oc.level = 0 THEN 'Primary Order'
    ELSE 'Child Order (Level ' || oc.level || ')'
  END as hierarchy_level
FROM order_hierarchy oc
JOIN patients p ON oc.patient_id = p.id
ORDER BY oc.visit_group_id, oc.path;

-- Patient Activity Timeline View
CREATE OR REPLACE VIEW patient_activity_timeline AS
SELECT 
  pal.id,
  pal.patient_id,
  p.name as patient_name,
  pal.order_id,
  o.visit_group_id,
  pal.activity_type,
  pal.description,
  pal.metadata,
  pal.performed_at,
  u.name as performed_by_name,
  o.order_type,
  ROW_NUMBER() OVER (
    PARTITION BY pal.patient_id, o.visit_group_id 
    ORDER BY pal.performed_at
  ) as sequence_in_visit
FROM patient_activity_log pal
JOIN patients p ON pal.patient_id = p.id
LEFT JOIN orders o ON pal.order_id = o.id
LEFT JOIN users u ON pal.performed_by = u.id
ORDER BY pal.patient_id, o.visit_group_id, pal.performed_at;

-- Utility functions
CREATE OR REPLACE FUNCTION get_patient_visit_chain(p_visit_group_id VARCHAR(100))
RETURNS TABLE (
  order_id UUID,
  order_type VARCHAR(50),
  status VARCHAR(50),
  total_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ,
  level INTEGER,
  is_parent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oc.id,
    oc.order_type,
    oc.status,
    oc.total_amount,
    oc.created_at,
    oc.level,
    (oc.parent_order_id IS NULL) as is_parent
  FROM order_chain_view oc
  WHERE oc.visit_group_id = p_visit_group_id
  ORDER BY oc.path;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_add_tests_to_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  order_record RECORD;
BEGIN
  SELECT 
    status, can_add_tests, locked_at, order_type,
    (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600) as hours_since_creation
  INTO order_record
  FROM orders 
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Order not found');
  END IF;

  IF NOT order_record.can_add_tests THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Order is locked', 'locked_at', order_record.locked_at, 'suggestion', 'Create new follow-up order');
  END IF;

  CASE order_record.status
    WHEN 'Sample Collection' THEN RETURN jsonb_build_object('allowed', true, 'method', 'modify_current', 'reason', 'Sample not yet collected');
    WHEN 'In Progress', 'Completed', 'Delivered' THEN RETURN jsonb_build_object('allowed', true, 'method', 'create_followup', 'reason', 'Cannot modify, create follow-up order');
    ELSE RETURN jsonb_build_object('allowed', true, 'method', 'modify_current', 'reason', 'Order is modifiable');
  END CASE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_linked_order(p_parent_order_id UUID, p_order_type VARCHAR(50), p_reason TEXT, p_created_by UUID)
RETURNS UUID AS $$
DECLARE
  parent_record RECORD;
  new_order_id UUID;
BEGIN
  SELECT patient_id, visit_group_id, doctor, lab_id
  INTO parent_record
  FROM orders
  WHERE id = p_parent_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent order not found';
  END IF;

  INSERT INTO orders (
    patient_id, parent_order_id, order_type, visit_group_id,
    doctor, addition_reason, created_by, lab_id,
    status, order_date
  ) VALUES (
    parent_record.patient_id, p_parent_order_id, p_order_type,
    parent_record.visit_group_id, parent_record.doctor, p_reason,
    p_created_by, parent_record.lab_id,
    'Sample Collection', CURRENT_DATE
  ) RETURNING id INTO new_order_id;

  INSERT INTO patient_activity_log (
    patient_id, order_id, activity_type, description, metadata, performed_by
  ) VALUES (
    parent_record.patient_id, new_order_id, 'order_linked',
    'New order linked to parent order',
    jsonb_build_object('parent_order_id', p_parent_order_id, 'order_type', p_order_type, 'reason', p_reason),
    p_created_by
  );

  RETURN new_order_id;
END;
$$ LANGUAGE plpgsql;

-- Populate visit_group_id for existing records
UPDATE orders 
SET visit_group_id = generate_visit_group_id(patient_id, order_date::date)
WHERE visit_group_id IS NULL;

-- Permissions
GRANT SELECT, INSERT, UPDATE ON patient_activity_log TO authenticated;
GRANT SELECT ON patient_visit_summary TO authenticated;
GRANT SELECT ON order_chain_view TO authenticated;
GRANT SELECT ON patient_activity_timeline TO authenticated;

GRANT EXECUTE ON FUNCTION get_patient_visit_chain(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION can_add_tests_to_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_linked_order(UUID, VARCHAR, TEXT, UUID) TO authenticated;

-- Table & View Comments
COMMENT ON TABLE patient_activity_log IS 'Comprehensive activity log for patient journey tracking';
COMMENT ON VIEW patient_visit_summary IS 'Summary view of patient visits with order aggregation';
COMMENT ON VIEW order_chain_view IS 'Hierarchical view of linked orders within patient visits';
COMMENT ON VIEW patient_activity_timeline IS 'Timeline view of all activities for patient visits';
