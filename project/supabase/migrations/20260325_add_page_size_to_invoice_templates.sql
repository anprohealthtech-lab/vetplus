-- Add page_size column to invoice_templates
-- Allows per-template paper size selection: A4 (full page), A5 (half page), Letter

ALTER TABLE invoice_templates
  ADD COLUMN IF NOT EXISTS page_size TEXT NOT NULL DEFAULT 'A4'
  CHECK (page_size IN ('A4', 'A5', 'Letter'));
