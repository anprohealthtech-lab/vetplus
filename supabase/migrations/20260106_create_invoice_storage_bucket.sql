-- Create storage bucket for invoices
-- This bucket will store generated invoice PDFs

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the invoices bucket

-- Policy: Allow authenticated users to read invoices from their own lab
CREATE POLICY "Users can view invoices from their lab"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM labs
    WHERE id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Policy: Allow authenticated users to upload invoices for their lab
CREATE POLICY "Users can upload invoices for their lab"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM labs
    WHERE id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Policy: Allow authenticated users to update invoices from their lab
CREATE POLICY "Users can update invoices from their lab"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM labs
    WHERE id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Policy: Allow authenticated users to delete invoices from their lab
CREATE POLICY "Users can delete invoices from their lab"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM labs
    WHERE id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Add comment
COMMENT ON POLICY "Users can view invoices from their lab" ON storage.objects IS 
  'Allows users to view invoice PDFs from their own lab only';
