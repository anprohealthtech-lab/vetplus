-- Track when a bridge app started sending an order to the analyzer.
-- Used to detect stuck orders (status = 'sending' but sending_started_at is old).
ALTER TABLE public.analyzer_order_queue
  ADD COLUMN IF NOT EXISTS sending_started_at timestamp with time zone;
