-- Storage Bucket Setup for Attachments
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  true,  -- Public bucket for PDF access
  102400,  -- 100KB limit
  ARRAY['text/html', 'image/png', 'image/jpeg', 'image/jpg']  -- Allowed file types
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 102400,
  allowed_mime_types = ARRAY['text/html', 'image/png', 'image/jpeg', 'image/jpg'];

-- ============================================
-- 2. CREATE STORAGE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete attachments" ON storage.objects;

-- Policy: Authenticated users can upload to attachments bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] IN ('labs', 'locations', 'accounts')
);

-- Policy: Public can read from attachments bucket
CREATE POLICY "Public can read attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'attachments');

-- Policy: Admins can delete from attachments bucket
CREATE POLICY "Admins can delete attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('Admin', 'Owner')
  )
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify bucket exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM storage.buckets WHERE id = 'attachments') THEN
    RAISE NOTICE '✅ Attachments bucket created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create attachments bucket';
  END IF;
END $$;

-- Verify policies
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%attachments%';
  
  RAISE NOTICE '✅ Created % storage policies for attachments', policy_count;
END $$;
