User: create comprehensive md file for the same

GitHub Copilot: I'll provide the comprehensive MD file content for you to create. Since file creation is disabled, you can copy this into a new file named `INVENTORY_MANAGEMENT_SYSTEM_PLAN.md`:

```markdown
# AI-Enabled Inventory Management System

## Comprehensive Implementation Plan for LIMS v2

**Date**: January 19, 2026  
**AI Model**: Anthropic Claude 3.5 Haiku (via Edge Functions)  
**Status**: Planning Phase

---

## 1. Executive Summary

A full-featured inventory/material management system for diagnostic laboratories with:
- **Intelligent test-to-item mapping** using AI
- **Automated consumption tracking** triggered by result entry
- **Smart stock alerts** with AI-powered reorder suggestions
- **Complete procurement workflow** (PO → GRN → Payment)
- **Physical verification** with discrepancy handling
- **Batch/expiry tracking** with FIFO enforcement

### Key AI Features (Claude 3.5 Haiku)

| Feature | Description |
|---------|-------------|
| **Smart Item Setup** | AI suggests item details, categories, and units based on item name |
| **Test-Item Mapping** | AI auto-maps reagents/consumables to tests based on test methodology |
| **Consumption Patterns** | AI analyzes historical data to optimize consumption quantities |
| **Reorder Intelligence** | AI predicts optimal reorder timing and quantities |
| **Anomaly Detection** | AI flags unusual consumption patterns (wastage, theft) |
| **Expiry Management** | AI suggests usage prioritization based on expiry dates |

---

## 2. Database Schema

### 2.1 Migration File: `supabase/migrations/20260120000001_inventory_tables.sql`

```sql
-- Migration: AI-Enabled Inventory Management System
-- Date: 2026-01-20
-- Description: Complete inventory management with suppliers, items, consumption tracking, 
--              procurement, physical verification, and AI insights

-- ============================================================================
-- 1. SUPPLIERS (Vendor Master)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  -- Basic Info
  name text NOT NULL,
  code text, -- Supplier code (e.g., SUP001)
  supplier_type text DEFAULT 'vendor' CHECK (supplier_type IN ('vendor', 'manufacturer', 'distributor')),
  
  -- Contact
  contact_person text,
  email text,
  phone text,
  alternate_phone text,
  website text,
  
  -- Address
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  country text DEFAULT 'India',
  
  -- Business Details
  gst_number text,
  pan_number text,
  payment_terms_days integer DEFAULT 30,
  credit_limit numeric DEFAULT 0,
  
  -- Banking
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  notes text,
  
  -- Audit
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  
  CONSTRAINT suppliers_pkey PRIMARY KEY (id),
  CONSTRAINT suppliers_lab_id_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT suppliers_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT suppliers_lab_code_unique UNIQUE (lab_id, code)
);

-- ============================================================================
-- 2. INVENTORY CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  name text NOT NULL,
  code text,
  parent_category_id uuid,
  description text,
  
  -- For AI categorization
  ai_keywords text[], -- Keywords AI uses for auto-categorization
  
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT inventory_categories_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_categories_lab_id_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT inventory_categories_parent_fkey FOREIGN KEY (parent_category_id) 
    REFERENCES public.inventory_categories(id)
);

-- ============================================================================
-- 3. INVENTORY ITEMS (Materials/Reagents/Consumables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  -- Identification
  name text NOT NULL,
  code text, -- Item code (e.g., ITM001, REA001)
  barcode text,
  category_id uuid,
  
  -- Classification
  item_type text NOT NULL DEFAULT 'consumable' 
    CHECK (item_type IN ('reagent', 'consumable', 'calibrator', 'control', 'general', 'equipment_part')),
  
  -- Units & Packaging
  unit_of_measure text NOT NULL DEFAULT 'pcs', -- pcs, ml, L, kg, g, box, kit, test
  pack_size numeric DEFAULT 1, -- e.g., 100 tests per kit
  pack_unit text, -- e.g., "kit", "box"
  
  -- Stock Management
  current_stock numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 0,
  reorder_quantity numeric DEFAULT 0,
  minimum_stock numeric DEFAULT 0,
  maximum_stock numeric,
  
  -- Pricing
  last_purchase_price numeric,
  average_price numeric,
  mrp numeric,
  
  -- Storage
  storage_location text, -- e.g., "Refrigerator A, Shelf 2"
  storage_temperature text, -- e.g., "2-8°C", "Room Temperature"
  
  -- Tracking Options
  batch_tracking_enabled boolean NOT NULL DEFAULT false,
  expiry_tracking_enabled boolean NOT NULL DEFAULT true,
  serial_tracking_enabled boolean NOT NULL DEFAULT false,
  
  -- Supplier
  default_supplier_id uuid,
  manufacturer text,
  
  -- Consumption Configuration
  consumption_method text NOT NULL DEFAULT 'per_test'
    CHECK (consumption_method IN ('per_test', 'per_sample', 'per_order', 'fixed_daily', 'manual')),
  
  -- AI Configuration
  ai_suggested_mapping jsonb,
  ai_consumption_analysis jsonb,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_critical boolean NOT NULL DEFAULT false,
  
  -- Audit
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  notes text,
  
  CONSTRAINT inventory_items_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_items_lab_id_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT inventory_items_category_fkey FOREIGN KEY (category_id) 
    REFERENCES public.inventory_categories(id),
  CONSTRAINT inventory_items_supplier_fkey FOREIGN KEY (default_supplier_id) 
    REFERENCES public.suppliers(id),
  CONSTRAINT inventory_items_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT inventory_items_lab_code_unique UNIQUE (lab_id, code)
);

-- ============================================================================
-- 4. INVENTORY BATCHES (For batch/lot tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  
  batch_number text NOT NULL,
  lot_number text,
  
  -- Quantities
  initial_quantity numeric NOT NULL,
  current_quantity numeric NOT NULL,
  
  -- Dates
  manufacturing_date date,
  expiry_date date,
  received_date date DEFAULT CURRENT_DATE,
  
  -- Source
  purchase_order_id uuid,
  goods_receipt_id uuid,
  supplier_id uuid,
  
  -- Pricing
  unit_cost numeric,
  
  -- Status
  status text NOT NULL DEFAULT 'available' 
    CHECK (status IN ('available', 'quarantine', 'expired', 'consumed', 'returned')),
  
  storage_location text,
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT inventory_batches_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_batches_item_fkey FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT inventory_batches_supplier_fkey FOREIGN KEY (supplier_id) 
    REFERENCES public.suppliers(id),
  CONSTRAINT inventory_batches_item_batch_unique UNIQUE (item_id, batch_number)
);

-- ============================================================================
-- 5. TEST-ITEM CONSUMPTION MAPPING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_test_consumption (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  -- Mapping
  test_group_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL,
  
  -- Consumption Details
  quantity_per_test numeric NOT NULL DEFAULT 1,
  consumption_type text NOT NULL DEFAULT 'per_test'
    CHECK (consumption_type IN ('per_test', 'per_sample', 'fixed')),
  
  quantity_unit text,
  
  -- Conditions
  is_optional boolean NOT NULL DEFAULT false,
  condition_expression text,
  
  -- AI
  ai_suggested boolean NOT NULL DEFAULT false,
  ai_confidence numeric,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT inventory_test_consumption_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_test_consumption_lab_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT inventory_test_consumption_test_fkey FOREIGN KEY (test_group_id) 
    REFERENCES public.test_groups(id) ON DELETE CASCADE,
  CONSTRAINT inventory_test_consumption_item_fkey FOREIGN KEY (inventory_item_id) 
    REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT inventory_test_consumption_unique UNIQUE (test_group_id, inventory_item_id)
);

-- ============================================================================
-- 6. INVENTORY TRANSACTIONS (All stock movements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  item_id uuid NOT NULL,
  batch_id uuid,
  
  -- Transaction Details
  transaction_type text NOT NULL 
    CHECK (transaction_type IN (
      'purchase', 'consumption', 'adjustment', 'transfer',
      'return', 'damage', 'expired', 'opening'
    )),
  
  -- Quantities (positive for IN, negative for OUT)
  quantity numeric NOT NULL,
  unit_cost numeric,
  total_cost numeric,
  
  -- Stock After Transaction
  stock_before numeric,
  stock_after numeric,
  
  -- Reference
  reference_type text,
  reference_id uuid,
  
  -- For consumption tracking
  order_id uuid,
  result_id uuid,
  test_group_id uuid,
  
  notes text,
  performed_by uuid,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT inventory_transactions_lab_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT inventory_transactions_item_fkey FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id),
  CONSTRAINT inventory_transactions_batch_fkey FOREIGN KEY (batch_id) 
    REFERENCES public.inventory_batches(id),
  CONSTRAINT inventory_transactions_order_fkey FOREIGN KEY (order_id) 
    REFERENCES public.orders(id),
  CONSTRAINT inventory_transactions_result_fkey FOREIGN KEY (result_id) 
    REFERENCES public.results(id),
  CONSTRAINT inventory_transactions_test_fkey FOREIGN KEY (test_group_id) 
    REFERENCES public.test_groups(id),
  CONSTRAINT inventory_transactions_user_fkey FOREIGN KEY (performed_by) 
    REFERENCES public.users(id)
);

-- ============================================================================
-- 7. PURCHASE ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  po_number text NOT NULL,
  po_date date NOT NULL DEFAULT CURRENT_DATE,
  
  supplier_id uuid NOT NULL,
  
  -- Amounts
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  shipping_amount numeric DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  
  -- Status
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 
                      'partially_received', 'received', 'cancelled')),
  
  -- Dates
  expected_delivery_date date,
  approved_date timestamp with time zone,
  approved_by uuid,
  
  -- Payment
  payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid')),
  payment_terms text,
  
  -- AI Features
  ai_suggested boolean NOT NULL DEFAULT false,
  ai_suggestion_reason text,
  
  notes text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_orders_lab_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT purchase_orders_supplier_fkey FOREIGN KEY (supplier_id) 
    REFERENCES public.suppliers(id),
  CONSTRAINT purchase_orders_approved_by_fkey FOREIGN KEY (approved_by) 
    REFERENCES public.users(id),
  CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT purchase_orders_lab_number_unique UNIQUE (lab_id, po_number)
);

-- ============================================================================
-- 8. PURCHASE ORDER ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL,
  
  item_id uuid NOT NULL,
  
  -- Quantities
  quantity_ordered numeric NOT NULL,
  quantity_received numeric NOT NULL DEFAULT 0,
  
  -- Pricing
  unit_price numeric NOT NULL,
  tax_percent numeric DEFAULT 0,
  discount_percent numeric DEFAULT 0,
  total_price numeric NOT NULL,
  
  specifications text,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_order_items_po_fkey FOREIGN KEY (purchase_order_id) 
    REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT purchase_order_items_item_fkey FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id)
);

-- ============================================================================
-- 9. GOODS RECEIPTS (GRN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  grn_number text NOT NULL,
  grn_date date NOT NULL DEFAULT CURRENT_DATE,
  
  purchase_order_id uuid,
  supplier_id uuid NOT NULL,
  
  -- Invoice Reference
  supplier_invoice_number text,
  supplier_invoice_date date,
  supplier_invoice_amount numeric,
  
  -- Status
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_qc', 'approved', 'partial_reject', 'rejected')),
  
  -- Quality Check
  qc_checked_by uuid,
  qc_checked_at timestamp with time zone,
  qc_notes text,
  
  notes text,
  
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  
  CONSTRAINT goods_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT goods_receipts_lab_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipts_po_fkey FOREIGN KEY (purchase_order_id) 
    REFERENCES public.purchase_orders(id),
  CONSTRAINT goods_receipts_supplier_fkey FOREIGN KEY (supplier_id) 
    REFERENCES public.suppliers(id),
  CONSTRAINT goods_receipts_qc_by_fkey FOREIGN KEY (qc_checked_by) 
    REFERENCES public.users(id),
  CONSTRAINT goods_receipts_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT goods_receipts_lab_number_unique UNIQUE (lab_id, grn_number)
);

-- ============================================================================
-- 10. GOODS RECEIPT ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.goods_receipt_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL,
  
  item_id uuid NOT NULL,
  po_item_id uuid,
  
  -- Quantities
  quantity_received numeric NOT NULL,
  quantity_accepted numeric NOT NULL,
  quantity_rejected numeric DEFAULT 0,
  
  -- Batch Info
  batch_number text,
  lot_number text,
  manufacturing_date date,
  expiry_date date,
  
  unit_cost numeric,
  
  -- Quality
  qc_status text DEFAULT 'pending'
    CHECK (qc_status IN ('pending', 'passed', 'failed', 'partial')),
  rejection_reason text,
  
  storage_location text,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT goods_receipt_items_pkey PRIMARY KEY (id),
  CONSTRAINT goods_receipt_items_grn_fkey FOREIGN KEY (goods_receipt_id) 
    REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT goods_receipt_items_item_fkey FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id),
  CONSTRAINT goods_receipt_items_po_item_fkey FOREIGN KEY (po_item_id) 
    REFERENCES public.purchase_order_items(id)
);

-- ============================================================================
-- 11. STOCK ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  item_id uuid NOT NULL,
  batch_id uuid,
  
  alert_type text NOT NULL
    CHECK (alert_type IN (
      'low_stock', 'critical_stock', 'out_of_stock',
      'expiring_soon', 'expired', 'overstock',
      'consumption_anomaly', 'reorder_suggested'
    )),
  
  current_value numeric,
  threshold_value numeric,
  message text,
  
  -- AI Context
  ai_analysis jsonb,
  ai_recommendation text,
  
  -- Status
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'acknowledged', 'resolved', 'snoozed')),
  
  acknowledged_by uuid,
  acknowledged_at timestamp with time zone,
  resolved_at timestamp with time zone,
  snooze_until timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT stock_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT stock_alerts_lab_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT stock_alerts_item_fkey FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id),
  CONSTRAINT stock_alerts_batch_fkey FOREIGN KEY (batch_id) 
    REFERENCES public.inventory_batches(id),
  CONSTRAINT stock_alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) 
    REFERENCES public.users(id)
);

-- ============================================================================
-- 12. PHYSICAL VERIFICATIONS (Stock Audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.physical_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  verification_number text NOT NULL,
  verification_date date NOT NULL DEFAULT CURRENT_DATE,
  verification_type text NOT NULL DEFAULT 'full'
    CHECK (verification_type IN ('full', 'partial', 'category', 'random')),
  
  category_id uuid,
  
  -- Status
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'pending_approval', 'approved', 'cancelled')),
  
  -- Summary
  total_items_checked integer DEFAULT 0,
  items_matched integer DEFAULT 0,
  items_with_variance integer DEFAULT 0,
  total_variance_value numeric DEFAULT 0,
  
  -- Approval
  approved_by uuid,
  approved_at timestamp with time zone,
  
  notes text,
  
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  
  CONSTRAINT physical_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT physical_verifications_lab_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT physical_verifications_category_fkey FOREIGN KEY (category_id) 
    REFERENCES public.inventory_categories(id),
  CONSTRAINT physical_verifications_approved_by_fkey FOREIGN KEY (approved_by) 
    REFERENCES public.users(id),
  CONSTRAINT physical_verifications_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES public.users(id),
  CONSTRAINT physical_verifications_lab_number_unique UNIQUE (lab_id, verification_number)
);

-- ============================================================================
-- 13. PHYSICAL VERIFICATION ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.physical_verification_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  verification_id uuid NOT NULL,
  
  item_id uuid NOT NULL,
  batch_id uuid,
  
  -- Quantities
  system_quantity numeric NOT NULL,
  physical_quantity numeric NOT NULL,
  variance numeric GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  
  -- Valuation
  unit_cost numeric,
  variance_value numeric,
  
  variance_reason text,
  
  -- Action taken
  adjustment_approved boolean DEFAULT false,
  adjustment_transaction_id uuid,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT physical_verification_items_pkey PRIMARY KEY (id),
  CONSTRAINT physical_verification_items_verification_fkey FOREIGN KEY (verification_id) 
    REFERENCES public.physical_verifications(id) ON DELETE CASCADE,
  CONSTRAINT physical_verification_items_item_fkey FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id),
  CONSTRAINT physical_verification_items_batch_fkey FOREIGN KEY (batch_id) 
    REFERENCES public.inventory_batches(id),
  CONSTRAINT physical_verification_items_txn_fkey FOREIGN KEY (adjustment_transaction_id) 
    REFERENCES public.inventory_transactions(id)
);

-- ============================================================================
-- 14. AI INVENTORY INSIGHTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_inventory_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  
  insight_type text NOT NULL
    CHECK (insight_type IN (
      'consumption_pattern', 'reorder_prediction', 'anomaly_detection',
      'test_mapping_suggestion', 'cost_optimization', 'expiry_alert',
      'supplier_recommendation'
    )),
  
  -- Related Entity
  item_id uuid,
  test_group_id uuid,
  supplier_id uuid,
  
  -- AI Output
  analysis_data jsonb NOT NULL,
  recommendations jsonb,
  confidence_score numeric,
  
  -- Status
  status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected', 'expired')),
  
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  
  valid_until timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT ai_inventory_insights_pkey PRIMARY KEY (id),
  CONSTRAINT ai_inventory_insights_lab_fkey FOREIGN KEY (lab_id) 
    REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT ai_inventory_insights_item_fkey FOREIGN KEY (item_id) 
    REFERENCES public.inventory_items(id),
  CONSTRAINT ai_inventory_insights_test_fkey FOREIGN KEY (test_group_id) 
    REFERENCES public.test_groups(id),
  CONSTRAINT ai_inventory_insights_supplier_fkey FOREIGN KEY (supplier_id) 
    REFERENCES public.suppliers(id),
  CONSTRAINT ai_inventory_insights_reviewed_by_fkey FOREIGN KEY (reviewed_by) 
    REFERENCES public.users(id)
);

-- ============================================================================
-- 15. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_items_lab_category 
  ON public.inventory_items(lab_id, category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock 
  ON public.inventory_items(lab_id, current_stock, reorder_level) 
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry 
  ON public.inventory_batches(expiry_date, status) 
  WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item 
  ON public.inventory_transactions(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_reference 
  ON public.inventory_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_active 
  ON public.stock_alerts(lab_id, status, alert_type) 
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inventory_test_consumption_test 
  ON public.inventory_test_consumption(test_group_id) 
  WHERE is_active = true;

-- ============================================================================
-- 16. TRIGGERS
-- ============================================================================

-- Auto-update stock on transaction insert
CREATE OR REPLACE FUNCTION update_item_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.inventory_items
  SET current_stock = current_stock + NEW.quantity,
      updated_at = NOW()
  WHERE id = NEW.item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_stock ON public.inventory_transactions;
CREATE TRIGGER trigger_update_stock
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION update_item_stock();

-- Update batch quantity on transaction
CREATE OR REPLACE FUNCTION update_batch_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    UPDATE public.inventory_batches
    SET current_quantity = current_quantity + NEW.quantity
    WHERE id = NEW.batch_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_batch_stock ON public.inventory_transactions;
CREATE TRIGGER trigger_update_batch_stock
  AFTER INSERT ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION update_batch_stock();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

CREATE TRIGGER update_inventory_test_consumption_updated_at
  BEFORE UPDATE ON public.inventory_test_consumption
  FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

-- ============================================================================
-- 17. RLS POLICIES
-- ============================================================================

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_test_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_verification_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_inventory_insights ENABLE ROW LEVEL SECURITY;

-- Lab-scoped access policies
CREATE POLICY "suppliers_lab_access" ON public.suppliers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = suppliers.lab_id)
  );

CREATE POLICY "inventory_categories_lab_access" ON public.inventory_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = inventory_categories.lab_id)
  );

CREATE POLICY "inventory_items_lab_access" ON public.inventory_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = inventory_items.lab_id)
  );

CREATE POLICY "inventory_batches_lab_access" ON public.inventory_batches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.inventory_items i
      JOIN public.users u ON u.lab_id = i.lab_id
      WHERE i.id = inventory_batches.item_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "inventory_test_consumption_lab_access" ON public.inventory_test_consumption
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = inventory_test_consumption.lab_id)
  );

CREATE POLICY "inventory_transactions_lab_access" ON public.inventory_transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = inventory_transactions.lab_id)
  );

CREATE POLICY "purchase_orders_lab_access" ON public.purchase_orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = purchase_orders.lab_id)
  );

CREATE POLICY "purchase_order_items_lab_access" ON public.purchase_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      JOIN public.users u ON u.lab_id = po.lab_id
      WHERE po.id = purchase_order_items.purchase_order_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "goods_receipts_lab_access" ON public.goods_receipts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = goods_receipts.lab_id)
  );

CREATE POLICY "goods_receipt_items_lab_access" ON public.goods_receipt_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.goods_receipts gr
      JOIN public.users u ON u.lab_id = gr.lab_id
      WHERE gr.id = goods_receipt_items.goods_receipt_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "stock_alerts_lab_access" ON public.stock_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = stock_alerts.lab_id)
  );

CREATE POLICY "physical_verifications_lab_access" ON public.physical_verifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = physical_verifications.lab_id)
  );

CREATE POLICY "physical_verification_items_lab_access" ON public.physical_verification_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.physical_verifications pv
      JOIN public.users u ON u.lab_id = pv.lab_id
      WHERE pv.id = physical_verification_items.verification_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "ai_inventory_insights_lab_access" ON public.ai_inventory_insights
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.lab_id = ai_inventory_insights.lab_id)
  );

-- ============================================================================
-- 18. HELPER VIEWS
-- ============================================================================

-- View: Low stock items
CREATE OR REPLACE VIEW public.v_low_stock_items AS
SELECT 
  i.*,
  c.name as category_name,
  s.name as supplier_name,
  CASE 
    WHEN i.current_stock <= 0 THEN 'out_of_stock'
    WHEN i.current_stock <= i.minimum_stock THEN 'critical'
    WHEN i.current_stock <= i.reorder_level THEN 'low'
    ELSE 'normal'
  END as stock_status
FROM public.inventory_items i
LEFT JOIN public.inventory_categories c ON c.id = i.category_id
LEFT JOIN public.suppliers s ON s.id = i.default_supplier_id
WHERE i.is_active = true 
  AND i.current_stock <= i.reorder_level;

-- View: Expiring batches (next 30 days)
CREATE OR REPLACE VIEW public.v_expiring_batches AS
SELECT 
  b.*,
  i.name as item_name,
  i.code as item_code,
  i.lab_id,
  (b.expiry_date - CURRENT_DATE) as days_to_expiry
FROM public.inventory_batches b
JOIN public.inventory_items i ON i.id = b.item_id
WHERE b.status = 'available'
  AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY b.expiry_date;

-- View: Item consumption summary
CREATE OR REPLACE VIEW public.v_item_consumption_summary AS
SELECT 
  i.id as item_id,
  i.name as item_name,
  i.lab_id,
  COUNT(DISTINCT itc.test_group_id) as mapped_tests_count,
  COALESCE(SUM(ABS(t.quantity)) FILTER (WHERE t.transaction_type = 'consumption' 
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) as consumption_30_days,
  COALESCE(SUM(ABS(t.quantity)) FILTER (WHERE t.transaction_type = 'consumption' 
    AND t.created_at >= CURRENT_DATE - INTERVAL '7 days'), 0) as consumption_7_days
FROM public.inventory_items i
LEFT JOIN public.inventory_test_consumption itc ON itc.inventory_item_id = i.id AND itc.is_active = true
LEFT JOIN public.inventory_transactions t ON t.item_id = i.id
WHERE i.is_active = true
GROUP BY i.id, i.name, i.lab_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.suppliers IS 'Vendor/supplier master for inventory procurement';
COMMENT ON TABLE public.inventory_categories IS 'Hierarchical categories for inventory items';
COMMENT ON TABLE public.inventory_items IS 'Master list of inventory items (reagents, consumables, etc.)';
COMMENT ON TABLE public.inventory_batches IS 'Batch/lot tracking for items with expiry management';
COMMENT ON TABLE public.inventory_test_consumption IS 'Mapping of which items are consumed when tests are performed';
COMMENT ON TABLE public.inventory_transactions IS 'All stock movements (purchases, consumption, adjustments)';
COMMENT ON TABLE public.purchase_orders IS 'Purchase orders to suppliers';
COMMENT ON TABLE public.goods_receipts IS 'Goods Receipt Notes (GRN) for receiving inventory';
COMMENT ON TABLE public.stock_alerts IS 'Alerts for low stock, expiry, anomalies';
COMMENT ON TABLE public.physical_verifications IS 'Physical stock audit/verification records';
COMMENT ON TABLE public.ai_inventory_insights IS 'AI-generated insights and recommendations';

COMMENT ON COLUMN public.inventory_items.consumption_method IS 'per_test = consume per test performed, per_sample = per sample collected, manual = manual entry only';
COMMENT ON COLUMN public.inventory_test_consumption.ai_suggested IS 'True if this mapping was suggested by AI';
COMMENT ON COLUMN public.purchase_orders.ai_suggested IS 'True if this PO was suggested by AI reorder prediction';
```

---

## 3. AI Edge Functions (Anthropic Claude 3.5 Haiku)

### 3.1 Main AI Assistant Function

**File**: `supabase/functions/ai-inventory-assistant/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

interface AIRequest {
  action: 
    | 'suggest_item_details'
    | 'map_test_items'
    | 'analyze_consumption'
    | 'predict_reorder'
    | 'detect_anomalies'
    | 'categorize_item'
  payload: Record<string, any>
  labId: string
}

// System prompts for different actions
const SYSTEM_PROMPTS = {
  suggest_item_details: `You are an expert laboratory inventory manager AI assistant.
Your task is to suggest detailed attributes for inventory items in a diagnostic laboratory.

For each item, suggest:
1. Category (reagent, consumable, calibrator, control, general, equipment_part)
2. Unit of measure (ml, L, pcs, kit, box, test, g, kg)
3. Storage requirements (temperature, conditions)
4. Whether batch tracking is needed
5. Whether expiry tracking is needed
6. Typical pack sizes

Respond ONLY in valid JSON format:
{
  "item_type": "reagent|consumable|calibrator|control|general|equipment_part",
  "unit_of_measure": "string",
  "pack_size": number,
  "pack_unit": "string",
  "storage_temperature": "string",
  "storage_location_suggestion": "string",
  "batch_tracking_enabled": boolean,
  "expiry_tracking_enabled": boolean,
  "typical_shelf_life_days": number,
  "related_tests": ["test names this item might be used for"],
  "confidence": 0.0-1.0
}`,

  map_test_items: `You are an expert in diagnostic laboratory workflows.
Your task is to identify which inventory items (reagents, consumables) are typically consumed when performing a specific laboratory test.

Consider:
1. Primary reagents specific to the test methodology
2. Common consumables (tubes, tips, cuvettes)
3. Calibrators and controls if applicable
4. Quantity typically consumed per test

Respond ONLY in valid JSON format:
{
  "suggested_items": [
    {
      "item_name": "string",
      "item_type": "reagent|consumable|calibrator|control",
      "quantity_per_test": number,
      "unit": "string",
      "consumption_type": "per_test|per_sample|fixed",
      "is_essential": boolean,
      "notes": "string"
    }
  ],
  "methodology_notes": "Brief notes about the test methodology",
  "confidence": 0.0-1.0
}`,

  analyze_consumption: `You are a data analyst specializing in laboratory inventory optimization.
Analyze the consumption pattern data provided and identify:

1. Average daily/weekly/monthly consumption
2. Trends (increasing, decreasing, stable)
3. Seasonal patterns if any
4. Day-of-week patterns
5. Correlation with test volumes

Respond ONLY in valid JSON format:
{
  "average_daily_consumption": number,
  "average_weekly_consumption": number,
  "trend": "increasing|decreasing|stable",
  "trend_percentage": number,
  "seasonality": "none|weekly|monthly|quarterly",
  "peak_days": ["day names if applicable"],
  "recommendations": ["actionable suggestions"],
  "optimal_reorder_quantity": number,
  "optimal_reorder_frequency_days": number,
  "confidence": 0.0-1.0
}`,

  predict_reorder: `You are an inventory optimization AI for diagnostic laboratories.
Based on the consumption data, current stock, and lead times provided, predict:

1. When stock will reach reorder level
2. Optimal reorder quantity
3. Recommended order date
4. Risk assessment

Respond ONLY in valid JSON format:
{
  "current_stock_days_remaining": number,
  "predicted_stockout_date": "YYYY-MM-DD",
  "recommended_order_date": "YYYY-MM-DD",
  "recommended_quantity": number,
  "urgency": "low|medium|high|critical",
  "risk_factors": ["list of concerns"],
  "cost_optimization_notes": "suggestions for cost savings",
  "confidence": 0.0-1.0
}`,

  detect_anomalies: `You are a fraud and waste detection AI for laboratory inventory.
Analyze the consumption data and identify:

1. Unusual spikes or drops in consumption
2. Consumption that doesn't correlate with test volumes
3. Potential wastage indicators
4. Possible data entry errors

Respond ONLY in valid JSON format:
{
  "anomalies_detected": [
    {
      "date": "YYYY-MM-DD",
      "type": "spike|drop|mismatch|pattern_break",
      "expected_value": number,
      "actual_value": number,
      "deviation_percent": number,
      "severity": "low|medium|high",
      "possible_causes": ["list"]
    }
  ],
  "overall_assessment": "normal|concerning|critical",
  "recommended_actions": ["list"],
  "confidence": 0.0-1.0
}`,

  categorize_item: `You are a laboratory inventory classification expert.
Based on the item name and description, suggest the most appropriate category from the available categories.

Respond ONLY in valid JSON format:
{
  "suggested_category": "category name",
  "category_path": ["parent", "child"],
  "alternative_categories": ["other possible categories"],
  "reasoning": "brief explanation",
  "confidence": 0.0-1.0
}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Invalid authentication')

    // Parse request
    const { action, payload, labId }: AIRequest = await req.json()

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    // Get context data based on action
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let contextData: any = {}
    let userPrompt = ''

    switch (action) {
      case 'suggest_item_details':
        const { data: categories } = await supabaseAdmin
          .from('inventory_categories')
          .select('id, name, code')
          .eq('lab_id', labId)
          .eq('is_active', true)
        
        const { data: existingItems } = await supabaseAdmin
          .from('inventory_items')
          .select('name, item_type, unit_of_measure')
          .eq('lab_id', labId)
          .limit(20)

        userPrompt = `Item Name: "${payload.itemName}"

Existing Categories: ${JSON.stringify(categories)}
Similar Items: ${JSON.stringify(existingItems)}

Please analyze this item and suggest appropriate attributes.`
        break

      case 'map_test_items':
        const { data: testGroup } = await supabaseAdmin
          .from('test_groups')
          .select('id, name, code')
          .eq('id', payload.testGroupId)
          .single()

        const { data: availableItems } = await supabaseAdmin
          .from('inventory_items')
          .select('id, name, item_type, unit_of_measure')
          .eq('lab_id', labId)
          .eq('is_active', true)

        const { data: existingMappings } = await supabaseAdmin
          .from('inventory_test_consumption')
          .select(`
            inventory_item:inventory_items(name, item_type),
            quantity_per_test
          `)
          .eq('lab_id', labId)
          .limit(50)

        userPrompt = `Test: ${testGroup?.name} (${testGroup?.code})

Available Items: ${JSON.stringify(availableItems)}
Existing Mappings (for reference): ${JSON.stringify(existingMappings)}

Please suggest which items are consumed when performing this test.`
        break

      case 'analyze_consumption':
        const { data: transactions } = await supabaseAdmin
          .from('inventory_transactions')
          .select('quantity, created_at, transaction_type')
          .eq('item_id', payload.itemId)
          .eq('transaction_type', 'consumption')
          .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true })

        const { data: item } = await supabaseAdmin
          .from('inventory_items')
          .select('name, current_stock, reorder_level')
          .eq('id', payload.itemId)
          .single()

        // Aggregate by date
        const dailyConsumption: Record<string, number> = {}
        transactions?.forEach((t: any) => {
          const date = t.created_at.split('T')[0]
          dailyConsumption[date] = (dailyConsumption[date] || 0) + Math.abs(t.quantity)
        })

        userPrompt = `Item: ${item?.name}
Current Stock: ${item?.current_stock}
Reorder Level: ${item?.reorder_level}

Daily Consumption (last 90 days):
${JSON.stringify(dailyConsumption)}

Please analyze this consumption pattern.`
        break

      case 'predict_reorder':
        // Similar context gathering for reorder prediction
        const consumptionData = await getConsumptionData(supabaseAdmin, payload.itemId, 90)
        userPrompt = `${consumptionData}

Please predict optimal reorder timing and quantity.`
        break

      case 'detect_anomalies':
        const anomalyData = await getConsumptionData(supabaseAdmin, payload.itemId, 180)
        userPrompt = `${anomalyData}

Please identify any anomalies in the consumption pattern.`
        break

      case 'categorize_item':
        const { data: allCategories } = await supabaseAdmin
          .from('inventory_categories')
          .select('id, name, code, parent_category_id, ai_keywords')
          .eq('lab_id', labId)
          .eq('is_active', true)

        userPrompt = `Item Name: "${payload.itemName}"
Description: "${payload.description || 'Not provided'}"

Available Categories:
${JSON.stringify(allCategories)}

Please suggest the most appropriate category.`
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    // Call Claude 3.5 Haiku
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        system: SYSTEM_PROMPTS[action],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${error}`)
    }

    const aiResponse = await response.json()
    const content = aiResponse.content[0].text

    // Parse AI response (expecting JSON)
    let parsedResult
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                        content.match(/\{[\s\S]*\}/)
      parsedResult = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : content)
    } catch (e) {
      parsedResult = { raw_response: content, parse_error: true }
    }

    // Store insight for tracking
    const insightType = actionToInsightType(action)
    await supabaseAdmin.from('ai_inventory_insights').insert({
      lab_id: labId,
      insight_type: insightType,
      item_id: payload.itemId || null,
      test_group_id: payload.testGroupId || null,
      analysis_data: parsedResult,
      confidence_score: parsedResult.confidence || null,
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })

    return new Response(
      JSON.stringify({ success: true, data: parsedResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('AI Inventory Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

async function getConsumptionData(supabase: any, itemId: string, days: number) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const { data: transactions } = await supabase
    .from('inventory_transactions')
    .select('quantity, created_at, transaction_type')
    .eq('item_id', itemId)
    .eq('transaction_type', 'consumption')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })

  const { data: item } = await supabase
    .from('inventory_items')
    .select('name, current_stock, reorder_level, reorder_quantity, last_purchase_price')
    .eq('id', itemId)
    .single()

  const dailyConsumption: Record<string, number> = {}
  transactions?.forEach((t: any) => {
    const date = t.created_at.split('T')[0]
    dailyConsumption[date] = (dailyConsumption[date] || 0) + Math.abs(t.quantity)
  })

  return `Item: ${item?.name}
Current Stock: ${item?.current_stock}
Reorder Level: ${item?.reorder_level}
Reorder Quantity: ${item?.reorder_quantity}
Last Purchase Price: ${item?.last_purchase_price}
Analysis Period: ${days} days

Daily Consumption:
${JSON.stringify(dailyConsumption)}`
}

function actionToInsightType(action: string): string {
  const mapping: Record<string, string> = {
    suggest_item_details: 'test_mapping_suggestion',
    map_test_items: 'test_mapping_suggestion',
    analyze_consumption: 'consumption_pattern',
    predict_reorder: 'reorder_prediction',
    detect_anomalies: 'anomaly_detection',
    categorize_item: 'test_mapping_suggestion',
  }
  return mapping[action] || 'consumption_pattern'
}
```

### 3.2 Auto-Consumption Function

**File**: `supabase/functions/inventory-auto-consume/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * This function is triggered when a result is saved.
 * It automatically creates consumption transactions based on test-item mappings.
 * Skips outsourced tests (no local inventory consumed).
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { resultId, orderId, testGroupId, labId } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Check if test is outsourced (skip consumption if so)
    const { data: orderTest } = await supabase
      .from('order_tests')
      .select('outsourced_lab_id')
      .eq('order_id', orderId)
      .eq('test_group_id', testGroupId)
      .single()

    if (orderTest?.outsourced_lab_id) {
      return new Response(
        JSON.stringify({ success: true, message: 'Skipped - outsourced test', consumed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Get consumption mappings for this test
    const { data: mappings, error: mappingError } = await supabase
      .from('inventory_test_consumption')
      .select(`
        id,
        inventory_item_id,
        quantity_per_test,
        consumption_type,
        inventory_item:inventory_items(
          id, name, current_stock, minimum_stock, reorder_level, batch_tracking_enabled
        )
      `)
      .eq('test_group_id', testGroupId)
      .eq('lab_id', labId)
      .eq('is_active', true)

    if (mappingError) throw mappingError
    if (!mappings || mappings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No consumption mappings', consumed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Create consumption transactions
    const transactions = []
    const alerts = []

    for (const mapping of mappings) {
      const item = mapping.inventory_item as any
      const quantity = mapping.quantity_per_test
      const newStock = item.current_stock - quantity

      // Get batch if batch tracking enabled (FIFO by expiry)
      let batchId = null
      if (item.batch_tracking_enabled) {
        const { data: batch } = await supabase
          .from('inventory_batches')
          .select('id, current_quantity')
          .eq('item_id', item.id)
          .eq('status', 'available')
          .gt('current_quantity', 0)
          .order('expiry_date', { ascending: true }) // FIFO by expiry
          .limit(1)
          .single()
        
        if (batch) {
          batchId = batch.id
        }
      }

      // Create transaction (trigger will update stock)
      transactions.push({
        lab_id: labId,
        item_id: item.id,
        batch_id: batchId,
        transaction_type: 'consumption',
        quantity: -quantity, // Negative for consumption
        stock_before: item.current_stock,
        stock_after: newStock,
        reference_type: 'result',
        reference_id: resultId,
        order_id: orderId,
        result_id: resultId,
        test_group_id: testGroupId,
        notes: 'Auto-consumed for test result',
      })

      // Check for stock alerts
      if (newStock <= 0) {
        alerts.push({
          lab_id: labId,
          item_id: item.id,
          alert_type: 'out_of_stock',
          current_value: newStock,
          threshold_value: 0,
          message: `${item.name} is now OUT OF STOCK`,
        })
      } else if (newStock <= (item.minimum_stock || 0)) {
        alerts.push({
          lab_id: labId,
          item_id: item.id,
          alert_type: 'critical_stock',
          current_value: newStock,
          threshold_value: item.minimum_stock,
          message: `${item.name} is below CRITICAL level (${newStock} remaining)`,
        })
      } else if (newStock <= (item.reorder_level || 0)) {
        alerts.push({
          lab_id: labId,
          item_id: item.id,
          alert_type: 'low_stock',
          current_value: newStock,
          threshold_value: item.reorder_level,
          message: `${item.name} is below reorder level (${newStock} remaining)`,
        })
      }
    }

    // 4. Insert transactions (triggers update stock automatically)
    const { error: txError } = await supabase
      .from('inventory_transactions')
      .insert(transactions)

    if (txError) throw txError

    // 5. Insert alerts (avoid duplicates)
    for (const alert of alerts) {
      const { data: existing } = await supabase
        .from('stock_alerts')
        .select('id')
        .eq('item_id', alert.item_id)
        .eq('alert_type', alert.alert_type)
        .eq('status', 'active')
        .single()

      if (!existing) {
        await supabase.from('stock_alerts').insert(alert)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        consumed: transactions.length,
        alerts_created: alerts.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Auto-consume error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## 4. Frontend Integration

### 4.1 Component Structure

```
src/components/Inventory/
├── InventoryDashboard.tsx      # Main dashboard with stats & alerts
├── ItemMaster.tsx              # Item CRUD with AI assistance
├── ItemForm.tsx                # Add/Edit item form
├── SupplierMaster.tsx          # Supplier management
├── SupplierForm.tsx            # Add/Edit supplier form
├── ConsumptionConfig.tsx       # Test-item mapping configuration
├── ConsumptionMappingModal.tsx # AI-assisted mapping modal
├── PurchaseOrders/
│   ├── POList.tsx              # PO list view
│   ├── POForm.tsx              # Create/Edit PO
│   └── PODetail.tsx            # PO detail view
├── GoodsReceipt/
│   ├── GRNList.tsx             # GRN list view
│   ├── GRNForm.tsx             # Create GRN from PO
│   └── GRNDetail.tsx           # GRN detail view
├── PhysicalVerification/
│   ├── VerificationList.tsx    # Verification list
│   ├── VerificationForm.tsx    # New verification
│   └── StockCount.tsx          # Physical count entry
├── Reports/
│   ├── StockReport.tsx         # Current stock report
│   ├── ConsumptionReport.tsx   # Consumption analysis
│   └── ExpiryReport.tsx        # Expiring items report
├── Alerts/
│   └── AlertsPanel.tsx         # Alert notifications
└── AI/
    ├── AIInsightCard.tsx       # Display AI insights
    └── AIReorderSuggestion.tsx # Reorder recommendations
```

### 4.2 Result Entry Integration

**Modify**: `src/components/Results/ResultsInput.tsx`

After saving result values (around line 2015), add:

```typescript
// After successful result save, trigger auto-consumption
if (savedResult && !orderTest.outsourced_lab_id) {
  try {
    await supabase.functions.invoke('inventory-auto-consume', {
      body: {
        resultId: savedResult.id,
        orderId: selectedOrder.id,
        testGroupId: selectedTest.test_group_id,
        labId: labId,
      },
    });
  } catch (error) {
    console.error('Auto-consumption failed:', error);
    // Don't block result entry if consumption fails
  }
}
```

---

## 5. Environment Setup

### 5.1 Edge Function Secrets

```bash
# Set Anthropic API key for Claude 3.5 Haiku
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
```

### 5.2 Deploy Edge Functions

```bash
# Deploy AI assistant
supabase functions deploy ai-inventory-assistant

# Deploy auto-consumption
supabase functions deploy inventory-auto-consume
```

---

## 6. Consumption Calculation Methods

| Method | Use Case | Calculation |
|--------|----------|-------------|
| `per_test` | Test-specific reagents | Qty × Tests performed |
| `per_sample` | Common consumables (tubes) | Qty × Samples collected |
| `per_order` | General items per order | Qty × Orders |
| `fixed_daily` | Fixed daily consumption | Fixed amount |
| `manual` | Irregular consumption | Manual entry only |

---

## 7. Stock Alert Types

| Alert Type | Priority | Auto-Resolve Condition |
|------------|----------|------------------------|
| `out_of_stock` | Critical | Stock > 0 |
| `critical_stock` | High | Stock > minimum_stock |
| `low_stock` | Medium | Stock > reorder_level |
| `expired` | High | Manual resolution |
| `expiring_soon` | Medium | Consumed or returned |
| `consumption_anomaly` | Medium | After review |
| `reorder_suggested` | Low | PO created |

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Apply SQL migration with all 14 tables
- [ ] Test RLS policies
- [ ] Add database layer methods to `supabase.ts`
- [ ] Create basic Inventory page with navigation

### Phase 2: Master Data (Week 3-4)
- [ ] Supplier Master CRUD
- [ ] Category Master CRUD
- [ ] Item Master CRUD with AI-assisted setup
- [ ] Batch tracking setup

### Phase 3: Procurement (Week 5-6)
- [ ] Purchase Order creation/approval workflow
- [ ] Goods Receipt from PO
- [ ] Stock update on receipt

### Phase 4: Consumption (Week 7-8)
- [ ] Test-Item mapping configuration
- [ ] AI-suggested mappings (Claude 3.5 Haiku)
- [ ] Auto-consumption on result entry
- [ ] Integration with ResultsInput.tsx

### Phase 5: Alerts & Verification (Week 9-10)
- [ ] Stock alert system
- [ ] Expiry alerts
- [ ] Physical verification workflow
- [ ] Stock correction/adjustment

### Phase 6: AI & Reports (Week 11-12)
- [ ] AI consumption analysis
- [ ] AI reorder predictions
- [ ] AI anomaly detection
- [ ] Stock reports
- [ ] Consumption reports

---

## 9. Key Files Reference

| File | Purpose |
|------|---------|
| `supabase/migrations/20260120000001_inventory_tables.sql` | Database schema |
| `supabase/functions/ai-inventory-assistant/index.ts` | AI features (Claude 3.5 Haiku) |
| `supabase/functions/inventory-auto-consume/index.ts` | Auto-consumption trigger |
| supabase.ts | Database layer (add `inventory` namespace) |
| `src/pages/Inventory.tsx` | Main inventory page |
| `src/components/Results/ResultsInput.tsx` | Integration point for consumption |

---

*Document Version: 1.0*  
*Last Updated: January 19, 2026*
```

---

This comprehensive MD file covers:
1. **Executive Summary** with AI feature overview
2. **Complete SQL Migration** (14 tables, indexes, triggers, RLS)
3. **Two Edge Functions** using Anthropic Claude 3.5 Haiku
4. **Frontend Component Structure**
5. **Result Entry Integration** for auto-consumption
6. **Environment Setup** instructions
7. **Implementation Phases** (12-week roadmap)

You can save this as `INVENTORY_MANAGEMENT_SYSTEM_PLAN.md` in your project root.---

This comprehensive MD file covers:
1. **Executive Summary** with AI feature overview
2. **Complete SQL Migration** (14 tables, indexes, triggers, RLS)
3. **Two Edge Functions** using Anthropic Claude 3.5 Haiku
4. **Frontend Component Structure**
5. **Result Entry Integration** for auto-consumption
6. **Environment Setup** instructions
7. **Implementation Phases** (12-week roadmap)

You can save this as `INVENTORY_MANAGEMENT_SYSTEM_PLAN.md` in your project root.