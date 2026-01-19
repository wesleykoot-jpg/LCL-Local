-- Migration: Scrape job cleanup and recovery
-- Description: Adds procedures to delete old jobs and recover stuck processing jobs.

-- Function to cleanup old jobs
CREATE OR REPLACE FUNCTION public.cleanup_old_scrape_jobs(p_retention_days integer DEFAULT 3)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.scrape_jobs
  WHERE (status = 'completed' OR status = 'failed')
    AND completed_at < (now() - (p_retention_days || ' days')::interval);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- Function to recover stuck jobs
CREATE OR REPLACE FUNCTION public.recover_stuck_scrape_jobs(p_timeout_minutes integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recovered_count integer;
BEGIN
  UPDATE public.scrape_jobs
  SET status = 'pending',
      started_at = NULL,
      error_message = COALESCE(error_message, '') || ' [Recovered from stuck processing]'
  WHERE status = 'processing'
    AND started_at < (now() - (p_timeout_minutes || ' minutes')::interval);
  
  GET DIAGNOSTICS v_recovered_count = ROW_COUNT;
  RETURN v_recovered_count;
END;
$$;

-- Schedule maintenance via pg_cron if enabled
-- Note: We wrap in a DO block to avoid errors if pg_cron is not initialized in the current environment
DO $$
DECLARE
  v_cron_schema text;
BEGIN
  SELECT n.nspname INTO v_cron_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_cron';

  IF v_cron_schema IS NOT NULL THEN
    -- Run cleanup daily at 4:00 AM
    PERFORM cron.schedule(
      'cleanup-old-scrape-jobs',
      '0 4 * * *',
      'SELECT public.cleanup_old_scrape_jobs(3)'
    );
    
    -- Run recovery every 30 minutes
    PERFORM cron.schedule(
      'recover-stuck-scrape-jobs',
      '*/30 * * * *',
      'SELECT public.recover_stuck_scrape_jobs(30)'
    );
  END IF;
END;
$$;
