-- Migration: Auto-invoke PDF generation when job is queued
-- This uses pg_net to call the edge function automatically when all results are verified
-- Date: 2026-01-19

-- 1. Enable pg_net extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create a function to invoke the PDF generation edge function
CREATE OR REPLACE FUNCTION invoke_pdf_generation(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get Supabase URL and service key from vault (or use environment)
  -- These should be stored securely in Supabase Vault
  SELECT decrypted_secret INTO v_supabase_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL' 
  LIMIT 1;
  
  SELECT decrypted_secret INTO v_service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' 
  LIMIT 1;
  
  -- If vault secrets not found, try to get from current_setting (for local dev)
  IF v_supabase_url IS NULL THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;
  
  IF v_service_key IS NULL THEN
    v_service_key := current_setting('app.settings.service_role_key', true);
  END IF;
  
  -- Only proceed if we have the required config
  IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
    -- Make async HTTP POST to edge function using pg_net
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/generate-pdf-letterhead',
      body := jsonb_build_object('orderId', p_order_id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      )
    ) INTO v_request_id;
    
    RAISE NOTICE 'PDF generation invoked for order % (request_id: %)', p_order_id, v_request_id;
  ELSE
    RAISE WARNING 'Cannot auto-invoke PDF generation: Missing SUPABASE_URL or SERVICE_ROLE_KEY in vault';
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  RAISE WARNING 'Failed to invoke PDF generation for order %: %', p_order_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a trigger function that queues AND invokes PDF generation
CREATE OR REPLACE FUNCTION queue_pdf_generation()
RETURNS TRIGGER AS $$
DECLARE
  all_results_approved BOOLEAN;
  order_lab_id UUID;
  v_job_id UUID;
BEGIN
  -- Check if all results for this order are verified
  SELECT 
    COUNT(*) = COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) AND COUNT(*) > 0
  INTO all_results_approved
  FROM results
  WHERE order_id = NEW.order_id;

  -- Get lab_id from the order
  SELECT lab_id INTO order_lab_id
  FROM orders
  WHERE id = NEW.order_id;

  -- If all results approved and we have lab context
  IF all_results_approved AND order_lab_id IS NOT NULL THEN

    -- Insert job into queue (ON CONFLICT DO NOTHING to avoid duplicates)
    INSERT INTO pdf_generation_queue (order_id, lab_id, status, priority)
    VALUES (NEW.order_id, order_lab_id, 'pending', 0)
    ON CONFLICT (order_id) DO NOTHING
    RETURNING id INTO v_job_id;

    -- Only invoke if we actually inserted a new job (not a duplicate)
    IF v_job_id IS NOT NULL THEN
      -- Update order status
      UPDATE orders
      SET report_generation_status = 'queued'
      WHERE id = NEW.order_id;

      -- Auto-invoke the edge function via pg_net
      PERFORM invoke_pdf_generation(NEW.order_id);
      
      RAISE NOTICE 'PDF generation queued and invoked for order: %', NEW.order_id;
    ELSE
      RAISE NOTICE 'PDF job already exists for order: % (skipping duplicate)', NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Alternative: Create a separate trigger on pdf_generation_queue INSERT
-- This is a backup mechanism in case the above doesn't work
CREATE OR REPLACE FUNCTION on_pdf_job_inserted()
RETURNS TRIGGER AS $$
BEGIN
  -- Only invoke for new pending jobs
  IF NEW.status = 'pending' THEN
    PERFORM invoke_pdf_generation(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_invoke_pdf_on_queue ON pdf_generation_queue;

-- Create trigger on pdf_generation_queue INSERT
CREATE TRIGGER trigger_invoke_pdf_on_queue
AFTER INSERT ON pdf_generation_queue
FOR EACH ROW
EXECUTE FUNCTION on_pdf_job_inserted();

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION invoke_pdf_generation(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION on_pdf_job_inserted() TO service_role;

-- 6. Add vault secrets (run these manually in Supabase Dashboard > SQL Editor)
-- Replace with your actual values:
/*
-- Store Supabase URL in vault
SELECT vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'SUPABASE_URL');

-- Store Service Role Key in vault (KEEP THIS SECRET!)
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
*/

COMMENT ON FUNCTION invoke_pdf_generation(UUID) IS 'Invokes the generate-pdf-letterhead edge function via pg_net HTTP call';
COMMENT ON FUNCTION on_pdf_job_inserted() IS 'Trigger function that auto-invokes PDF generation when a job is inserted into the queue';
COMMENT ON TRIGGER trigger_invoke_pdf_on_queue ON pdf_generation_queue IS 'Auto-invokes PDF generation edge function when a new job is queued';
