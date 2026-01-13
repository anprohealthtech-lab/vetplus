-- Add billing_mode to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'standard' 
CHECK (billing_mode IN ('standard', 'monthly'));

-- Add comment
COMMENT ON COLUMN public.accounts.billing_mode IS 'Billing mode: "standard" for per-order invoicing, "monthly" for consolidated monthly billing';
