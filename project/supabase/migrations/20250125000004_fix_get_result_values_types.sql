-- Fix get_result_values function return type mismatch
-- The function expects TEXT but table columns are VARCHAR(255)

BEGIN;

-- Drop and recreate the function with matching types
DROP FUNCTION IF EXISTS get_result_values(UUID);

CREATE OR REPLACE FUNCTION get_result_values(p_result_id UUID)
RETURNS TABLE (
    value VARCHAR(255),
    unit VARCHAR(255), 
    reference_range VARCHAR(255),
    flag VARCHAR(255),
    analyte_name VARCHAR(255),
    department VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rv.value::VARCHAR(255),
        rv.unit::VARCHAR(255),
        rv.reference_range::VARCHAR(255),
        rv.flag::VARCHAR(255),
        a.name::VARCHAR(255),
        a.category::VARCHAR(255)
    FROM result_values rv
    LEFT JOIN analytes a ON a.id = rv.analyte_id
    WHERE rv.result_id = p_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_result_values(UUID) TO authenticated;

COMMIT;
