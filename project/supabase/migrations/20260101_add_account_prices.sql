-- Create account_prices table for fixed price overrides
CREATE TABLE IF NOT EXISTS public.account_prices (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.accounts(id),
    test_group_id uuid NOT NULL REFERENCES public.test_groups(id),
    price numeric NOT NULL CHECK (price >= 0),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE(account_id, test_group_id)
);

-- Enable RLS
ALTER TABLE public.account_prices ENABLE ROW LEVEL SECURITY;

-- Policies (Standard authenticated access)
CREATE POLICY "Enable read access for authenticated users" ON public.account_prices
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable write access for authenticated users" ON public.account_prices
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.account_prices
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.account_prices
    FOR DELETE TO authenticated USING (true);

-- Add index for valid performance lookup
CREATE INDEX IF NOT EXISTS idx_account_prices_lookup ON public.account_prices(account_id, test_group_id);
