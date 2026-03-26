-- Fix: Add UNIQUE constraint for upsert functionality
-- Run this in Supabase SQL Editor

-- ============================================
-- ADD UNIQUE CONSTRAINT
-- ============================================

DO $$
BEGIN
  -- 1. First, remove any duplicate rows if they exist (keeping the latest one)
  -- This is a safety step to ensure the constraint can be applied
  DELETE FROM attachments a1
  USING attachments a2
  WHERE a1.id < a2.id -- Keep the one with larger ID (newer)
    AND a1.entity_type = a2.entity_type
    AND a1.entity_id = a2.entity_id
    AND a1.attachment_type = a2.attachment_type;

  -- 2. Drop existing index if it exists (we will replace it with a unique one)
  DROP INDEX IF EXISTS idx_attachments_entity;

  -- 3. Add Unique Constraint
  -- We use a constraint instead of just an index to be explicit
  ALTER TABLE public.attachments 
  ADD CONSTRAINT attachments_entity_unique 
  UNIQUE (entity_type, entity_id, attachment_type);
  
  RAISE NOTICE '✅ Added UNIQUE constraint on (entity_type, entity_id, attachment_type)';

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error adding constraint: %', SQLERRM;
END $$;
