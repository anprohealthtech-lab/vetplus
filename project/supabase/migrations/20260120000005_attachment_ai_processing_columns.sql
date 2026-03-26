-- Migration: Add AI processing columns to attachments table
-- Purpose: Track when images have been AI-analyzed and metadata about the analysis

DO $$ 
BEGIN
  -- Add ai_processed column if not exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attachments' 
    AND column_name = 'ai_processed'
  ) THEN
    ALTER TABLE public.attachments ADD COLUMN ai_processed boolean DEFAULT false;
    RAISE NOTICE 'Added ai_processed column to attachments';
  END IF;

  -- Add ai_processed_at column if not exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attachments' 
    AND column_name = 'ai_processed_at'
  ) THEN
    ALTER TABLE public.attachments ADD COLUMN ai_processed_at timestamptz;
    RAISE NOTICE 'Added ai_processed_at column to attachments';
  END IF;

  -- Add ai_confidence column if not exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attachments' 
    AND column_name = 'ai_confidence'
  ) THEN
    ALTER TABLE public.attachments ADD COLUMN ai_confidence numeric;
    RAISE NOTICE 'Added ai_confidence column to attachments';
  END IF;

  -- Add ai_metadata column if not exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attachments' 
    AND column_name = 'ai_metadata'
  ) THEN
    ALTER TABLE public.attachments ADD COLUMN ai_metadata jsonb DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added ai_metadata column to attachments';
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.attachments.ai_processed IS 'Whether this attachment has been processed by AI for result extraction';
COMMENT ON COLUMN public.attachments.ai_processed_at IS 'Timestamp of when AI processing was completed';
COMMENT ON COLUMN public.attachments.ai_confidence IS 'AI confidence score for extracted results (0-1)';
COMMENT ON COLUMN public.attachments.ai_metadata IS 'Additional metadata from AI processing (test group, matched count, etc.)';

-- Create index for quick lookup of AI-processed attachments
CREATE INDEX IF NOT EXISTS idx_attachments_ai_processed 
ON public.attachments(ai_processed) 
WHERE ai_processed = true;
