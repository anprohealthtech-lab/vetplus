-- Fix workflow_results schema: Add missing foreign keys, fix constraints, and optimize indexes
-- Migration: fix_workflow_results_schema
-- Date: 2025-11-07

-- Drop duplicate/redundant indexes first
DROP INDEX IF EXISTS public.ux_workflow_results_instance_step; -- Duplicate of idx_wr_instance_step
DROP INDEX IF EXISTS public.idx_workflow_results_order; -- Duplicate of idx_wr_order
DROP INDEX IF EXISTS public.idx_workflow_results_created; -- Duplicate of idx_wr_created
DROP INDEX IF EXISTS public.idx_workflow_results_payload_gin; -- Duplicate of idx_wr_payload_gin

-- Drop the problematic unique constraint on workflow_instance_id alone
-- (A workflow instance can have multiple steps/results)
ALTER TABLE public.workflow_results 
DROP CONSTRAINT IF EXISTS workflow_results_workflow_instance_id_key;

-- CLEAN UP ORPHANED RECORDS BEFORE ADDING FOREIGN KEYS
-- This is necessary when adding constraints to existing tables with data

-- Delete workflow_results with non-existent workflow_instance_id
DELETE FROM public.workflow_results
WHERE workflow_instance_id NOT IN (
    SELECT id FROM public.order_workflow_instances
);

-- Delete workflow_results with non-existent order_id
DELETE FROM public.workflow_results
WHERE order_id IS NOT NULL 
AND order_id NOT IN (
    SELECT id FROM public.orders
);

-- Delete workflow_results with non-existent patient_id
DELETE FROM public.workflow_results
WHERE patient_id IS NOT NULL 
AND patient_id NOT IN (
    SELECT id FROM public.patients
);

-- Delete workflow_results with non-existent lab_id
DELETE FROM public.workflow_results
WHERE lab_id IS NOT NULL 
AND lab_id NOT IN (
    SELECT id FROM public.labs
);

-- Delete workflow_results with non-existent test_group_id
DELETE FROM public.workflow_results
WHERE test_group_id IS NOT NULL 
AND test_group_id NOT IN (
    SELECT id FROM public.test_groups
);

-- Note: NOT cleaning up sample_id references because we're not adding a foreign key constraint
-- Samples may not exist when workflow results are created

-- Delete workflow_results with non-existent created_by
DELETE FROM public.workflow_results
WHERE created_by IS NOT NULL 
AND created_by NOT IN (
    SELECT id FROM public.users
);

-- Add missing foreign key constraints
DO $$
BEGIN
    -- Add workflow_instance_id foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workflow_results_workflow_instance_id_fkey'
        AND table_name = 'workflow_results'
    ) THEN
        ALTER TABLE public.workflow_results
        ADD CONSTRAINT workflow_results_workflow_instance_id_fkey 
        FOREIGN KEY (workflow_instance_id) 
        REFERENCES public.order_workflow_instances(id) 
        ON DELETE CASCADE;
    END IF;

    -- Add patient_id foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workflow_results_patient_id_fkey'
        AND table_name = 'workflow_results'
    ) THEN
        ALTER TABLE public.workflow_results
        ADD CONSTRAINT workflow_results_patient_id_fkey 
        FOREIGN KEY (patient_id) 
        REFERENCES public.patients(id) 
        ON DELETE SET NULL;
    END IF;

    -- Add test_group_id foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workflow_results_test_group_id_fkey'
        AND table_name = 'workflow_results'
    ) THEN
        ALTER TABLE public.workflow_results
        ADD CONSTRAINT workflow_results_test_group_id_fkey 
        FOREIGN KEY (test_group_id) 
        REFERENCES public.test_groups(id) 
        ON DELETE SET NULL;
    END IF;

    -- Note: sample_id foreign key is NOT added because:
    -- 1. Sample records may not exist when workflow results are submitted
    -- 2. sample_id is a reference string (TEXT), not a critical relationship
    -- 3. Workflow results are created before samples in many cases
    -- If you need referential integrity, ensure samples are created first
    
    -- Remove sample_id foreign key if it exists (causes insert failures)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workflow_results_sample_id_fkey'
        AND table_name = 'workflow_results'
    ) THEN
        ALTER TABLE public.workflow_results
        DROP CONSTRAINT workflow_results_sample_id_fkey;
    END IF;

    -- Add created_by foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workflow_results_created_by_fkey'
        AND table_name = 'workflow_results'
    ) THEN
        ALTER TABLE public.workflow_results
        ADD CONSTRAINT workflow_results_created_by_fkey 
        FOREIGN KEY (created_by) 
        REFERENCES public.users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Add check constraint for status values
DO $$
BEGIN
    -- Drop existing constraint if it exists (to allow modification)
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'workflow_results_status_check'
    ) THEN
        ALTER TABLE public.workflow_results DROP CONSTRAINT workflow_results_status_check;
    END IF;
    
    -- Create/recreate with correct values
    ALTER TABLE public.workflow_results
    ADD CONSTRAINT workflow_results_status_check 
    CHECK (status IN ('received', 'processing', 'completed', 'failed', 'committed', 'done'));
END $$;

-- Add check constraint for review_status values (if applicable)
DO $$
BEGIN
    -- Drop existing constraint if it exists (to allow modification)
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'workflow_results_review_status_check'
    ) THEN
        ALTER TABLE public.workflow_results DROP CONSTRAINT workflow_results_review_status_check;
    END IF;
    
    -- Create/recreate with all valid values
    ALTER TABLE public.workflow_results
    ADD CONSTRAINT workflow_results_review_status_check 
    CHECK (review_status IS NULL OR review_status IN (
        'pending', 
        'approved', 
        'rejected', 
        'needs_clarification',
        'completed',
        'in_progress',
        'not_started',
        'done'
    ));
END $$;

-- Create optimized indexes (only the ones we need, avoiding duplicates)
CREATE INDEX IF NOT EXISTS idx_wr_instance_step 
ON public.workflow_results USING btree (workflow_instance_id, step_id);

CREATE INDEX IF NOT EXISTS idx_wr_order 
ON public.workflow_results USING btree (order_id) 
WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wr_patient 
ON public.workflow_results USING btree (patient_id) 
WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wr_lab 
ON public.workflow_results USING btree (lab_id) 
WHERE lab_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wr_test_group 
ON public.workflow_results USING btree (test_group_id) 
WHERE test_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wr_created 
ON public.workflow_results USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wr_status 
ON public.workflow_results USING btree (status) 
WHERE status IN ('received', 'processing');

CREATE INDEX IF NOT EXISTS idx_wr_sample 
ON public.workflow_results USING btree (sample_id) 
WHERE sample_id IS NOT NULL;

-- GIN index for JSONB payload (for searching within payload)
CREATE INDEX IF NOT EXISTS idx_wr_payload_gin 
ON public.workflow_results USING gin (payload);

-- GIN index for JSONB extracted (for searching within extracted results)
CREATE INDEX IF NOT EXISTS idx_wr_extracted_gin 
ON public.workflow_results USING gin (extracted) 
WHERE extracted IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE public.workflow_results IS 'Stores workflow execution results linked to order workflow instances. Each step can produce results that are tracked here before being committed to the results table.';

COMMENT ON COLUMN public.workflow_results.workflow_instance_id IS 'References the order_workflow_instances.id - the active workflow execution';
COMMENT ON COLUMN public.workflow_results.step_id IS 'Identifier for the workflow step that produced these results';
COMMENT ON COLUMN public.workflow_results.status IS 'Processing status: received, processing, completed, failed, committed';
COMMENT ON COLUMN public.workflow_results.review_status IS 'Review/approval status if applicable: pending, approved, rejected, needs_clarification';
COMMENT ON COLUMN public.workflow_results.payload IS 'Raw workflow step output data';
COMMENT ON COLUMN public.workflow_results.extracted IS 'AI-extracted structured data from payload';
COMMENT ON COLUMN public.workflow_results.committed_at IS 'Timestamp when results were committed to the main results table';
COMMENT ON COLUMN public.workflow_results.sample_id IS 'Optional reference to samples table (nullable as sample may not exist yet)';

-- Handle Row Level Security (RLS)
-- SimpleWorkflowRunner inserts via REST API with anon key, so we need proper RLS policies

-- Ensure RLS is enabled
ALTER TABLE public.workflow_results ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS workflow_results_policy ON public.workflow_results;
DROP POLICY IF EXISTS workflow_results_insert_policy ON public.workflow_results;
DROP POLICY IF EXISTS workflow_results_select_policy ON public.workflow_results;
DROP POLICY IF EXISTS workflow_results_update_policy ON public.workflow_results;
DROP POLICY IF EXISTS workflow_results_service_policy ON public.workflow_results;

-- Allow authenticated users (including anon key with JWT) to insert workflow results
CREATE POLICY workflow_results_insert_policy ON public.workflow_results
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Allow authenticated users to view workflow results from their lab
CREATE POLICY workflow_results_select_policy ON public.workflow_results
  FOR SELECT
  TO authenticated, anon
  USING (
    -- Allow if user's lab matches the workflow result's lab
    lab_id IN (
      SELECT lab_id FROM public.users WHERE id = auth.uid()
    )
    OR
    -- Allow service role to see everything
    auth.role() = 'service_role'
  );

-- Allow authenticated users to update workflow results in their lab
CREATE POLICY workflow_results_update_policy ON public.workflow_results
  FOR UPDATE
  TO authenticated, anon
  USING (
    lab_id IN (
      SELECT lab_id FROM public.users WHERE id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    lab_id IN (
      SELECT lab_id FROM public.users WHERE id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
  );

-- Allow authenticated users to delete workflow results (for cleanup)
CREATE POLICY workflow_results_delete_policy ON public.workflow_results
  FOR DELETE
  TO authenticated
  USING (
    lab_id IN (
      SELECT lab_id FROM public.users WHERE id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
  );

-- Note: These policies allow SimpleWorkflowRunner (via anon key + JWT) to insert workflow results
-- and restrict viewing/updating to users within the same lab
