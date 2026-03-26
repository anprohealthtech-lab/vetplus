-- =============================================
-- Fix Refund Approval/Rejection User Lookup
-- =============================================
-- This migration fixes the user lookup in approve_refund, reject_refund, 
-- and mark_refund_paid functions to use email-based lookup instead of auth_user_id

-- =============================================
-- 1. Fix approve_refund function
-- =============================================
CREATE OR REPLACE FUNCTION approve_refund(
  p_refund_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_auth_email TEXT;
  v_result refund_requests%ROWTYPE;
BEGIN
  -- Get current auth user's email
  SELECT auth.email() INTO v_auth_email;
  
  IF v_auth_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get user by email (matches getCurrentUserLabId pattern)
  SELECT u.id INTO v_user_id 
  FROM users u 
  WHERE u.email = v_auth_email 
    AND u.status = 'Active';
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found or inactive');
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

-- =============================================
-- 2. Fix reject_refund function
-- =============================================
CREATE OR REPLACE FUNCTION reject_refund(
  p_refund_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_auth_email TEXT;
  v_result refund_requests%ROWTYPE;
BEGIN
  -- Get current auth user's email
  SELECT auth.email() INTO v_auth_email;
  
  IF v_auth_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get user by email (matches getCurrentUserLabId pattern)
  SELECT u.id INTO v_user_id 
  FROM users u 
  WHERE u.email = v_auth_email 
    AND u.status = 'Active';
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found or inactive');
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

-- =============================================
-- 3. Fix mark_refund_paid function
-- =============================================
CREATE OR REPLACE FUNCTION mark_refund_paid(
  p_refund_id UUID,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_auth_email TEXT;
  v_result refund_requests%ROWTYPE;
BEGIN
  -- Get current auth user's email
  SELECT auth.email() INTO v_auth_email;
  
  IF v_auth_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  -- Get user by email (matches getCurrentUserLabId pattern)
  SELECT u.id INTO v_user_id 
  FROM users u 
  WHERE u.email = v_auth_email 
    AND u.status = 'Active';
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found or inactive');
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
    payment_reference = COALESCE(p_payment_reference, payment_reference),
    updated_at = now()
  WHERE id = p_refund_id AND status = 'approved'
  RETURNING * INTO v_result;
  
  IF v_result.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund request not found or not approved');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'refund_id', v_result.id, 'status', v_result.status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. Grant permissions
-- =============================================
GRANT EXECUTE ON FUNCTION approve_refund TO authenticated;
GRANT EXECUTE ON FUNCTION reject_refund TO authenticated;
GRANT EXECUTE ON FUNCTION mark_refund_paid TO authenticated;

-- =============================================
-- 5. Add comments
-- =============================================
COMMENT ON FUNCTION approve_refund IS 'Approves a refund request using email-based user lookup (matches getCurrentUserLabId pattern)';
COMMENT ON FUNCTION reject_refund IS 'Rejects a refund request using email-based user lookup (matches getCurrentUserLabId pattern)';
COMMENT ON FUNCTION mark_refund_paid IS 'Marks a refund as paid using email-based user lookup (matches getCurrentUserLabId pattern)';
