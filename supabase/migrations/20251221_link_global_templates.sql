
-- 1. Add default_template_id to global_test_catalog
ALTER TABLE public.global_test_catalog 
ADD COLUMN IF NOT EXISTS default_template_id uuid REFERENCES public.global_template_catalog(id);

-- 2. Add interpretation fields to global_template_catalog if useful for rendering logic, 
-- or we rely on the analytes JSONB/Table. The user mentioned "interpretation table low high", 
-- but that data lives on the analyte level. We might just need the template to support rendering it.

-- 3. Ensure global_template_catalog has a 'test_group_id' or similar if we want bi-directional linking,
-- though the default_template_id on the test catalog is usually sufficient (Test -> Template).

-- 4. Enable RLS or permissions if needed (generally good practice)
ALTER TABLE public.global_template_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_test_catalog ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users (labs need to see the catalog)
CREATE POLICY "Allow read access to global templates" ON public.global_template_catalog FOR SELECT USING (true);
CREATE POLICY "Allow read access to global tests" ON public.global_test_catalog FOR SELECT USING (true);
