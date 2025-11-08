-- Improved workflow_results schema with proper foreign keys and constraints
-- This is the corrected CREATE TABLE statement

CREATE TABLE IF NOT EXISTS public.workflow_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_instance_id uuid NOT NULL,
  step_id text NOT NULL,
  order_id uuid NULL,
  patient_id uuid NULL,
  lab_id uuid NULL,
  test_group_id uuid NULL,
  test_name text NULL,
  test_code text NULL,
  review_status text NULL,
  sample_id text NULL,
  qc_summary text NULL,
  payload jsonb NOT NULL,
  extracted jsonb NULL,
  status text NOT NULL DEFAULT 'received'::text,
  created_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  committed_at timestamp with time zone NULL,
  error text NULL,
  detail text NULL,
  
  -- Primary Key
  CONSTRAINT workflow_results_pkey PRIMARY KEY (id),
  
  -- Unique constraint: Each workflow instance can only have one result per step
  CONSTRAINT workflow_results_instance_step_unique UNIQUE (workflow_instance_id, step_id),
  
  -- Foreign Keys
  CONSTRAINT workflow_results_workflow_instance_id_fkey 
    FOREIGN KEY (workflow_instance_id) 
    REFERENCES public.order_workflow_instances(id) 
    ON DELETE CASCADE,
  
  CONSTRAINT workflow_results_order_id_fkey 
    FOREIGN KEY (order_id) 
    REFERENCES public.orders(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT workflow_results_patient_id_fkey 
    FOREIGN KEY (patient_id) 
    REFERENCES public.patients(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT workflow_results_lab_id_fkey 
    FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT workflow_results_test_group_id_fkey 
    FOREIGN KEY (test_group_id) 
    REFERENCES public.test_groups(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT workflow_results_sample_id_fkey 
    FOREIGN KEY (sample_id) 
    REFERENCES public.samples(id) 
    ON DELETE SET NULL,
  
  CONSTRAINT workflow_results_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.users(id) 
    ON DELETE SET NULL,
  
  -- Check Constraints
  CONSTRAINT workflow_results_status_check 
    CHECK (status IN ('received', 'processing', 'completed', 'failed', 'committed')),
  
  CONSTRAINT workflow_results_review_status_check 
    CHECK (review_status IS NULL OR review_status IN ('pending', 'approved', 'rejected', 'needs_clarification'))
    
) TABLESPACE pg_default;

-- Indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_wr_instance_step 
  ON public.workflow_results USING btree (workflow_instance_id, step_id) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_order 
  ON public.workflow_results USING btree (order_id) 
  WHERE order_id IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_patient 
  ON public.workflow_results USING btree (patient_id) 
  WHERE patient_id IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_lab 
  ON public.workflow_results USING btree (lab_id) 
  WHERE lab_id IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_test_group 
  ON public.workflow_results USING btree (test_group_id) 
  WHERE test_group_id IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_sample 
  ON public.workflow_results USING btree (sample_id) 
  WHERE sample_id IS NOT NULL
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_created 
  ON public.workflow_results USING btree (created_at DESC) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_status 
  ON public.workflow_results USING btree (status) 
  WHERE status IN ('received', 'processing')
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_payload_gin 
  ON public.workflow_results USING gin (payload) 
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_wr_extracted_gin 
  ON public.workflow_results USING gin (extracted) 
  WHERE extracted IS NOT NULL
  TABLESPACE pg_default;

-- Table and column comments
COMMENT ON TABLE public.workflow_results IS 'Stores workflow execution results linked to order workflow instances';
COMMENT ON COLUMN public.workflow_results.workflow_instance_id IS 'References order_workflow_instances.id';
COMMENT ON COLUMN public.workflow_results.step_id IS 'Workflow step identifier';
COMMENT ON COLUMN public.workflow_results.status IS 'Processing status: received, processing, completed, failed, committed';
COMMENT ON COLUMN public.workflow_results.review_status IS 'Review status: pending, approved, rejected, needs_clarification';
COMMENT ON COLUMN public.workflow_results.payload IS 'Raw workflow step output data';
COMMENT ON COLUMN public.workflow_results.extracted IS 'AI-extracted structured data';
COMMENT ON COLUMN public.workflow_results.committed_at IS 'When results were committed to results table';
