-- =============================================
-- Fix Refund System User Lookup
-- =============================================
-- This migration fixes the user lookup pattern in refund RPC functions and RLS policies
-- to use email-based lookup instead of auth_user_id, matching the rest of the codebase
-- (e.g., getCurrentUserLabId pattern)

-- =============================================
-- 1. Fix create_refund_request function
-- =============================================
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
  v_auth_email TEXT;
BEGIN
  -- Get current auth user's email
  SELECT auth.email() INTO v_auth_email;
  
  IF v_auth_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get user and lab by email (matches getCurrentUserLabId pattern)
  SELECT u.id, u.lab_id INTO v_user_id, v_lab_id 
  FROM users u 
  WHERE u.email = v_auth_email 
    AND u.status = 'Active';
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found or inactive');
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
    'data', jsonb_build_object(
      'id', v_result.id,
      'refund_amount', v_result.refund_amount,
      'status', v_result.status
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. Fix RLS policies to use email-based lookup
-- =============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create refund requests in their lab" ON refund_requests;
DROP POLICY IF EXISTS "Users can view refund requests in their lab" ON refund_requests;
DROP POLICY IF EXISTS "Updates via RPC functions only" ON refund_requests;
DROP POLICY IF EXISTS "Only admins can delete refund requests" ON refund_requests;

-- Policy: Anyone in lab can create refund requests (email-based)
CREATE POLICY "Users can create refund requests in their lab"
  ON refund_requests FOR INSERT
  WITH CHECK (
    lab_id = (SELECT lab_id FROM users WHERE email = auth.email() AND status = 'Active')
  );

-- Policy: Anyone in lab can view refund requests (email-based)
CREATE POLICY "Users can view refund requests in their lab"
  ON refund_requests FOR SELECT
  USING (
    lab_id = (SELECT lab_id FROM users WHERE email = auth.email() AND status = 'Active')
  );

-- Policy: Updates allowed via RPC functions (email-based)
CREATE POLICY "Updates via RPC functions only"
  ON refund_requests FOR UPDATE
  USING (
    lab_id = (SELECT lab_id FROM users WHERE email = auth.email() AND status = 'Active')
  )
  WITH CHECK (
    lab_id = (SELECT lab_id FROM users WHERE email = auth.email() AND status = 'Active')
  );

-- Policy: Only admins can delete refund requests (email-based)
CREATE POLICY "Only admins can delete refund requests"
  ON refund_requests FOR DELETE
  USING (
    is_lab_admin((SELECT id FROM users WHERE email = auth.email() AND status = 'Active'))
  );

-- =============================================
-- 3. Grant permissions
-- =============================================
GRANT EXECUTE ON FUNCTION create_refund_request TO authenticated;

COMMENT ON FUNCTION create_refund_request IS 'Creates a refund request using email-based user lookup (matches getCurrentUserLabId pattern)';
