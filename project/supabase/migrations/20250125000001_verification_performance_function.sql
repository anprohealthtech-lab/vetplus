-- Verification Performance Analytics Function (Aligned with existing schema)

CREATE OR REPLACE FUNCTION get_verification_performance(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
) 
RETURNS TABLE (
    total_verified INTEGER,
    avg_verification_time_hours NUMERIC,
    approved_count INTEGER,
    rejected_count INTEGER,
    clarification_count INTEGER,
    urgent_verified INTEGER,
    overdue_count INTEGER,
    performance_score NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_verified,
        ROUND(AVG(EXTRACT(HOURS FROM (verified_at - created_at))), 2) as avg_verification_time_hours,
        COUNT(*) FILTER (WHERE verification_status = 'verified')::INTEGER as approved_count,
        COUNT(*) FILTER (WHERE verification_status = 'rejected')::INTEGER as rejected_count,
        COUNT(*) FILTER (WHERE verification_status = 'needs_clarification')::INTEGER as clarification_count,
        COUNT(*) FILTER (WHERE critical_flag = true AND verification_status = 'verified')::INTEGER as urgent_verified,
        COUNT(*) FILTER (WHERE verification_status = 'pending_verification' AND created_at < NOW() - INTERVAL '24 hours')::INTEGER as overdue_count,
        -- Performance score: weighted by urgency and timeliness
        ROUND(
            (
                COUNT(*) FILTER (WHERE verification_status = 'verified' AND verified_at - created_at < INTERVAL '4 hours') * 100 +
                COUNT(*) FILTER (WHERE verification_status = 'verified' AND verified_at - created_at BETWEEN INTERVAL '4 hours' AND INTERVAL '24 hours') * 80 +
                COUNT(*) FILTER (WHERE verification_status = 'verified' AND verified_at - created_at > INTERVAL '24 hours') * 60 +
                COUNT(*) FILTER (WHERE verification_status = 'rejected') * 90 +
                COUNT(*) FILTER (WHERE verification_status = 'needs_clarification') * 70
            )::NUMERIC / GREATEST(COUNT(*), 1), 2
        ) as performance_score
    FROM results 
    WHERE verified_at BETWEEN start_date AND end_date
       OR (verification_status = 'pending_verification' AND created_at BETWEEN start_date AND end_date);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_verification_performance TO authenticated;

-- Add function comment
COMMENT ON FUNCTION get_verification_performance IS 'Calculate verification performance metrics for a given date range';
