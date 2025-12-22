-- Migration: Add AI config column to test_groups and sync with global_test_catalog
-- Description: Adds ai_config JSONB column to test_groups to store full AI configuration
--              from global_test_catalog during lab onboarding.

-- Add ai_config column to test_groups if not exists
ALTER TABLE public.test_groups
ADD COLUMN IF NOT EXISTS ai_config jsonb DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.test_groups.ai_config IS 'Full AI configuration copied from global_test_catalog during onboarding. Includes confidence, warnings, method-specific config, vision_prompt, etc.';

-- Update existing test_groups from global_test_catalog where possible
UPDATE public.test_groups tg
SET 
  ai_config = gtc.ai_config,
  default_ai_processing_type = COALESCE(tg.default_ai_processing_type, gtc.default_ai_processing_type),
  group_level_prompt = COALESCE(tg.group_level_prompt, gtc.group_level_prompt)
FROM public.global_test_catalog gtc
WHERE tg.code = gtc.code
  AND gtc.ai_config IS NOT NULL
  AND gtc.ai_config != '{}'::jsonb;

-- Create index for quick lookups by processing type
CREATE INDEX IF NOT EXISTS idx_test_groups_ai_processing_type 
ON public.test_groups(default_ai_processing_type) 
WHERE default_ai_processing_type IS NOT NULL;
