-- =============================================
-- LIMS REFUND MANAGEMENT SYSTEM
-- Migration for: user_role enum, invoices, refund_requests, cash_register, triggers, RLS
-- Created: 2025-11-27
-- =============================================

-- =============================================
-- PART 0: ADD MISSING USER ROLE ENUM VALUES
-- =============================================

-- First, check and add missing enum values to user_role type
-- Using a DO block to handle the case where values already exist

DO $$
BEGIN
  -- Add 'Lab Manager' if it doesn't exist (using this instead of 'Lab Admin')
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Lab Manager' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Lab Manager';
  END IF;
  
  -- Add other roles if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Manager' AND enumtypid = 'user_role'::regtype) THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Manager';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Some enum values may already exist or type does not exist: %', SQLERRM;
END $$;

-- =============================================
-- PART 1: EXTEND INVOICES TABLE
-- =============================================

-- Add refund tracking columns
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS total_refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Add refund_status with CHECK constraint (avoiding enum for flexibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'refund_status'
  ) THEN
    ALTER TABLE invoices ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'not_requested';
    ALTER TABLE invoices ADD CONSTRAINT invoices_refund_status_check 
      CHECK (refund_status IN ('not_requested', 'pending', 'partially_refunded', 'fully_refunded'));
  END IF;
END $$;

-- Add computed amount_paid (sum from payments table - we'll use a trigger instead of generated column)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoices.total_refunded_amount IS 'Cumulative amount refunded for this invoice';
COMMENT ON COLUMN invoices.refund_status IS 'Refund workflow status: not_requested | pending | partially_refunded | fully_refunded';
COMMENT ON COLUMN invoices.amount_paid IS 'Total payments received (auto-calculated from payments table)';

CREATE INDEX IF NOT EXISTS idx_invoices_refund_status 
  ON invoices(refund_status) WHERE refund_status != 'not_requested';

-- =============================================
-- PART 2: CREATE REFUND_REQUESTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Lab & Location context (multi-lab support)
  lab_id UUID NOT NULL REFERENCES labs(id),
  location_id UUID REFERENCES locations(id),
  
  -- Source reference (what's being refunded)
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  
  -- Financial details
  refund_amount NUMERIC(10,2) NOT NULL CHECK (refund_amount > 0),
  refunded_items JSONB DEFAULT '[]'::jsonb,  
  -- Format: [{"item_id": "uuid", "test_name": "CBC", "amount": 500, "reason": "test cancelled"}]
  
  refund_method TEXT NOT NULL CHECK (refund_method IN (
    'cash', 'card', 'upi', 'cheque', 'net_banking', 'wallet', 'bank_transfer', 'credit_adjustment'
  )),
  
  -- Workflow state
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
    'draft',              -- Created but not submitted
    'pending_approval',   -- Awaiting lab admin authorization
    'approved',           -- Approved by admin, awaiting disbursement
    'rejected',           -- Rejected by admin
    'paid',               -- Refund completed/disbursed
    'cancelled'           -- Request cancelled by requester
  )),
  
  -- Reason & Notes
  reason_category TEXT CHECK (reason_category IN (
    'test_cancelled', 'duplicate_billing', 'patient_request', 
    'price_correction', 'insurance_adjustment', 'error_correction', 'other'
  )),
  reason_details TEXT,
  admin_notes TEXT,        -- Notes from approver
  rejection_reason TEXT,   -- Required if rejected
  
  -- Audit trail - WHO did WHAT and WHEN
  requested_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  rejected_by UUID REFERENCES users(id),
  paid_by UUID REFERENCES users(id),
  cancelled_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,      -- When moved from draft to pending
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_refund_requests_lab_id ON refund_requests(lab_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_invoice_id ON refund_requests(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_patient_id ON refund_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_location_id ON refund_requests(location_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_pending ON refund_requests(lab_id, status) 
  WHERE status = 'pending_approval';

COMMENT ON TABLE refund_requests IS 'Tracks refund requests with admin approval workflow';

-- =============================================
-- PART 3: EXTEND CASH_REGISTER FOR REFUNDS
-- =============================================

ALTER TABLE cash_register 
ADD COLUMN IF NOT EXISTS total_collections NUMERIC(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_refunds NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Update system_amount to be collections minus refunds
COMMENT ON COLUMN cash_register.total_collections IS 'Total cash collected (from payments table)';
COMMENT ON COLUMN cash_register.total_refunds IS 'Total cash refunded (from refund_requests table)';
COMMENT ON COLUMN cash_register.system_amount IS 'Net cash = total_collections - total_refunds';

-- Need unique constraint for upsert (add if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cash_register_unique_day'
  ) THEN
    ALTER TABLE cash_register 
    ADD CONSTRAINT cash_register_unique_day UNIQUE (lab_id, location_id, register_date, shift);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Constraint may already exist: %', SQLERRM;
END $$;

-- =============================================
-- PART 4: TRIGGER - SYNC INVOICE AMOUNT_PAID
-- =============================================

CREATE OR REPLACE FUNCTION sync_invoice_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the invoice's amount_paid from all payments
  UPDATE invoices
  SET amount_paid = COALESCE((
    SELECT SUM(amount) FROM payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
  ), 0),
  updated_at = now()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_invoice_amount_paid ON payments;
CREATE TRIGGER trigger_sync_invoice_amount_paid
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_amount_paid();

-- =============================================
-- PART 5: TRIGGER - UPDATE INVOICE REFUND TOTALS
-- =============================================

CREATE OR REPLACE FUNCTION update_invoice_refund_totals()
RETURNS TRIGGER AS $$
DECLARE
  total_refunded NUMERIC(10,2);
  paid_amt NUMERIC(10,2);
  inv_id UUID;
BEGIN
  -- Determine which invoice to update
  inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate total refunded amount for this invoice (only 'paid' refunds count)
  SELECT COALESCE(SUM(refund_amount), 0) INTO total_refunded
  FROM refund_requests
  WHERE invoice_id = inv_id AND status = 'paid';
  
  -- Get paid amount from invoice
  SELECT amount_paid INTO paid_amt FROM invoices WHERE id = inv_id;
  
  -- Update invoice with new totals
  UPDATE invoices
  SET 
    total_refunded_amount = total_refunded,
    refund_status = CASE
      WHEN total_refunded = 0 THEN 'not_requested'
      WHEN total_refunded >= COALESCE(paid_amt, 0) THEN 'fully_refunded'
      ELSE 'partially_refunded'
    END,
    updated_at = now()
  WHERE id = inv_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_refund_totals ON refund_requests;
CREATE TRIGGER trigger_update_invoice_refund_totals
  AFTER INSERT OR UPDATE OR DELETE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_refund_totals();

-- =============================================
-- PART 6: TRIGGER - PREVENT OVER-REFUNDING
-- =============================================

CREATE OR REPLACE FUNCTION prevent_over_refund()
RETURNS TRIGGER AS $$
DECLARE
  existing_refunds NUMERIC(10,2);
  paid_amt NUMERIC(10,2);
  max_refundable NUMERIC(10,2);
BEGIN
  -- Only check when approving or marking as paid
  IF NEW.status NOT IN ('approved', 'paid') THEN
    RETURN NEW;
  END IF;
  
  -- Get sum of already approved/paid refunds (excluding this one if update)
  SELECT COALESCE(SUM(refund_amount), 0) INTO existing_refunds
  FROM refund_requests
  WHERE invoice_id = NEW.invoice_id 
    AND status IN ('approved', 'paid')
    AND id != NEW.id;
  
  -- Get paid amount from invoice
  SELECT amount_paid INTO paid_amt FROM invoices WHERE id = NEW.invoice_id;
  
  -- Calculate max refundable
  max_refundable := COALESCE(paid_amt, 0) - existing_refunds;
  
  -- Check if refund would exceed paid amount
  IF NEW.refund_amount > max_refundable THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds maximum refundable amount (%). Already refunded: %', 
      NEW.refund_amount, max_refundable, existing_refunds
      USING ERRCODE = 'check_violation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_over_refund ON refund_requests;
CREATE TRIGGER trigger_prevent_over_refund
  BEFORE INSERT OR UPDATE ON refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_over_refund();

-- =============================================
-- PART 7: TRIGGER - UPDATE CASH REGISTER ON REFUND
-- =============================================

CREATE OR REPLACE FUNCTION update_cash_register_refunds()
RETURNS TRIGGER AS $$
DECLARE
  refund_date DATE;
  v_lab_id UUID;
  v_location_id UUID;
BEGIN
  -- Only process cash refunds that are marked as paid
  IF NEW.refund_method != 'cash' OR NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;
  
  -- Get refund details
  refund_date := COALESCE(NEW.paid_at::DATE, CURRENT_DATE);
  v_lab_id := NEW.lab_id;
  v_location_id := NEW.location_id;
  
  -- Update existing cash register entry for this date/location
  UPDATE cash_register
  SET 
    total_refunds = total_refunds + NEW.refund_amount,
    system_amount = total_collections - (total_refunds + NEW.refund_amount)
  WHERE lab_id = v_lab_id 
    AND (location_id = v_location_id OR (location_id IS NULL AND v_location_id IS NULL))
    AND register_date = refund_date;
  
  -- If no row updated, the cash register entry doesn't exist yet - that's OK
  -- The refund will be picked up when the register is created/reconciled
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cash_register_refunds ON refund_requests;
CREATE TRIGGER trigger_update_cash_register_refunds
  AFTER UPDATE ON refund_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'paid')
  EXECUTE FUNCTION update_cash_register_refunds();

-- =============================================
-- PART 8: VIEW - DAILY CASH SUMMARY
-- =============================================

CREATE OR REPLACE VIEW v_daily_cash_summary AS
SELECT 
  p.lab_id,
  p.location_id,
  l.name AS location_name,
  p.payment_date AS summary_date,
  
  -- Collections
  SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) AS cash_collections,
  SUM(CASE WHEN p.payment_method != 'cash' THEN p.amount ELSE 0 END) AS non_cash_collections,
  SUM(p.amount) AS total_collections,
  
  -- Refunds (subquery for cash refunds on same date)
  COALESCE((
    SELECT SUM(r.refund_amount) 
    FROM refund_requests r 
    WHERE r.lab_id = p.lab_id 
      AND (r.location_id = p.location_id OR (r.location_id IS NULL AND p.location_id IS NULL))
      AND r.paid_at::DATE = p.payment_date
      AND r.refund_method = 'cash'
      AND r.status = 'paid'
  ), 0) AS cash_refunds,
  
  -- Net cash
  SUM(CASE WHEN p.payment_method = 'cash' THEN p.amount ELSE 0 END) - 
  COALESCE((
    SELECT SUM(r.refund_amount) 
    FROM refund_requests r 
    WHERE r.lab_id = p.lab_id 
      AND (r.location_id = p.location_id OR (r.location_id IS NULL AND p.location_id IS NULL))
      AND r.paid_at::DATE = p.payment_date
      AND r.refund_method = 'cash'
      AND r.status = 'paid'
  ), 0) AS net_cash,
  
  -- Counts
  COUNT(*) AS payment_count,
  COUNT(DISTINCT p.invoice_id) AS invoice_count

FROM payments p
LEFT JOIN locations l ON l.id = p.location_id
WHERE p.payment_date IS NOT NULL
GROUP BY p.lab_id, p.location_id, l.name, p.payment_date
ORDER BY p.payment_date DESC;

-- =============================================
-- PART 9: VIEW - PENDING REFUND APPROVALS
-- =============================================

CREATE OR REPLACE VIEW v_pending_refund_approvals AS
SELECT 
  rr.id,
  rr.lab_id,
  rr.location_id,
  rr.invoice_id,
  rr.patient_id,
  rr.refund_amount,
  rr.refund_method,
  rr.reason_category,
  rr.reason_details,
  rr.status,
  rr.created_at,
  rr.submitted_at,
  
  -- Invoice details
  i.total AS invoice_total,
  i.amount_paid,
  i.total_refunded_amount AS already_refunded,
  (i.amount_paid - i.total_refunded_amount) AS max_refundable,
  
  -- Patient details
  pt.name AS patient_name,
  pt.phone AS patient_phone,
  
  -- Requester details
  u.name AS requested_by_name,
  
  -- Location details
  l.name AS location_name,
  
  -- Time waiting
  EXTRACT(EPOCH FROM (now() - rr.created_at))/3600 AS hours_pending

FROM refund_requests rr
JOIN invoices i ON i.id = rr.invoice_id
JOIN patients pt ON pt.id = rr.patient_id
JOIN users u ON u.id = rr.requested_by
LEFT JOIN locations l ON l.id = rr.location_id
WHERE rr.status = 'pending_approval'
ORDER BY rr.created_at ASC;

-- =============================================
-- PART 10: HELPER FUNCTION - CHECK ADMIN
-- Uses 'Admin', 'Lab Manager', 'Manager' roles
-- =============================================

CREATE OR REPLACE FUNCTION is_lab_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_admin_role BOOLEAN;
BEGIN
  -- Check direct role enum (using Lab Manager instead of Lab Admin)
  SELECT role::TEXT INTO user_role FROM users WHERE id = p_user_id;
  IF user_role IN ('Admin', 'Lab Manager', 'Manager') THEN
    RETURN TRUE;
  END IF;
  
  -- Check via user_roles table (for expanded RBAC)
  SELECT EXISTS (
    SELECT 1 FROM users u
    JOIN user_roles ur ON ur.id = u.role_id
    WHERE u.id = p_user_id
    AND ur.role_code IN ('admin', 'lab_admin', 'lab_manager', 'manager', 'owner')
  ) INTO has_admin_role;
  
  RETURN COALESCE(has_admin_role, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PART 11: RPC FUNCTIONS FOR REFUND ACTIONS
-- =============================================

-- Approve refund (admin only)
CREATE OR REPLACE FUNCTION approve_refund(
  p_refund_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_result refund_requests%ROWTYPE;
BEGIN
  -- Get current user
  SELECT id INTO v_user_id FROM users WHERE auth_user_id = auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if user is admin
  IF NOT is_lab_admin(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Lab Managers/Admins can approve refunds');
  END IF;
  
  -- Update refund request
  UPDATE refund_requests
  SET 
    status = 'approved',
    approved_by = v_user_id,
    approved_at = now(),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at = now()
  WHERE id = p_refund_id AND status = 'pending_approval'
  RETURNING * INTO v_result;
  
  IF v_result.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund request not found or not pending');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'refund_id', v_result.id, 'status', v_result.status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reject refund (admin only)
CREATE OR REPLACE FUNCTION reject_refund(
  p_refund_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_result refund_requests%ROWTYPE;
BEGIN
  -- Get current user
  SELECT id INTO v_user_id FROM users WHERE auth_user_id = auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if user is admin
  IF NOT is_lab_admin(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Lab Managers/Admins can reject refunds');
  END IF;
  
  -- Validate rejection reason
  IF p_rejection_reason IS NULL OR LENGTH(TRIM(p_rejection_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required');
  END IF;
  
  -- Update refund request
  UPDATE refund_requests
  SET 
    status = 'rejected',
    rejected_by = v_user_id,
    rejected_at = now(),
    rejection_reason = p_rejection_reason,
    updated_at = now()
  WHERE id = p_refund_id AND status = 'pending_approval'
  RETURNING * INTO v_result;
  
  IF v_result.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund request not found or not pending');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'refund_id', v_result.id, 'status', v_result.status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark refund as paid (admin only)
CREATE OR REPLACE FUNCTION mark_refund_paid(
  p_refund_id UUID,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_result refund_requests%ROWTYPE;
BEGIN
  -- Get current user
  SELECT id INTO v_user_id FROM users WHERE auth_user_id = auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Check if user is admin
  IF NOT is_lab_admin(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Lab Managers/Admins can mark refunds as paid');
  END IF;
  
  -- Update refund request
  UPDATE refund_requests
  SET 
    status = 'paid',
    paid_by = v_user_id,
    paid_at = now(),
    admin_notes = CASE 
      WHEN p_payment_reference IS NOT NULL 
      THEN COALESCE(admin_notes || E'\n', '') || 'Ref: ' || p_payment_reference
      ELSE admin_notes 
    END,
    updated_at = now()
  WHERE id = p_refund_id AND status = 'approved'
  RETURNING * INTO v_result;
  
  IF v_result.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund request not found or not approved');
  END IF;
  
  -- Trigger will automatically update invoice totals and cash register
  
  RETURN jsonb_build_object('success', true, 'refund_id', v_result.id, 'status', v_result.status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create refund request (any authenticated user in lab)
CREATE OR REPLACE FUNCTION create_refund_request(
  p_invoice_id UUID,
  p_refund_amount NUMERIC,
  p_refund_method TEXT,
  p_reason_category TEXT DEFAULT NULL,
  p_reason_details TEXT DEFAULT NULL,
  p_refunded_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_lab_id UUID;
  v_location_id UUID;
  v_patient_id UUID;
  v_order_id UUID;
  v_amount_paid NUMERIC;
  v_total_refunded NUMERIC;
  v_max_refundable NUMERIC;
  v_result refund_requests%ROWTYPE;
BEGIN
  -- Get current user and their lab
  SELECT u.id, u.lab_id INTO v_user_id, v_lab_id 
  FROM users u WHERE u.auth_user_id = auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get invoice details
  SELECT 
    i.patient_id, i.order_id, i.location_id, i.amount_paid, i.total_refunded_amount
  INTO 
    v_patient_id, v_order_id, v_location_id, v_amount_paid, v_total_refunded
  FROM invoices i
  WHERE i.id = p_invoice_id AND i.lab_id = v_lab_id;
  
  IF v_patient_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found or not in your lab');
  END IF;
  
  -- Calculate max refundable
  v_max_refundable := COALESCE(v_amount_paid, 0) - COALESCE(v_total_refunded, 0);
  
  IF p_refund_amount > v_max_refundable THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Refund amount exceeds maximum refundable (%.2f)', v_max_refundable)
    );
  END IF;
  
  -- Create the refund request
  INSERT INTO refund_requests (
    lab_id, location_id, invoice_id, order_id, patient_id,
    refund_amount, refund_method, reason_category, reason_details, refunded_items,
    requested_by, submitted_at
  ) VALUES (
    v_lab_id, v_location_id, p_invoice_id, v_order_id, v_patient_id,
    p_refund_amount, p_refund_method, p_reason_category, p_reason_details, p_refunded_items,
    v_user_id, now()
  )
  RETURNING * INTO v_result;
  
  -- Update invoice refund_status to pending
  UPDATE invoices SET refund_status = 'pending', updated_at = now() WHERE id = p_invoice_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'refund_id', v_result.id, 
    'status', v_result.status,
    'message', 'Refund request created and pending approval'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- PART 12: RLS POLICIES - LAB ADMIN ONLY APPROVAL
-- =============================================

-- Enable RLS on refund_requests
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can create refund requests in their lab" ON refund_requests;
DROP POLICY IF EXISTS "Users can view refund requests in their lab" ON refund_requests;
DROP POLICY IF EXISTS "Only admins can approve or reject refunds" ON refund_requests;
DROP POLICY IF EXISTS "Only admins can delete refund requests" ON refund_requests;

-- Policy: Anyone in lab can create refund requests
CREATE POLICY "Users can create refund requests in their lab"
  ON refund_requests FOR INSERT
  WITH CHECK (
    lab_id = (SELECT lab_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy: Anyone in lab can view refund requests
CREATE POLICY "Users can view refund requests in their lab"
  ON refund_requests FOR SELECT
  USING (
    lab_id = (SELECT lab_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy: Updates allowed via RPC functions (SECURITY DEFINER)
-- This allows the RPC functions to update, while direct updates are restricted
CREATE POLICY "Updates via RPC functions only"
  ON refund_requests FOR UPDATE
  USING (
    lab_id = (SELECT lab_id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    lab_id = (SELECT lab_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy: Only admins can delete refund requests
CREATE POLICY "Only admins can delete refund requests"
  ON refund_requests FOR DELETE
  USING (
    is_lab_admin((SELECT id FROM users WHERE auth_user_id = auth.uid()))
  );

-- =============================================
-- PART 13: SYNC EXISTING INVOICES AMOUNT_PAID
-- =============================================

-- One-time update to sync amount_paid for existing invoices
UPDATE invoices i
SET amount_paid = COALESCE((
  SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id
), 0)
WHERE amount_paid = 0 OR amount_paid IS NULL;

-- =============================================
-- DONE!
-- =============================================
