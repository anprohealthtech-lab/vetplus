/*
  # Add Soft Delete Function for Patients

  1. New Functions
    - `get_patients_with_test_counts_active` - Returns only active patients with their test counts
  
  2. Changes
    - Updates the existing function to include is_active filter
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_patients_with_test_counts();

-- Create the updated function that only returns active patients
CREATE OR REPLACE FUNCTION get_patients_with_test_counts()
RETURNS SETOF patients AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.*,
    COALESCE(COUNT(DISTINCT o.id), 0)::integer AS test_count
  FROM 
    patients p
  LEFT JOIN 
    orders o ON p.id = o.patient_id
  WHERE
    p.is_active = true
  GROUP BY 
    p.id
  ORDER BY 
    p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add a comment explaining the function
COMMENT ON FUNCTION get_patients_with_test_counts() IS 'Returns all active patients with their test counts';