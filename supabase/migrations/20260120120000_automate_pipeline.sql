-- Migration: Automate Pipeline with pg_cron and Self-Healing
-- Description: Enables pg_cron/pg_net, adds cleanup functions for stuck jobs, and schedules periodic triggers.

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create self-healing function for stuck scrape jobs
CREATE OR REPLACE FUNCTION public.reset_stuck_scrape_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stuck_limit interval := '1 hour';
  v_reset_count int;
  v_failed_count int;
BEGIN
  -- Reset jobs that are 'processing' for too long, if they have retries left
  WITH stuck AS (
    SELECT id
    FROM public.scrape_jobs
    WHERE status = 'processing'
      AND started_at < (now() - v_stuck_limit)
      AND attempts < max_attempts
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.scrape_jobs
    SET status = 'pending',
        started_at = NULL,
        worker_id = NULL
    WHERE id IN (SELECT id FROM stuck)
    RETURNING id
  )
  SELECT count(*) INTO v_reset_count FROM updated;

  -- Fail jobs that are 'processing' for too long and have NO retries left
  WITH stuck_failed AS (
    SELECT id
    FROM public.scrape_jobs
    WHERE status = 'processing'
      AND started_at < (now() - v_stuck_limit)
      AND attempts >= max_attempts
    FOR UPDATE SKIP LOCKED
  ),
  updated_val AS (
    UPDATE public.scrape_jobs
    SET status = 'failed',
        error_message = 'Job timed out and exceeded max attempts',
        completed_at = now()
    WHERE id IN (SELECT id FROM stuck_failed)
    RETURNING id
  )
  SELECT count(*) INTO v_failed_count FROM updated_val;

  IF v_reset_count > 0 OR v_failed_count > 0 THEN
    RAISE NOTICE 'Self-healing: Reset % stuck jobs, Failed % timed-out jobs', v_reset_count, v_failed_count;
  END IF;
END;
$$;

-- 3. Create self-healing function for discovery jobs (similar logic)
CREATE OR REPLACE FUNCTION public.reset_stuck_discovery_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stuck_limit interval := '30 minutes';
  v_reset_count int;
BEGIN
  -- Reset discovery jobs stuck in processing
  WITH stuck AS (
    SELECT id
    FROM public.discovery_jobs
    WHERE status = 'processing'
      AND started_at < (now() - v_stuck_limit)
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.discovery_jobs
    SET status = 'pending',
        started_at = NULL,
        worker_id = NULL
    WHERE id IN (SELECT id FROM stuck)
    RETURNING id
  )
  SELECT count(*) INTO v_reset_count FROM updated;

  IF v_reset_count > 0 THEN
    RAISE NOTICE 'Self-healing: Reset % stuck discovery jobs', v_reset_count;
  END IF;
END;
$$;

-- 4. Helper function to invoke Edge Functions safely via pg_net
CREATE OR REPLACE FUNCTION public.invoke_edge_function(
  p_function_name text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Hardcoded for simplicity based on current project knowledge.
  -- Ideally, this should be a config table or secret.
  v_base_url text := 'https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1';
  v_url text;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA';
  v_request_id int;
BEGIN
  v_url := v_base_url || '/' || p_function_name;
  
  -- Use pg_net to make the async call
  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key
    ),
    body := p_payload
  ) INTO v_request_id;
  
  -- RAISE NOTICE 'Invoked % with ID %', v_url, v_request_id;
END;
$$;

-- 5. Schedule cron jobs
-- Note: 'postgres' database is usually where pg_cron runs in Supabase
-- If pg_cron is not enabled on this DB, these calls might fail or be ignored.

-- 5a. Cleanup Stuck Jobs (Every 30 mins)
SELECT cron.schedule(
  'cleanup-stuck-jobs',
  '*/30 * * * *',
  $$SELECT public.reset_stuck_scrape_jobs(), public.reset_stuck_discovery_jobs()$$
);

-- 5b. Invoke Coordinator (Every hour at minute 0)
SELECT cron.schedule(
  'invoke-coordinator',
  '0 * * * *',
  $$SELECT public.invoke_edge_function('scrape-coordinator', '{"triggerWorker": true}'::jsonb)$$
);

-- 5c. Invoke Worker (Every 5 minutes to process any pending queue + new items)
-- This ensures that even if coordinator didn't trigger it, or it failed, we retry.
SELECT cron.schedule(
  'invoke-worker-watchdog',
  '*/5 * * * *',
  $$SELECT public.invoke_edge_function('scrape-worker', '{"enableDeepScraping": true}'::jsonb)$$
);

-- 5d. Discovery Coordinator (Daily at 03:00 AM)
SELECT cron.schedule(
  'invoke-discovery-coordinator',
  '0 3 * * *',
  $$SELECT public.invoke_edge_function('source-discovery-coordinator')$$
);

-- 5e. Discovery Worker (Every 15 minutes)
SELECT cron.schedule(
  'invoke-discovery-worker',
  '*/15 * * * *',
  $$SELECT public.invoke_edge_function('source-discovery-worker')$$
);
