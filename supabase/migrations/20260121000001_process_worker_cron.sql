-- Supabase Cron Job Setup for ELT Pipeline
-- Run this SQL to schedule automatic process-worker invocation

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create a cron job that triggers process-worker every 5 minutes
SELECT cron.schedule(
  'process-worker-cron',  -- job name
  '*/5 * * * *',          -- every 5 minutes
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/process-worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job;
