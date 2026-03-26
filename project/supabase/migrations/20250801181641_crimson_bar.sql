
-- Add default_ai_processing_type and group_level_prompt to test_groups table
ALTER TABLE public.test_groups
ADD COLUMN default_ai_processing_type character varying(50) DEFAULT 'ocr_report'::character varying,
ADD COLUMN group_level_prompt text;

-- Create ai_prompts table
CREATE TABLE public.ai_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid,
    analyte_id uuid,
    lab_id uuid,
    ai_processing_type character varying(50) NOT NULL,
    prompt text NOT NULL,
    "default" boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_prompts_pkey PRIMARY KEY (id)
);

-- Indexes for ai_prompts
CREATE INDEX idx_ai_prompts_analyte_id ON public.ai_prompts USING btree (analyte_id);
CREATE INDEX idx_ai_prompts_lab_id ON public.ai_prompts USING btree (lab_id);
CREATE INDEX idx_ai_prompts_test_id ON public.ai_prompts USING btree (test_id);
CREATE INDEX idx_ai_prompts_type_default ON public.ai_prompts USING btree (ai_processing_type, "default");

-- Foreign keys for ai_prompts
ALTER TABLE public.ai_prompts ADD CONSTRAINT fk_ai_prompts_analyte FOREIGN KEY (analyte_id) REFERENCES public.analytes(id) ON DELETE CASCADE;
ALTER TABLE public.ai_prompts ADD CONSTRAINT fk_ai_prompts_lab FOREIGN KEY (lab_id) REFERENCES public.labs(id) ON DELETE CASCADE;
ALTER TABLE public.ai_prompts ADD CONSTRAINT fk_ai_prompts_test_group FOREIGN KEY (test_id) REFERENCES public.test_groups(id) ON DELETE CASCADE;

-- RLS for ai_prompts
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read ai_prompts" ON public.ai_prompts FOR SELECT USING (true);
CREATE POLICY "Lab managers can modify ai_prompts" ON public.ai_prompts FOR ALL USING (true) WITH CHECK (true);