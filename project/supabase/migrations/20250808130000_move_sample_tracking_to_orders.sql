-- Migration: Move sample tracking from patients to orders
-- Date: 2025-08-08
-- Purpose: Each order should have its own sample tube, QR code, and color for proper lab workflow

-- Step 1: Add missing sample tracking columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS sample_id text,
ADD COLUMN IF NOT EXISTS sample_collected_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS sample_collected_by text,
ADD COLUMN IF NOT EXISTS tube_barcode text;

-- Step 2: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_sample_id ON public.orders(sample_id);
CREATE INDEX IF NOT EXISTS idx_orders_color_code ON public.orders(color_code);
CREATE INDEX IF NOT EXISTS idx_orders_sample_collected_at ON public.orders(sample_collected_at);

-- Step 3: Add constraints
ALTER TABLE public.orders 
ADD CONSTRAINT unique_sample_id UNIQUE (sample_id);

-- Step 4: Generate sample data for orders that don't have it yet
-- Create a function to generate order-based sample IDs
CREATE OR REPLACE FUNCTION generate_order_sample_data()
RETURNS void AS $$
DECLARE
  order_record RECORD;
  daily_sequence INTEGER;
  sample_date DATE;
  new_sample_id TEXT;
  new_color_code TEXT;
  new_color_name TEXT;
  new_qr_data TEXT;
BEGIN
  -- Process orders that don't have sample data
  FOR order_record IN 
    SELECT id, patient_id, order_date, created_at
    FROM orders 
    WHERE sample_id IS NULL OR color_code IS NULL OR qr_code_data IS NULL
    ORDER BY order_date, created_at
  LOOP
    -- Get the date for sample ID generation
    sample_date := order_record.order_date::DATE;
    
    -- Count existing orders for this date to get sequence number
    SELECT COALESCE(MAX(
      CASE 
        WHEN sample_id ~ '^[0-9]{2}-[A-Za-z]{3}-[0-9]{4}-[0-9]+$' 
        THEN CAST(split_part(sample_id, '-', 4) AS INTEGER)
        ELSE 0 
      END
    ), 0) + 1 INTO daily_sequence
    FROM orders 
    WHERE order_date::DATE = sample_date 
      AND sample_id IS NOT NULL;
    
    -- Generate sample ID in format DD-Mon-YYYY-SEQ
    new_sample_id := to_char(sample_date, 'DD-Mon-YYYY') || '-' || LPAD(daily_sequence::TEXT, 3, '0');
    
    -- Generate color based on sequence (cycling through colors)
    CASE (daily_sequence - 1) % 12
      WHEN 0 THEN new_color_code := '#EF4444'; new_color_name := 'Red';
      WHEN 1 THEN new_color_code := '#3B82F6'; new_color_name := 'Blue';
      WHEN 2 THEN new_color_code := '#10B981'; new_color_name := 'Green';
      WHEN 3 THEN new_color_code := '#F59E0B'; new_color_name := 'Orange';
      WHEN 4 THEN new_color_code := '#8B5CF6'; new_color_name := 'Purple';
      WHEN 5 THEN new_color_code := '#06B6D4'; new_color_name := 'Cyan';
      WHEN 6 THEN new_color_code := '#EC4899'; new_color_name := 'Pink';
      WHEN 7 THEN new_color_code := '#84CC16'; new_color_name := 'Lime';
      WHEN 8 THEN new_color_code := '#F97316'; new_color_name := 'Amber';
      WHEN 9 THEN new_color_code := '#6366F1'; new_color_name := 'Indigo';
      WHEN 10 THEN new_color_code := '#14B8A6'; new_color_name := 'Teal';
      WHEN 11 THEN new_color_code := '#A855F7'; new_color_name := 'Violet';
    END CASE;
    
    -- Generate QR code data with order information
    SELECT json_build_object(
      'orderId', order_record.id,
      'patientId', order_record.patient_id,
      'sampleId', new_sample_id,
      'orderDate', order_record.order_date,
      'colorCode', new_color_code,
      'colorName', new_color_name
    )::text INTO new_qr_data;
    
    -- Update the order with sample data
    UPDATE orders 
    SET 
      sample_id = new_sample_id,
      color_code = new_color_code,
      color_name = new_color_name,
      qr_code_data = new_qr_data
    WHERE id = order_record.id;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Execute the sample data generation
SELECT generate_order_sample_data();

-- Step 6: Drop the temporary function
DROP FUNCTION generate_order_sample_data();

-- Step 7: Add comments explaining the new schema
COMMENT ON COLUMN public.orders.sample_id IS 'Unique daily sample identifier in format DD-Mon-YYYY-SEQ (e.g., 08-Aug-2025-001)';
COMMENT ON COLUMN public.orders.qr_code_data IS 'QR code data containing order and sample information for tube identification';
COMMENT ON COLUMN public.orders.color_code IS 'Hex color code for sample tube visual identification';
COMMENT ON COLUMN public.orders.color_name IS 'Human-readable color name for sample tube';
COMMENT ON COLUMN public.orders.sample_collected_at IS 'Timestamp when physical sample was collected from patient';
COMMENT ON COLUMN public.orders.sample_collected_by IS 'User who collected the physical sample';
COMMENT ON COLUMN public.orders.tube_barcode IS 'Physical barcode on the sample tube (if different from QR code)';

-- Step 8: Update patient_visit_summary view to use order-based sample data
DROP VIEW IF EXISTS public.patient_visit_summary CASCADE;
CREATE OR REPLACE VIEW public.patient_visit_summary AS
SELECT 
  p.id as patient_id,
  p.name as patient_name,
  p.age,
  p.gender,
  p.created_at as patient_created_at,
  o.id as order_id,
  o.status as order_status,
  o.order_date,
  o.expected_date,
  o.total_amount,
  o.sample_id,
  o.color_code,
  o.color_name,
  o.sample_collected_at,
  ARRAY_AGG(DISTINCT ot.test_name) as tests,
  COUNT(DISTINCT r.id) as result_count,
  COUNT(DISTINCT CASE WHEN r.status = 'Approved' THEN r.id END) as approved_results,
  CASE 
    WHEN o.status IN ('Completed', 'Delivered') THEN 'Complete'
    WHEN o.status = 'Pending Approval' THEN 'Awaiting Approval'
    WHEN o.status = 'In Progress' THEN 'In Progress'
    WHEN o.status = 'Sample Collection' THEN 'Sample Collection'
    WHEN o.status = 'Order Created' THEN 'Order Created'
    ELSE 'Unknown'
  END as visit_status
FROM patients p
LEFT JOIN orders o ON p.id = o.patient_id
LEFT JOIN order_tests ot ON o.id = ot.order_id
LEFT JOIN results r ON o.id = r.order_id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.age, p.gender, p.created_at, o.id, o.status, o.order_date, o.expected_date, o.total_amount, o.sample_id, o.color_code, o.color_name, o.sample_collected_at;

-- Step 9: Create a view for daily sample management
CREATE OR REPLACE VIEW public.daily_sample_roster AS
SELECT 
  o.order_date::DATE as sample_date,
  o.sample_id,
  o.color_code,
  o.color_name,
  o.id as order_id,
  o.status as order_status,
  p.name as patient_name,
  p.age as patient_age,
  ARRAY_AGG(DISTINCT ot.test_name) as tests,
  o.sample_collected_at,
  o.sample_collected_by,
  o.created_at as order_created_at
FROM orders o
JOIN patients p ON o.patient_id = p.id
LEFT JOIN order_tests ot ON o.id = ot.order_id
WHERE o.sample_id IS NOT NULL
GROUP BY o.order_date, o.sample_id, o.color_code, o.color_name, o.id, o.status, p.name, p.age, o.sample_collected_at, o.sample_collected_by, o.created_at
ORDER BY o.order_date DESC, o.sample_id;

COMMENT ON VIEW public.daily_sample_roster IS 'Daily roster of all samples with their colors, QR codes, and collection status for laboratory workflow management';

-- Note: Patient table sample columns will be removed in a future migration after verification
-- For now, they remain for backwards compatibility during transition period
