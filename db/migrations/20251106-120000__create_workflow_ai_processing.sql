DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = 'workflow_ai_processing'
    ) THEN
        CREATE TABLE public.workflow_ai_processing (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            workflow_instance_id UUID REFERENCES order_workflow_instances(id) ON DELETE CASCADE,
            order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
            test_group_id UUID REFERENCES test_groups(id),
            lab_id UUID REFERENCES labs(id),
            workflow_data JSONB DEFAULT '{}'::jsonb,
            image_attachments JSONB DEFAULT '[]'::jsonb,
            reference_images JSONB DEFAULT '[]'::jsonb,
            processing_status TEXT DEFAULT 'pending',
            processing_started_at TIMESTAMPTZ,
            processing_completed_at TIMESTAMPTZ,
            extracted_values JSONB,
            ai_confidence NUMERIC,
            ai_metadata JSONB,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

ALTER TABLE public.workflow_ai_processing
    ALTER COLUMN workflow_data SET DEFAULT '{}'::jsonb;

ALTER TABLE public.workflow_ai_processing
    ALTER COLUMN image_attachments SET DEFAULT '[]'::jsonb;

ALTER TABLE public.workflow_ai_processing
    ALTER COLUMN reference_images SET DEFAULT '[]'::jsonb;

ALTER TABLE public.workflow_ai_processing
    ADD CONSTRAINT IF NOT EXISTS workflow_ai_processing_status_check
        CHECK (processing_status = ANY (ARRAY['pending','processing','completed','failed']));

CREATE INDEX IF NOT EXISTS idx_workflow_ai_processing_order
    ON public.workflow_ai_processing (order_id);

CREATE INDEX IF NOT EXISTS idx_workflow_ai_processing_status
    ON public.workflow_ai_processing (processing_status);
