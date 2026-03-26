-- Create enum type for result_status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'result_status') THEN
    CREATE TYPE public.result_status AS ENUM ('Entered', 'Under Review', 'Approved', 'Reported');
  END IF;
END $$;

-- Create results table
CREATE TABLE IF NOT EXISTS public.results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    patient_name character varying(255) NOT NULL,
    test_name character varying(255) NOT NULL,
    status result_status NOT NULL DEFAULT 'Entered',
    entered_by character varying(255) NOT NULL,
    entered_date date NOT NULL DEFAULT CURRENT_DATE,
    reviewed_by character varying(255),
    reviewed_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.results ADD CONSTRAINT results_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE public.results ADD CONSTRAINT results_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_results_entered_date ON public.results USING btree (entered_date);
CREATE INDEX IF NOT EXISTS idx_results_order_id ON public.results USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_results_patient_id ON public.results USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON public.results USING btree (status);

-- Enable RLS
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Technicians can modify results" ON public.results;
CREATE POLICY "Technicians can modify results" ON public.results
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read results" ON public.results;
CREATE POLICY "Users can read results" ON public.results
  FOR SELECT USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_results_updated_at BEFORE UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create result_values table
CREATE TABLE IF NOT EXISTS public.result_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id uuid NOT NULL,
    analyte_id uuid,
    parameter character varying(255) NOT NULL,
    value character varying(255) NOT NULL,
    unit character varying(50) NOT NULL,
    reference_range text NOT NULL,
    flag character varying(10),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE public.result_values ADD CONSTRAINT result_values_result_id_fkey FOREIGN KEY (result_id) REFERENCES public.results(id) ON DELETE CASCADE;
ALTER TABLE public.result_values ADD CONSTRAINT result_values_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES public.analytes(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_result_values_analyte_id ON public.result_values USING btree (analyte_id);
CREATE INDEX IF NOT EXISTS idx_result_values_flag ON public.result_values USING btree (flag);
CREATE INDEX IF NOT EXISTS idx_result_values_result_id ON public.result_values USING btree (result_id);

-- Enable RLS
ALTER TABLE public.result_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Technicians can modify result values" ON public.result_values;
CREATE POLICY "Technicians can modify result values" ON public.result_values
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read result values" ON public.result_values;
CREATE POLICY "Users can read result values" ON public.result_values
  FOR SELECT USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_result_values_updated_at BEFORE UPDATE ON public.result_values FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();