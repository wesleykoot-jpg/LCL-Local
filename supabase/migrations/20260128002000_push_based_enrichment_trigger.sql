-- Migration: Convert to Push-Based Enrichment Architecture
-- 
-- Changes from "Pull" model (Worker polling DB) to "Push" model (DB triggering Worker)
-- 
-- Current Flow (Legacy): Scraper -> DB (Pending) -> Cron (Every 5m) -> process-worker -> aiParsing.ts -> DB (Processed)
-- Target Flow (Waterfall): Scraper -> DB (Insert) -> Trigger (Immediate) -> enrichment-worker -> waterfallV2.ts -> DB (Processed)

-- =============================================================================
-- PHASE 1: Create HTTP Request Function for Trigger
-- =============================================================================

-- Enable the pg_net extension for async HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

/**
 * Function to trigger the enrichment-worker via HTTP POST
 * 
 * This function sends a Database Webhook payload to the enrichment-worker Edge Function.
 * It uses pg_net for async HTTP to avoid blocking the INSERT transaction.
 * 
 * Payload Structure: { "record": <new row data> }
 * Security: Uses service role key for Authorization header
 */
CREATE OR REPLACE FUNCTION public.trigger_enrichment_worker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get configuration from app settings
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_role_key := current_setting('app.supabase_service_role_key', true);
  
  -- Fallback to env vars if app settings not available
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    v_supabase_url := current_setting('supabase.url', true);
  END IF;
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    v_service_role_key := current_setting('supabase.service_role_key', true);
  END IF;
  
  -- Only trigger for rows entering awaiting_enrichment status
  IF NEW.pipeline_status = 'awaiting_enrichment' THEN
    -- Use pg_net for async HTTP POST to enrichment-worker
    SELECT extensions.http_post(
      url := v_supabase_url || '/functions/v1/enrichment-worker',
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'raw_event_staging',
        'schema', 'public',
        'record', jsonb_build_object(
          'id', NEW.id,
          'source_id', NEW.source_id,
          'source_url', NEW.source_url,
          'detail_url', NEW.detail_url,
          'title', NEW.title,
          'raw_html', NEW.raw_html,
          'pipeline_status', NEW.pipeline_status::TEXT,
          'created_at', NEW.created_at
        ),
        'old_record', NULL
      ),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_role_key,
        'Content-Type', 'application/json'
      ),
      timeout_milliseconds := 5000
    ) INTO v_request_id;
    
    RAISE NOTICE '[Enrichment Trigger] Queued HTTP request % for event %', v_request_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_enrichment_worker() TO service_role;

-- =============================================================================
-- PHASE 2: Create Trigger on Staging Table
-- =============================================================================

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS tr_enrichment_webhook ON public.raw_event_staging;

-- Create the trigger for new inserts with awaiting_enrichment status
-- Also fires on UPDATE to catch status transitions to awaiting_enrichment
CREATE TRIGGER tr_enrichment_webhook
  AFTER INSERT OR UPDATE OF pipeline_status
  ON public.raw_event_staging
  FOR EACH ROW
  WHEN (NEW.pipeline_status = 'awaiting_enrichment')
  EXECUTE FUNCTION public.trigger_enrichment_worker();

COMMENT ON TRIGGER tr_enrichment_webhook ON public.raw_event_staging IS 
  'Push-based trigger: Immediately invokes enrichment-worker when row enters awaiting_enrichment status';

-- =============================================================================
-- PHASE 3: Unschedule Legacy Cron Job
-- =============================================================================

-- Remove the process-worker-cron job (if it exists)
-- Using DO block for safety (handles case where job doesn't exist)
DO $$
DECLARE
  v_cron_schema TEXT;
BEGIN
  -- Check if pg_cron is installed
  SELECT n.nspname INTO v_cron_schema
  FROM pg_extension e
  JOIN pg_namespace n ON e.extnamespace = n.oid
  WHERE e.extname = 'pg_cron';
  
  IF v_cron_schema IS NOT NULL THEN
    -- Unschedule the legacy process-worker-cron job
    BEGIN
      PERFORM cron.unschedule('process-worker-cron');
      RAISE NOTICE 'Successfully unscheduled process-worker-cron job';
    EXCEPTION
      WHEN undefined_function THEN
        RAISE NOTICE 'cron.unschedule not available - skipping';
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not unschedule process-worker-cron: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron extension not installed - skipping cron cleanup';
  END IF;
END;
$$;

-- =============================================================================
-- PHASE 4: Add Helper View for Monitoring Push-Based Pipeline
-- =============================================================================

CREATE OR REPLACE VIEW public.enrichment_trigger_status AS
SELECT 
  COUNT(*) FILTER (WHERE pipeline_status = 'awaiting_enrichment') as pending_enrichment,
  COUNT(*) FILTER (WHERE pipeline_status = 'enriching') as currently_enriching,
  COUNT(*) FILTER (WHERE pipeline_status = 'ready_to_index') as ready_to_index,
  COUNT(*) FILTER (WHERE pipeline_status = 'failed' AND enrichment_attempts >= 3) as failed_permanently,
  (
    SELECT COUNT(*) 
    FROM extensions.http_request_queue 
    WHERE url LIKE '%enrichment-worker%' 
      AND status = 'pending'
  ) as pending_http_requests
FROM public.raw_event_staging;

COMMENT ON VIEW public.enrichment_trigger_status IS 
  'Monitor the push-based enrichment pipeline: pending work and HTTP queue status';

-- =============================================================================
-- VERIFICATION: Test the trigger exists
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_enrichment_webhook' 
      AND tgrelid = 'public.raw_event_staging'::regclass
  ) THEN
    RAISE EXCEPTION 'Trigger tr_enrichment_webhook was not created successfully';
  END IF;
  RAISE NOTICE '✓ Push-based enrichment trigger successfully installed';
END;
$$;
