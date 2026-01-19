-- Migration: Multi-Entity Pricing System
-- Date: 2026-01-19
-- Description: Add test-wise pricing for locations (franchise B2C), outsourced labs, and B2B account packages

-- ============================================================================
-- 1. LOCATION TEST PRICES (Franchise B2C Pricing + Lab Receivables)
-- ============================================================================
-- For franchise locations: patient_price = what patient pays, lab_receivable = what lab receives
-- If lab_receivable is NULL, calculate using locations.collection_percentage instead

CREATE TABLE IF NOT EXISTS public.location_test_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  test_group_id uuid NOT NULL,
  patient_price numeric NOT NULL CHECK (patient_price >= 0),
  lab_receivable numeric CHECK (lab_receivable >= 0), -- NULL means use collection_percentage
  effective_from date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  notes text,
  
  CONSTRAINT location_test_prices_pkey PRIMARY KEY (id),
  CONSTRAINT location_test_prices_location_id_fkey FOREIGN KEY (location_id) 
    REFERENCES public.locations(id) ON DELETE CASCADE,
  CONSTRAINT location_test_prices_test_group_id_fkey FOREIGN KEY (test_group_id) 
    REFERENCES public.test_groups(id) ON DELETE CASCADE,
  CONSTRAINT location_test_prices_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT location_test_prices_updated_by_fkey FOREIGN KEY (updated_by) 
    REFERENCES public.users(id)
);

-- Unique constraint: one active price per location/test (considering effective_from)
CREATE UNIQUE INDEX IF NOT EXISTS idx_location_test_prices_unique 
  ON public.location_test_prices(location_id, test_group_id) 
  WHERE is_active = true;

-- Index for price lookups
CREATE INDEX IF NOT EXISTS idx_location_test_prices_lookup 
  ON public.location_test_prices(location_id, test_group_id, is_active, effective_from);

-- ============================================================================
-- 2. LOCATION PACKAGE PRICES (Franchise B2C Package Pricing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.location_package_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  package_id uuid NOT NULL,
  patient_price numeric NOT NULL CHECK (patient_price >= 0),
  lab_receivable numeric CHECK (lab_receivable >= 0),
  effective_from date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  notes text,
  
  CONSTRAINT location_package_prices_pkey PRIMARY KEY (id),
  CONSTRAINT location_package_prices_location_id_fkey FOREIGN KEY (location_id) 
    REFERENCES public.locations(id) ON DELETE CASCADE,
  CONSTRAINT location_package_prices_package_id_fkey FOREIGN KEY (package_id) 
    REFERENCES public.packages(id) ON DELETE CASCADE,
  CONSTRAINT location_package_prices_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT location_package_prices_updated_by_fkey FOREIGN KEY (updated_by) 
    REFERENCES public.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_package_prices_unique 
  ON public.location_package_prices(location_id, package_id) 
  WHERE is_active = true;

-- ============================================================================
-- 3. OUTSOURCED LAB PRICES (What we pay to outsourced labs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.outsourced_lab_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL, -- Our lab
  outsourced_lab_id uuid NOT NULL, -- The outsourced partner
  test_group_id uuid NOT NULL,
  cost numeric NOT NULL CHECK (cost >= 0), -- What we pay them
  effective_from date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  notes text,
  
  CONSTRAINT outsourced_lab_prices_pkey PRIMARY KEY (id),
  CONSTRAINT outsourced_lab_prices_lab_id_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT outsourced_lab_prices_outsourced_lab_id_fkey FOREIGN KEY (outsourced_lab_id) 
    REFERENCES public.outsourced_labs(id) ON DELETE CASCADE,
  CONSTRAINT outsourced_lab_prices_test_group_id_fkey FOREIGN KEY (test_group_id) 
    REFERENCES public.test_groups(id) ON DELETE CASCADE,
  CONSTRAINT outsourced_lab_prices_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT outsourced_lab_prices_updated_by_fkey FOREIGN KEY (updated_by) 
    REFERENCES public.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outsourced_lab_prices_unique 
  ON public.outsourced_lab_prices(lab_id, outsourced_lab_id, test_group_id) 
  WHERE is_active = true;

-- Index for cost lookups
CREATE INDEX IF NOT EXISTS idx_outsourced_lab_prices_lookup 
  ON public.outsourced_lab_prices(outsourced_lab_id, test_group_id, is_active);

-- ============================================================================
-- 4. ACCOUNT PACKAGE PRICES (B2B Package Pricing)
-- ============================================================================
-- account_prices already exists for test pricing, this adds package pricing

CREATE TABLE IF NOT EXISTS public.account_package_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  package_id uuid NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  effective_from date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  notes text,
  
  CONSTRAINT account_package_prices_pkey PRIMARY KEY (id),
  CONSTRAINT account_package_prices_account_id_fkey FOREIGN KEY (account_id) 
    REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT account_package_prices_package_id_fkey FOREIGN KEY (package_id) 
    REFERENCES public.packages(id) ON DELETE CASCADE,
  CONSTRAINT account_package_prices_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT account_package_prices_updated_by_fkey FOREIGN KEY (updated_by) 
    REFERENCES public.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_package_prices_unique 
  ON public.account_package_prices(account_id, package_id) 
  WHERE is_active = true;

-- ============================================================================
-- 5. ADD effective_from TO EXISTING account_prices TABLE
-- ============================================================================

ALTER TABLE public.account_prices 
  ADD COLUMN IF NOT EXISTS effective_from date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================================
-- 6. ADD outsourced_cost TO invoice_items FOR MARGIN TRACKING
-- ============================================================================

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS outsourced_cost numeric CHECK (outsourced_cost >= 0),
  ADD COLUMN IF NOT EXISTS outsourced_lab_id uuid REFERENCES public.outsourced_labs(id),
  ADD COLUMN IF NOT EXISTS location_receivable numeric CHECK (location_receivable >= 0);

-- ============================================================================
-- 7. ADD location_receivable_type TO LOCATIONS FOR CALCULATION MODE
-- ============================================================================

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS receivable_type text NOT NULL DEFAULT 'percentage' 
    CHECK (receivable_type IN ('percentage', 'test_wise', 'own_center'));

-- Update existing locations: if collection_percentage = 100, mark as own_center
UPDATE public.locations 
SET receivable_type = 'own_center' 
WHERE collection_percentage = 100 OR collection_percentage IS NULL;

-- ============================================================================
-- 8. HELPER VIEWS FOR PRICING LOOKUPS
-- ============================================================================

-- View: Get effective location test prices (considering effective_from date)
CREATE OR REPLACE VIEW public.v_location_test_prices_effective AS
SELECT DISTINCT ON (location_id, test_group_id)
  ltp.*,
  l.name as location_name,
  l.receivable_type,
  l.collection_percentage,
  tg.name as test_name,
  tg.code as test_code,
  tg.price as base_price,
  CASE 
    WHEN l.receivable_type = 'own_center' THEN ltp.patient_price
    WHEN ltp.lab_receivable IS NOT NULL THEN ltp.lab_receivable
    ELSE ROUND(ltp.patient_price * COALESCE(l.collection_percentage, 0) / 100, 2)
  END as calculated_receivable
FROM public.location_test_prices ltp
JOIN public.locations l ON l.id = ltp.location_id
JOIN public.test_groups tg ON tg.id = ltp.test_group_id
WHERE ltp.is_active = true 
  AND ltp.effective_from <= CURRENT_DATE
ORDER BY location_id, test_group_id, effective_from DESC;

-- View: Get effective outsourced lab prices
CREATE OR REPLACE VIEW public.v_outsourced_lab_prices_effective AS
SELECT DISTINCT ON (outsourced_lab_id, test_group_id)
  olp.*,
  ol.name as outsourced_lab_name,
  tg.name as test_name,
  tg.code as test_code,
  tg.price as base_price,
  (tg.price - olp.cost) as margin
FROM public.outsourced_lab_prices olp
JOIN public.outsourced_labs ol ON ol.id = olp.outsourced_lab_id
JOIN public.test_groups tg ON tg.id = olp.test_group_id
WHERE olp.is_active = true 
  AND olp.effective_from <= CURRENT_DATE
ORDER BY outsourced_lab_id, test_group_id, effective_from DESC;

-- View: Get effective account prices (tests + packages)
CREATE OR REPLACE VIEW public.v_account_prices_effective AS
SELECT DISTINCT ON (account_id, test_group_id)
  ap.id,
  ap.account_id,
  ap.test_group_id,
  NULL::uuid as package_id,
  ap.price,
  ap.effective_from,
  ap.is_active,
  a.name as account_name,
  tg.name as item_name,
  tg.code as item_code,
  'test' as item_type,
  tg.price as base_price
FROM public.account_prices ap
JOIN public.accounts a ON a.id = ap.account_id
JOIN public.test_groups tg ON tg.id = ap.test_group_id
WHERE ap.is_active = true 
  AND (ap.effective_from IS NULL OR ap.effective_from <= CURRENT_DATE)
ORDER BY account_id, test_group_id, effective_from DESC NULLS LAST

UNION ALL

SELECT DISTINCT ON (account_id, package_id)
  app.id,
  app.account_id,
  NULL::uuid as test_group_id,
  app.package_id,
  app.price,
  app.effective_from,
  app.is_active,
  a.name as account_name,
  p.name as item_name,
  NULL as item_code,
  'package' as item_type,
  p.price as base_price
FROM public.account_package_prices app
JOIN public.accounts a ON a.id = app.account_id
JOIN public.packages p ON p.id = app.package_id
WHERE app.is_active = true 
  AND app.effective_from <= CURRENT_DATE
ORDER BY account_id, package_id, effective_from DESC;

-- ============================================================================
-- 9. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.location_test_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_package_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outsourced_lab_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_package_prices ENABLE ROW LEVEL SECURITY;

-- Location Test Prices: Lab users can manage their locations' prices
CREATE POLICY "location_test_prices_lab_access" ON public.location_test_prices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.users u ON u.lab_id = l.lab_id
      WHERE l.id = location_test_prices.location_id
      AND u.id = auth.uid()
    )
  );

-- Location Package Prices
CREATE POLICY "location_package_prices_lab_access" ON public.location_package_prices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.locations l
      JOIN public.users u ON u.lab_id = l.lab_id
      WHERE l.id = location_package_prices.location_id
      AND u.id = auth.uid()
    )
  );

-- Outsourced Lab Prices: Lab users can manage their outsourced lab prices
CREATE POLICY "outsourced_lab_prices_lab_access" ON public.outsourced_lab_prices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.lab_id = outsourced_lab_prices.lab_id
    )
  );

-- Account Package Prices: Lab users can manage their accounts' prices
CREATE POLICY "account_package_prices_lab_access" ON public.account_package_prices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      JOIN public.users u ON u.lab_id = a.lab_id
      WHERE a.id = account_package_prices.account_id
      AND u.id = auth.uid()
    )
  );

-- ============================================================================
-- 10. TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_location_test_prices_updated_at
  BEFORE UPDATE ON public.location_test_prices
  FOR EACH ROW EXECUTE FUNCTION update_pricing_updated_at();

CREATE TRIGGER update_location_package_prices_updated_at
  BEFORE UPDATE ON public.location_package_prices
  FOR EACH ROW EXECUTE FUNCTION update_pricing_updated_at();

CREATE TRIGGER update_outsourced_lab_prices_updated_at
  BEFORE UPDATE ON public.outsourced_lab_prices
  FOR EACH ROW EXECUTE FUNCTION update_pricing_updated_at();

CREATE TRIGGER update_account_package_prices_updated_at
  BEFORE UPDATE ON public.account_package_prices
  FOR EACH ROW EXECUTE FUNCTION update_pricing_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.location_test_prices IS 'Test-wise pricing for franchise locations. patient_price = B2C price, lab_receivable = fixed amount lab receives (if NULL, use collection_percentage)';
COMMENT ON TABLE public.location_package_prices IS 'Package-wise pricing for franchise locations';
COMMENT ON TABLE public.outsourced_lab_prices IS 'Cost we pay to outsourced labs per test. Used for margin calculation';
COMMENT ON TABLE public.account_package_prices IS 'B2B package pricing for accounts (complements account_prices for tests)';
COMMENT ON COLUMN public.locations.receivable_type IS 'percentage = use collection_percentage, test_wise = use location_test_prices.lab_receivable, own_center = receivable is 100%';
COMMENT ON COLUMN public.invoice_items.outsourced_cost IS 'Cost paid to outsourced lab for this item (for margin tracking)';
COMMENT ON COLUMN public.invoice_items.location_receivable IS 'Amount receivable from franchise location for this item';
