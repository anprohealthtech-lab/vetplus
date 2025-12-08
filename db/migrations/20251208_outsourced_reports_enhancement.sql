-- Migration: Outsourced Reports Lab Integration Enhancement
-- Date: 2025-12-08
-- Description: Adds lab-level settings, logistics tracking, and PDF merge support for outsourced reports

BEGIN;

-- 1. Create lab_outsourcing_settings table for lab-specific preferences
CREATE TABLE IF NOT EXISTS public.lab_outsourcing_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
    
    -- Matching preferences
    auto_match boolean DEFAULT false,
    match_confidence_threshold numeric DEFAULT 0.8 CHECK (match_confidence_threshold >= 0 AND match_confidence_threshold <= 1),
    match_date_range_days integer DEFAULT 7,
    
    -- Logistics tracking
    logistics_providers jsonb DEFAULT '[]'::jsonb,
    default_tat_days integer DEFAULT 3,
    enable_logistics_tracking boolean DEFAULT true,
    
    -- PDF merge preferences
    merge_mode text DEFAULT 'both' CHECK (merge_mode IN ('print_only', 'ecopy_only', 'both')),
    auto_merge_on_match boolean DEFAULT false,
    preserve_outsourced_branding boolean DEFAULT true,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT unique_lab_outsourcing_settings UNIQUE (lab_id)
);

-- 2. Add logistics tracking to results table
DO $$
BEGIN
    -- Add outsourced_logistics_status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'results' AND column_name = 'outsourced_logistics_status'
    ) THEN
        ALTER TABLE public.results 
        ADD COLUMN outsourced_logistics_status text 
        CHECK (outsourced_logistics_status IN (
            'pending_dispatch', 
            'awaiting_pickup', 
            'in_transit', 
            'delivered_to_lab', 
            'report_awaited'
        ));
    END IF;
    
    -- Add tracking barcode for logistics
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'results' AND column_name = 'tracking_barcode'
    ) THEN
        ALTER TABLE public.results ADD COLUMN tracking_barcode text;
    END IF;
    
    -- Add logistics notes
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'results' AND column_name = 'logistics_notes'
    ) THEN
        ALTER TABLE public.results ADD COLUMN logistics_notes text;
    END IF;
    
    -- Add dispatch metadata
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'results' AND column_name = 'dispatched_at'
    ) THEN
        ALTER TABLE public.results ADD COLUMN dispatched_at timestamptz;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'results' AND column_name = 'dispatched_by'
    ) THEN
        ALTER TABLE public.results ADD COLUMN dispatched_by uuid REFERENCES public.users(id);
    END IF;
END $$;

-- 3. Add merged PDF columns to reports table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'merged_print_pdf_url'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN merged_print_pdf_url text;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'merged_ecopy_pdf_url'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN merged_ecopy_pdf_url text;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' AND column_name = 'merged_at'
    ) THEN
        ALTER TABLE public.reports ADD COLUMN merged_at timestamptz;
    END IF;
END $$;

-- 4. Add matching metadata to outsourced_reports
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'outsourced_reports' AND column_name = 'match_confidence'
    ) THEN
        ALTER TABLE public.outsourced_reports 
        ADD COLUMN match_confidence numeric CHECK (match_confidence >= 0 AND match_confidence <= 1);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'outsourced_reports' AND column_name = 'match_suggestions'
    ) THEN
        ALTER TABLE public.outsourced_reports ADD COLUMN match_suggestions jsonb;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'outsourced_reports' AND column_name = 'matched_at'
    ) THEN
        ALTER TABLE public.outsourced_reports ADD COLUMN matched_at timestamptz;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'outsourced_reports' AND column_name = 'matched_by'
    ) THEN
        ALTER TABLE public.outsourced_reports ADD COLUMN matched_by uuid REFERENCES public.users(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'outsourced_reports' AND column_name = 'merge_status'
    ) THEN
        ALTER TABLE public.outsourced_reports 
        ADD COLUMN merge_status text DEFAULT 'pending' 
        CHECK (merge_status IN ('pending', 'in_progress', 'completed', 'failed'));
    END IF;
END $$;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_results_outsourced_logistics_status 
    ON public.results(outsourced_logistics_status) 
    WHERE outsourced_to_lab_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_results_tracking_barcode 
    ON public.results(tracking_barcode) 
    WHERE tracking_barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outsourced_reports_match_confidence 
    ON public.outsourced_reports(match_confidence) 
    WHERE match_confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outsourced_reports_merge_status 
    ON public.outsourced_reports(merge_status);

-- 6. Add RLS policies
ALTER TABLE public.lab_outsourcing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their lab's outsourcing settings"
    ON public.lab_outsourcing_settings
    FOR SELECT
    USING (
        lab_id IN (
            SELECT lab_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Lab managers can update their lab's outsourcing settings"
    ON public.lab_outsourcing_settings
    FOR ALL
    USING (
        lab_id IN (
            SELECT lab_id FROM public.users 
            WHERE id = auth.uid() AND role IN ('Admin', 'Lab Manager')
        )
    );

-- 7. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_lab_outsourcing_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lab_outsourcing_settings_updated_at
    BEFORE UPDATE ON public.lab_outsourcing_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_outsourcing_settings_updated_at();

-- 8. Insert default settings for existing labs
INSERT INTO public.lab_outsourcing_settings (lab_id, auto_match, match_confidence_threshold, merge_mode)
SELECT id, false, 0.8, 'both'
FROM public.labs
WHERE NOT EXISTS (
    SELECT 1 FROM public.lab_outsourcing_settings WHERE lab_id = labs.id
);

COMMIT;

-- Summary:
-- ✅ Created lab_outsourcing_settings table with matching, logistics, and merge preferences
-- ✅ Added outsourced_logistics_status to results for pre-send tracking
-- ✅ Added tracking_barcode, logistics_notes, dispatch metadata to results
-- ✅ Added merged PDF columns (print/ecopy) to reports table
-- ✅ Added match_confidence, match_suggestions, merge_status to outsourced_reports
-- ✅ Created indexes for performance optimization
-- ✅ Set up RLS policies for lab-scoped access
-- ✅ Initialized default settings for all existing labs
