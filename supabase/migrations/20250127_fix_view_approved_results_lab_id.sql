-- =============================================
-- Fix view_approved_results to include lab_id
-- =============================================
-- The Reports page queries this view with .eq('lab_id', lab_id)
-- but the view was missing the lab_id column

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
    o.lab_id,  -- ← Added for lab filtering
    p.name as patient_full_name,
    p.age,
    p.gender,
    p.phone,
    -- Include attachment info for viewing uploaded documents
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

-- Grant permissions
GRANT SELECT ON view_approved_results TO authenticated;

-- Add comment
COMMENT ON VIEW view_approved_results IS 'Verified results with lab_id for multi-lab filtering';
