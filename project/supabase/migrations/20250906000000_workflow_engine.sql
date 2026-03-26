-- Migration: workflow engine base (lab-scoped workflows)
-- Safe additive changes only

BEGIN;

-- 1. Workflows (logical grouping)
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'lab', -- lab | global (can extend later)
  lab_id UUID NULL, -- required when scope='lab'
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_lab_scope ON public.workflows(lab_id, scope) WHERE lab_id IS NOT NULL;

-- 2. Workflow versions (immutable definitions)
CREATE TABLE IF NOT EXISTS public.workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  definition JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, version)
);

-- 3. Mapping tests to a specific workflow version (lab scoped)
CREATE TABLE IF NOT EXISTS public.test_workflow_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  test_code TEXT NOT NULL, -- canonical test identifier (e.g., 'PERIPH_SMEAR', 'CBC')
  test_group_id UUID NULL REFERENCES public.test_groups(id) ON DELETE SET NULL, -- optional test group mapping
  workflow_version_id UUID NOT NULL REFERENCES public.workflow_versions(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_workflow_map_lookup ON public.test_workflow_map(lab_id, test_code);
CREATE INDEX IF NOT EXISTS idx_test_workflow_map_lab ON public.test_workflow_map(lab_id);
CREATE INDEX IF NOT EXISTS idx_test_workflow_map_test_group ON public.test_workflow_map(test_group_id) WHERE test_group_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_test_workflow_map_default ON public.test_workflow_map(lab_id, test_code) WHERE is_default = TRUE;

-- 4. Workflow instance per order (optional linkage)
CREATE TABLE IF NOT EXISTS public.order_workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  workflow_version_id UUID NOT NULL REFERENCES public.workflow_versions(id) ON DELETE RESTRICT,
  current_step_id TEXT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  UNIQUE(order_id)
);
CREATE INDEX IF NOT EXISTS idx_order_workflow_instances_order ON public.order_workflow_instances(order_id);

-- 5. Step events (audit trail)
CREATE TABLE IF NOT EXISTS public.workflow_step_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.order_workflow_instances(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- step.enter, step.complete, etc.
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_step_events_instance ON public.workflow_step_events(instance_id);

COMMIT;

-- Seed peripheral smear workflow for lab 2f8d0329-d584-4423-91f6-9ab326b700ae
DO $$
DECLARE
  lab UUID := '2f8d0329-d584-4423-91f6-9ab326b700ae';
  wf_id UUID;
  wfv_id UUID;
BEGIN
  -- create workflow
  INSERT INTO public.workflows(name, scope, lab_id)
  VALUES ('Peripheral Smear Examination', 'lab', lab)
  RETURNING id INTO wf_id;

  -- create version 1
  INSERT INTO public.workflow_versions(workflow_id, version, definition)
  VALUES (
    wf_id,
    1,
    jsonb_build_object(
      'id','peripheral_smear_v1',
      'name','Peripheral Smear Examination',
      'steps', jsonb_build_array(
        jsonb_build_object('id','intro','type','info','title','Start Peripheral Smear','text','Prepare slide, focus at 10x.'),
        jsonb_build_object('id','capture_low','type','capture','magnification','10x','prompt','Capture representative field (10x)'),
        jsonb_build_object('id','capture_high','type','capture','magnification','40x','prompt','Capture WBC rich field (40x)'),
        jsonb_build_object('id','ai_stub','type','analyze','algorithm','wbc_rbc_estimator_stub'),
        jsonb_build_object('id','review','type','review','fields', jsonb_build_array('wbc_estimate','rbc_morphology','platelets')),
        jsonb_build_object('id','finalize','type','commit','creates', jsonb_build_array('result'))
      )
    )
  ) RETURNING id INTO wfv_id;

  -- map multiple test codes to this workflow version as default
  INSERT INTO public.test_workflow_map(lab_id, test_code, workflow_version_id, is_default)
  VALUES
    (lab, 'PERIPH_SMEAR', wfv_id, TRUE),
    (lab, 'CBC', wfv_id, TRUE),
    (lab, 'CBC_WITH_DIFF', wfv_id, TRUE),
    (lab, 'BLOOD_SMEAR', wfv_id, TRUE),
    (lab, 'HEMATOLOGY_BASIC', wfv_id, TRUE);
END $$;
