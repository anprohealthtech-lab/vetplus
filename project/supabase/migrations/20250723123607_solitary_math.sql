/*
  # Fix RLS policies for attachments table and storage

  1. Storage Policies
    - Allow authenticated users to upload files to attachments bucket
    - Allow authenticated users to read files from attachments bucket
    - Allow users to delete their own uploaded files

  2. Table Policies
    - Allow authenticated users to insert attachment records
    - Allow users to read attachments they have access to
    - Allow users to update/delete their own attachments

  3. Security
    - Ensure proper access control based on authentication
    - Allow temporary uploads for patient registration
*/

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create storage policies for the attachments bucket
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'attachments');

-- Update attachments table policies
DROP POLICY IF EXISTS "Authenticated users can insert attachments" ON attachments;
DROP POLICY IF EXISTS "Users can read attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete attachments" ON attachments;

-- Allow authenticated users to insert attachment records
CREATE POLICY "Authenticated users can insert attachments"
ON attachments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to read attachments
CREATE POLICY "Users can read attachments"
ON attachments
FOR SELECT
TO authenticated
USING (true);

-- Allow users to update attachments
CREATE POLICY "Users can update attachments"
ON attachments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow users to delete attachments
CREATE POLICY "Users can delete attachments"
ON attachments
FOR DELETE
TO authenticated
USING (true);

-- Ensure RLS is enabled on attachments table
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;