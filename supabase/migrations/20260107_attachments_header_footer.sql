-- Migration: Add Header/Footer Support via Attachments Table
-- Date: 2026-01-07
-- Purpose: Enable location-specific and B2B-specific headers/footers for PDF reports
-- Note: This migration handles both new table creation and existing table modification

-- ============================================
-- 1. CHECK AND CREATE ATTACHMENTS TABLE
-- ============================================

DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attachments') THEN
    -- Create new table
    CREATE TABLE public.attachments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type text NOT NULL,
      entity_id uuid NOT NULL,
      attachment_type text NOT NULL,
      file_url text NOT NULL,
      file_name text,
      file_size bigint,
      mime_type text,
      uploaded_by uuid REFERENCES auth.users(id),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    
    RAISE NOTICE 'Created new attachments table';
  ELSE
    -- Table exists, check and add missing columns
    RAISE NOTICE 'Attachments table already exists, checking columns...';
    
    -- Add entity_type if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'entity_type') THEN
      ALTER TABLE public.attachments ADD COLUMN entity_type text NOT NULL DEFAULT 'lab';
      RAISE NOTICE 'Added entity_type column';
    END IF;
    
    -- Add entity_id if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'entity_id') THEN
      ALTER TABLE public.attachments ADD COLUMN entity_id uuid;
      RAISE NOTICE 'Added entity_id column';
    END IF;
    
    -- Add attachment_type if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'attachment_type') THEN
      ALTER TABLE public.attachments ADD COLUMN attachment_type text NOT NULL DEFAULT 'document';
      RAISE NOTICE 'Added attachment_type column';
    END IF;
    
    -- Add file_url if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'file_url') THEN
      ALTER TABLE public.attachments ADD COLUMN file_url text NOT NULL DEFAULT '';
      RAISE NOTICE 'Added file_url column';
    END IF;
    
    -- Add file_name if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'file_name') THEN
      ALTER TABLE public.attachments ADD COLUMN file_name text;
      RAISE NOTICE 'Added file_name column';
    END IF;
    
    -- Add file_size if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'file_size') THEN
      ALTER TABLE public.attachments ADD COLUMN file_size bigint;
      RAISE NOTICE 'Added file_size column';
    END IF;
    
    -- Add mime_type if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'mime_type') THEN
      ALTER TABLE public.attachments ADD COLUMN mime_type text;
      RAISE NOTICE 'Added mime_type column';
    END IF;
    
    -- Add uploaded_by if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'uploaded_by') THEN
      ALTER TABLE public.attachments ADD COLUMN uploaded_by uuid REFERENCES auth.users(id);
      RAISE NOTICE 'Added uploaded_by column';
    END IF;
    
    -- Add created_at if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'created_at') THEN
      ALTER TABLE public.attachments ADD COLUMN created_at timestamptz DEFAULT now();
      RAISE NOTICE 'Added created_at column';
    END IF;
    
    -- Add updated_at if not exists
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'attachments' 
                   AND column_name = 'updated_at') THEN
      ALTER TABLE public.attachments ADD COLUMN updated_at timestamptz DEFAULT now();
      RAISE NOTICE 'Added updated_at column';
    END IF;
  END IF;
END $$;

-- ============================================
-- 2. CREATE INDEXES FOR FAST LOOKUP
-- ============================================

-- Composite index for entity lookup
CREATE INDEX IF NOT EXISTS idx_attachments_entity 
ON attachments(entity_type, entity_id, attachment_type);

-- Index for attachment type
CREATE INDEX IF NOT EXISTS idx_attachments_type 
ON attachments(attachment_type);

-- Index for entity type
CREATE INDEX IF NOT EXISTS idx_attachments_entity_type 
ON attachments(entity_type);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. DROP EXISTING POLICIES (if any)
-- ============================================

DROP POLICY IF EXISTS "authenticated_users_read_attachments" ON attachments;
DROP POLICY IF EXISTS "admins_insert_attachments" ON attachments;
DROP POLICY IF EXISTS "admins_update_attachments" ON attachments;
DROP POLICY IF EXISTS "admins_delete_attachments" ON attachments;

-- ============================================
-- 5. CREATE RLS POLICIES
-- ============================================

-- Policy: Authenticated users can read all attachments
CREATE POLICY "authenticated_users_read_attachments"
ON attachments
FOR SELECT
TO authenticated
USING (true);

-- Policy: Only admins/owners can insert attachments
CREATE POLICY "admins_insert_attachments"
ON attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('Admin', 'Owner')
  )
);

-- Policy: Only admins/owners can update attachments
CREATE POLICY "admins_update_attachments"
ON attachments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('Admin', 'Owner')
  )
);

-- Policy: Only admins/owners can delete attachments
CREATE POLICY "admins_delete_attachments"
ON attachments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('Admin', 'Owner')
  )
);

-- ============================================
-- 6. ADD HELPFUL COMMENTS
-- ============================================

COMMENT ON TABLE attachments IS 'Stores file attachments for various entities (labs, locations, accounts) including headers, footers, and logos for PDF customization';
COMMENT ON COLUMN attachments.entity_type IS 'Type of entity: lab, location, account, etc.';
COMMENT ON COLUMN attachments.entity_id IS 'UUID of the entity';
COMMENT ON COLUMN attachments.attachment_type IS 'Type of attachment: header, footer, logo, etc.';
COMMENT ON COLUMN attachments.file_url IS 'Public URL to the file in storage';

-- ============================================
-- 7. CREATE OR REPLACE HELPER FUNCTION
-- ============================================

-- Drop function if exists
DROP FUNCTION IF EXISTS get_attachment(text, uuid, text);

-- Function to get attachment for an entity
CREATE OR REPLACE FUNCTION get_attachment(
  p_entity_type text,
  p_entity_id uuid,
  p_attachment_type text
)
RETURNS TABLE (
  id uuid,
  file_url text,
  file_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.file_url,
    a.file_name,
    a.created_at
  FROM attachments a
  WHERE a.entity_type = p_entity_type
    AND a.entity_id = p_entity_id
    AND a.attachment_type = p_attachment_type
  ORDER BY a.created_at DESC
  LIMIT 1;
END;
$$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'attachments') THEN
    RAISE NOTICE '✅ Attachments table exists';
  ELSE
    RAISE EXCEPTION '❌ Attachments table was not created';
  END IF;
END $$;

-- Verify indexes
DO $$
DECLARE
  index_count int;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'attachments';
  
  RAISE NOTICE '✅ Created % indexes on attachments table', index_count;
END $$;

-- Verify RLS is enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'attachments' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS is enabled on attachments table';
  ELSE
    RAISE WARNING '⚠️ RLS is not enabled on attachments table';
  END IF;
END $$;

-- Verify policies
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'attachments';
  
  RAISE NOTICE '✅ Created % RLS policies on attachments table', policy_count;
END $$;
