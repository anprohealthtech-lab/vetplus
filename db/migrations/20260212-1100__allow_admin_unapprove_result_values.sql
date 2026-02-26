-- Allow admin users to unapprove (revert) verified result_values back to pending.
--
-- Problem:
--   1) RLS policy `prevent_locked_result_value_edit` blocks ALL updates to 
--      result_values when results.verification_status = 'verified'.
--   2) Trigger `prevent_verified_result_edit` blocks value/flag changes
--      on verified results.
--
-- Fix:
--   Replace the RLS policy with one that allows admin/super_admin/lab_admin
--   to update verify_status (but still blocks value/flag changes).
--   Also update the trigger to allow verify_status changes by admins.

-- ============================================================================
-- 1) Replace the RLS policy to allow admin unapprove
-- ============================================================================

DROP POLICY IF EXISTS prevent_locked_result_value_edit ON result_values;

CREATE POLICY prevent_locked_result_value_edit ON result_values
  FOR UPDATE
  USING (
    -- Allow if the parent result is NOT verified and NOT locked
    NOT EXISTS (
      SELECT 1 FROM results r
      WHERE r.id = result_values.result_id 
      AND (r.is_locked = true OR r.verification_status = 'verified')
    )
    -- OR allow if the current user is an admin (for unapprove operations)
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND LOWER(u.role::text) IN ('admin', 'super_admin', 'lab_admin')
    )
  );

-- ============================================================================
-- 2) Update the trigger to allow verify_status changes by admins
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_verified_result_edit()
RETURNS TRIGGER AS $$
DECLARE
  result_record RECORD;
  is_admin boolean := false;
BEGIN
  -- Get result status for this result_value
  SELECT verification_status, is_locked, locked_reason
  INTO result_record
  FROM results 
  WHERE id = COALESCE(NEW.result_id, OLD.result_id);

  -- Check if current user is admin
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND LOWER(u.role::text) IN ('admin', 'super_admin', 'lab_admin')
  ) INTO is_admin;

  -- Check if result is verified
  IF result_record.verification_status = 'verified' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete values of verified results. Use amendment process if changes are needed.';
    ELSIF TG_OP = 'UPDATE' THEN
      -- Admin can change verify_status (unapprove), but NOT value/flag
      IF is_admin THEN
        IF (OLD.value IS DISTINCT FROM NEW.value OR OLD.flag IS DISTINCT FROM NEW.flag) THEN
          RAISE EXCEPTION 'Cannot modify values of verified results. Only unapprove is allowed for admins.';
        END IF;
        -- Allow verify_status, verify_note, verified_at, verified_by changes
      ELSE
        IF (OLD.value IS DISTINCT FROM NEW.value OR OLD.flag IS DISTINCT FROM NEW.flag) THEN
          RAISE EXCEPTION 'Cannot modify values of verified results. Use amendment process if changes are needed.';
        END IF;
        -- Non-admin: also block verify_status revert
        IF OLD.verify_status = 'approved' AND NEW.verify_status != 'approved' THEN
          RAISE EXCEPTION 'Only admin users can unapprove verified results.';
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- Check if result is locked
  IF result_record.is_locked = true THEN
    IF TG_OP = 'DELETE' THEN
      -- Allow admin to delete result_values on locked results (for reopen-for-correction)
      IF NOT is_admin THEN
        RAISE EXCEPTION 'Cannot delete values of locked results. Reason: %', result_record.locked_reason;
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NOT is_admin AND (OLD.value IS DISTINCT FROM NEW.value OR OLD.flag IS DISTINCT FROM NEW.flag) THEN
        RAISE EXCEPTION 'Cannot modify values of locked results. Reason: %', result_record.locked_reason;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3) Update validate_result_workflow trigger on results table
--    to allow admins to revert verification_status from 'verified'
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_result_workflow()
RETURNS TRIGGER AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  -- Prevent status regression from verified (unless admin)
  IF OLD.verification_status = 'verified' AND NEW.verification_status != 'verified' THEN
    -- Check if current user is admin
    SELECT EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND LOWER(u.role::text) IN ('admin', 'super_admin', 'lab_admin')
    ) INTO is_admin;

    IF NOT is_admin THEN
      RAISE EXCEPTION 'Cannot revert verified results. Use amendment process if changes are needed.';
    END IF;
  END IF;

  -- Auto-update fields when result is verified
  IF NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
    NEW.verified_at = NOW();
    NEW.verified_by = auth.uid();
    NEW.manually_verified = true;
    NEW.status = 'Reviewed';

    IF NOT EXISTS (SELECT 1 FROM result_values WHERE result_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot verify result without values';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
