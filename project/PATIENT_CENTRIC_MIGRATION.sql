-- ========================================
-- PATIENT-CENTRIC WORKFLOW MIGRATION
-- Run this script manually in your Supabase SQL editor
-- ========================================

-- Step 1: Add new columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id),
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'initial',
ADD COLUMN IF NOT EXISTS visit_group_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS addition_reason TEXT,
ADD COLUMN IF NOT EXISTS can_add_tests BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- Step 2: Add comments for documentation
COMMENT ON COLUMN orders.parent_order_id IS 'Links child orders to parent order for order chaining';
COMMENT ON COLUMN orders.order_type IS 'Type of order: initial, additional, urgent, follow_up';
COMMENT ON COLUMN orders.visit_group_id IS 'Groups all orders from same patient visit';
COMMENT ON COLUMN orders.addition_reason IS 'Reason why this order was added (for additional orders)';
COMMENT ON COLUMN orders.can_add_tests IS 'Whether more tests can be added to this order';
COMMENT ON COLUMN orders.locked_at IS 'Timestamp when order was locked from modifications';

-- Step 3: Create patient activity log table
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

-- Step 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_visit_group ON orders(visit_group_id);
CREATE INDEX IF NOT EXISTS idx_orders_patient_date ON orders(patient_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_can_add_tests ON orders(can_add_tests) WHERE can_add_tests = true;

CREATE INDEX IF NOT EXISTS idx_activity_patient_date ON patient_activity_log(patient_id, performed_at);
CREATE INDEX IF NOT EXISTS idx_activity_order ON patient_activity_log(order_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON patient_activity_log(activity_type);

-- Step 5: Create visit group ID generation function
CREATE OR REPLACE FUNCTION generate_visit_group_id(p_patient_id UUID, p_order_date DATE)
RETURNS VARCHAR(100) AS $$
DECLARE
  patient_display VARCHAR(20);
  date_str VARCHAR(20);
  sequence_num INTEGER;
BEGIN
  -- Get patient display ID or create one
  SELECT COALESCE(display_id, 'PAT' || LPAD(extract(day from p_order_date)::text, 2, '0')) 
  INTO patient_display 
  FROM patients 
  WHERE id = p_patient_id;
  
  -- Format: DDMONYY
  date_str := TO_CHAR(p_order_date, 'DDMONYY');
  
  -- Get next sequence number for this patient on this date
  SELECT COALESCE(MAX(CAST(RIGHT(visit_group_id, 3) AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM orders 
  WHERE patient_id = p_patient_id 
    AND order_date::date = p_order_date
    AND visit_group_id IS NOT NULL
    AND visit_group_id LIKE patient_display || '-' || date_str || '-%';
  
  -- Return format: PAT-02AUG25-001
  RETURN patient_display || '-' || date_str || '-' || LPAD(sequence_num::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create activity logging function
CREATE OR REPLACE FUNCTION log_patient_activity(
  p_patient_id UUID,
  p_order_id UUID,
  p_activity_type VARCHAR(50),
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_lab_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO patient_activity_log (
    patient_id,
    order_id,
    activity_type,
    description,
    metadata,
    performed_by,
    lab_id
  ) VALUES (
    p_patient_id,
    p_order_id,
    p_activity_type,
    p_description,
    p_metadata,
    p_performed_by,
    p_lab_id
  ) RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to auto-generate visit group IDs
CREATE OR REPLACE FUNCTION auto_generate_visit_group()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if visit_group_id is not already set
  IF NEW.visit_group_id IS NULL THEN
    NEW.visit_group_id := generate_visit_group_id(NEW.patient_id, NEW.order_date::date);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_auto_visit_group ON orders;
CREATE TRIGGER trigger_auto_visit_group
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_visit_group();

-- Step 8: Create trigger to auto-log order activities
CREATE OR REPLACE FUNCTION log_order_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_patient_activity(
      NEW.patient_id,
      NEW.id,
      'order_created',
      'Order created: ' || COALESCE(NEW.order_type, 'initial'),
      jsonb_build_object(
        'order_type', NEW.order_type,
        'visit_group_id', NEW.visit_group_id,
        'doctor', NEW.doctor,
        'total_amount', NEW.total_amount
      ),
      NEW.created_by,
      NEW.lab_id
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_patient_activity(
        NEW.patient_id,
        NEW.id,
        'status_changed',
        'Order status changed from ' || COALESCE(OLD.status, 'null') || ' to ' || COALESCE(NEW.status, 'null'),
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status
        ),
        NEW.created_by,
        NEW.lab_id
      );
    END IF;
    
    -- Log when order is locked
    IF OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL THEN
      PERFORM log_patient_activity(
        NEW.patient_id,
        NEW.id,
        'order_locked',
        'Order locked for modifications',
        jsonb_build_object(
          'locked_at', NEW.locked_at
        ),
        NEW.created_by,
        NEW.lab_id
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_log_order_activity ON orders;
CREATE TRIGGER trigger_log_order_activity
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_activity();

-- Step 9: Populate visit_group_id for existing orders (OPTIONAL)
-- Uncomment the following lines if you want to generate visit group IDs for existing orders

/*
UPDATE orders 
SET visit_group_id = generate_visit_group_id(patient_id, order_date::date)
WHERE visit_group_id IS NULL;
*/

-- Step 10: Create sample activity log entries for existing orders (OPTIONAL)
-- Uncomment the following lines if you want to create activity logs for existing orders

/*
INSERT INTO patient_activity_log (patient_id, order_id, activity_type, description, performed_at)
SELECT 
  patient_id, 
  id, 
  'order_created', 
  'Existing order migrated to patient-centric workflow',
  created_at
FROM orders
WHERE id NOT IN (SELECT DISTINCT order_id FROM patient_activity_log WHERE order_id IS NOT NULL);
*/

-- ========================================
-- VERIFICATION QUERIES
-- Run these to verify the migration worked
-- ========================================

-- Check if columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('parent_order_id', 'order_type', 'visit_group_id', 'addition_reason', 'can_add_tests', 'locked_at');

-- Check if activity log table was created
SELECT COUNT(*) as activity_log_count FROM patient_activity_log;

-- Check if functions were created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
  AND routine_name IN ('generate_visit_group_id', 'log_patient_activity');

-- Check if triggers were created
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_auto_visit_group', 'trigger_log_order_activity');

-- ========================================
-- MIGRATION COMPLETE
-- Your database now supports patient-centric workflow!
-- ========================================
