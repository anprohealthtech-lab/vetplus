-- Add PDF support to reports table

BEGIN;

-- Add PDF-related columns to reports table
DO $$ 
BEGIN
    -- Add pdf_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reports' 
                   AND column_name = 'pdf_url') THEN
        ALTER TABLE reports ADD COLUMN pdf_url TEXT;
    END IF;
    
    -- Add pdf_generated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reports' 
                   AND column_name = 'pdf_generated_at') THEN
        ALTER TABLE reports ADD COLUMN pdf_generated_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add order_id column if it doesn't exist (backup check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'reports' 
                   AND column_name = 'order_id') THEN
        ALTER TABLE reports ADD COLUMN order_id UUID;
        
        -- Update order_id based on result_id relationships
        UPDATE reports 
        SET order_id = r.order_id 
        FROM results r 
        WHERE reports.result_id = r.id 
        AND reports.order_id IS NULL;
        
        -- Add foreign key constraint
        ALTER TABLE reports 
        ADD CONSTRAINT reports_order_id_fkey 
        FOREIGN KEY (order_id) REFERENCES orders(id);
    END IF;
    
    -- Update status column to be more descriptive if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'reports' 
               AND column_name = 'status') THEN
        -- Update existing records to have consistent status
        UPDATE reports 
        SET status = CASE 
            WHEN status IS NULL OR status = '' THEN 'pending'
            WHEN status = 'pending' THEN 'pending'
            WHEN pdf_url IS NOT NULL THEN 'completed'
            ELSE 'pending'
        END;
    END IF;
END $$;

-- Create index for better performance on PDF queries
CREATE INDEX IF NOT EXISTS idx_reports_pdf_url 
ON reports(pdf_url) 
WHERE pdf_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_order_id_pdf 
ON reports(order_id, pdf_generated_at) 
WHERE order_id IS NOT NULL;

-- Add comment to table for documentation
COMMENT ON COLUMN reports.pdf_url IS 'URL to the generated PDF report stored in Supabase storage';
COMMENT ON COLUMN reports.pdf_generated_at IS 'Timestamp when the PDF was generated and saved';
COMMENT ON COLUMN reports.order_id IS 'Reference to the order this report belongs to';

COMMIT;
