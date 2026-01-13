-- Add contact_person to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS contact_person text;
