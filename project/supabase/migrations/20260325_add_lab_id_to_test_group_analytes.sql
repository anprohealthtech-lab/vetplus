-- ============================================================
-- Add lab_id to test_group_analytes (denormalized for fast filtering)
--
-- Rationale: test_group_analytes is linked to a lab via
--   test_group_analytes.test_group_id → test_groups.lab_id
-- Every deduplication / filtering query had to join test_groups
-- just to get lab_id. Adding lab_id here (same pattern as
-- analyte_name / test_group_name) eliminates that join.
-- ============================================================

-- 1. Add the column (nullable so existing rows aren't broken)
ALTER TABLE public.test_group_analytes
    ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES public.labs(id) ON DELETE CASCADE;

-- 2. Backfill from test_groups
UPDATE public.test_group_analytes tga
SET    lab_id = tg.lab_id
FROM   public.test_groups tg
WHERE  tga.test_group_id = tg.id
  AND  tga.lab_id IS NULL;

-- 3. Index for lab-scoped queries / deduplication
CREATE INDEX IF NOT EXISTS idx_tga_lab_id
    ON public.test_group_analytes (lab_id);

-- Composite index useful for "give me all analytes for a lab"
CREATE INDEX IF NOT EXISTS idx_tga_lab_analyte
    ON public.test_group_analytes (lab_id, analyte_id);

-- 4. Trigger: auto-populate lab_id on INSERT or test_group_id change
CREATE OR REPLACE FUNCTION public.sync_tga_lab_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.lab_id IS NULL OR TG_OP = 'UPDATE' AND NEW.test_group_id IS DISTINCT FROM OLD.test_group_id THEN
        SELECT tg.lab_id INTO NEW.lab_id
        FROM   public.test_groups tg
        WHERE  tg.id = NEW.test_group_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tga_lab_id ON public.test_group_analytes;
CREATE TRIGGER trg_sync_tga_lab_id
    BEFORE INSERT OR UPDATE OF test_group_id
    ON public.test_group_analytes
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_tga_lab_id();

COMMENT ON COLUMN public.test_group_analytes.lab_id IS
    'Denormalized from test_groups.lab_id — kept in sync by trg_sync_tga_lab_id. Avoids join to test_groups for lab-scoped queries.';
