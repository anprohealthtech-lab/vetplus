/*
  # Create function to get invoices with payment summary

  1. New Functions
    - `get_invoices_with_payments`
      - Returns all invoices with payment summary information
      - Calculates total paid amount for each invoice
      - Determines payment status based on paid amount vs total amount
*/

-- Create a function to get invoices with payment summary
CREATE OR REPLACE FUNCTION get_invoices_with_payments()
RETURNS TABLE (
  id uuid,
  patient_id uuid,
  order_id uuid,
  patient_name text,
  subtotal numeric,
  discount numeric,
  tax numeric,
  total numeric,
  status text,
  invoice_date date,
  due_date date,
  payment_method text,
  payment_date date,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  paid_amount numeric,
  payment_status text,
  invoice_items json
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.patient_id,
    i.order_id,
    i.patient_name,
    i.subtotal,
    i.discount,
    i.tax,
    i.total,
    i.status,
    i.invoice_date,
    i.due_date,
    i.payment_method,
    i.payment_date,
    i.notes,
    i.created_at,
    i.updated_at,
    COALESCE(SUM(p.amount), 0) as paid_amount,
    CASE 
      WHEN COALESCE(SUM(p.amount), 0) >= i.total THEN 'Paid'
      WHEN COALESCE(SUM(p.amount), 0) > 0 THEN 'Partial'
      WHEN i.due_date < CURRENT_DATE THEN 'Overdue'
      ELSE i.status
    END as payment_status,
    (
      SELECT json_agg(ii.*)
      FROM invoice_items ii
      WHERE ii.invoice_id = i.id
    ) as invoice_items
  FROM 
    invoices i
  LEFT JOIN 
    payments p ON i.id = p.invoice_id
  GROUP BY 
    i.id
  ORDER BY 
    i.invoice_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_invoices_with_payments() TO authenticated;