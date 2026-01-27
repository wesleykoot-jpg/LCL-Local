-- Safe cleanup: conditional and dynamic drops for scraper artifacts
-- This script is idempotent and will attempt to remove known
-- scraper tables, functions, triggers and the `scraper` schema.
-- It uses dynamic SQL to safely drop functions by signature.

-- Drop tables (public + schema-qualified)
DROP TABLE IF EXISTS public.scraper_sources CASCADE;
DROP TABLE IF EXISTS public.scraper_sources_archive CASCADE;
DROP TABLE IF EXISTS public.scrape_jobs CASCADE;
DROP TABLE IF EXISTS public.raw_event_staging CASCADE;
DROP TABLE IF EXISTS public.scraper_insights CASCADE;
DROP TABLE IF EXISTS public.staged_events CASCADE;
DROP TABLE IF EXISTS public.raw_events CASCADE;
DROP TABLE IF EXISTS public.raw_pages CASCADE;
DROP TABLE IF EXISTS public.pipeline_jobs CASCADE;
DROP TABLE IF EXISTS public.discovery_jobs CASCADE;
DROP TABLE IF EXISTS public.scrape_events CASCADE;
DROP TABLE IF EXISTS public.scraper_runs CASCADE;
DROP TABLE IF EXISTS public.scraper_failures CASCADE;
DROP TABLE IF EXISTS public.error_logs CASCADE;
DROP TABLE IF EXISTS public.dead_letter_queue CASCADE;
DROP TABLE IF EXISTS public.circuit_breaker_state CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.embedding_queue CASCADE;
DROP TABLE IF EXISTS public.geocode_cache CASCADE;
DROP TABLE IF EXISTS public.cities CASCADE;
DROP TABLE IF EXISTS public.enrichment_logs CASCADE;
DROP TABLE IF EXISTS public.net_http_responses_audit CASCADE;
DROP TABLE IF EXISTS public.app_secrets CASCADE;

-- Drop triggers safely (check table exists first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname='scrape_jobs' AND n.nspname='public') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS update_scrape_jobs_updated_at ON public.scrape_jobs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname='raw_event_staging' AND n.nspname='public') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_processing_timestamp_trigger ON public.raw_event_staging';
    EXECUTE 'DROP TRIGGER IF EXISTS update_raw_event_timestamp ON public.raw_event_staging';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname='scraper_sources' AND n.nspname='public') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS scraper_sources_updated_at ON public.scraper_sources';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE c.relname='events' AND n.nspname='public') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS queue_embedding_on_event_insert ON public.events';
    EXECUTE 'DROP TRIGGER IF EXISTS queue_embedding_on_event_update ON public.events';
  END IF;
END
$$;

-- Drop functions by searching pg_proc and executing DROP by signature
DO $$
DECLARE
  fn RECORD;
  names TEXT[] := ARRAY[
    'trigger_scrape_coordinator', 'update_scraper_source_stats', 'get_pipeline_health',
    'get_scraper_stats', 'get_recent_scraper_runs', 'reset_stuck_scrape_jobs', 'log_scraper_insight',
    'enqueue_scrape_jobs', 'claim_scrape_jobs', 'cleanup_old_scrape_jobs', 'recover_stuck_scrape_jobs'
  ];
BEGIN
  FOR fn IN SELECT oid::regprocedure AS qname FROM pg_proc JOIN pg_namespace n ON pg_proc.pronamespace=n.oid WHERE pg_proc.proname = ANY(names) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.qname::text);
  END LOOP;
END$$;

-- Remove `scraper` schema if empty/exists
DROP SCHEMA IF EXISTS scraper CASCADE;

-- Remove scraper-specific columns from `events` safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='source_id') THEN
    ALTER TABLE public.events DROP COLUMN IF EXISTS source_id;
  END IF;
  ALTER TABLE public.events DROP COLUMN IF EXISTS scraped_at;
  ALTER TABLE public.events DROP COLUMN IF EXISTS scraper_source_id;
  ALTER TABLE public.events DROP COLUMN IF EXISTS raw_event_id;
  ALTER TABLE public.events DROP COLUMN IF EXISTS extraction_method;
  ALTER TABLE public.events DROP COLUMN IF EXISTS confidence_score;
  ALTER TABLE public.events DROP COLUMN IF EXISTS event_fingerprint;
  ALTER TABLE public.events DROP COLUMN IF EXISTS parsing_method;
  ALTER TABLE public.events DROP COLUMN IF EXISTS quality_score;
  ALTER TABLE public.events DROP COLUMN IF EXISTS quality_issues;
  ALTER TABLE public.events DROP COLUMN IF EXISTS quality_checked_at;
  ALTER TABLE public.events DROP COLUMN IF EXISTS data_completeness;
  ALTER TABLE public.events DROP COLUMN IF EXISTS needs_enrichment;
  ALTER TABLE public.events DROP COLUMN IF EXISTS enrichment_status;
  ALTER TABLE public.events DROP COLUMN IF EXISTS last_enriched_at;
EXCEPTION WHEN undefined_table THEN
  -- events table doesn't exist or other issue; ignore
  NULL;
END$$;

-- Clean pg_cron jobs if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM (SELECT cron.jobid FROM cron.job LIMIT 1);
    DELETE FROM cron.job WHERE jobname LIKE '%scrape%';
    DELETE FROM cron.job WHERE jobname LIKE '%pipeline%';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END$$;

-- Final check: list remaining scraper-like tables (for manual review)
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND (table_name ILIKE '%scrap%' OR table_name ILIKE '%pipeline%' OR table_name ILIKE '%scraper%');
