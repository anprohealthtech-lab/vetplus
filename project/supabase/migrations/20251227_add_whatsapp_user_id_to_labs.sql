-- Migration: Add whatsapp_user_id to labs table
-- This stores the WhatsApp backend user ID for each lab
-- All WhatsApp operations for a lab will use this single ID

-- Add whatsapp_user_id column to labs table
ALTER TABLE public.labs 
ADD COLUMN IF NOT EXISTS whatsapp_user_id UUID;

-- Add comment explaining the column
COMMENT ON COLUMN public.labs.whatsapp_user_id IS 
  'The user ID used for WhatsApp backend integration. Set when lab admin connects WhatsApp.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_labs_whatsapp_user_id 
ON public.labs (whatsapp_user_id) 
WHERE whatsapp_user_id IS NOT NULL;
