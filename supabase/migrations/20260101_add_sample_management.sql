-- Migration: Add sample management support to existing schema
-- Date: 2026-01-01
-- Purpose: Enable proper sample tracking for machine integration

-- ============================================================
-- Step 1: Add sample_id to order_test_groups
-- ============================================================
-- This links each test group to its required physical sample
ALTER TABLE public.order_test_groups 
ADD COLUMN IF NOT EXISTS sample_id text;

-- Add foreign key constraint
ALTER TABLE public.order_test_groups
ADD CONSTRAINT order_test_groups_sample_id_fkey 
FOREIGN KEY (sample_id) REFERENCES public.samples(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_test_groups_sample_id 
ON public.order_test_groups(sample_id);

-- Add comments
COMMENT ON COLUMN public.order_test_groups.sample_id IS 
  'Reference to the physical sample tube required for this test group. Multiple test groups can share the same sample if they require the same sample type.';

-- ============================================================
-- Step 2: Add qr_code_data to samples
-- ============================================================
-- Store QR code payload for comprehensive sample identification
ALTER TABLE public.samples 
ADD COLUMN IF NOT EXISTS qr_code_data jsonb;

-- Create GIN index for JSON querying
CREATE INDEX IF NOT EXISTS idx_samples_qr_code 
ON public.samples USING GIN (qr_code_data);

-- Add comments
COMMENT ON COLUMN public.samples.qr_code_data IS 
  'QR code payload containing sample metadata (sampleId, type, patient, order, etc.) for mobile and tablet scanning';

-- ============================================================
-- Step 3: Create sample_events table
-- ============================================================
-- Audit trail for sample lifecycle (machine integration ready)
CREATE TABLE IF NOT EXISTS public.sample_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sample_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'created',           -- Sample record created
    'collected',         -- Physical sample collected from patient
    'received',          -- Sample received at lab
    'scanned',           -- Barcode/QR scanned
    'loaded_to_machine', -- Loaded into analyzer
    'processed',         -- Analysis completed
    'quality_check',     -- QC performed
    'rejected',          -- Sample rejected (hemolyzed, clotted, etc.)
    'discarded'          -- Sample disposed
  )),
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  location_id uuid,
  machine_id text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT sample_events_pkey PRIMARY KEY (id),
  CONSTRAINT sample_events_sample_id_fkey 
    FOREIGN KEY (sample_id) REFERENCES public.samples(id) ON DELETE CASCADE,
  CONSTRAINT sample_events_performed_by_fkey 
    FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT sample_events_location_id_fkey 
    FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sample_events_sample_id 
ON public.sample_events(sample_id);

CREATE INDEX IF NOT EXISTS idx_sample_events_event_type 
ON public.sample_events(event_type);

CREATE INDEX IF NOT EXISTS idx_sample_events_event_timestamp 
ON public.sample_events(event_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sample_events_machine_id 
ON public.sample_events(machine_id) WHERE machine_id IS NOT NULL;

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_sample_events_sample_type_time 
ON public.sample_events(sample_id, event_type, event_timestamp DESC);

-- Add comments
COMMENT ON TABLE public.sample_events IS 
  'Audit trail for sample lifecycle events including machine loading and scanning. Critical for compliance and machine integration.';

COMMENT ON COLUMN public.sample_events.event_type IS 
  'Type of event: created, collected, received, scanned, loaded_to_machine, processed, quality_check, rejected, discarded';

COMMENT ON COLUMN public.sample_events.machine_id IS 
  'Identifier of the analyzer/machine that processed this sample (e.g., "SYSMEX-XN-1000", "COBAS-6000")';

COMMENT ON COLUMN public.sample_events.metadata IS 
  'Event-specific metadata such as QC results, rejection reasons, machine parameters, etc.';

-- ============================================================
-- Step 4: Create helper view for sample summary
-- ============================================================
-- Makes it easy to see sample status and linked tests
CREATE OR REPLACE VIEW public.v_sample_summary AS
SELECT 
  s.id as sample_id,
  s.order_id,
  s.sample_type,
  s.barcode,
  s.status,
  s.collected_at,
  s.collected_by,
  s.lab_id,
  
  -- Order info
  o.patient_id,
  o.patient_name,
  o.order_date,
  
  -- Test groups using this sample
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'test_group_id', otg.test_group_id,
        'test_name', otg.test_name,
        'order_test_group_id', otg.id
      )
    ) FILTER (WHERE otg.id IS NOT NULL),
    '[]'::json
  ) as test_groups,
  
  -- Count of tests
  COUNT(DISTINCT otg.id) as test_count,
  
  -- Latest event
  (
    SELECT jsonb_build_object(
      'event_type', se.event_type,
      'timestamp', se.event_timestamp,
      'performed_by', se.performed_by
    )
    FROM sample_events se
    WHERE se.sample_id = s.id
    ORDER BY se.event_timestamp DESC
    LIMIT 1
  ) as latest_event,
  
  -- Event count
  (SELECT COUNT(*) FROM sample_events WHERE sample_id = s.id) as event_count

FROM samples s
LEFT JOIN orders o ON s.order_id = o.id
LEFT JOIN order_test_groups otg ON otg.sample_id = s.id
GROUP BY s.id, s.order_id, s.sample_type, s.barcode, s.status, 
         s.collected_at, s.collected_by, s.lab_id,
         o.patient_id, o.patient_name, o.order_date;

COMMENT ON VIEW public.v_sample_summary IS 
  'Summary view of samples with their linked test groups and latest events';

-- ============================================================
-- Step 5: Update existing order_tests.sample_id usage
-- ============================================================
-- The order_tests table already has sample_id (text), but it's been unused
-- Now we can populate it from order_test_groups when needed
COMMENT ON COLUMN public.order_tests.sample_id IS 
  'Legacy sample_id field. New implementation uses order_test_groups.sample_id for proper linking.';
