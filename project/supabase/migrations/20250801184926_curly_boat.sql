
-- Create the lab_analytes table
CREATE TABLE public.lab_analytes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lab_id uuid NOT NULL,
  analyte_id uuid NOT NULL,
  is_active boolean DEFAULT true,       -- Can the lab use this analyte?
  visible boolean DEFAULT true,         -- Should this analyte show in lab's UI?
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),

  CONSTRAINT lab_analytes_pkey PRIMARY KEY (id),
  CONSTRAINT lab_analytes_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE CASCADE,
  CONSTRAINT lab_analytes_analyte_id_fkey FOREIGN KEY (analyte_id) REFERENCES public.analytes(id) ON DELETE CASCADE,
  CONSTRAINT unique_lab_analyte UNIQUE (lab_id, analyte_id)
);

-- Add RLS policy for lab_analytes
ALTER TABLE public.lab_analytes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lab managers can manage lab analytes"
ON public.lab_analytes
FOR ALL
TO authenticated
USING (lab_id = get_my_lab_id())
WITH CHECK (lab_id = get_my_lab_id());

-- Add trigger to update 'updated_at' column automatically
CREATE TRIGGER update_lab_analytes_updated_at
BEFORE UPDATE ON public.lab_analytes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function to create lab_analytes entries for a new lab
CREATE OR REPLACE FUNCTION public.create_lab_analytes_for_new_lab()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.lab_analytes (lab_id, analyte_id, is_active, visible)
  SELECT NEW.id, a.id, true, true
  FROM public.analytes a;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on labs table to call the function when a new lab is inserted
CREATE TRIGGER on_lab_insert_create_lab_analytes
AFTER INSERT ON public.labs
FOR EACH ROW
EXECUTE FUNCTION public.create_lab_analytes_for_new_lab();