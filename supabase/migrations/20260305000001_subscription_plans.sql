-- Migration: Subscription Plans & Lab Subscriptions
-- Purpose: Support trial → paid plans (Razorpay integration ready)
-- Date: 2026-03-05

-- ============================================================================
-- 1. SUBSCRIPTION PLANS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                        -- 'Monthly', '3 Months', '6 Months', '12 Months'
  slug text NOT NULL UNIQUE,                 -- 'monthly', '3months', '6months', '12months'
  duration_months integer NOT NULL,          -- 1, 3, 6, 12
  price_inr numeric(10,2) NOT NULL,          -- Full price in INR
  discount_percent numeric(5,2) DEFAULT 0,   -- Discount shown to user
  razorpay_plan_id text,                     -- Razorpay plan ID (set when created in Razorpay dashboard)
  is_active boolean NOT NULL DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed the 4 plans
INSERT INTO public.subscription_plans (name, slug, duration_months, price_inr, discount_percent, display_order)
VALUES
  ('Monthly',    'monthly',  1,   999.00,  0,  1),
  ('3 Months',   '3months',  3,  2699.00, 10,  2),
  ('6 Months',   '6months',  6,  4999.00, 17,  3),
  ('12 Months', '12months', 12,  8999.00, 25,  4)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. LAB SUBSCRIPTIONS TABLE  (payment history / audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lab_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  plan_name text,                          -- Snapshot of plan name at time of purchase
  duration_months integer,                 -- Snapshot of duration
  amount_paid numeric(10,2),               -- Actual amount paid in INR
  currency text DEFAULT 'INR',
  -- Razorpay fields
  razorpay_order_id text,                  -- Created before payment
  razorpay_payment_id text,               -- Set after successful payment
  razorpay_signature text,                -- Verified signature from Razorpay
  -- Subscription period
  plan_starts_at timestamptz,
  plan_ends_at timestamptz,
  -- Status
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_subscriptions_lab_id ON public.lab_subscriptions(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_subscriptions_status ON public.lab_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_lab_subscriptions_razorpay_order ON public.lab_subscriptions(razorpay_order_id);

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans are public-readable (needed for pricing page before login)
CREATE POLICY "subscription_plans_public_read"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- Lab subscriptions: only accessible by lab members
CREATE POLICY "lab_subscriptions_lab_read"
  ON public.lab_subscriptions FOR SELECT
  USING (
    lab_id IN (
      SELECT lab_id FROM public.users
      WHERE id = auth.uid() AND status = 'Active'
    )
  );

-- Service role can do anything (for edge functions)
CREATE POLICY "lab_subscriptions_service_all"
  ON public.lab_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. AUTO-UPDATE updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();

CREATE TRIGGER trg_lab_subscriptions_updated_at
  BEFORE UPDATE ON public.lab_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();

-- ============================================================================
-- 5. DAILY CRON: Expire trials and active plans past active_upto
-- Requires pg_cron extension.
-- Enable it first in: Supabase Dashboard → Database → Extensions → pg_cron
-- Then run this block manually (or re-run this migration after enabling).
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'expire-lab-plans',
      '0 2 * * *',
      $cron$
        UPDATE public.labs
        SET
          plan_status = 'inactive',
          updated_at  = NOW()
        WHERE plan_status IN ('trial', 'active')
          AND active_upto IS NOT NULL
          AND active_upto < NOW();
      $cron$
    );
    RAISE NOTICE 'pg_cron job "expire-lab-plans" scheduled successfully.';
  ELSE
    RAISE NOTICE 'pg_cron extension not found — skipping cron job. Enable it in: Supabase Dashboard → Database → Extensions → pg_cron, then re-run this block.';
  END IF;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.subscription_plans IS 'Available subscription plans for labs';
COMMENT ON TABLE public.lab_subscriptions IS 'Payment history and subscription periods for each lab';
COMMENT ON COLUMN public.lab_subscriptions.razorpay_order_id IS 'Created by create-razorpay-order edge function';
COMMENT ON COLUMN public.lab_subscriptions.razorpay_payment_id IS 'Set by razorpay-webhook after payment capture';
