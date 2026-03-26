/*
  # Create OCR Results Table

  1. New Tables
    - `ocr_results`
      - `id` (uuid, primary key)
      - `attachment_id` (uuid, foreign key to attachments)
      - `raw_text` (text, extracted text from OCR)
      - `confidence_score` (numeric, OCR confidence)
      - `processing_method` (text, method used for OCR)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `ocr_results` table
    - Add policy for authenticated users to read and insert OCR results
*/

CREATE TABLE IF NOT EXISTS ocr_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid REFERENCES attachments(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  confidence_score numeric DEFAULT 0,
  processing_method text DEFAULT 'Google Cloud Vision AI',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read OCR results"
  ON ocr_results
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert OCR results"
  ON ocr_results
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ocr_results_attachment_id ON ocr_results(attachment_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_created_at ON ocr_results(created_at);