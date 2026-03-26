-- Add ImageKit support fields to attachments and extend processing status values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attachments'
          AND column_name = 'imagekit_url'
    ) THEN
        ALTER TABLE public.attachments
        ADD COLUMN imagekit_url text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attachments'
          AND column_name = 'imagekit_file_id'
    ) THEN
        ALTER TABLE public.attachments
        ADD COLUMN imagekit_file_id text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attachments'
          AND column_name = 'processed_url'
    ) THEN
        ALTER TABLE public.attachments
        ADD COLUMN processed_url text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attachments'
          AND column_name = 'variants'
    ) THEN
        ALTER TABLE public.attachments
        ADD COLUMN variants jsonb DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attachments'
          AND column_name = 'image_processed_at'
    ) THEN
        ALTER TABLE public.attachments
        ADD COLUMN image_processed_at timestamptz;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'attachments'
          AND column_name = 'image_processing_error'
    ) THEN
        ALTER TABLE public.attachments
        ADD COLUMN image_processing_error text;
    END IF;
END $$;

-- Ensure variants column always has a JSON object default
ALTER TABLE public.attachments
    ALTER COLUMN variants SET DEFAULT '{}'::jsonb;

UPDATE public.attachments
SET variants = '{}'::jsonb
WHERE variants IS NULL;

-- Extend processing_status allowable values and defaults
ALTER TABLE public.attachments
    DROP CONSTRAINT IF EXISTS attachments_processing_status_check;

ALTER TABLE public.attachments
    ADD CONSTRAINT attachments_processing_status_check
    CHECK (processing_status = ANY (ARRAY['pending', 'processing', 'processed', 'failed']));

ALTER TABLE public.attachments
    ALTER COLUMN processing_status SET DEFAULT 'pending';

UPDATE public.attachments
SET processing_status = COALESCE(processing_status, 'pending')
WHERE processing_status IS NULL;
