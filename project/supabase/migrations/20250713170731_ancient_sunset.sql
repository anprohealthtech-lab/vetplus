-- Add doctor column only if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = 'doctor'
  ) THEN
    ALTER TABLE public.reports 
    ADD COLUMN doctor varchar(255) NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_reports_doctor ON public.reports(doctor);