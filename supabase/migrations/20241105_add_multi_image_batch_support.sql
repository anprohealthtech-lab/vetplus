-- Multi-Image Batch Upload Support
-- This migration adds support for batch image uploads with proper tracking and labeling

-- Add batch tracking columns to existing attachments table
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS batch_sequence INTEGER;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS batch_total INTEGER;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS image_label TEXT; -- "Image 1", "Image 2", etc.
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS batch_metadata JSONB DEFAULT '{}';

-- Create indexes for batch queries
CREATE INDEX IF NOT EXISTS idx_attachments_batch ON attachments(batch_id, batch_sequence);
CREATE INDEX IF NOT EXISTS idx_attachments_batch_order ON attachments(batch_id, order_id);

-- Create batch uploads tracking table
CREATE TABLE IF NOT EXISTS attachment_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  patient_id UUID REFERENCES patients(id),
  upload_type TEXT CHECK (upload_type IN ('order', 'test', 'patient')) NOT NULL,
  total_files INTEGER NOT NULL,
  upload_context JSONB DEFAULT '{}', -- stores test_id, analyte info etc
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  lab_id UUID REFERENCES labs(id) NOT NULL,
  batch_status TEXT DEFAULT 'completed' CHECK (batch_status IN ('uploading', 'completed', 'failed')),
  batch_description TEXT,
  
  CONSTRAINT attachment_batches_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES labs(id),
  CONSTRAINT attachment_batches_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT attachment_batches_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT attachment_batches_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Create indexes for batch tracking
CREATE INDEX IF NOT EXISTS idx_attachment_batches_order ON attachment_batches(order_id);
CREATE INDEX IF NOT EXISTS idx_attachment_batches_lab ON attachment_batches(lab_id);
CREATE INDEX IF NOT EXISTS idx_attachment_batches_created ON attachment_batches(created_at DESC);

-- Migration for existing attachments to have batch support
DO $$
BEGIN
  -- Set existing attachments as individual batches
  UPDATE attachments 
  SET 
    batch_id = id, -- Each existing attachment is its own batch
    batch_sequence = 1,
    batch_total = 1,
    image_label = 'Image 1'
  WHERE batch_id IS NULL;
  
  -- Create batch records for existing attachments that have order_id
  INSERT INTO attachment_batches (
    id, order_id, patient_id, upload_type, total_files, 
    uploaded_by, created_at, lab_id, batch_description
  )
  SELECT DISTINCT
    a.id as batch_id,
    a.order_id,
    a.patient_id,
    'order' as upload_type,
    1 as total_files,
    a.uploaded_by,
    a.upload_timestamp as created_at,
    COALESCE(a.lab_id, o.lab_id) as lab_id,
    'Migrated single file upload' as batch_description
  FROM attachments a
  LEFT JOIN orders o ON a.order_id = o.id
  WHERE a.order_id IS NOT NULL 
    AND a.batch_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM attachment_batches ab WHERE ab.id = a.batch_id
    );
END $$;

-- Add RLS policies for attachment_batches
ALTER TABLE attachment_batches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access batches from their lab
CREATE POLICY "attachment_batches_lab_isolation" ON attachment_batches
FOR ALL USING (
  lab_id IN (
    SELECT lab_id FROM users WHERE id = auth.uid()
  )
);

-- Add helpful view for batch queries
CREATE OR REPLACE VIEW v_attachment_batches AS
SELECT 
  ab.*,
  COUNT(a.id) as actual_files,
  STRING_AGG(a.original_filename, ', ' ORDER BY a.batch_sequence) as filenames,
  u.email as uploaded_by_email,
  o.patient_name,
  l.name as lab_name
FROM attachment_batches ab
LEFT JOIN attachments a ON ab.id = a.batch_id
LEFT JOIN users u ON ab.uploaded_by = u.id
LEFT JOIN orders o ON ab.order_id = o.id
LEFT JOIN labs l ON ab.lab_id = l.id
GROUP BY ab.id, u.email, o.patient_name, l.name;

COMMENT ON TABLE attachment_batches IS 'Tracks batch uploads of multiple images/files with context';
COMMENT ON COLUMN attachments.batch_id IS 'Groups multiple files uploaded together';
COMMENT ON COLUMN attachments.batch_sequence IS 'Order within the batch (1, 2, 3...)';
COMMENT ON COLUMN attachments.image_label IS 'Human readable label like "Image 1", "Image 2"';