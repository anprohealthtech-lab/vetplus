-- Add clinical summary columns to orders table
-- This is needed because reports may not exist at verification time

-- Add columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS ai_clinical_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_clinical_summary_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_clinical_summary_generated_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS include_clinical_summary_in_report BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN orders.ai_clinical_summary IS 'AI-generated clinical summary for doctors, stored at order level since reports may not exist during verification';
COMMENT ON COLUMN orders.ai_clinical_summary_generated_at IS 'When the clinical summary was generated/saved';
COMMENT ON COLUMN orders.ai_clinical_summary_generated_by IS 'User who generated/saved the clinical summary';
COMMENT ON COLUMN orders.include_clinical_summary_in_report IS 'Whether to include clinical summary in the final PDF report';

-- Create or replace function to save clinical summary to orders
CREATE OR REPLACE FUNCTION save_clinical_summary_to_order(
  p_order_id UUID,
  p_summary_text TEXT,
  p_user_id UUID DEFAULT NULL,
  p_include_in_report BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update the order with the clinical summary
  UPDATE orders
  SET 
    ai_clinical_summary = p_summary_text,
    ai_clinical_summary_generated_at = NOW(),
    ai_clinical_summary_generated_by = p_user_id,
    include_clinical_summary_in_report = COALESCE(p_include_in_report, include_clinical_summary_in_report),
    updated_at = NOW()
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  RETURN json_build_object('success', true, 'order_id', p_order_id);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION save_clinical_summary_to_order TO authenticated;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_clinical_summary ON orders(ai_clinical_summary_generated_at) 
WHERE ai_clinical_summary IS NOT NULL;

-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS generate_ai_doctor_summary(uuid, text, uuid);

-- Recreate the function to work even without existing report (fallback to orders table)
CREATE OR REPLACE FUNCTION generate_ai_doctor_summary(
  p_order_id UUID,
  p_summary_text TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id UUID;
  v_result JSON;
BEGIN
  -- First, try to update existing report
  UPDATE reports
  SET 
    ai_doctor_summary = p_summary_text,
    ai_summary_generated_at = NOW()
  WHERE order_id = p_order_id
  RETURNING id INTO v_report_id;

  -- If no report exists, save to orders table instead
  IF v_report_id IS NULL THEN
    UPDATE orders
    SET 
      ai_clinical_summary = p_summary_text,
      ai_clinical_summary_generated_at = NOW(),
      ai_clinical_summary_generated_by = p_user_id,
      updated_at = NOW()
    WHERE id = p_order_id;

    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Order not found');
    END IF;

    RETURN json_build_object('success', true, 'saved_to', 'orders', 'order_id', p_order_id);
  END IF;

  RETURN json_build_object('success', true, 'saved_to', 'reports', 'report_id', v_report_id);
END;
$$;
