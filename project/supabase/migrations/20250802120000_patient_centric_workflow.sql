-- Migration: Patient-Centric Workflow Implementation
-- Date: 2025-08-02
-- Purpose: Transform order-centric to patient-centric lab workflow

-- Create new enums for the enhanced workflow
CREATE TYPE session_status AS ENUM ('active', 'completed', 'cancelled', 'archived');
CREATE TYPE request_type AS ENUM ('initial', 'additional', 'urgent', 'doctor_requested', 'follow_up');
CREATE TYPE test_request_status AS ENUM ('requested', 'approved', 'sample_collected', 'in_progress', 'completed', 'cancelled');
CREATE TYPE change_type AS ENUM ('session_created', 'test_added', 'test_removed', 'test_modified', 'status_changed', 'payment_updated');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'upi', 'insurance', 'credit');

-- Patient Sessions Table (Core of new workflow)
CREATE TABLE patient_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_number INTEGER NOT NULL, -- Daily sequence number per patient
  session_display_id VARCHAR(50) GENERATED ALWAYS AS (
    'SES-' || TO_CHAR(session_date, 'DDMONYY') || '-' || 
    LPAD(session_number::text, 3, '0')
  ) STORED,
  status session_status DEFAULT 'active',
  doctor VARCHAR(255),
  referring_physician VARCHAR(255),
  clinical_notes TEXT,
  special_instructions TEXT,
  estimated_total DECIMAL(10,2) DEFAULT 0,
  actual_total DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(8,2) DEFAULT 0,
  final_total DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending',
  lab_id UUID REFERENCES labs(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  UNIQUE(patient_id, session_date, session_number)
);

-- Test Requests Table (Replaces rigid orders)
CREATE TABLE test_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES patient_sessions(id) ON DELETE CASCADE,
  test_group_id UUID REFERENCES test_groups(id),
  individual_test_name VARCHAR(255), -- For standalone tests not in groups
  request_type request_type DEFAULT 'initial',
  status test_request_status DEFAULT 'requested',
  priority priority_type DEFAULT 'normal',
  sample_type sample_type,
  special_requirements TEXT,
  
  -- Sample collection tracking
  sample_collected_at TIMESTAMPTZ,
  sample_collected_by UUID REFERENCES users(id),
  sample_id VARCHAR(100), -- Physical sample identifier
  
  -- Cost tracking
  estimated_cost DECIMAL(8,2),
  actual_cost DECIMAL(8,2),
  discount_applied DECIMAL(6,2) DEFAULT 0,
  
  -- Request lifecycle
  requested_by UUID REFERENCES users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  started_by UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  
  -- Cancellation tracking
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Additional metadata
  notes TEXT,
  urgent_reason TEXT,
  lab_id UUID REFERENCES labs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Request Change Log (Audit trail)
CREATE TABLE test_request_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES patient_sessions(id),
  test_request_id UUID REFERENCES test_requests(id),
  change_type change_type NOT NULL,
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  change_details JSONB,
  reason TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Billing Summary
CREATE TABLE session_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES patient_sessions(id) ON DELETE CASCADE,
  
  -- Cost breakdown
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(8,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_percentage DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(8,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Payment tracking
  payment_method payment_method,
  advance_payment DECIMAL(10,2) DEFAULT 0,
  payment_received DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  
  -- Invoice details
  invoice_number VARCHAR(50),
  invoice_generated_at TIMESTAMPTZ,
  invoice_url TEXT,
  
  -- Payment completion
  payment_completed_at TIMESTAMPTZ,
  payment_reference VARCHAR(100),
  payment_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Sample Tracking
CREATE TABLE session_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES patient_sessions(id) ON DELETE CASCADE,
  sample_id VARCHAR(100) NOT NULL, -- Physical tube/container ID
  sample_type sample_type NOT NULL,
  collection_time TIMESTAMPTZ DEFAULT NOW(),
  collected_by UUID REFERENCES users(id),
  collection_notes TEXT,
  sample_condition VARCHAR(50) DEFAULT 'good', -- good, hemolyzed, lipemic, etc.
  storage_location VARCHAR(100),
  disposal_date DATE,
  lab_id UUID REFERENCES labs(id),
  UNIQUE(sample_id, lab_id)
);

-- Link test requests to samples
CREATE TABLE test_request_samples (
  test_request_id UUID REFERENCES test_requests(id) ON DELETE CASCADE,
  sample_id UUID REFERENCES session_samples(id) ON DELETE CASCADE,
  volume_required DECIMAL(6,2), -- ml
  volume_used DECIMAL(6,2), -- ml
  PRIMARY KEY (test_request_id, sample_id)
);

-- Create indexes for performance
CREATE INDEX idx_patient_sessions_patient_date ON patient_sessions(patient_id, session_date);
CREATE INDEX idx_patient_sessions_status ON patient_sessions(status);
CREATE INDEX idx_patient_sessions_lab ON patient_sessions(lab_id);

CREATE INDEX idx_test_requests_session ON test_requests(session_id);
CREATE INDEX idx_test_requests_status ON test_requests(status);
CREATE INDEX idx_test_requests_sample_collected ON test_requests(sample_collected_at);

CREATE INDEX idx_test_request_changes_session ON test_request_changes(session_id);
CREATE INDEX idx_test_request_changes_timestamp ON test_request_changes(changed_at);

CREATE INDEX idx_session_samples_session ON session_samples(session_id);
CREATE INDEX idx_session_samples_type ON session_samples(sample_type);

-- Trigger to auto-generate session numbers
CREATE OR REPLACE FUNCTION generate_session_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the next session number for this patient on this date
  SELECT COALESCE(MAX(session_number), 0) + 1
  INTO NEW.session_number
  FROM patient_sessions
  WHERE patient_id = NEW.patient_id 
    AND session_date = NEW.session_date;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_session_number
  BEFORE INSERT ON patient_sessions
  FOR EACH ROW
  EXECUTE FUNCTION generate_session_number();

-- Trigger to update session totals when test requests change
CREATE OR REPLACE FUNCTION update_session_totals()
RETURNS TRIGGER AS $$
DECLARE
  session_record RECORD;
BEGIN
  -- Get the affected session ID
  DECLARE session_id_to_update UUID;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      session_id_to_update := OLD.session_id;
    ELSE
      session_id_to_update := NEW.session_id;
    END IF;
    
    -- Calculate new totals
    SELECT 
      COALESCE(SUM(estimated_cost), 0) as estimated_total,
      COALESCE(SUM(actual_cost), 0) as actual_total,
      COALESCE(SUM(CASE WHEN status IN ('completed', 'in_progress') THEN actual_cost ELSE estimated_cost END), 0) as final_total
    INTO session_record
    FROM test_requests
    WHERE session_id = session_id_to_update 
      AND status != 'cancelled';
    
    -- Update the session
    UPDATE patient_sessions
    SET 
      estimated_total = session_record.estimated_total,
      actual_total = session_record.actual_total,
      final_total = session_record.final_total - COALESCE(discount_amount, 0),
      updated_at = NOW()
    WHERE id = session_id_to_update;
    
    RETURN COALESCE(NEW, OLD);
  END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_totals
  AFTER INSERT OR UPDATE OR DELETE ON test_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_session_totals();

-- Trigger to log changes to test requests
CREATE OR REPLACE FUNCTION log_test_request_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO test_request_changes (
      session_id, test_request_id, change_type, 
      new_value, changed_by, change_details
    ) VALUES (
      NEW.session_id, NEW.id, 'test_added',
      COALESCE(NEW.individual_test_name, 'Test Group: ' || NEW.test_group_id::text),
      NEW.requested_by,
      jsonb_build_object(
        'request_type', NEW.request_type,
        'priority', NEW.priority,
        'estimated_cost', NEW.estimated_cost
      )
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status != NEW.status THEN
      INSERT INTO test_request_changes (
        session_id, test_request_id, change_type,
        field_changed, old_value, new_value, changed_by
      ) VALUES (
        NEW.session_id, NEW.id, 'status_changed',
        'status', OLD.status::text, NEW.status::text,
        NEW.updated_by
      );
    END IF;
    
    -- Log cost changes
    IF OLD.actual_cost != NEW.actual_cost THEN
      INSERT INTO test_request_changes (
        session_id, test_request_id, change_type,
        field_changed, old_value, new_value, changed_by
      ) VALUES (
        NEW.session_id, NEW.id, 'test_modified',
        'actual_cost', OLD.actual_cost::text, NEW.actual_cost::text,
        NEW.updated_by
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO test_request_changes (
      session_id, test_request_id, change_type,
      old_value, changed_by, reason
    ) VALUES (
      OLD.session_id, OLD.id, 'test_removed',
      COALESCE(OLD.individual_test_name, 'Test Group: ' || OLD.test_group_id::text),
      OLD.cancelled_by,
      OLD.cancellation_reason
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add updated_by field to test_requests for change tracking
ALTER TABLE test_requests ADD COLUMN updated_by UUID REFERENCES users(id);

CREATE TRIGGER trigger_log_test_request_changes
  AFTER INSERT OR UPDATE OR DELETE ON test_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_test_request_changes();

-- Create useful views for the application

-- Active Sessions View
CREATE VIEW active_patient_sessions AS
SELECT 
  ps.*,
  p.name as patient_name,
  p.phone as patient_phone,
  p.email as patient_email,
  COUNT(tr.id) as total_tests,
  COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as completed_tests,
  COUNT(CASE WHEN tr.status = 'cancelled' THEN 1 END) as cancelled_tests,
  MAX(tr.sample_collected_at) as last_sample_time,
  SUM(CASE WHEN tr.status != 'cancelled' THEN tr.estimated_cost ELSE 0 END) as estimated_total,
  SUM(CASE WHEN tr.status != 'cancelled' THEN COALESCE(tr.actual_cost, tr.estimated_cost) ELSE 0 END) as current_total
FROM patient_sessions ps
JOIN patients p ON ps.patient_id = p.id
LEFT JOIN test_requests tr ON ps.id = tr.session_id
WHERE ps.status = 'active'
GROUP BY ps.id, p.name, p.phone, p.email;

-- Session Summary View
CREATE VIEW session_summary AS
SELECT 
  ps.id,
  ps.session_display_id,
  ps.session_date,
  ps.status as session_status,
  p.name as patient_name,
  p.display_id as patient_display_id,
  ps.doctor,
  COUNT(tr.id) as total_tests,
  COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as completed_tests,
  COUNT(CASE WHEN tr.status IN ('requested', 'approved', 'sample_collected', 'in_progress') THEN 1 END) as pending_tests,
  ps.final_total,
  sb.payment_received,
  sb.balance_due,
  ps.created_at,
  ps.updated_at
FROM patient_sessions ps
JOIN patients p ON ps.patient_id = p.id
LEFT JOIN test_requests tr ON ps.id = tr.session_id AND tr.status != 'cancelled'
LEFT JOIN session_billing sb ON ps.id = sb.session_id
GROUP BY ps.id, ps.session_display_id, ps.session_date, ps.status, 
         p.name, p.display_id, ps.doctor, ps.final_total, 
         sb.payment_received, sb.balance_due, ps.created_at, ps.updated_at;

-- Test Request Details View
CREATE VIEW test_request_details AS
SELECT 
  tr.id,
  tr.session_id,
  ps.session_display_id,
  ps.patient_id,
  p.name as patient_name,
  COALESCE(tr.individual_test_name, tg.name) as test_name,
  tr.request_type,
  tr.status,
  tr.priority,
  tr.sample_type,
  tr.estimated_cost,
  tr.actual_cost,
  tr.sample_collected_at,
  tr.completed_at,
  tr.requested_at,
  u_req.name as requested_by_name,
  u_coll.name as collected_by_name,
  tr.notes
FROM test_requests tr
JOIN patient_sessions ps ON tr.session_id = ps.id
JOIN patients p ON ps.patient_id = p.id
LEFT JOIN test_groups tg ON tr.test_group_id = tg.id
LEFT JOIN users u_req ON tr.requested_by = u_req.id
LEFT JOIN users u_coll ON tr.sample_collected_by = u_coll.id;

-- Add helpful functions

-- Function to get session timeline
CREATE OR REPLACE FUNCTION get_session_timeline(session_uuid UUID)
RETURNS TABLE (
  timestamp TIMESTAMPTZ,
  event_type TEXT,
  description TEXT,
  user_name TEXT,
  details JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    trc.changed_at as timestamp,
    trc.change_type::text as event_type,
    CASE 
      WHEN trc.change_type = 'test_added' THEN 'Test added: ' || trc.new_value
      WHEN trc.change_type = 'test_removed' THEN 'Test removed: ' || trc.old_value
      WHEN trc.change_type = 'status_changed' THEN 'Status changed from ' || trc.old_value || ' to ' || trc.new_value
      ELSE trc.change_type::text
    END as description,
    u.name as user_name,
    trc.change_details as details
  FROM test_request_changes trc
  LEFT JOIN users u ON trc.changed_by = u.id
  WHERE trc.session_id = session_uuid
  ORDER BY trc.changed_at;
END;
$$ LANGUAGE plpgsql;

-- Function to check if tests can be added to a session
CREATE OR REPLACE FUNCTION can_add_test_to_session(
  session_uuid UUID,
  test_sample_type sample_type,
  user_role TEXT DEFAULT 'technician'
)
RETURNS JSONB AS $$
DECLARE
  session_info RECORD;
  sample_collected BOOLEAN;
  result JSONB;
BEGIN
  -- Get session information
  SELECT status, created_at INTO session_info
  FROM patient_sessions WHERE id = session_uuid;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Session not found');
  END IF;
  
  -- Check if session is active
  IF session_info.status != 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Session is not active');
  END IF;
  
  -- Check if sample of this type has been collected
  SELECT EXISTS(
    SELECT 1 FROM test_requests 
    WHERE session_id = session_uuid 
      AND sample_type = test_sample_type 
      AND sample_collected_at IS NOT NULL
  ) INTO sample_collected;
  
  -- Rules based on collection status
  IF NOT sample_collected THEN
    -- Before collection: all tests allowed
    RETURN jsonb_build_object(
      'allowed', true, 
      'reason', 'Sample not yet collected - all tests allowed',
      'requires_approval', false
    );
  ELSE
    -- After collection: depends on sample type and user role
    IF user_role IN ('doctor', 'admin') THEN
      RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'Doctor/Admin can add tests anytime',
        'requires_approval', false,
        'may_need_new_sample', true
      );
    ELSE
      RETURN jsonb_build_object(
        'allowed', true,
        'reason', 'Test can be added but may require approval',
        'requires_approval', true,
        'may_need_new_sample', true
      );
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE patient_sessions IS 'Core table for patient-centric workflow - represents a single patient visit/session';
COMMENT ON TABLE test_requests IS 'Individual test requests within a session - replaces rigid order system';
COMMENT ON TABLE test_request_changes IS 'Audit trail for all changes to test requests';
COMMENT ON TABLE session_billing IS 'Consolidated billing information for entire patient session';
COMMENT ON TABLE session_samples IS 'Physical sample tracking linked to sessions';

COMMENT ON COLUMN patient_sessions.session_display_id IS 'Human-readable session ID in format SES-DDMONYY-001';
COMMENT ON COLUMN test_requests.request_type IS 'Type of request: initial, additional, urgent, doctor_requested, follow_up';
COMMENT ON COLUMN test_requests.individual_test_name IS 'For standalone tests not part of test groups';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON patient_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON test_requests TO authenticated;
GRANT SELECT, INSERT ON test_request_changes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON session_billing TO authenticated;
GRANT SELECT, INSERT, UPDATE ON session_samples TO authenticated;
GRANT SELECT, INSERT, UPDATE ON test_request_samples TO authenticated;

GRANT SELECT ON active_patient_sessions TO authenticated;
GRANT SELECT ON session_summary TO authenticated;
GRANT SELECT ON test_request_details TO authenticated;
