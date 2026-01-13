-- Migration: Add consolidated invoices for monthly B2B billing
-- Step 1: Create consolidated_invoices table
CREATE TABLE IF NOT EXISTS public.consolidated_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lab_id uuid NOT NULL REFERENCES public.labs(id),
  invoice_number text NOT NULL,
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_amount numeric DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
  due_date date,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  notes text,
  CONSTRAINT unique_lab_invoice_number UNIQUE(lab_id, invoice_number),
  CONSTRAINT unique_account_period UNIQUE(account_id, billing_period_start, billing_period_end)
);

-- Step 2: Create junction table
CREATE TABLE IF NOT EXISTS public.consolidated_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consolidated_invoice_id uuid NOT NULL REFERENCES public.consolidated_invoices(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_invoice_order UNIQUE(consolidated_invoice_id, order_id)
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_consolidated_invoices_account ON public.consolidated_invoices(account_id, billing_period_start);
CREATE INDEX IF NOT EXISTS idx_consolidated_invoices_status ON public.consolidated_invoices(status);
CREATE INDEX IF NOT EXISTS idx_consolidated_invoices_lab ON public.consolidated_invoices(lab_id);
CREATE INDEX IF NOT EXISTS idx_consolidated_invoice_items_lookup ON public.consolidated_invoice_items(consolidated_invoice_id, order_id);
CREATE INDEX IF NOT EXISTS idx_consolidated_invoice_items_order ON public.consolidated_invoice_items(order_id);

-- Step 4: Enable RLS
ALTER TABLE public.consolidated_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consolidated_invoice_items ENABLE ROW LEVEL SECURITY;

-- Step 5: Create policies for consolidated_invoices
CREATE POLICY "Enable read for authenticated" ON public.consolidated_invoices 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated" ON public.consolidated_invoices 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated" ON public.consolidated_invoices 
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated" ON public.consolidated_invoices 
  FOR DELETE TO authenticated USING (true);

-- Step 6: Create policies for consolidated_invoice_items
CREATE POLICY "Enable read for authenticated items" ON public.consolidated_invoice_items 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated items" ON public.consolidated_invoice_items 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated items" ON public.consolidated_invoice_items 
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated items" ON public.consolidated_invoice_items 
  FOR DELETE TO authenticated USING (true);

-- Step 7: Add comments
COMMENT ON TABLE public.consolidated_invoices IS 'Monthly consolidated invoices for B2B accounts with billing_mode = monthly';
COMMENT ON TABLE public.consolidated_invoice_items IS 'Links individual orders to their consolidated invoice';
COMMENT ON COLUMN public.consolidated_invoices.invoice_number IS 'Unique invoice number per lab (e.g., CINV-2026-01-001)';
COMMENT ON COLUMN public.consolidated_invoices.status IS 'Invoice status: draft, sent, paid, partial, overdue, cancelled';
