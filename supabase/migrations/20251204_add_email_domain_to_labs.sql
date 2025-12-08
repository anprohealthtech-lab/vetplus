-- Migration: Add email_domain field to labs table for lab-specific email sending
-- Date: 2025-12-04
-- Purpose: Allow each lab to use their own verified domain for sending emails

-- Add email_domain column to labs table
ALTER TABLE public.labs 
ADD COLUMN IF NOT EXISTS email_domain text;

-- Add comment explaining the field
COMMENT ON COLUMN public.labs.email_domain IS 
'Verified email domain for this lab (e.g., "bestpathologylab.in"). When set, emails will be sent from addresses like reports@{email_domain}, billing@{email_domain}. If null, falls back to platform default domain.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_labs_email_domain ON public.labs(email_domain);

-- Example update for existing labs (optional - run manually after domain verification in Resend)
-- UPDATE public.labs SET email_domain = 'bestpathologylab.in' WHERE code = 'BEST001';
-- UPDATE public.labs SET email_domain = 'labname.com' WHERE code = 'LAB002';
