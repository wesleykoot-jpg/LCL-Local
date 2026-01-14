-- Enable pg_net extension for HTTP calls from PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a function to trigger the scrape-coordinator edge function
CREATE OR REPLACE FUNCTION public.trigger_scrape_coordinator()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/scrape-coordinator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"triggerWorker": true}'::jsonb
  );
END;
$$;

-- Schedule the scraper to run daily at 03:00 UTC
SELECT cron.schedule(
  'daily-scrape-coordinator',
  '0 3 * * *',
  $$SELECT public.trigger_scrape_coordinator()$$
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.trigger_scrape_coordinator() TO postgres;
GRANT EXECUTE ON FUNCTION public.trigger_scrape_coordinator() TO service_role;