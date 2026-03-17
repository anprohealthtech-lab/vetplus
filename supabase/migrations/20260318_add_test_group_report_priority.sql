ALTER TABLE public.test_groups
  ADD COLUMN IF NOT EXISTS report_priority integer;

COMMENT ON COLUMN public.test_groups.report_priority IS
  'Global report ordering priority. Lower numbers render earlier in e-copy and print outputs. Null means no special priority.';

CREATE INDEX IF NOT EXISTS idx_test_groups_lab_report_priority
  ON public.test_groups(lab_id, report_priority, name);
