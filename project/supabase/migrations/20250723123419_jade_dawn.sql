/*
  # Update Attachments RLS Policies

  1. Security Updates
    - Enable RLS on attachments table if not already enabled
    - Update policies to allow authenticated users to insert attachments
    - Allow users to read attachments they uploaded or from their lab
    - Allow users to update/delete their own attachments

  2. Policy Changes
    - INSERT: Allow authenticated users to create attachments
    - SELECT: Allow users to read attachments from their lab or that they uploaded
    - UPDATE: Allow users to update attachments they uploaded or from their lab
    - DELETE: Allow users to delete attachments they uploaded or from their lab
*/

-- Enable RLS on attachments table
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert attachments" ON attachments;
DROP POLICY IF EXISTS "Users can read own lab attachments" ON attachments;
DROP POLICY IF EXISTS "Users can update own attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete own attachments" ON attachments;

-- Create new policies for direct client-side uploads
CREATE POLICY "Authenticated users can insert attachments"
  ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read attachments"
  ON attachments
  FOR SELECT
  TO authenticated
  USING (
    lab_id IS NULL OR 
    lab_id IN (
      SELECT users.lab_id 
      FROM users 
      WHERE users.id = auth.uid()
    ) OR
    uploaded_by = auth.uid()
  );

CREATE POLICY "Users can update attachments"
  ON attachments
  FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    lab_id IN (
      SELECT users.lab_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments"
  ON attachments
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    lab_id IN (
      SELECT users.lab_id 
      FROM users 
      WHERE users.id = auth.uid()
    )
  );