-- Ensure pg_cron extension is available for scheduling
CREATE SCHEMA IF NOT EXISTS cron;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- Harden trigger to fall back to app.settings when app_secrets is empty
CREATE OR REPLACE FUNCTION public.trigger_scrape_coordinator()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_role_key text;
  v_supabase_url text;
BEGIN
  -- Primary: read from app_secrets (preferred secure storage)
  SELECT value INTO v_service_role_key
  FROM app_secrets
  WHERE key = 'service_role_key';

  -- Fallback: use database setting populated by Supabase (backward compatibility)
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    v_service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE EXCEPTION 'Service role key not configured for scrape coordinator';
  END IF;

  -- Resolve Supabase URL (prefer app.settings, fallback to app_secrets)
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    SELECT value INTO v_supabase_url
    FROM app_secrets
    WHERE key = 'supabase_url';
  END IF;

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE EXCEPTION 'Supabase URL not configured for scrape coordinator';
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/scrape-coordinator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('triggerWorker', true)
  );
END;
$$;

-- Reactivate or create the daily scheduler (03:00 UTC)
DO $$
DECLARE
  v_job_id integer;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'daily-scrape-coordinator';

  IF v_job_id IS NULL THEN
    PERFORM cron.schedule(
      'daily-scrape-coordinator',
      '0 3 * * *',
      $$SELECT public.trigger_scrape_coordinator()$$
    );
  ELSE
    PERFORM cron.alter_job(
      jobid := v_job_id,
      schedule := '0 3 * * *',
      active := true
    );
  END IF;
END;
$$;
