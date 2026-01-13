-- Storage Policies for Attachments Bucket
-- Run this in Supabase SQL Editor

-- ============================================
-- CREATE/UPDATE STORAGE POLICIES
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update attachments" ON storage.objects;

-- Policy: Authenticated users can upload to attachments bucket
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

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

-- Policy: Admins can update attachments
CREATE POLICY "Admins can update attachments"
ON storage.objects
FOR UPDATE
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

DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%attachments%';
  
  RAISE NOTICE '✅ Created/updated % storage policies for attachments', policy_count;
END $$;
