ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS report_settings jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.orders.report_settings IS
  'Order-level report preferences such as manual test-group order override and preferred print layout mode.';
