CREATE EXTENSION IF NOT EXISTS pg_cron;

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

  IF v_supabase_url IS NOT NULL THEN
    -- Normalize and validate format
    v_supabase_url := trim(both ' ' from v_supabase_url);
    v_supabase_url := regexp_replace(v_supabase_url, '/+$', '');

    IF v_supabase_url !~* '^https?://[A-Za-z0-9.-]+(:\\d+)?(/[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]*)?$' THEN
      RAISE EXCEPTION 'Supabase URL not configured correctly for scrape coordinator';
    END IF;
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
  v_cron_schema text;
  v_job_id integer;
BEGIN
  SELECT n.nspname INTO v_cron_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_cron';

  IF v_cron_schema IS NULL THEN
    RAISE EXCEPTION 'pg_cron extension not available';
  END IF;

  EXECUTE format('SELECT jobid FROM %I.job WHERE jobname = $1', v_cron_schema)
    INTO v_job_id
    USING 'daily-scrape-coordinator';

  IF v_job_id IS NULL THEN
    EXECUTE format('SELECT %I.schedule($1, $2, $3)', v_cron_schema)
      USING 'daily-scrape-coordinator', '0 3 * * *', 'SELECT public.trigger_scrape_coordinator()';
  ELSE
    EXECUTE format('SELECT %I.alter_job(jobid := $1, schedule := $2, active := true)', v_cron_schema)
      USING v_job_id, '0 3 * * *';
  END IF;
END;
$$;
