-- Compact print planning: minimal persistence for per-order print sequence
-- and print-only compact layout metadata.

ALTER TABLE public.order_test_groups
  ADD COLUMN IF NOT EXISTS print_order integer;

ALTER TABLE public.order_tests
  ADD COLUMN IF NOT EXISTS print_order integer;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY order_id ORDER BY created_at, id) AS seq
  FROM public.order_test_groups
)
UPDATE public.order_test_groups otg
SET print_order = ranked.seq
FROM ranked
WHERE otg.id = ranked.id
  AND otg.print_order IS NULL;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY order_id ORDER BY created_at, id) AS seq
  FROM public.order_tests
)
UPDATE public.order_tests ot
SET print_order = ranked.seq
FROM ranked
WHERE ot.id = ranked.id
  AND ot.print_order IS NULL;

ALTER TABLE public.order_test_groups
  ALTER COLUMN print_order SET DEFAULT 0;

ALTER TABLE public.order_tests
  ALTER COLUMN print_order SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_order_test_groups_print_order
  ON public.order_test_groups(order_id, print_order, created_at);

CREATE INDEX IF NOT EXISTS idx_order_tests_print_order
  ON public.order_tests(order_id, print_order, created_at);

COMMENT ON COLUMN public.order_test_groups.print_order IS
  'Order-specific print/display sequence for report rendering. Lower values print first.';

COMMENT ON COLUMN public.order_tests.print_order IS
  'Order-specific print/display sequence for report rendering when legacy order_tests rows are used. Lower values print first.';

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS print_layout_mode text
  CHECK (print_layout_mode IN ('standard', 'compact'));

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS print_plan_json jsonb;

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS print_plan_source text
  CHECK (print_plan_source IN ('manual', 'deterministic', 'ai', 'fallback'));

UPDATE public.reports
SET print_layout_mode = COALESCE(print_layout_mode, 'standard')
WHERE print_layout_mode IS NULL;

ALTER TABLE public.reports
  ALTER COLUMN print_layout_mode SET DEFAULT 'standard';

COMMENT ON COLUMN public.reports.print_layout_mode IS
  'Print-only layout mode. standard = current print output, compact = paper-saving print output.';

COMMENT ON COLUMN public.reports.print_plan_json IS
  'Validated compact print planning JSON used to generate the current print PDF.';

COMMENT ON COLUMN public.reports.print_plan_source IS
  'How the current print plan was chosen: manual, ai, deterministic, or fallback.';
