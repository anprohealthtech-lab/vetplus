/*
  # Create function to get patients with test counts

  1. New Function
    - Creates a stored procedure that returns patients with their test counts
    - Joins patients with orders and counts distinct order IDs
    - Returns all patient fields plus test_count

  2. Security
    - Function is accessible to authenticated users
*/

CREATE OR REPLACE FUNCTION get_patients_with_test_counts()
RETURNS TABLE (
  id uuid,
  name character varying,
  age integer,
  gender gender_type,
  phone character varying,
  email character varying,
  address text,
  city character varying,
  state character varying,
  pincode character varying,
  emergency_contact character varying,
  emergency_phone character varying,
  blood_group blood_group_type,
  allergies text,
  medical_history text,
  registration_date date,
  last_visit date,
  total_tests integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  external_patient_id character varying,
  qr_code_data text,
  color_code text,
  color_name text,
  test_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.*,
    COALESCE(COUNT(DISTINCT o.id), 0)::bigint as test_count
  FROM 
    patients p
  LEFT JOIN 
    orders o ON p.id = o.patient_id
  GROUP BY 
    p.id
  ORDER BY 
    p.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_patients_with_test_counts() TO authenticated;