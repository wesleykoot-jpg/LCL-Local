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
        started_at = NULL
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
        started_at = NULL
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

-- 5. Audit Logging for pg_net (Recommended by Supabase AI)
CREATE TABLE IF NOT EXISTS public.net_http_responses_audit (
    id bigserial PRIMARY KEY,
    request_id uuid,
    status integer,
    url text,
    method text,
    headers jsonb,
    body jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    duration_ms integer,
    created_at timestamptz DEFAULT now()
);

-- Polling function to archive net responses
CREATE OR REPLACE FUNCTION public.poll_net_http_responses_audit(p_since interval DEFAULT '5 minutes') 
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    -- Check if net._http_response exists (it should if pg_net is enabled)
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '_http_response' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'net')) THEN
        RETURN 0;
    END IF;

    WITH moved_rows AS (
        SELECT 
            id, request_id, status, url, method, headers, body, started_at, completed_at,
            EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000 AS duration_ms
        FROM net._http_response
        WHERE started_at >= now() - p_since
    ),
    inserted AS (
        INSERT INTO public.net_http_responses_audit 
        (request_id, status, url, method, headers, body, started_at, completed_at, duration_ms)
        SELECT request_id, status, url, method, headers, body, started_at, completed_at, duration_ms
        FROM moved_rows
        ON CONFLICT DO NOTHING -- Avoid duplicates if running overlapping
        RETURNING id
    )
    SELECT count(*) INTO v_count FROM inserted;

    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.poll_net_http_responses_audit(interval) TO postgres;
GRANT EXECUTE ON FUNCTION public.poll_net_http_responses_audit(interval) TO service_role;


-- 6. Schedule cron jobs
-- Note: 'postgres' database is usually where pg_cron runs in Supabase
-- If pg_cron is not enabled on this DB, these calls might fail or be ignored.

-- 6a. Poll Audit Logs (Every 5 mins)
SELECT cron.schedule(
  'poll_net_audit',
  '*/5 * * * *',
  $$SELECT public.poll_net_http_responses_audit('5 minutes'::interval)$$
);

-- 6b. Cleanup Stuck Jobs (Every 30 mins)
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
