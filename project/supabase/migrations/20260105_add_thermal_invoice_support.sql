-- Migration: Add thermal printer support to invoice templates and labs
-- This enables generating thermal receipt-style invoices (58mm/80mm) alongside standard A4 PDFs

-- ============================================
-- PART 1: Update invoice_templates table
-- ============================================

-- Add format type column
ALTER TABLE public.invoice_templates 
ADD COLUMN IF NOT EXISTS format_type VARCHAR(20) DEFAULT 'a4' 
  CHECK (format_type IN ('a4', 'thermal_80mm', 'thermal_58mm'));

-- Add print mode column  
ALTER TABLE public.invoice_templates
ADD COLUMN IF NOT EXISTS print_mode VARCHAR(20) DEFAULT 'pdf' 
  CHECK (print_mode IN ('pdf', 'thermal', 'both'));

-- Add thermal printer settings as JSONB
ALTER TABLE public.invoice_templates
ADD COLUMN IF NOT EXISTS thermal_settings JSONB DEFAULT jsonb_build_object(
  'width_mm', 80,
  'paper_size', '80mm',
  'font_size', '12px',
  'line_spacing', '1.2',
  'margins', '5mm',
  'barcode_height', '40px',
  'barcode_width', '200px',
  'barcode_format', 'CODE128',
  'include_logo', true,
  'logo_height', '40px',
  'show_barcode', true,
  'auto_cut', false
);

-- Add comments for documentation
COMMENT ON COLUMN public.invoice_templates.format_type IS 
  'Invoice format: a4 (standard PDF), thermal_80mm (80mm thermal), thermal_58mm (58mm thermal)';
  
COMMENT ON COLUMN public.invoice_templates.print_mode IS 
  'Generation mode: pdf (A4 PDF only), thermal (thermal HTML only), both (generate both formats)';
  
COMMENT ON COLUMN public.invoice_templates.thermal_settings IS 
  'Thermal printer configuration JSON: width_mm, font_size, barcode settings, margins, etc.';

-- ============================================
-- PART 2: Update labs table
-- ============================================

-- Add default print mode for lab
ALTER TABLE public.labs 
ADD COLUMN IF NOT EXISTS default_print_format VARCHAR(20) DEFAULT 'a4'
  CHECK (default_print_format IN ('a4', 'thermal_80mm', 'thermal_58mm'));

-- Add thermal printer model (for documentation/support)
ALTER TABLE public.labs
ADD COLUMN IF NOT EXISTS thermal_printer_model VARCHAR(100);

-- Add thermal paper width
ALTER TABLE public.labs
ADD COLUMN IF NOT EXISTS thermal_paper_width INTEGER DEFAULT 80
  CHECK (thermal_paper_width IN (58, 80));

-- Add comments
COMMENT ON COLUMN public.labs.default_print_format IS 
  'Default invoice format for this lab: a4, thermal_80mm, or thermal_58mm';
  
COMMENT ON COLUMN public.labs.thermal_printer_model IS 
  'Thermal printer model (e.g., Epson TM-T20, Star TSP100) - for documentation';
  
COMMENT ON COLUMN public.labs.thermal_paper_width IS 
  'Thermal paper width in mm: 58 or 80';

-- ============================================
-- PART 3: Create default thermal templates
-- ============================================

-- Insert default 80mm thermal template for existing labs
INSERT INTO public.invoice_templates (
  lab_id,
  template_name,
  format_type,
  print_mode,
  is_default,
  is_active,
  thermal_settings,
  include_payment_terms,
  payment_terms_text
)
SELECT 
  id as lab_id,
  'Thermal Receipt 80mm (Default)' as template_name,
  'thermal_80mm' as format_type,
  'thermal' as print_mode,
  false as is_default,  -- Don't override existing default A4 template
  true as is_active,
  jsonb_build_object(
    'width_mm', 80,
    'paper_size', '80mm',
    'font_size', '11px',
    'line_spacing', '1.3',
    'margins', '5mm',
    'barcode_height', '35px',
    'barcode_format', 'CODE128',
    'include_logo', true,
    'logo_height', '35px',
    'show_barcode', true,
    'auto_cut', false
  ) as thermal_settings,
  false as include_payment_terms,
  'Thank you for your visit!' as payment_terms_text
FROM public.labs
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_templates it 
  WHERE it.lab_id = labs.id 
  AND it.format_type = 'thermal_80mm'
);

-- Insert default 58mm thermal template for existing labs
INSERT INTO public.invoice_templates (
  lab_id,
  template_name,
  format_type,
  print_mode,
  is_default,
  is_active,
  thermal_settings,
  include_payment_terms,
  payment_terms_text
)
SELECT 
  id as lab_id,
  'Thermal Receipt 58mm' as template_name,
  'thermal_58mm' as format_type,
  'thermal' as print_mode,
  false as is_default,
  true as is_active,
  jsonb_build_object(
    'width_mm', 58,
    'paper_size', '58mm',
    'font_size', '10px',
    'line_spacing', '1.2',
    'margins', '3mm',
    'barcode_height', '30px',
    'barcode_format', 'CODE128',
    'include_logo', false,  -- Usually skip logo on 58mm
    'logo_height', '25px',
    'show_barcode', true,
    'auto_cut', false
  ) as thermal_settings,
  false as include_payment_terms,
  'Thank you!' as payment_terms_text
FROM public.labs
WHERE NOT EXISTS (
  SELECT 1 FROM public.invoice_templates it 
  WHERE it.lab_id = labs.id 
  AND it.format_type = 'thermal_58mm'
);

-- ============================================
-- PART 4: Add helper function to get thermal template
-- ============================================

CREATE OR REPLACE FUNCTION get_thermal_template(
  p_lab_id UUID,
  p_format_type VARCHAR DEFAULT 'thermal_80mm'
)
RETURNS TABLE (
  id UUID,
  template_name VARCHAR,
  thermal_settings JSONB,
  payment_terms_text TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    it.id,
    it.template_name,
    it.thermal_settings,
    it.payment_terms_text
  FROM public.invoice_templates it
  WHERE it.lab_id = p_lab_id
    AND it.format_type = p_format_type
    AND it.is_active = true
  ORDER BY it.is_default DESC, it.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_thermal_template IS 
  'Helper function to fetch active thermal template for a lab';
