-- =============================================
-- Add AI Interpretation & Flag Fields to result_values
-- Add Trend Graph & AI Summary Fields to reports/orders
-- =============================================
-- This allows per-result-value AI suggestions without modifying analyte master data
-- Verifiers can review and edit AI-generated interpretations and flags before approval

-- =============================================
-- 1. Add AI fields to result_values table
-- =============================================
ALTER TABLE result_values
ADD COLUMN IF NOT EXISTS ai_suggested_flag TEXT,
ADD COLUMN IF NOT EXISTS ai_suggested_interpretation TEXT,
ADD COLUMN IF NOT EXISTS trend_interpretation TEXT,
ADD COLUMN IF NOT EXISTS verifier_notes TEXT,
ADD COLUMN IF NOT EXISTS flag_override_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS flag_override_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS interpretation_override_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS interpretation_override_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN result_values.ai_suggested_flag IS 'AI-generated flag suggestion (Low/Normal/High/Critical) - can be overridden by verifier';
COMMENT ON COLUMN result_values.ai_suggested_interpretation IS 'AI-generated clinical interpretation of this specific value - can be edited by verifier';
COMMENT ON COLUMN result_values.trend_interpretation IS 'AI-generated trend analysis based on historical values (improving/worsening/stable)';
COMMENT ON COLUMN result_values.verifier_notes IS 'Verifier notes/comments about this specific result value';
COMMENT ON COLUMN result_values.flag_override_by IS 'User who manually changed the AI suggested flag';
COMMENT ON COLUMN result_values.flag_override_at IS 'Timestamp when flag was manually overridden';
COMMENT ON COLUMN result_values.interpretation_override_by IS 'User who manually edited the AI interpretation';
COMMENT ON COLUMN result_values.interpretation_override_at IS 'Timestamp when interpretation was manually edited';

-- =============================================
-- 2. Add trend graph data to orders table
-- =============================================
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS trend_graph_data JSONB,
ADD COLUMN IF NOT EXISTS trend_graph_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trend_graph_generated_by UUID REFERENCES users(id);

COMMENT ON COLUMN orders.trend_graph_data IS 'Historical trend data for analytes (JSON format with dates, values, reference ranges)';
COMMENT ON COLUMN orders.trend_graph_generated_at IS 'When the trend graph data was last generated';
COMMENT ON COLUMN orders.trend_graph_generated_by IS 'User/system that generated the trend data';

-- =============================================
-- 3. Add AI doctor summary to reports table
-- =============================================
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS ai_doctor_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_summary_reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS ai_summary_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS include_trend_graphs BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trend_graphs_config JSONB;

COMMENT ON COLUMN reports.ai_doctor_summary IS 'AI-generated clinical summary for doctors (overview of results, flags, interpretations)';
COMMENT ON COLUMN reports.ai_summary_generated_at IS 'When the AI summary was generated';
COMMENT ON COLUMN reports.ai_summary_reviewed_by IS 'Lab manager/doctor who reviewed the AI summary';
COMMENT ON COLUMN reports.ai_summary_reviewed_at IS 'When the AI summary was reviewed/approved';
COMMENT ON COLUMN reports.include_trend_graphs IS 'Whether to include trend graphs in the PDF report';
COMMENT ON COLUMN reports.trend_graphs_config IS 'Configuration for which analytes to show trends for (JSON)';

-- =============================================
-- 4. Create helper function to copy AI suggestions to final fields
-- =============================================
CREATE OR REPLACE FUNCTION apply_ai_suggestions_to_result_value(
  p_result_value_id UUID,
  p_user_id UUID,
  p_apply_flag BOOLEAN DEFAULT true,
  p_apply_interpretation BOOLEAN DEFAULT true,
  p_custom_flag TEXT DEFAULT NULL,
  p_custom_interpretation TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result_value result_values%ROWTYPE;
  v_final_flag TEXT;
  v_final_interpretation TEXT;
BEGIN
  -- Get current result value
  SELECT * INTO v_result_value 
  FROM result_values 
  WHERE id = p_result_value_id;
  
  IF v_result_value.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Result value not found');
  END IF;
  
  -- Determine final flag
  IF p_custom_flag IS NOT NULL THEN
    v_final_flag := p_custom_flag;
  ELSIF p_apply_flag THEN
    v_final_flag := v_result_value.ai_suggested_flag;
  ELSE
    v_final_flag := v_result_value.flag;
  END IF;
  
  -- Determine final interpretation
  IF p_custom_interpretation IS NOT NULL THEN
    v_final_interpretation := p_custom_interpretation;
  ELSIF p_apply_interpretation THEN
    v_final_interpretation := v_result_value.ai_suggested_interpretation;
  ELSE
    v_final_interpretation := v_result_value.interpretation;
  END IF;
  
  -- Update result value
  UPDATE result_values
  SET 
    flag = v_final_flag,
    interpretation = v_final_interpretation,
    flag_override_by = CASE WHEN p_custom_flag IS NOT NULL THEN p_user_id ELSE flag_override_by END,
    flag_override_at = CASE WHEN p_custom_flag IS NOT NULL THEN now() ELSE flag_override_at END,
    interpretation_override_by = CASE WHEN p_custom_interpretation IS NOT NULL THEN p_user_id ELSE interpretation_override_by END,
    interpretation_override_at = CASE WHEN p_custom_interpretation IS NOT NULL THEN now() ELSE interpretation_override_at END,
    updated_at = now()
  WHERE id = p_result_value_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'result_value_id', p_result_value_id,
    'applied_flag', v_final_flag,
    'applied_interpretation', v_final_interpretation
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION apply_ai_suggestions_to_result_value TO authenticated;

COMMENT ON FUNCTION apply_ai_suggestions_to_result_value IS 'Apply AI suggestions to result value with optional manual overrides';

-- =============================================
-- 5. Create function to generate AI doctor summary
-- =============================================
CREATE OR REPLACE FUNCTION generate_ai_doctor_summary(
  p_order_id UUID,
  p_summary_text TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_report_id UUID;
BEGIN
  -- Get report for this order
  SELECT id INTO v_report_id
  FROM reports
  WHERE order_id = p_order_id
  ORDER BY generated_date DESC
  LIMIT 1;
  
  IF v_report_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No report found for this order');
  END IF;
  
  -- Update report with AI summary
  UPDATE reports
  SET 
    ai_doctor_summary = p_summary_text,
    ai_summary_generated_at = now(),
    ai_summary_reviewed_by = p_user_id,
    ai_summary_reviewed_at = CASE WHEN p_user_id IS NOT NULL THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = v_report_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'summary_length', LENGTH(p_summary_text)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_ai_doctor_summary TO authenticated;

COMMENT ON FUNCTION generate_ai_doctor_summary IS 'Save AI-generated doctor summary to report';

-- =============================================
-- 6. Create function to save trend graph data
-- =============================================
CREATE OR REPLACE FUNCTION save_trend_graph_data(
  p_order_id UUID,
  p_trend_data JSONB,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  -- Update order with trend data
  UPDATE orders
  SET 
    trend_graph_data = p_trend_data,
    trend_graph_generated_at = now(),
    trend_graph_generated_by = p_user_id,
    updated_at = now()
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'analytes_count', jsonb_array_length(p_trend_data -> 'analytes')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION save_trend_graph_data TO authenticated;

COMMENT ON FUNCTION save_trend_graph_data IS 'Save historical trend graph data for order';

-- =============================================
-- 7. Update view_approved_results to include AI fields
-- =============================================
DROP VIEW IF EXISTS view_approved_results;

CREATE OR REPLACE VIEW view_approved_results AS
SELECT 
    r.id as result_id,
    r.order_id,
    r.patient_id,
    r.patient_name,
    r.test_name,
    r.status,
    r.verification_status,
    r.verified_by,
    r.verified_at,
    r.review_comment,
    r.entered_by,
    r.entered_date,
    r.reviewed_by,
    r.reviewed_date,
    o.sample_id,
    o.order_date,
    o.doctor,
    o.lab_id,
    o.trend_graph_data,  -- ← Include trend data
    o.trend_graph_generated_at,
    p.name as patient_full_name,
    p.age,
    p.gender,
    p.phone,
    -- Include attachment info
    r.attachment_id,
    a.file_url as attachment_url,
    a.file_type as attachment_type,
    a.original_filename as attachment_name
FROM results r
LEFT JOIN orders o ON r.order_id = o.id
LEFT JOIN patients p ON r.patient_id = p.id
LEFT JOIN attachments a ON r.attachment_id = a.id
WHERE r.verification_status = 'verified'
ORDER BY r.verified_at DESC;

GRANT SELECT ON view_approved_results TO authenticated;

-- =============================================
-- 8. Add indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_result_values_ai_flag ON result_values(ai_suggested_flag) WHERE ai_suggested_flag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_result_values_ai_interpretation ON result_values(ai_suggested_interpretation) WHERE ai_suggested_interpretation IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_trend_generated ON orders(trend_graph_generated_at) WHERE trend_graph_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_ai_summary ON reports(ai_summary_generated_at) WHERE ai_doctor_summary IS NOT NULL;

-- =============================================
-- Summary
-- =============================================
-- New workflow:
-- 1. AI processes result → populates ai_suggested_flag, ai_suggested_interpretation in result_values
-- 2. Verifier reviews → can edit in verifier_notes or override flag/interpretation
-- 3. Call apply_ai_suggestions_to_result_value() to apply (auto or manual)
-- 4. AI generates doctor summary → saved to reports.ai_doctor_summary
-- 5. AI generates trend graphs → saved to orders.trend_graph_data
-- 6. PDF generation includes trend graphs + AI summary if enabled
