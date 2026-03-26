/*
  # Enhance attachments table for better file management

  1. Schema Updates
    - Add `lab_id` column for lab-specific organization
    - Add `file_path` column to store the actual storage path
    - Add `original_filename` and `stored_filename` for better file tracking
    - Add `file_size` column for storage management
    - Add `upload_timestamp` for detailed tracking

  2. Indexes
    - Add indexes for efficient querying by patient_id, lab_id, and file_type
    - Add composite indexes for common query patterns

  3. Security
    - Update RLS policies to handle lab_id access
    - Ensure proper access control for file operations
*/

-- Add new columns to attachments table
DO $$
BEGIN
  -- Add lab_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'lab_id'
  ) THEN
    ALTER TABLE attachments ADD COLUMN lab_id uuid REFERENCES labs(id) ON DELETE SET NULL;
  END IF;

  -- Add file_path column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE attachments ADD COLUMN file_path text;
  END IF;

  -- Add original_filename column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'original_filename'
  ) THEN
    ALTER TABLE attachments ADD COLUMN original_filename text;
  END IF;

  -- Add stored_filename column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'stored_filename'
  ) THEN
    ALTER TABLE attachments ADD COLUMN stored_filename text;
  END IF;

  -- Add file_size column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE attachments ADD COLUMN file_size bigint;
  END IF;

  -- Add upload_timestamp column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'upload_timestamp'
  ) THEN
    ALTER TABLE attachments ADD COLUMN upload_timestamp timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_attachments_patient_id ON attachments(patient_id);
CREATE INDEX IF NOT EXISTS idx_attachments_lab_id ON attachments(lab_id);
CREATE INDEX IF NOT EXISTS idx_attachments_file_type ON attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_attachments_upload_timestamp ON attachments(upload_timestamp);
CREATE INDEX IF NOT EXISTS idx_attachments_patient_lab ON attachments(patient_id, lab_id);
CREATE INDEX IF NOT EXISTS idx_attachments_related ON attachments(related_table, related_id);

-- Update RLS policies for enhanced access control
DROP POLICY IF EXISTS "Users can read attachments" ON attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete attachments" ON attachments;

-- Create comprehensive RLS policies
CREATE POLICY "Users can read own lab attachments"
  ON attachments
  FOR SELECT
  TO authenticated
  USING (
    lab_id IS NULL OR 
    lab_id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments"
  ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    lab_id IS NULL OR 
    lab_id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own attachments"
  ON attachments
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    lab_id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own attachments"
  ON attachments
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    lab_id IN (
      SELECT lab_id FROM users WHERE id = auth.uid()
    )
  );