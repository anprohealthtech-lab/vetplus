-- Migration: Email Integration & Outsourced Management
-- Date: 2025-12-02
-- Description: Adds missing columns to existing tables for multi-tenant email routing

-- NOTE: Most tables already exist in the schema. Only adding missing columns.

-- 1. email_logs table - ALREADY EXISTS, skip creation

-- 2. outsourced_labs table - ALREADY EXISTS, skip creation

-- 3. test_groups columns - Add if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_groups' AND column_name = 'is_outsourced') THEN
        ALTER TABLE public.test_groups ADD COLUMN is_outsourced boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'test_groups' AND column_name = 'default_outsourced_lab_id') THEN
        ALTER TABLE public.test_groups ADD COLUMN default_outsourced_lab_id uuid REFERENCES public.outsourced_labs(id);
    END IF;
END $$;

-- 4. results table columns - Add if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'results' AND column_name = 'outsourced_to_lab_id') THEN
        ALTER TABLE public.results ADD COLUMN outsourced_to_lab_id uuid REFERENCES public.outsourced_labs(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'results' AND column_name = 'outsourced_status') THEN
        ALTER TABLE public.results ADD COLUMN outsourced_status text DEFAULT 'not_outsourced' CHECK (outsourced_status IN ('not_outsourced', 'pending_send', 'sent', 'awaiting_report', 'received', 'merged'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'results' AND column_name = 'outsourced_tat_estimate') THEN
        ALTER TABLE public.results ADD COLUMN outsourced_tat_estimate timestamp with time zone;
    END IF;
END $$;

-- 5. outsourced_reports table - ALREADY EXISTS, add missing columns for multi-tenant routing
DO $$
BEGIN
    -- Add recipient_email column (the forwarding email - key for multi-tenant matching)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outsourced_reports' AND column_name = 'recipient_email') THEN
        ALTER TABLE public.outsourced_reports ADD COLUMN recipient_email text;
        COMMENT ON COLUMN public.outsourced_reports.recipient_email IS 'The lab user email that forwarded this report - used for multi-tenant routing';
    END IF;

    -- Add matched_user_id column (tracks which user received this)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outsourced_reports' AND column_name = 'matched_user_id') THEN
        ALTER TABLE public.outsourced_reports ADD COLUMN matched_user_id uuid REFERENCES public.users(id);
        COMMENT ON COLUMN public.outsourced_reports.matched_user_id IS 'The user whose email received this report';
    END IF;
END $$;

-- Add index for faster lookups by recipient email
CREATE INDEX IF NOT EXISTS idx_outsourced_reports_recipient_email ON public.outsourced_reports(recipient_email);

-- 6. Create storage bucket for outsourced reports (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('outsourced_reports', 'outsourced_reports', true) 
ON CONFLICT (id) DO NOTHING;
