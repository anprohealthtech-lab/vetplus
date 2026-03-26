/*
  # LIMS Database Schema Documentation
  
  This migration serves as comprehensive documentation of the current database schema.
  It includes all tables, relationships, constraints, and data types as they exist.
  
  ## Key Relationships & Design Patterns:
  
  1. **Generic Attachments System**:
     - attachments.related_table + attachments.related_id creates flexible relationships
     - No direct foreign key constraints to specific tables
     - Allows attachments to be linked to orders, patients, results, etc.
  
  2. **Multi-Lab Support**:
     - labs table contains lab information
     - users.lab_id links users to specific labs
     - lab_analytes provides lab-specific analyte configurations
  
  3. **Test Organization**:
     - test_groups contain test packages/panels
     - test_group_analytes links groups to specific analytes
     - orders link to test_groups via order_test_groups
     - Legacy tests table for individual tests
  
  4. **Results & Values**:
     - results table contains test result metadata
     - result_values table contains individual parameter values
     - AI processing fields track automated extraction
  
  5. **User-Defined Types**:
     - gender, blood_group, sample_type, user_status, user_role
     - order_status, priority_type, result_status, invoice_status
     - group_ai_mode for analyte processing modes
  
  ## Important Notes for AI/Applications:
  
  1. **Attachments Relationships**:
     - Use related_table = 'orders' AND related_id = order.id to find order attachments
     - Use related_table = 'patients' AND related_id = patient.id for patient attachments
     - NO direct foreign key constraints exist for these relationships
  
  2. **AI Processing**:
     - attachments.ai_processed, ai_confidence, ai_metadata track AI extraction
     - results.extracted_by_ai, ai_confidence, ai_extraction_metadata for AI results
     - analytes.ai_processing_type defines how AI should process each analyte
  
  3. **Lab-Specific Data**:
     - Always consider lab_id context for multi-lab installations
     - lab_analytes table overrides global analyte settings per lab
  
  4. **Color & QR Coding**:
     - patients.color_code, color_name for visual identification
     - patients.qr_code_data for QR code generation
     - patients.display_id for human-readable patient IDs
*/

-- This migration doesn't modify the schema, it serves as documentation only
-- The schema structure is already established through previous migrations

-- Create a comment on the database to indicate this is a LIMS system
COMMENT ON DATABASE postgres IS 'Laboratory Information Management System (LIMS) - Multi-lab support with AI integration';

-- Add table comments for better understanding
COMMENT ON TABLE public.attachments IS 'Generic attachment system using related_table + related_id for flexible relationships';
COMMENT ON TABLE public.analytes IS 'Global analyte definitions with AI processing configuration';
COMMENT ON TABLE public.lab_analytes IS 'Lab-specific analyte overrides and configurations';
COMMENT ON TABLE public.orders IS 'Test orders from patients with status tracking';
COMMENT ON TABLE public.patients IS 'Patient demographics with color coding and QR code support';
COMMENT ON TABLE public.results IS 'Test result metadata with AI extraction tracking';
COMMENT ON TABLE public.result_values IS 'Individual parameter values for test results';
COMMENT ON TABLE public.test_groups IS 'Test packages/panels with AI processing defaults';
COMMENT ON TABLE public.users IS 'System users with lab association and role-based access';

-- Add column comments for key relationships
COMMENT ON COLUMN public.attachments.related_table IS 'Table name this attachment relates to (orders, patients, results, etc.)';
COMMENT ON COLUMN public.attachments.related_id IS 'ID of the related record in the specified table';
COMMENT ON COLUMN public.attachments.ai_processed IS 'Whether this attachment has been processed by AI';
COMMENT ON COLUMN public.results.extracted_by_ai IS 'Whether this result was extracted using AI';
COMMENT ON COLUMN public.patients.display_id IS 'Human-readable patient ID in format DD-Mon-YYYY-SeqNum';
COMMENT ON COLUMN public.patients.color_code IS 'Hex color code for visual patient identification';

-- Create a view to help understand attachment relationships
CREATE OR REPLACE VIEW public.attachment_relationships AS
SELECT 
  a.id as attachment_id,
  a.related_table,
  a.related_id,
  a.original_filename,
  a.file_type,
  a.ai_processed,
  CASE 
    WHEN a.related_table = 'orders' THEN o.patient_name
    WHEN a.related_table = 'patients' THEN p.name
    WHEN a.related_table = 'results' THEN r.patient_name
    ELSE 'Unknown'
  END as entity_name,
  CASE 
    WHEN a.related_table = 'orders' THEN o.status::text
    WHEN a.related_table = 'patients' THEN CASE WHEN p.is_active THEN 'Active' ELSE 'Inactive' END
    WHEN a.related_table = 'results' THEN r.status::text
    ELSE 'N/A'
  END as entity_status
FROM public.attachments a
LEFT JOIN public.orders o ON (a.related_table = 'orders' AND a.related_id = o.id)
LEFT JOIN public.patients p ON (a.related_table = 'patients' AND a.related_id = p.id)
LEFT JOIN public.results r ON (a.related_table = 'results' AND a.related_id = r.id);

COMMENT ON VIEW public.attachment_relationships IS 'Helper view to understand attachment relationships across tables';

-- Function to get attachments for any entity
CREATE OR REPLACE FUNCTION public.get_entity_attachments(
  entity_table text,
  entity_id uuid
)
RETURNS TABLE (
  id uuid,
  file_url text,
  original_filename text,
  file_type text,
  description text,
  ai_processed boolean,
  created_at timestamptz
) 
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    a.id,
    a.file_url,
    a.original_filename,
    a.file_type,
    a.description,
    a.ai_processed,
    a.created_at
  FROM public.attachments a
  WHERE a.related_table = entity_table 
    AND a.related_id = entity_id
  ORDER BY a.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_entity_attachments IS 'Get all attachments for a specific entity (table + id)';

-- Function to help applications understand the schema relationships
CREATE OR REPLACE FUNCTION public.get_schema_info()
RETURNS jsonb
LANGUAGE SQL
STABLE
AS $$
  SELECT jsonb_build_object(
    'attachment_system', jsonb_build_object(
      'type', 'generic',
      'description', 'Uses related_table + related_id for flexible relationships',
      'no_foreign_keys', true,
      'supported_entities', ARRAY['orders', 'patients', 'results', 'labs']
    ),
    'ai_integration', jsonb_build_object(
      'attachment_processing', 'attachments.ai_processed, ai_confidence, ai_metadata',
      'result_extraction', 'results.extracted_by_ai, ai_confidence, ai_extraction_metadata',
      'analyte_config', 'analytes.ai_processing_type, ai_prompt_override'
    ),
    'multi_lab_support', jsonb_build_object(
      'enabled', true,
      'user_association', 'users.lab_id',
      'analyte_overrides', 'lab_analytes table'
    ),
    'patient_identification', jsonb_build_object(
      'display_id_format', 'DD-Mon-YYYY-SeqNum',
      'color_coding', true,
      'qr_codes', true
    )
  );
$$;

COMMENT ON FUNCTION public.get_schema_info IS 'Returns JSON describing key schema design patterns for applications';
